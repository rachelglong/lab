import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AddRegular } from "@fluentui/react-icons"
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input } from "@fluentui/react-components"
import { Lab_warehouselocationsService } from "@/generated"
import { useToast } from "@/hooks/use-toast"
import { inventoryQueryKey, loadItems, loadLocations, locationQueryKey } from "@/warehouse-data"

export default function LocationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [capacity, setCapacity] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const locationsQuery = useQuery({ queryKey: locationQueryKey, queryFn: loadLocations })
  const itemsQuery = useQuery({ queryKey: inventoryQueryKey, queryFn: loadItems })
  const queryClient = useQueryClient()
  const toast = useToast()

  async function createLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !address.trim() || !capacity) {
      setError("Fill in all required fields.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const result = await Lab_warehouselocationsService.create({
        lab_name: name.trim(),
        lab_address: address.trim(),
        lab_capacity: capacity,
      } as Parameters<typeof Lab_warehouselocationsService.create>[0])
      if (!result.success) {
        setError(result.error?.message ?? "The location could not be saved.")
        return
      }
      setName("")
      setAddress("")
      setCapacity("")
      setDialogOpen(false)
      toast.success("Location added.")
      await queryClient.invalidateQueries({ queryKey: locationQueryKey })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The location could not be saved.")
    } finally {
      setSubmitting(false)
    }
  }

  const locations = locationsQuery.data ?? []
  const itemCounts = new Map<string, number>()
  for (const item of itemsQuery.data ?? []) {
    const id = item._lab_locationid_value
    if (id) itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1)
  }

  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">Warehouse floor</p><h1>Locations</h1><p className="page-subtitle">See where stock is stored and how many item records each site holds.</p></div>
        <Button appearance="primary" icon={<AddRegular />} onClick={() => { setError(""); setDialogOpen(true) }}>New location</Button>
      </div>
      {(locationsQuery.isError || itemsQuery.isError) && <div className="error-state" role="alert">{locationsQuery.error?.message ?? itemsQuery.error?.message}</div>}
      <div className="surface">
        <div className="surface-toolbar"><span className="surface-label">Warehouse locations</span><span className="record-count">{locations.length} locations</span></div>
        {locationsQuery.isLoading || itemsQuery.isLoading ? <div className="loading-state">Loading locations…</div> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Location</th><th>Address</th><th>Capacity</th><th>Items held</th></tr></thead>
              <tbody>{locations.map((location) => (
                <tr key={location.lab_warehouselocationid}>
                  <td className="record-name">{location.lab_name}</td>
                  <td>{location.lab_address || <span className="muted">—</span>}</td>
                  <td>{location.lab_capacity || <span className="muted">—</span>}</td>
                  <td className="qty">{itemCounts.get(location.lab_warehouselocationid) ?? 0}</td>
                </tr>
              ))}</tbody>
            </table>
            {!locations.length && <div className="empty-state">No warehouse locations found.</div>}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface><form onSubmit={createLocation}><DialogBody>
          <DialogTitle>Add warehouse location</DialogTitle>
          <DialogContent><div className="form-grid">
            <Field label="Name" required><Input autoFocus value={name} onChange={(_, data) => setName(data.value)} /></Field>
            <Field label="Address" required><Input value={address} onChange={(_, data) => setAddress(data.value)} /></Field>
            <Field label="Capacity" required><Input type="number" value={capacity} onChange={(_, data) => setCapacity(data.value)} /></Field>
            {error && <div className="dialog-error full-width" role="alert">{error}</div>}
          </div></DialogContent>
          <DialogActions><Button appearance="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button><Button appearance="primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add location"}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>
    </section>
  )
}