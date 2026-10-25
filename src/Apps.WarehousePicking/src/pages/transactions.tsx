import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AddRegular } from "@fluentui/react-icons"
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select } from "@fluentui/react-components"
import { Lab_warehousetransactionsService } from "@/generated"
import { useToast } from "@/hooks/use-toast"
import { formatQuantity, inventoryQueryKey, loadItems, loadTransactions, transactionQueryKey } from "@/warehouse-data"

export default function TransactionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [itemId, setItemId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [type, setType] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const transactionsQuery = useQuery({ queryKey: transactionQueryKey, queryFn: loadTransactions })
  const itemsQuery = useQuery({ queryKey: inventoryQueryKey, queryFn: loadItems })
  const queryClient = useQueryClient()
  const toast = useToast()

  async function createTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !itemId || !quantity || !type) {
      setError("Fill in all required fields.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const result = await Lab_warehousetransactionsService.create({
        lab_name: name.trim(),
        lab_quantity: quantity,
        lab_transactiontype: Number(type),
        lab_transactiondate: new Date().toISOString(),
        "lab_itemid@odata.bind": `/lab_warehouseitems(${itemId})`,
      } as Parameters<typeof Lab_warehousetransactionsService.create>[0])
      if (!result.success) {
        setError(result.error?.message ?? "The transaction could not be saved.")
        return
      }
      setName("")
      setItemId("")
      setQuantity("")
      setType("")
      setDialogOpen(false)
      toast.success("Transaction saved.")
      await queryClient.invalidateQueries({ queryKey: transactionQueryKey })
      await queryClient.invalidateQueries({ queryKey: inventoryQueryKey })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The transaction could not be saved.")
    } finally {
      setSubmitting(false)
    }
  }

  const transactions = transactionsQuery.data ?? []
  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">Warehouse floor</p><h1>Transactions</h1><p className="page-subtitle">Review the latest stock movements across all items.</p></div>
        <Button appearance="primary" icon={<AddRegular />} onClick={() => { setError(""); setDialogOpen(true) }}>New transaction</Button>
      </div>
      {transactionsQuery.isError && <div className="error-state" role="alert">{transactionsQuery.error.message}</div>}
      <div className="surface">
        <div className="surface-toolbar"><span className="surface-label">All movements</span><span className="record-count">{transactions.length} transactions</span></div>
        {transactionsQuery.isLoading ? <div className="loading-state">Loading transactions…</div> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Transaction</th><th>Item</th><th>Type</th><th>Quantity</th><th>Date</th><th>Total value</th></tr></thead>
              <tbody>{transactions.map((transaction) => (
                <tr key={transaction.lab_warehousetransactionid}>
                  <td className="record-name">{transaction.lab_name}</td>
                  <td>{transaction.lab_itemidname}</td>
                  <td>{transaction.lab_transactiontypename || (Number(transaction.lab_transactiontype) === 100000000 ? "Inbound" : "Outbound")}</td>
                  <td className="qty">{formatQuantity(transaction.lab_quantity)}</td>
                  <td>{transaction.lab_transactiondate ? new Date(transaction.lab_transactiondate).toLocaleString() : "—"}</td>
                  <td>{transaction.lab_totalvalue ? Number(transaction.lab_totalvalue).toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
            {!transactions.length && <div className="empty-state">No warehouse transactions found.</div>}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface><form onSubmit={createTransaction}><DialogBody>
          <DialogTitle>New transaction</DialogTitle>
          <DialogContent><div className="form-grid">
            <Field label="Name" required><Input autoFocus value={name} onChange={(_, data) => setName(data.value)} /></Field>
            <Field label="Item" required><Select value={itemId} onChange={(_, data) => setItemId(data.value)}><option value="">Choose item</option>{(itemsQuery.data ?? []).map((item) => <option key={item.lab_warehouseitemid} value={item.lab_warehouseitemid}>{item.lab_name} · {item.lab_sku}</option>)}</Select></Field>
            <Field label="Quantity" required><Input type="number" value={quantity} onChange={(_, data) => setQuantity(data.value)} /></Field>
            <Field label="Type" required><Select value={type} onChange={(_, data) => setType(data.value)}><option value="">Choose type</option><option value="100000000">Inbound</option><option value="100000001">Outbound</option></Select></Field>
            {error && <div className="dialog-error full-width" role="alert">{error}</div>}
          </div></DialogContent>
          <DialogActions><Button appearance="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button><Button appearance="primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save transaction"}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>
    </section>
  )
}