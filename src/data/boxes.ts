import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Box, BoxDoc } from '../types'
import { rangeEnd } from './rooms'

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
