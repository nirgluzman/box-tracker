import { type ChangeEvent, Fragment, useMemo, useState } from 'react'
import { useBoxes } from '../hooks/useBoxes'
import { useRooms } from '../hooks/useRooms'
import { useOnline } from '../hooks/useOnline'
import { addBoxPhoto, boxKey, deleteBox, duplicateKeys, removeBoxPhoto, updateBox } from '../data/boxes'
import { downloadBoxesCsv } from '../data/csv'
import { Spinner } from './Spinner'
import { PhotoThumbs } from './PhotoThumbs'
import { PencilIcon, TrashIcon } from './icons'
import type { BoxDoc, RoomDoc } from '../types'

// SPEC 6.3 — Browse. Real-time list, filters, responsive cards/table,
// edit/delete, duplicate-number badge, full-dataset CSV export.
export default function Browse() {
  const { boxes, loading } = useBoxes()
  const { rooms } = useRooms()

  const [roomSel, setRoomSel] = useState<string[]>([]) // empty = all rooms
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [groupByRoom, setGroupByRoom] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dupKeys = useMemo(() => duplicateKeys(boxes), [boxes])

  const filtered = useMemo(
    () =>
      boxes.filter(
        (b) => (roomSel.length === 0 || roomSel.includes(b.room)) && (!urgentOnly || b.urgent),
      ),
    [boxes, roomSel, urgentOnly],
  )

  const toggleRoom = (name: string) =>
    setRoomSel((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))

  // When grouping, split into room sections ordered by rangeStart (deleted-room
  // names fall to the end). Otherwise a single unlabeled group keeps the flat list.
  const groups = useMemo(() => {
    if (!groupByRoom) return [{ room: null as string | null, color: '', boxes: filtered }]
    const order = new Map(rooms.map((r) => [r.name, r.rangeStart]))
    const map = new Map<string, BoxDoc[]>()
    for (const b of filtered) {
      const arr = map.get(b.room) ?? []
      arr.push(b)
      map.set(b.room, arr)
    }
    return [...map.entries()]
      .sort(
        (a, b) =>
          (order.get(a[0]) ?? Infinity) - (order.get(b[0]) ?? Infinity) ||
          a[0].localeCompare(b[0]),
      )
      .map(([room, list]) => ({ room: room as string | null, color: list[0].roomColor, boxes: list }))
  }, [groupByRoom, filtered, rooms])

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

      {/* Filters (SPEC 6.3) — select one or more rooms; none = all. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRoomSel([])}
          aria-pressed={roomSel.length === 0}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            roomSel.length === 0 ? 'border-accent bg-accent/15 font-semibold' : 'border-edge'
          }`}
        >
          All
        </button>
        {rooms.map((r) => {
          const on = roomSel.includes(r.name)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRoom(r.name)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                on ? 'border-accent bg-accent/15 font-semibold' : 'border-edge'
              }`}
            >
              <span
                className="size-3 rounded-full"
                style={{ background: r.color }}
                aria-hidden="true"
              />
              {r.name}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
          />
          Urgent only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={groupByRoom}
            onChange={(e) => setGroupByRoom(e.target.checked)}
          />
          Group by room
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No boxes match.</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {groups.map((g) => (
              <Fragment key={g.room ?? 'all'}>
                {g.room && (
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: g.color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold">{g.room}</span>
                    <span className="text-xs text-muted">{g.boxes.length}</span>
                  </div>
                )}
                {g.boxes.map((box) =>
                  editingId === box.id ? (
                    <EditForm key={box.id} box={box} rooms={rooms} onDone={() => setEditingId(null)} />
                  ) : (
                    <BoxCard
                      key={box.id}
                      box={box}
                      duplicate={dupKeys.has(boxKey(box))}
                      deleting={deletingId === box.id}
                      onEdit={() => setEditingId(box.id)}
                      onDelete={() => handleDelete(box)}
                    />
                  ),
                )}
              </Fragment>
            ))}
          </div>

          {/* Desktop: table */}
          <table className="hidden w-full border-collapse text-left text-sm md:table">
            <thead>
              <tr className="border-b border-edge text-muted">
                <th className="p-2">#</th>
                <th className="p-2">Packing #</th>
                <th className="p-2">Room</th>
                <th className="p-2">Description</th>
                <th className="p-2">Urgent</th>
                <th className="p-2">Added By</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.room ?? 'all'}>
                  {g.room && (
                    <tr className="bg-surface-2">
                      <td colSpan={7} className="p-2 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ background: g.color }}
                            aria-hidden="true"
                          />
                          {g.room}
                          <span className="text-xs text-muted">({g.boxes.length})</span>
                        </span>
                      </td>
                    </tr>
                  )}
                  {g.boxes.map((box) =>
                    editingId === box.id ? (
                      <tr key={box.id} className="border-b border-edge">
                        <td colSpan={7} className="p-2">
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
                        <td className="p-2 tabular-nums text-muted">{box.packingNumber || ''}</td>
                        <td className="p-2">{box.room}</td>
                        <td className="p-2">{box.description}</td>
                        <td className="p-2">{box.urgent ? 'Yes' : ''}</td>
                        <td className="p-2 text-muted">{box.addedBy}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn px-3"
                              onClick={() => setEditingId(box.id)}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              className="btn px-3"
                              onClick={() => handleDelete(box)}
                              disabled={deletingId === box.id}
                              aria-label="Delete"
                              title="Delete"
                            >
                              {deletingId === box.id ? <Spinner /> : <TrashIcon />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </Fragment>
              ))}
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
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold tabular-nums">#{box.boxNumber}</span>
        <span className="text-sm text-muted">{box.room}</span>
        {box.packingNumber && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
            Pkg #{box.packingNumber}
          </span>
        )}
        {box.urgent && (
          <span className="rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">Urgent</span>
        )}
        {duplicate && <DuplicateBadge />}
      </div>
      {box.description && <p className="mb-2 text-sm">{box.description}</p>}
      {box.photoUrls.length > 0 && (
        <div className="mb-2">
          <PhotoThumbs urls={box.photoUrls} />
        </div>
      )}
      <p className="mb-2 text-xs text-muted">Added by {box.addedBy}</p>
      <div className="flex gap-2">
        <button type="button" className="btn px-3" onClick={onEdit} aria-label="Edit" title="Edit">
          <PencilIcon />
        </button>
        <button
          type="button"
          className="btn px-3"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete"
          title="Delete"
        >
          {deleting ? <Spinner /> : <TrashIcon />}
        </button>
      </div>
    </div>
  )
}

function EditForm({ box, rooms, onDone }: { box: BoxDoc; rooms: RoomDoc[]; onDone: () => void }) {
  const [boxNumber, setBoxNumber] = useState(box.boxNumber)
  const [packingNumber, setPackingNumber] = useState(box.packingNumber ?? '')
  const [roomName, setRoomName] = useState(box.room)
  const [description, setDescription] = useState(box.description)
  const [urgent, setUrgent] = useState(box.urgent)
  const [busy, setBusy] = useState(false)
  const online = useOnline()
  const [uploading, setUploading] = useState(false)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    try {
      // roomColor follows the picked room; keep existing color if the room was deleted.
      const roomColor = rooms.find((r) => r.name === roomName)?.color ?? box.roomColor
      await updateBox(box.id, {
        boxNumber,
        packingNumber: packingNumber.trim(),
        room: roomName,
        roomColor,
        description,
        urgent,
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  // Photos persist immediately (SPEC 13) — independent of the Save button. The
  // live snapshot feeds box.photoUrls back in, so the grid updates on its own.
  async function handleAddPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) await addBoxPhoto(box.id, file)
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto(url: string) {
    if (!window.confirm('Delete this photo?')) return
    setRemovingUrl(url)
    try {
      await removeBoxPhoto(box.id, url)
    } finally {
      setRemovingUrl(null)
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
      <label className="flex items-center gap-2 text-sm">
        Packing #
        <input
          type="text"
          inputMode="numeric"
          className="field w-28"
          value={packingNumber}
          onChange={(e) => setPackingNumber(e.target.value)}
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

      {/* Photos — add/remove later (SPEC 13). Persist immediately. */}
      <div>
        <span className="mb-1 block text-sm text-muted">Photos</span>
        {box.photoUrls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {box.photoUrls.map((url) => (
              <div key={url} className="relative">
                <img
                  src={url}
                  alt=""
                  className="size-16 rounded border border-edge object-cover"
                />
                {removingUrl === url ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white">
                    <Spinner />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-xs text-white"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`btn inline-flex items-center gap-2 ${!online || uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            {uploading ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              '📷 Take photo'
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleAddPhotos}
              disabled={!online || uploading}
            />
          </label>
          <label
            className={`btn inline-flex items-center gap-2 ${!online || uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            🖼 Gallery
            <input
              type="file"
              accept="image/*"
              className="hidden"
              multiple
              onChange={handleAddPhotos}
              disabled={!online || uploading}
            />
          </label>
          {!online && <span className="text-xs text-muted">Photos need a connection.</span>}
        </div>
      </div>

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
