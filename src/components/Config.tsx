import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRooms } from '../hooks/useRooms'
import { useBoxes } from '../hooks/useBoxes'
import type { BoxDoc, MemberDoc, Room, RoomDoc } from '../types'
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
import { setDeletePerm, permAllowed, type DeletePerm } from '../data/members'
import { auth } from '../firebase'
import { useMembers } from '../hooks/useMembers'
import { usePermissions } from '../hooks/usePermissions'
import { useOnline } from '../hooks/useOnline'
import { usePalette } from '../hooks/usePalette'
import { useConfirmPrefs } from '../hooks/useConfirmPrefs'
import { useBackDismiss } from '../hooks/useBackDismiss'
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
                  // Cascade a sticker-color change to all boxes in this room.
                  await updateRoom(room.id, values, {
                    oldName: room.name,
                    oldColor: room.color,
                    boxes,
                  })
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

      <div className="mt-6 border-t border-edge pt-4">
        <div className="mx-auto flex max-w-sm gap-3">
          <button
            type="button"
            className="btn flex-1 justify-center"
            onClick={() => downloadBoxesCsv(boxes)}
            disabled={boxes.length === 0}
          >
            Download CSV
          </button>
          <button
            type="button"
            className="btn flex-1 justify-center"
            onClick={() => fileRef.current?.click()}
          >
            Upload CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {importError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {importError}
        </p>
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
      <DeletePermissions />
      <ConfirmSettings />

      {/* Maintenance: rare, connection-only cleanup, kept apart from everyday actions. */}
      <div className="mt-6 border-t border-edge pt-4">
        <h3 className="mb-1 font-semibold">Maintenance</h3>
        <p className="mb-3 text-sm text-muted">
          Find photo folders left behind by boxes that were never saved, and delete them.
          Requires a connection.
        </p>
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
            'Scan for orphaned photos'
          )}
        </button>

        {orphanError && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {orphanError}
          </p>
        )}

        {orphans && (
          <div className="mt-4 rounded-lg border border-edge bg-surface p-3">
            <h4 className="mb-2 font-semibold">Orphaned photos</h4>
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
      </div>
    </section>
  )
}

// Avatar for a member row: Google photo in a circle, initial fallback (mirrors
// the header Avatar in App.tsx but takes a MemberDoc).
function MemberAvatar({ member }: { member: MemberDoc }) {
  const [broken, setBroken] = useState(false)
  const label = member.displayName ?? member.email ?? undefined
  if (member.photoURL && !broken) {
    return (
      <img
        src={member.photoURL}
        alt=""
        title={label}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-9 shrink-0 rounded-full object-cover"
      />
    )
  }
  const initial = (member.displayName ?? member.email ?? '?').charAt(0).toUpperCase()
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">
      {initial}
    </span>
  )
}

// Admin-only toggle for one member's delete permission. Checked = allowed.
function PermToggle({
  uid,
  field,
  label,
  allowed,
}: {
  uid: string
  field: DeletePerm
  label: string
  allowed: boolean
}) {
  const [busy, setBusy] = useState(false)
  return (
    <label className="flex items-center gap-1.5 text-sm">
      {label}
      <input
        type="checkbox"
        className="size-4"
        checked={allowed}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true)
          try {
            await setDeletePerm(uid, field, e.target.checked)
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}

// Read-only allowed/blocked row, shown to non-admins for their own permissions.
function PermRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <li className="flex items-center justify-between border-b border-edge py-2 text-sm">
      <span>{label}</span>
      <span className={allowed ? 'font-semibold text-emerald-400' : 'font-semibold text-danger'}>
        {allowed ? 'Allowed' : 'Blocked'}
      </span>
    </li>
  )
}

// Delete permissions (SPEC 5). The admin (token.admin claim) sees a per-member
// toggle for box and photo deletion; everyone else sees their own permissions
// read-only. Box deletion is also enforced in firestore.rules; photo deletion
// is UI-only (Storage rules can't read Firestore - see SPEC 5/15).
function DeletePermissions() {
  const { isAdmin, canDeleteBox, canDeletePhoto } = usePermissions()
  const { members } = useMembers()
  const uid = auth.currentUser?.uid
  // There can be more than one admin (any user with the `admin` claim).
  const adminEmails = members.filter((m) => m.admin && m.email).map((m) => m.email)
  const adminLabel = adminEmails.length > 1 ? 'Admins' : 'Admin'

  return (
    <section className="mt-6 border-t border-edge pt-4">
      <h3 className="mb-1 font-semibold">Deletion permissions</h3>
      <p className="mb-3 text-sm text-muted">
        {adminLabel}
        {adminEmails.length ? `: ${adminEmails.join(', ')}` : ''}. The admin decides who may delete
        boxes and photos. Everyone may delete by default; editing a description is always allowed.
      </p>

      {isAdmin ? (
        <ul className="list-none p-0">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 border-b border-edge py-2.5">
              <MemberAvatar member={m} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.displayName ?? m.email}</p>
                {m.displayName && m.email && (
                  <p className="truncate text-xs text-muted">{m.email}</p>
                )}
              </div>
              {m.id === uid || m.admin ? (
                <span className="shrink-0 text-xs font-semibold text-accent">
                  Admin - full access
                </span>
              ) : (
                <div className="flex shrink-0 gap-4">
                  <PermToggle
                    uid={m.id}
                    field="canDeleteBox"
                    label="Boxes"
                    allowed={permAllowed(m.canDeleteBox)}
                  />
                  <PermToggle
                    uid={m.id}
                    field="canDeletePhoto"
                    label="Photos"
                    allowed={permAllowed(m.canDeletePhoto)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="list-none p-0">
            <PermRow label="Delete boxes" allowed={canDeleteBox} />
            <PermRow label="Delete photos" allowed={canDeletePhoto} />
          </ul>
          <p className="mt-2 text-xs text-muted">
            Set by the admin - you can't change these here.
          </p>
        </>
      )}
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

// HSL -> hex. h in [0,360), s/l in [0,1].
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

type HexCell = { x: number; y: number; color: string }

// Build a hexagon-shaped honeycomb of pointy-top hex cells (axial coords). Hue
// is the angle around the center, saturation grows with distance, lightness
// fades to white at the center - a full-spectrum color wheel.
function buildHoneycomb(rings: number, R: number): HexCell[] {
  const raw: { x: number; y: number; dist: number }[] = []
  let maxDist = 0
  for (let q = -rings; q <= rings; q++) {
    for (let r = -rings; r <= rings; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > rings) continue
      const x = Math.sqrt(3) * R * (q + r / 2)
      const y = 1.5 * R * r
      const dist = Math.hypot(x, y)
      maxDist = Math.max(maxDist, dist)
      raw.push({ x, y, dist })
    }
  }
  return raw.map(({ x, y, dist }) => {
    const norm = maxDist === 0 ? 0 : dist / maxDist
    let angle = (Math.atan2(y, x) * 180) / Math.PI
    if (angle < 0) angle += 360
    const color = norm < 0.001 ? '#ffffff' : hslToHex(angle, 1, 1 - 0.5 * norm)
    return { x, y, color }
  })
}

// Pointy-top hexagon vertices around (cx, cy) with circumradius R.
function hexPoints(cx: number, cy: number, R: number): string {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 90) * Math.PI) / 180
    pts.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const HONEYCOMB_R = 13
const HONEYCOMB_RINGS = 7

// Honeycomb color-wheel picker: tap a hex cell to choose its color.
function SwatchGridPicker({
  value,
  onPick,
}: {
  value?: string
  onPick: (hex: string) => void
}) {
  const selected = value ? normalizeColor(value) : ''
  const cells = useMemo(() => buildHoneycomb(HONEYCOMB_RINGS, HONEYCOMB_R), [])
  const extent = (HONEYCOMB_RINGS + 1) * Math.sqrt(3) * HONEYCOMB_R
  const vb = extent * 2

  return (
    <svg
      viewBox={`${-extent} ${-extent} ${vb} ${vb}`}
      className="mx-auto block w-full max-w-65"
      role="group"
      aria-label="Color wheel"
    >
      {cells.map((c) => {
        const isSel = normalizeColor(c.color) === selected
        return (
          <polygon
            key={`${c.x},${c.y}`}
            points={hexPoints(c.x, c.y, HONEYCOMB_R)}
            fill={c.color}
            stroke={isSel ? '#fff' : c.color}
            strokeWidth={isSel ? 2.5 : 0.5}
            className="cursor-pointer"
            onClick={() => onPick(c.color)}
          >
            <title>{c.color}</title>
          </polygon>
        )
      })}
    </svg>
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

  // Back button closes whichever color dialog is open instead of leaving Config.
  useBackDismiss(adding, () => setAdding(false))
  useBackDismiss(menuColor !== null, () => setMenuColor(null))

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
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setMenuColor(c)}
              aria-label={`Edit or delete ${c}`}
              className="size-8 shrink-0 rounded-md border border-white/20"
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
