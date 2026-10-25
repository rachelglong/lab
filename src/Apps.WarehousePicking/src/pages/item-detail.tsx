import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRegular, ArrowSyncRegular } from "@fluentui/react-icons"
import { Button, Field, Input, Select } from "@fluentui/react-components"
import { Lab_warehouseitemsService, Lab_warehousetransactionsService } from "@/generated"
import BarcodeScanDialog from "@/components/barcode-scan-dialog"
import LinkedProduct from "@/components/linked-product"
import { useToast } from "@/hooks/use-toast"
import {
  categoryLabel,
  formatQuantity,
  inventoryQueryKey,
  transactionQueryKey,
  unwrapResult,
} from "@/warehouse-data"

export default function ItemDetailPage() {
  const { itemId = "" } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [transactionType, setTransactionType] = useState("")
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const itemQuery = useQuery({
    queryKey: [...inventoryQueryKey, itemId],
    queryFn: async () => unwrapResult(await Lab_warehouseitemsService.get(itemId)),
    enabled: Boolean(itemId),
  })
  const historyQuery = useQuery({
    queryKey: [...transactionQueryKey, itemId],
    queryFn: async () => unwrapResult(await Lab_warehousetransactionsService.getAll({
      filter: `_lab_itemid_value eq ${itemId}`,
      orderBy: ["lab_transactiondate desc"],
    })) ?? [],
    enabled: Boolean(itemId),
  })
  const item = itemQuery.data

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !quantity || !transactionType) {
      setFeedback({ text: "Fill in all required fields.", error: true })
      return
    }

    setSubmitting(true)
    setFeedback(null)
    try {
      const record = {
        lab_name: name.trim(),
        lab_quantity: quantity,
        lab_transactiontype: Number(transactionType),
        lab_transactiondate: new Date().toISOString(),
        "lab_itemid@odata.bind": `/lab_warehouseitems(${itemId})`,
      } as Parameters<typeof Lab_warehousetransactionsService.create>[0]
      const result = await Lab_warehousetransactionsService.create(record)
      if (!result.success) {
        setFeedback({ text: result.error?.message ?? "The transaction could not be saved.", error: true })
        return
      }
      setName("")
      setQuantity("")
      setTransactionType("")
      setFeedback({ text: "Transaction saved.", error: false })
      toast.success("Transaction saved.")
      await queryClient.invalidateQueries({ queryKey: inventoryQueryKey })
      await queryClient.invalidateQueries({ queryKey: [...inventoryQueryKey, itemId] })
      await queryClient.invalidateQueries({ queryKey: transactionQueryKey })
      await queryClient.invalidateQueries({ queryKey: [...transactionQueryKey, itemId] })
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "The transaction could not be saved.", error: true })
    } finally {
      setSubmitting(false)
    }
  }

  if (itemQuery.isLoading) return <div className="loading-state">Loading item…</div>
  if (itemQuery.isError || !item) return <div className="error-state" role="alert">{itemQuery.error?.message ?? "Item not found."}</div>

  return (
    <section>
      <Button className="detail-back" appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => window.history.back()}>
        Back to items
      </Button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Item detail · {item.lab_sku}</p>
          <h1>{item.lab_name}</h1>
          <p className="page-subtitle">{item.lab_description || "Use this screen to pick or receive stock."}</p>
        </div>
        <div className="heading-actions">
          <BarcodeScanDialog
            itemId={itemId}
            currentProductId={item._lab_productid_value}
            onLinked={(imageSaved) => {
              void queryClient.invalidateQueries({ queryKey: [...inventoryQueryKey, itemId] })
              void queryClient.invalidateQueries({ queryKey: ["product", item._lab_productid_value] })
              if (imageSaved) toast.success("Product linked to this item.")
              else toast.warning("Product linked, but the image failed to save.")
            }}
          />
          <Button appearance="secondary" icon={<ArrowSyncRegular />} onClick={() => { void itemQuery.refetch(); void historyQuery.refetch() }}>Refresh</Button>
        </div>
      </div>

      <div className="detail-metrics">
        <div className="metric"><span className="metric-label">Qty on hand</span><span className="metric-value">{formatQuantity(item.lab_availablequantity)}</span></div>
        <div className="metric"><span className="metric-label">Category</span><span className="metric-value">{categoryLabel(item.lab_category, item.lab_categoryname)}</span></div>
        <div className="metric"><span className="metric-label">Location</span><span className="metric-value">{item.lab_locationidname || "Unassigned"}</span></div>
      </div>

      {item._lab_productid_value && <LinkedProduct productId={item._lab_productid_value} />}

      <form className="transaction-form" onSubmit={submitTransaction}>
        <h2 className="transaction-form-heading">Record stock movement</h2>
        <Field label="Transaction name" required><Input value={name} onChange={(_, data) => setName(data.value)} placeholder="e.g. Aisle 4 pick" /></Field>
        <Field label="Quantity" required><Input type="number" value={quantity} onChange={(_, data) => setQuantity(data.value)} /></Field>
        <Field label="Type" required>
          <Select value={transactionType} onChange={(_, data) => setTransactionType(data.value)}>
            <option value="">Choose type</option>
            <option value="100000001">Outbound · Pick</option>
            <option value="100000000">Inbound · Restock</option>
          </Select>
        </Field>
        <Button className="transaction-submit" appearance="primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save movement"}</Button>
        {feedback && <div className={`inline-notice ${feedback.error ? "error" : "success"}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</div>}
      </form>

      <div className="surface" style={{ marginTop: 26 }}>
        <div className="surface-toolbar"><span className="surface-label">Item transactions</span><span className="record-count">{historyQuery.data?.length ?? 0} movements</span></div>
        {historyQuery.isError && <div className="error-state" role="alert">{historyQuery.error.message}</div>}
        {historyQuery.isLoading ? <div className="loading-state">Loading history…</div> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Type</th><th>Quantity</th><th>Date</th><th>Notes</th></tr></thead>
              <tbody>
                {(historyQuery.data ?? []).map((transaction) => (
                  <tr key={transaction.lab_warehousetransactionid}>
                    <td className="record-name">{transaction.lab_name}</td>
                    <td>{transaction.lab_transactiontypename || (Number(transaction.lab_transactiontype) === 100000000 ? "Inbound" : "Outbound")}</td>
                    <td className="qty">{formatQuantity(transaction.lab_quantity)}</td>
                    <td>{transaction.lab_transactiondate ? new Date(transaction.lab_transactiondate).toLocaleString() : "—"}</td>
                    <td>{transaction.lab_notes || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!historyQuery.isLoading && historyQuery.data?.length === 0 && <div className="empty-state">No transactions for this item yet.</div>}
          </div>
        )}
      </div>
    </section>
  )
}