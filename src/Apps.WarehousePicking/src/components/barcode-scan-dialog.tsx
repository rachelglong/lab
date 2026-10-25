import { useEffect, useRef, useState, type FormEvent } from "react"
import { BrowserMultiFormatReader } from "@zxing/browser"
import { AddRegular, CameraRegular, SearchRegular } from "@fluentui/react-icons"
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
} from "@fluentui/react-components"
import { getClient } from "@microsoft/power-apps/data"
import { Lab_productsService, Lab_warehouseitemsService, OpenFoodFactsService } from "@/generated"
import type { OpenFoodFactsModel } from "@/generated"
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo"

type BarcodeScanDialogProps = {
  itemId: string
  currentProductId?: string
  onLinked: (imageSaved: boolean) => void
}

const dataClient = getClient(dataSourcesInfo)

function toImageBlob(value: unknown): Blob {
  if (value instanceof Blob) return value
  if (value instanceof ArrayBuffer) return new Blob([value], { type: "image/jpeg" })
  if (value instanceof Uint8Array) return new Blob([value as BlobPart], { type: "image/jpeg" })
  throw new Error("The image response did not contain file data.")
}

async function getProductImage(imageUrl: string) {
  const result = await OpenFoodFactsService.GetProductImage(imageUrl)
  if (!result.success) throw new Error(result.error?.message ?? "The product image could not be retrieved.")
  return toImageBlob(result.data)
}

export default function BarcodeScanDialog({ itemId, currentProductId, onLinked }: BarcodeScanDialogProps) {
  const [open, setOpen] = useState(false)
  const [barcode, setBarcode] = useState("")
  const [product, setProduct] = useState<OpenFoodFactsModel.Product | null>(null)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [cameraMessage, setCameraMessage] = useState("")
  const [error, setError] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const [linking, setLinking] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (!open || !videoRef.current) return

    let active = true
    const reader = new BrowserMultiFormatReader()
    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" } } },
      videoRef.current,
      (result) => {
        if (!active || !result) return
        setBarcode(result.getText())
        setCameraMessage("Barcode captured. Select Look Up to continue.")
        controlsRef.current?.stop()
      },
    ).then((controls) => {
      controlsRef.current = controls
      if (!active) controls.stop()
    }).catch(() => {
      if (active) setCameraMessage("Camera unavailable. Enter the barcode below.")
    })

    return () => {
      active = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!imageBlob) {
      setPreviewUrl("")
      return
    }
    const url = URL.createObjectURL(imageBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageBlob])

  function showDialog() {
    setBarcode("")
    setProduct(null)
    setImageBlob(null)
    setError("")
    setCameraMessage("")
    setOpen(true)
  }

  async function lookUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = barcode.trim()
    if (!value) {
      setError("Enter or scan a barcode.")
      return
    }

    setLookingUp(true)
    setProduct(null)
    setImageBlob(null)
    setError("")
    try {
      const result = await OpenFoodFactsService.GetProductByBarcode(value)
      if (!result.success) {
        setError(result.error?.message ?? "The product lookup failed.")
        return
      }
      setProduct(result.data)
      if (result.data.imageUrl) {
        try {
          setImageBlob(await getProductImage(result.data.imageUrl))
        } catch {
          setImageBlob(null)
        }
      }
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "The product lookup failed.")
    } finally {
      setLookingUp(false)
    }
  }

  async function linkProduct() {
    if (!product) return

    setLinking(true)
    setError("")
    try {
      const ean = product.ean?.trim() || barcode.trim()
      const escapedEan = ean.replace(/'/g, "''")
      const existing = await Lab_productsService.getAll({ filter: `lab_ean eq '${escapedEan}'`, top: 1 })
      if (!existing.success) {
        setError(existing.error?.message ?? "The product could not be checked.")
        return
      }

      let savedProduct = existing.data[0]
      if (!savedProduct) {
        const created = await Lab_productsService.create({
          lab_name: product.name?.trim() || ean,
          lab_ean: ean,
          ...(product.brand ? { lab_brand: product.brand } : {}),
          ...(product.quantity ? { lab_quantity: product.quantity } : {}),
          ...(product.imageUrl ? { lab_imageurl: product.imageUrl } : {}),
          lab_lastsyncedon: new Date().toISOString(),
        } as Parameters<typeof Lab_productsService.create>[0])
        if (!created.success) {
          setError(created.error?.message ?? "The product could not be saved.")
          return
        }
        savedProduct = created.data
      }

      const linked = await Lab_warehouseitemsService.update(itemId, {
        "lab_productid@odata.bind": `/lab_products(${savedProduct.lab_productid})`,
      })
      if (!linked.success) {
        setError(linked.error?.message ?? "The product could not be linked to this item.")
        return
      }

      let imageSaved = !product.imageUrl
      if (product.imageUrl) {
        try {
          const blob = imageBlob ?? await getProductImage(product.imageUrl)
          const extension = blob.type.toLocaleLowerCase().includes("png") ? "png" : "jpg"
          const upload = await dataClient.uploadFileToRecord(
            "lab_products",
            savedProduct.lab_productid,
            "lab_productimage",
            `${ean}.${extension}`,
            blob,
          )
          imageSaved = upload.success
        } catch {
          imageSaved = false
        }
      }

      onLinked(imageSaved)
      setOpen(false)
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "The product could not be linked.")
    } finally {
      setLinking(false)
    }
  }

  return (
    <>
      <Button appearance="primary" icon={currentProductId ? <CameraRegular /> : <AddRegular />} onClick={showDialog}>
        {currentProductId ? "Rescan Barcode" : "Scan Barcode"}
      </Button>
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Scan product barcode</DialogTitle>
            <DialogContent>
              <div className="barcode-camera">
                <video ref={videoRef} autoPlay muted playsInline aria-label="Barcode camera preview" />
                {!cameraMessage && <span className="barcode-camera-hint">Point the camera at a barcode</span>}
              </div>
              {cameraMessage && <p className="barcode-camera-message" role="status">{cameraMessage}</p>}
              <form className="barcode-lookup-form" onSubmit={lookUp}>
                <Field label="Barcode" required>
                  <Input autoFocus value={barcode} onChange={(_, data) => setBarcode(data.value)} placeholder="Type a barcode" />
                </Field>
                <Button appearance="secondary" icon={<SearchRegular />} type="submit" disabled={lookingUp}>
                  {lookingUp ? "Looking up…" : "Look Up"}
                </Button>
              </form>
              {error && <div className="dialog-error" role="alert">{error}</div>}
              {product && (
                <div className="barcode-product-preview">
                  {previewUrl ? <img src={previewUrl} alt={`${product.name || barcode} product`} /> : <div className="barcode-image-empty">No image preview</div>}
                  <div>
                    <p className="eyebrow">Product match</p>
                    <h3>{product.name || barcode}</h3>
                    <p>{product.brand || "Brand not listed"}</p>
                    <span>{product.quantity || "Quantity not listed"}</span>
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button appearance="primary" disabled={!product || linking} onClick={() => void linkProduct()}>
                {linking ? "Linking…" : "Link to Item"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}