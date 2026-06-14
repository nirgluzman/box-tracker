import { useMemo, useState } from 'react'
import { useBoxes } from '../hooks/useBoxes'
import { useRooms } from '../hooks/useRooms'
import { boxKey, deleteBox, duplicateKeys, updateBox } from '../data/boxes'
import { downloadBoxesCsv } from '../data/csv'
import { Spinner } from './Spinner'
import type { BoxDoc, RoomDoc } from '../types'

// SPEC 6.3 — Browse. Real-time list, filters, responsive cards/table,
// edit/delete, duplicate-number badge, full-dataset CSV export.
export default function Browse() {
  const { boxes, loading } = useBoxes()
  const { rooms } = useRooms()

  const [roomFilter, setRoomFilter] = useState('all')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dupKeys = useMemo(() => duplicateKeys(boxes), [boxes])

  const filtered = boxes.filter(
    (b) => (roomFilter === 'all' || b.room === roomFilter) && (!urgentOnly || b.urgent),
  )

  async function handleDelete(box: BoxDoc) {
    if (!window.confirm(`Delete Box #${box.boxNumber} (${box.room})? This also removes its photos.`))
      return
    setDeletingId(box.id)
    try {
      await deleteBox(box)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading)
    return (
      <section className="p-4">
        <h2 className="mb-2 text-xl font-semibold">Browse</h2>
        <p className="text-muted">Loading…</p>
      </section>
    )

  return (
    <section className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Browse</h2>
        <span className="text-sm text-muted">{filtered.length} boxes</span>
        <button
          type="button"
          className="btn ml-auto"
          onClick={() => downloadBoxesCsv(boxes)}
          disabled={boxes.length === 0}
        >
          Export CSV
        </button>
      </div>

      {/* Filters (SPEC 6.3) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className="field"
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
        >
          <option value="all">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
          />
          Urgent only
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No boxes match.</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {filtered.map((box) =>
              editingId === box.id ? (
                <li key={box.id}>
                  <EditForm
                    box={box}
                    rooms={rooms}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={box.id}>
                  <BoxCard
                    box={box}
                    duplicate={dupKeys.has(boxKey(box))}
                    deleting={deletingId === box.id}
                    onEdit={() => setEditingId(box.id)}
                    onDelete={() => handleDelete(box)}
                  />
                </li>
              ),
            )}
          </ul>

          {/* Desktop: table */}
          <table className="hidden w-full border-collapse text-left text-sm md:table">
            <thead>
              <tr className="border-b border-edge text-muted">
                <th className="p-2">#</th>
                <th className="p-2">Room</th>
                <th className="p-2">Description</th>
                <th className="p-2">Urgent</th>
                <th className="p-2">Added By</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((box) =>
                editingId === box.id ? (
                  <tr key={box.id} className="border-b border-edge">
                    <td colSpan={6} className="p-2">
                      <EditForm box={box} rooms={rooms} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={box.id} className="border-b border-edge align-top">
                    <td className="p-2 font-semibold tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="size-3 rounded-full"
                          style={{ background: box.roomColor }}
                          aria-hidden="true"
                        />
                        {box.boxNumber}
                      </span>
                      {dupKeys.has(boxKey(box)) && <DuplicateBadge />}
                    </td>
                    <td className="p-2">{box.room}</td>
                    <td className="p-2">{box.description}</td>
                    <td className="p-2">{box.urgent ? 'Yes' : ''}</td>
                    <td className="p-2 text-muted">{box.addedBy}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button type="button" className="btn" onClick={() => setEditingId(box.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn inline-flex items-center gap-2"
                          onClick={() => handleDelete(box)}
                          disabled={deletingId === box.id}
                        >
                          {deletingId === box.id ? <Spinner /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function DuplicateBadge() {
  return (
    <span
      className="ml-1 rounded bg-warn/20 px-1.5 py-0.5 text-xs text-warn"
      title="Duplicate box number in this room"
    >
      ⚠ dup
    </span>
  )
}

function BoxCard({
  box,
  duplicate,
  deleting,
  onEdit,
  onDelete,
}: {
  box: BoxDoc
  duplicate: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="rounded-lg border border-edge bg-surface p-3"
      style={{ borderLeft: `4px solid ${box.roomColor}` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg font-bold tabular-nums">#{box.boxNumber}</span>
        <span className="text-sm text-muted">{box.room}</span>
        {box.urgent && (
          <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">Urgent</span>
        )}
        {duplicate && <DuplicateBadge />}
      </div>
      {box.description && <p className="mb-2 text-sm">{box.description}</p>}
      {box.photoUrls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {box.photoUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="size-16 rounded border border-edge object-cover"
            />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="btn inline-flex items-center gap-2"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? <Spinner /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

function EditForm({ box, rooms, onDone }: { box: BoxDoc; rooms: RoomDoc[]; onDone: () => void }) {
  const [boxNumber, setBoxNumber] = useState(box.boxNumber)
  const [roomName, setRoomName] = useState(box.room)
  const [description, setDescription] = useState(box.description)
  const [urgent, setUrgent] = useState(box.urgent)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      // roomColor follows the picked room; keep existing color if the room was deleted.
      const roomColor = rooms.find((r) => r.name === roomName)?.color ?? box.roomColor
      await updateBox(box.id, { boxNumber, room: roomName, roomColor, description, urgent })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-edge bg-surface p-3">
      <label className="flex items-center gap-2 text-sm">
        Box #
        <input
          type="number"
          className="field w-28"
          value={boxNumber}
          onChange={(e) => setBoxNumber(Number(e.target.value))}
        />
      </label>
      <select className="field" value={roomName} onChange={(e) => setRoomName(e.target.value)}>
        {/* Include the box's current room even if it was since deleted. */}
        {!rooms.some((r) => r.name === roomName) && <option value={roomName}>{roomName}</option>}
        {rooms.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
      <textarea
        className="field min-h-20"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
        />
        Urgent
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary inline-flex items-center gap-2"
          onClick={save}
          disabled={busy}
        >
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            'Save'
          )}
        </button>
        <button type="button" className="btn" onClick={onDone} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}
