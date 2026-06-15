import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRooms } from '../hooks/useRooms'
import { useBoxes } from '../hooks/useBoxes'
import type { BoxDoc, Room, RoomDoc } from '../types'
import {
  addRoom,
  deleteRoom,
  inUseNumbersInRange,
  overlappingRoom,
  rangeEnd,
  seedRooms,
  suggestNextRangeStart,
  updateRoom,
} from '../data/rooms'
import { applyImportPlan } from '../data/boxes'
import {
  csvToRecords,
  downloadBoxesCsv,
  parseCsv,
  planImport,
  type ImportPlan,
} from '../data/csv'
import { deleteOrphanFolder, listOrphanedFolders, type OrphanFolder } from '../data/photos'
import {
  addPaletteColor,
  editPaletteColor,
  normalizeColor,
  removePaletteColor,
  seedPalette,
} from '../data/palette'
import { confirmAction, CONFIRM_LABELS, type ConfirmKey } from '../data/confirmPrefs'
import { useOnline } from '../hooks/useOnline'
import { usePalette } from '../hooks/usePalette'
import { useConfirmPrefs } from '../hooks/useConfirmPrefs'
import { Spinner } from './Spinner'
import { PencilIcon, TrashIcon } from './icons'

// SPEC 6.5 - Config / room manager + CSV download/upload (SPEC 8) + orphaned-photos cleanup (SPEC 6.2).
export default function Config() {
  const { rooms, loading } = useRooms()
  const { boxes } = useBoxes()
  const { colors: palette } = usePalette()
  const online = useOnline()
  const boxNumbers = boxes.map((b) => b.boxNumber)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // CSV import (SPEC 8.2)
  const fileRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [ackDeletion, setAckDeletion] = useState(false)
  const [applying, setApplying] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setAckDeletion(false)
    try {
      const text = await file.text()
      const records = csvToRecords(parseCsv(text))
      setPlan(planImport(records, boxes, rooms))
    } catch (err) {
      setPlan(null)
      setImportError(err instanceof Error ? err.message : 'Could not read this file.')
    }
  }

  async function confirmImport() {
    if (!plan) return
    setApplying(true)
    try {
      await applyImportPlan(plan)
      setPlan(null)
    } finally {
      setApplying(false)
    }
  }

  // Orphaned-photos cleanup (SPEC 6.2/6.5) - requires a connection.
  const [scanning, setScanning] = useState(false)
  const [orphans, setOrphans] = useState<OrphanFolder[] | null>(null)
  const [orphanError, setOrphanError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function scanOrphans() {
    setScanning(true)
    setOrphanError(null)
    try {
      const liveIds = new Set(boxes.map((b) => b.id))
      setOrphans(await listOrphanedFolders(liveIds))
    } catch (err) {
      setOrphanError(err instanceof Error ? err.message : 'Scan failed.')
    } finally {
      setScanning(false)
    }
  }

  async function removeOrphan(docId: string) {
    if (!confirmAction('deleteOrphans', 'Delete these orphaned photos? This cannot be undone.')) return
    setDeletingId(docId)
    try {
      await deleteOrphanFolder(docId)
      setOrphans((prev) => prev?.filter((o) => o.docId !== docId) ?? null)
    } catch (err) {
      setOrphanError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDelete(room: RoomDoc) {
    if (!confirmAction('deleteRoom', `Delete room "${room.name}"? Existing boxes keep their number and color.`))
      return
    await deleteRoom(room.id)
  }

  if (loading)
    return (
      <section className="p-4">
        <h2 className="mb-2 text-xl font-semibold">Config</h2>
        <p className="text-muted">Loading…</p>
      </section>
    )

  return (
    <section className="p-4">
      <h2 className="mb-2 text-xl font-semibold">Config</h2>

      {rooms.length === 0 && !adding && (
        <p className="text-muted">
          No rooms yet.{' '}
          <button type="button" className="btn" onClick={() => seedRooms()}>
            Seed starting rooms
          </button>
        </p>
      )}

      <ul className="my-3 list-none p-0">
        {rooms.map((room) =>
          editingId === room.id ? (
            <li key={room.id}>
              <RoomForm
                initial={room}
                rooms={rooms}
                boxNumbers={boxNumbers}
                palette={palette}
                excludeId={room.id}
                submitLabel="Save"
                onSubmit={async (values) => {
                  await updateRoom(room.id, values)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={room.id}
              className="flex items-center gap-2.5 border-b border-edge py-2.5"
            >
              <span
                className="size-5 shrink-0 rounded border border-white/20"
                style={{ background: room.color }}
                aria-hidden="true"
              />
              <span className="flex-1 font-semibold">{room.name}</span>
              <span className="text-muted tabular-nums">
                {room.rangeStart}-{rangeEnd(room.rangeStart)}
              </span>
              <button
                type="button"
                className="btn px-3"
                onClick={() => setEditingId(room.id)}
                aria-label="Edit"
                title="Edit"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="btn px-3"
                onClick={() => handleDelete(room)}
                aria-label="Delete"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <RoomForm
          rooms={rooms}
          boxNumbers={boxNumbers}
          palette={palette}
          submitLabel="Add room"
          onSubmit={async (values) => {
            await addRoom(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + Add room
        </button>
      )}

      <PaletteManager colors={palette} rooms={rooms} boxes={boxes} />

      <div className="mt-6 flex flex-wrap gap-2 border-t border-edge pt-4">
        <button
          type="button"
          className="btn"
          onClick={() => downloadBoxesCsv(boxes)}
          disabled={boxes.length === 0}
        >
          Download CSV
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Upload CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          className="btn"
          onClick={scanOrphans}
          disabled={scanning || !online}
          title={online ? 'Scan for photos with no box' : 'Requires a connection'}
        >
          {scanning ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Scanning…
            </span>
          ) : (
            'Orphaned photos'
          )}
        </button>
      </div>

      {importError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {importError}
        </p>
      )}

      {orphanError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {orphanError}
        </p>
      )}

      {orphans && (
        <div className="mt-4 rounded-lg border border-edge bg-surface p-3">
          <h3 className="mb-2 font-semibold">Orphaned photos</h3>
          {orphans.length === 0 ? (
            <p className="text-sm text-muted">No orphaned photo folders found.</p>
          ) : (
            <ul className="list-none p-0">
              {orphans.map((o) => (
                <li
                  key={o.docId}
                  className="flex items-center gap-2.5 border-b border-edge py-2"
                >
                  {o.thumbUrl ? (
                    <img
                      src={o.thumbUrl}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="size-10 shrink-0 rounded bg-edge" aria-hidden="true" />
                  )}
                  <span className="flex-1 text-sm">
                    {o.count} photo{o.count === 1 ? '' : 's'}
                    <span className="block text-xs text-muted">{o.docId}</span>
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => removeOrphan(o.docId)}
                    disabled={deletingId === o.docId}
                  >
                    {deletingId === o.docId ? <Spinner /> : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan && (
        <div className="mt-4 rounded-lg border border-edge bg-surface p-3">
          <h3 className="mb-2 font-semibold">Review import</h3>
          <ul className="mb-3 text-sm">
            <li>Updates: {plan.updates.length}</li>
            <li>New boxes: {plan.creates.length}</li>
            <li>Deletions: {plan.deletes.length}</li>
          </ul>
          {plan.highDeletion && (
            <label className="mb-3 flex items-start gap-2 text-sm text-warn">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={ackDeletion}
                onChange={(e) => setAckDeletion(e.target.checked)}
              />
              This file deletes {plan.deletes.length} of {boxes.length} boxes - it may be a
              partial export. I understand and want to proceed.
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary inline-flex items-center gap-2"
              onClick={confirmImport}
              disabled={applying || (plan.highDeletion && !ackDeletion)}
            >
              {applying ? (
                <>
                  <Spinner /> Applying…
                </>
              ) : (
                'Apply changes'
              )}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setPlan(null)}
              disabled={applying}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <ConfirmSettings />
    </section>
  )
}

// Per-device toggles for the "Are you sure?" prompts on destructive actions.
function ConfirmSettings() {
  const { prefs, setPref } = useConfirmPrefs()
  const keys = Object.keys(CONFIRM_LABELS) as ConfirmKey[]
  return (
    <div className="mt-6 border-t border-edge pt-4">
      <h3 className="mb-1 font-semibold">Confirmation prompts</h3>
      <p className="mb-3 text-sm text-muted">
        Ask before destructive actions. Off = act immediately, no prompt. Saved on this
        device only.
      </p>
      <ul className="list-none p-0">
        {keys.map((key) => (
          <li key={key} className="flex items-center justify-between border-b border-edge py-2">
            <label htmlFor={`confirm-${key}`} className="text-sm">
              {CONFIRM_LABELS[key]}
            </label>
            <input
              id={`confirm-${key}`}
              type="checkbox"
              className="size-4"
              checked={prefs[key]}
              onChange={(e) => setPref(key, e.target.checked)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoomForm({
  initial,
  rooms,
  boxNumbers,
  palette,
  excludeId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: RoomDoc
  rooms: RoomDoc[]
  boxNumbers: number[]
  palette: string[]
  excludeId?: string
  submitLabel: string
  onSubmit: (values: Room) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? palette[0] ?? '#85b7eb')
  // Keep a legacy/edited color selectable even if it's no longer in the palette.
  const swatches =
    color && !palette.some((c) => normalizeColor(c) === normalizeColor(color))
      ? [color, ...palette]
      : palette
  const [rangeStart, setRangeStart] = useState<number>(
    initial?.rangeStart ?? suggestNextRangeStart(rooms),
  )
  const [busy, setBusy] = useState(false)

  // Live, non-blocking overlap warnings (SPEC 6.5).
  const overlap = overlappingRoom(rangeStart, rooms, excludeId)
  const usedNumbers = inUseNumbersInRange(rangeStart, boxNumbers)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), color, rangeStart })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="my-3 flex flex-col gap-2.5 rounded-lg border border-edge bg-surface p-3"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        placeholder="Room name"
        className="field"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div>
        <span className="mb-1 block text-sm text-muted">Color</span>
        {swatches.length === 0 ? (
          <p className="text-sm text-warn">No colors in the palette - add some under “Box colors”.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {swatches.map((c) => {
              const selected = normalizeColor(c) === normalizeColor(color)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={selected}
                  className={`size-8 rounded-full border-2 ${
                    selected ? 'border-accent ring-2 ring-accent' : 'border-white/20'
                  }`}
                  style={{ background: c }}
                />
              )
            })}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2">
        Range start
        <input
          type="number"
          step={100}
          className="field w-28"
          value={rangeStart}
          onChange={(e) => setRangeStart(Number(e.target.value))}
        />
        <span className="text-muted tabular-nums">
          {rangeStart}-{rangeEnd(rangeStart)}
        </span>
      </label>

      {overlap && (
        <p className="text-sm text-warn" role="alert">
          Overlaps “{overlap.name}” ({overlap.rangeStart}-{rangeEnd(overlap.rangeStart)}).
        </p>
      )}
      {usedNumbers.length > 0 && (
        <p className="text-sm text-warn" role="alert">
          {usedNumbers.length} box number(s) already in use in this range
          {usedNumbers.length <= 5 ? ` (${usedNumbers.join(', ')})` : ''}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="btn btn-primary inline-flex items-center gap-2"
          disabled={busy || !name.trim()}
        >
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            submitLabel
          )}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Discrete color swatches for the palette picker - a curated grid (10 hue
// families x 6 shades + grays) so users tap a color instead of fiddling with a
// Hue/Saturation/Value picker. A hex field covers the rare fully-custom color.
const PRESET_SWATCHES = [
  '#fee2e2', '#fca5a5', '#ef4444', '#dc2626', '#991b1b', '#7f1d1d',
  '#ffedd5', '#fdba74', '#f97316', '#ea580c', '#c2410c', '#7c2d12',
  '#fef3c7', '#fcd34d', '#f59e0b', '#d97706', '#b45309', '#78350f',
  '#dcfce7', '#86efac', '#22c55e', '#16a34a', '#15803d', '#14532d',
  '#ccfbf1', '#5eead4', '#14b8a6', '#0d9488', '#0f766e', '#134e4a',
  '#dbeafe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a',
  '#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5', '#4338ca', '#312e81',
  '#f3e8ff', '#d8b4fe', '#a855f7', '#9333ea', '#7e22ce', '#581c87',
  '#fce7f3', '#f9a8d4', '#ec4899', '#db2777', '#be185d', '#831843',
  '#ffffff', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827',
]

const isHex = (s: string) => /^#?[0-9a-fA-F]{6}$/.test(s.trim())

// Swatch-grid color picker: tap a preset, or type a hex for a custom color.
function SwatchGridPicker({
  value,
  onPick,
}: {
  value?: string
  onPick: (hex: string) => void
}) {
  const [custom, setCustom] = useState(value ?? '')
  const selected = value ? normalizeColor(value) : ''
  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={c}
            className={`size-8 rounded-md ${
              normalizeColor(c) === selected
                ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface'
                : 'border border-white/20'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          className="field flex-1"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#RRGGBB (custom)"
          aria-label="Custom hex color"
        />
        <button
          type="button"
          className="btn"
          disabled={!isHex(custom)}
          onClick={() => onPick(custom.trim().startsWith('#') ? custom.trim() : `#${custom.trim()}`)}
        >
          Use
        </button>
      </div>
    </div>
  )
}

// Curate the shared color palette that rooms choose from. Tapping a color opens
// an Edit / Delete menu.
function PaletteManager({
  colors,
  rooms,
  boxes,
}: {
  colors: string[]
  rooms: RoomDoc[]
  boxes: BoxDoc[]
}) {
  const [menuColor, setMenuColor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  function roomsUsing(color: string) {
    return rooms.filter((r) => normalizeColor(r.color) === normalizeColor(color))
  }

  function handleDelete(color: string) {
    const used = roomsUsing(color)
    if (used.length > 0) {
      window.alert(
        `Can't delete this color - it's assigned to ${used.length} room(s): ` +
          `${used.map((r) => r.name).join(', ')}. Change those rooms to another color first.`,
      )
      return
    }
    if (!confirmAction('deletePaletteColor', 'Delete this color from the palette?')) return
    removePaletteColor(color)
    setMenuColor(null)
  }

  async function handleEdit(oldColor: string, newColor: string) {
    await editPaletteColor(oldColor, newColor, rooms, boxes)
    setMenuColor(null)
  }

  return (
    <section className="mt-6 border-t border-edge pt-4">
      <h3 className="mb-1 font-semibold">Box colors</h3>
      <p className="mb-3 text-sm text-muted">
        Curate the colors rooms can choose from. Tap a color to edit or delete it.
      </p>

      {colors.length === 0 ? (
        <p className="mb-3 text-sm text-warn">
          No colors yet - add one below or{' '}
          <button type="button" className="underline" onClick={() => seedPalette()}>
            load the defaults
          </button>
          .
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-2.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setMenuColor(c)}
              aria-label={`Edit or delete ${c}`}
              className="size-9 rounded-full border border-white/20"
              style={{ background: c }}
            />
          ))}
        </div>
      )}

      <button type="button" className="btn" onClick={() => setAdding(true)}>
        + Add color
      </button>

      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setAdding(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg border border-edge bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-3 font-semibold">Add a color</h4>
            <SwatchGridPicker
              onPick={(hex) => {
                addPaletteColor(hex)
                setAdding(false)
              }}
            />
            <button
              type="button"
              className="btn mt-3 w-full"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {menuColor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuColor(null)}
        >
          <div
            className="w-full max-w-xs rounded-lg border border-edge bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="size-6 rounded-full border border-white/20"
                style={{ background: menuColor }}
              />
              <span className="font-semibold">Color</span>
            </div>
            {/* Edit: pick a new color; recolors all rooms/boxes using this one. */}
            <p className="mb-2 text-sm text-muted">Pick a new color to replace it:</p>
            <SwatchGridPicker value={menuColor} onPick={(hex) => handleEdit(menuColor, hex)} />
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="btn" onClick={() => handleDelete(menuColor)}>
                Delete color
              </button>
              <button type="button" className="btn" onClick={() => setMenuColor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
