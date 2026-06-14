import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRooms } from '../hooks/useRooms'
import { useBoxes } from '../hooks/useBoxes'
import type { Room, RoomDoc } from '../types'
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

// SPEC 6.5 — Config / room manager + CSV download/upload (SPEC 8).
// Orphaned-photos cleanup (SPEC 6.2) lands in a later phase.
export default function Config() {
  const { rooms, loading } = useRooms()
  const { boxes } = useBoxes()
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

  async function handleDelete(room: RoomDoc) {
    if (!window.confirm(`Delete room "${room.name}"? Existing boxes keep their number and color.`))
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
                {room.rangeStart}–{rangeEnd(room.rangeStart)}
              </span>
              <button type="button" className="btn" onClick={() => setEditingId(room.id)}>
                Edit
              </button>
              <button type="button" className="btn" onClick={() => handleDelete(room)}>
                Delete
              </button>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <RoomForm
          rooms={rooms}
          boxNumbers={boxNumbers}
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
        <button type="button" className="btn" disabled title="Coming in a later phase">
          Orphaned photos
        </button>
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
              This file deletes {plan.deletes.length} of {boxes.length} boxes — it may be a
              partial export. I understand and want to proceed.
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmImport}
              disabled={applying || (plan.highDeletion && !ackDeletion)}
            >
              {applying ? 'Applying…' : 'Apply changes'}
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
    </section>
  )
}

function RoomForm({
  initial,
  rooms,
  boxNumbers,
  excludeId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: RoomDoc
  rooms: RoomDoc[]
  boxNumbers: number[]
  excludeId?: string
  submitLabel: string
  onSubmit: (values: Room) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? '#85B7EB')
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
      <label className="flex items-center gap-2">
        Color
        <input
          type="color"
          className="h-9 w-12 rounded border border-edge bg-surface"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </label>
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
          {rangeStart}–{rangeEnd(rangeStart)}
        </span>
      </label>

      {overlap && (
        <p className="text-sm text-warn" role="alert">
          Overlaps “{overlap.name}” ({overlap.rangeStart}–{rangeEnd(overlap.rangeStart)}).
        </p>
      )}
      {usedNumbers.length > 0 && (
        <p className="text-sm text-warn" role="alert">
          {usedNumbers.length} box number(s) already in use in this range
          {usedNumbers.length <= 5 ? ` (${usedNumbers.join(', ')})` : ''}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
