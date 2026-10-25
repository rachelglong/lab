import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AddRegular, SearchRegular } from "@fluentui/react-icons"
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
  Select,
} from "@fluentui/react-components"
import { useNavigate } from "react-router-dom"
import { Lab_warehouseitemsService } from "@/generated"
import { useToast } from "@/hooks/use-toast"
import {
  categoryLabel,
  formatQuantity,
  inventoryQueryKey,
  itemCategories,
  loadItems,
  loadLocations,
  locationQueryKey,
} from "@/warehouse-data"

type ItemDraft = { name: string; sku: string; quantity: string; category: string; locationId: string }
const emptyDraft: ItemDraft = { name: "", sku: "", quantity: "", category: "", locationId: "" }

export default function HomePage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const itemsQuery = useQuery({ queryKey: inventoryQueryKey, queryFn: loadItems })
  const locationsQuery = useQuery({ queryKey: locationQueryKey, queryFn: loadLocations })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const items = itemsQuery.data ?? []
  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase()
    if (!searchTerm) return items
    return items.filter((item) =>
      `${item.lab_name} ${item.lab_sku}`.toLocaleLowerCase().includes(searchTerm),
    )
  }, [items, search])

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim() || !draft.sku.trim() || !draft.quantity || !draft.category) {
      setSubmitError("Fill in all required fields.")
      return
    }

    setSubmitting(true)
    setSubmitError("")
    try {
      const record = {
        lab_name: draft.name.trim(),
        lab_sku: draft.sku.trim(),
        lab_availablequantity: draft.quantity,
        lab_category: Number(draft.category),
        ...(draft.locationId ? { "lab_locationid@odata.bind": `/lab_warehouselocations(${draft.locationId})` } : {}),
      } as Parameters<typeof Lab_warehouseitemsService.create>[0]
      const result = await Lab_warehouseitemsService.create(record)
      if (!result.success) {
        setSubmitError(result.error?.message ?? "The item could not be saved.")
        return
      }
      setDialogOpen(false)
      setDraft(emptyDraft)
      toast.success("Item added.")
      await queryClient.invalidateQueries({ queryKey: inventoryQueryKey })
      await queryClient.invalidateQueries({ queryKey: locationQueryKey })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The item could not be saved.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Warehouse floor</p>
          <h1>Items</h1>
          <p className="page-subtitle">Find stock and record movement from the item detail.</p>
        </div>
        <div className="heading-actions">
          <Button appearance="primary" icon={<AddRegular />} onClick={() => { setSubmitError(""); setDialogOpen(true) }}>
            New item
          </Button>
        </div>
      </div>

      {itemsQuery.isError && <div className="error-state" role="alert">{itemsQuery.error.message}</div>}
      <div className="surface">
        <div className="surface-toolbar">
          <span className="surface-label">Inventory</span>
          <div className="heading-actions">
            <span className="record-count">{items.length} items</span>
            <Input
              aria-label="Search items"
              contentBefore={<SearchRegular />}
              placeholder="Search name or SKU"
              value={search}
              onChange={(_, data) => setSearch(data.value)}
            />
          </div>
        </div>
        {itemsQuery.isLoading ? <div className="loading-state">Loading inventory…</div> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>SKU</th><th>Category</th><th>Location</th><th>Qty on hand</th><th>Unit price</th></tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.lab_warehouseitemid}>
                    <td><button className="item-link" onClick={() => navigate(`/items/${item.lab_warehouseitemid}`)}>{item.lab_name}</button></td>
                    <td className="sku">{item.lab_sku}</td>
                    <td><span className="category-tag">{categoryLabel(item.lab_category, item.lab_categoryname)}</span></td>
                    <td>{item.lab_locationidname || <span className="muted">Unassigned</span>}</td>
                    <td className="qty">{formatQuantity(item.lab_availablequantity)}</td>
                    <td>{item.lab_unitprice ? Number(item.lab_unitprice).toLocaleString(undefined, { style: "currency", currency: "USD" }) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!itemsQuery.isLoading && filteredItems.length === 0 && <div className="empty-state">{items.length ? "No items match this search." : "No warehouse items found."}</div>}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={createItem}>
            <DialogBody>
              <DialogTitle>Add warehouse item</DialogTitle>
              <DialogContent>
                <div className="form-grid">
                  <Field label="Name" required><Input autoFocus value={draft.name} onChange={(_, data) => setDraft({ ...draft, name: data.value })} /></Field>
                  <Field label="SKU" required><Input value={draft.sku} onChange={(_, data) => setDraft({ ...draft, sku: data.value })} /></Field>
                  <Field label="Available quantity" required><Input type="number" min="0" step="1" value={draft.quantity} onChange={(_, data) => setDraft({ ...draft, quantity: data.value })} /></Field>
                  <Field label="Category" required>
                    <Select value={draft.category} onChange={(_, data) => setDraft({ ...draft, category: data.value })}>
                      <option value="">Choose a category</option>
                      {itemCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </Select>
                  </Field>
                  <Field className="full-width" label="Location">
                    <Select value={draft.locationId} onChange={(_, data) => setDraft({ ...draft, locationId: data.value })}>
                      <option value="">No location</option>
                      {(locationsQuery.data ?? []).map((location) => <option key={location.lab_warehouselocationid} value={location.lab_warehouselocationid}>{location.lab_name}</option>)}
                    </Select>
                  </Field>
                  {submitError && <div className="dialog-error full-width" role="alert">{submitError}</div>}
                </div>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button appearance="primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add item"}</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </section>
  )
}

