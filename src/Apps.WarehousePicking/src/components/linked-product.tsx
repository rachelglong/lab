import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getClient } from "@microsoft/power-apps/data"
import { Lab_productsService, OpenFoodFactsService } from "@/generated"
import { dataSourcesInfo } from "../../.power/schemas/appschemas/dataSourcesInfo"

const dataClient = getClient(dataSourcesInfo)

function imageBlob(value: unknown): Blob {
  if (value instanceof Blob) return value
  if (value instanceof Uint8Array) return new Blob([value as BlobPart], { type: "image/jpeg" })
  if (value instanceof ArrayBuffer) return new Blob([value], { type: "image/jpeg" })
  throw new Error("The image response did not contain file data.")
}

export default function LinkedProduct({ productId }: { productId: string }) {
  const [imageSrc, setImageSrc] = useState("")
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const result = await Lab_productsService.get(productId)
      if (!result.success) throw new Error(result.error?.message ?? "The linked product could not be loaded.")
      return result.data
    },
    enabled: Boolean(productId),
  })
  const imageUrl = productQuery.data?.lab_imageurl

  useEffect(() => {
    let active = true
    let objectUrl = ""
    setImageSrc("")

    async function loadImage() {
      const storedImage = await dataClient.downloadFileFromRecord("lab_products", productId, "lab_productimage")
      if (storedImage.success && storedImage.data.length) {
        if (active) {
          objectUrl = URL.createObjectURL(imageBlob(storedImage.data))
          setImageSrc(objectUrl)
        }
        return
      }
      if (!imageUrl) return

      const remoteImage = await OpenFoodFactsService.GetProductImage(imageUrl)
      if (!remoteImage.success) throw new Error(remoteImage.error?.message ?? "The product image could not be loaded.")
      if (active) {
        objectUrl = URL.createObjectURL(imageBlob(remoteImage.data))
        setImageSrc(objectUrl)
      }
    }

    if (productQuery.data) {
      void loadImage().catch(() => setImageSrc(""))
    }

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl, productId, productQuery.data])

  if (productQuery.isLoading) return <div className="linked-product loading-state">Loading linked product…</div>
  if (productQuery.isError || !productQuery.data) return <div className="error-state" role="alert">{productQuery.error?.message ?? "Linked product not found."}</div>

  const product = productQuery.data
  return (
    <div className="linked-product">
      {imageSrc ? <img src={imageSrc} alt={`${product.lab_name} product`} /> : <div className="linked-product-image-empty">No image</div>}
      <div>
        <p className="eyebrow">Linked product</p>
        <h2>{product.lab_name}</h2>
        {product.lab_brand && <p>{product.lab_brand}</p>}
        <span>{product.lab_quantity || product.lab_ean}</span>
      </div>
    </div>
  )
}