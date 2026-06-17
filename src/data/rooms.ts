import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { normalizeColor } from './palette'
import type { Room, RoomDoc } from '../types'

// Default range size per room: rangeStart .. rangeStart + 99 (SPEC 4.2 / 4.3).
export const RANGE_SIZE = 100

const roomsCol = collection(db, 'rooms')

// --- CRUD ---

export function addRoom(room: Room) {
  return addDoc(roomsCol, room)
}

// Edit a room. When the sticker color changes, cascade the new color to every
// box already saved in that room (matched by the room's previous name, since
// boxes store their room as a name string) so the stored roomColor snapshots
// stay in sync - same idea as editPaletteColor (SPEC 4.1/6.5). Without this,
// existing boxes would keep the old color until each was individually re-saved.
export async function updateRoom(
  id: string,
  patch: Partial<Room>,
  cascade?: { oldName: string; oldColor: string; boxes: { id: string; room: string }[] },
): Promise<void> {
  const colorChanged =
    cascade != null &&
    patch.color != null &&
    normalizeColor(patch.color) !== normalizeColor(cascade.oldColor)

  if (!colorChanged) {
    await updateDoc(doc(db, 'rooms', id), patch)
    return
  }

  const batch = writeBatch(db)
  batch.update(doc(db, 'rooms', id), patch)
  for (const b of cascade.boxes) {
    if (b.room === cascade.oldName) batch.update(doc(db, 'boxes', b.id), { roomColor: patch.color })
  }
  await batch.commit()
}

// Deleting a room leaves its boxes untouched - they keep their stored room
// name, color, and numbers (SPEC 6.5).
export function deleteRoom(id: string) {
  return deleteDoc(doc(db, 'rooms', id))
}

// Starting set from SPEC 4.2. Names stored in Hebrew (matches the data-model example).
export const SEED_ROOMS: Room[] = [
  { name: 'מטבח', color: '#EF9F27', rangeStart: 100 },
  { name: 'סלון', color: '#5DCAA5', rangeStart: 200 },
  { name: 'חדר הורים', color: '#AFA9EC', rangeStart: 300 },
  { name: 'חדר ילדים', color: '#F0997B', rangeStart: 400 },
  { name: 'משרד', color: '#85B7EB', rangeStart: 500 },
  { name: 'אמבטיה', color: '#97C459', rangeStart: 600 },
  { name: 'מחסן', color: '#B4B2A9', rangeStart: 700 },
]

export function seedRooms() {
  const batch = writeBatch(db)
  for (const room of SEED_ROOMS) {
    batch.set(doc(roomsCol), room)
  }
  return batch.commit()
}

// --- Pure range helpers (exported for reuse in Add Box numbering + tests) ---

// End of a room's range, inclusive.
export function rangeEnd(rangeStart: number) {
  return rangeStart + RANGE_SIZE - 1
}

// Next available range start: one RANGE_SIZE above the current max, else 100.
export function suggestNextRangeStart(rooms: RoomDoc[]): number {
  if (rooms.length === 0) return RANGE_SIZE
  const maxStart = Math.max(...rooms.map((r) => r.rangeStart))
  return maxStart + RANGE_SIZE
}

// The existing room whose [start, start+99] range overlaps the candidate
// range, or undefined. Excludes `excludeId` (the room being edited).
export function overlappingRoom(
  candidateStart: number,
  rooms: RoomDoc[],
  excludeId?: string,
): RoomDoc | undefined {
  const aStart = candidateStart
  const aEnd = rangeEnd(candidateStart)
  return rooms.find((r) => {
    if (r.id === excludeId) return false
    const bStart = r.rangeStart
    const bEnd = rangeEnd(r.rangeStart)
    return aStart <= bEnd && bStart <= aEnd
  })
}

// Box numbers already in use that fall inside the candidate range - including
// boxes whose room was since deleted (SPEC 6.5). `boxNumbers` is every box's
// number across the whole collection.
export function inUseNumbersInRange(candidateStart: number, boxNumbers: number[]): number[] {
  const start = candidateStart
  const end = rangeEnd(candidateStart)
  return boxNumbers.filter((n) => n >= start && n <= end).sort((a, b) => a - b)
}
