import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Box, BoxDoc } from '../types'
import { rangeEnd } from './rooms'
import { deletePhotoUrls } from './photos'

// Generate a box document id up front (SPEC 6.2) so photos can be stored under
// boxPhotos/{docId}/ before the document is written.
export function newBoxId(): string {
  return doc(collection(db, 'boxes')).id
}

// Box number = max existing number in that room + 1, else the room's rangeStart
// (SPEC 4.3). `boxes` should come from the local-cache snapshot so it includes
// pending unsynced boxes and works offline.
export function nextBoxNumber(roomName: string, rangeStart: number, boxes: BoxDoc[]): number {
  const nums = boxes.filter((b) => b.room === roomName).map((b) => b.boxNumber)
  return nums.length ? Math.max(...nums) + 1 : rangeStart
}

// True when the assigned number spills past the room's range (SPEC 4.3).
export function isRangeOverflow(boxNumber: number, rangeStart: number): boolean {
  return boxNumber > rangeEnd(rangeStart)
}

// Write the box using the pre-generated id. createdAt is server-set and never
// edited; queued locally and resolved on sync when offline.
export function createBox(docId: string, data: Omit<Box, 'createdAt'>) {
  return setDoc(doc(db, 'boxes', docId), { ...data, createdAt: serverTimestamp() })
}

// Edit an existing box (SPEC 6.3). createdAt is never edited.
export function updateBox(id: string, patch: Partial<Omit<Box, 'createdAt'>>) {
  return updateDoc(doc(db, 'boxes', id), patch)
}

// Delete a box and its Storage photos (SPEC 6.3).
export async function deleteBox(box: BoxDoc): Promise<void> {
  await deletePhotoUrls(box.photoUrls)
  await deleteDoc(doc(db, 'boxes', box.id))
}

// Boxes sharing the same number within the same room are flagged in Browse
// (SPEC 4.3 safety net). Returns the set of "room|number" keys with > 1 box.
export function duplicateKeys(boxes: BoxDoc[]): Set<string> {
  const counts = new Map<string, number>()
  for (const b of boxes) {
    const key = `${b.room}|${b.boxNumber}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k))
}

export function boxKey(box: BoxDoc): string {
  return `${box.room}|${box.boxNumber}`
}
