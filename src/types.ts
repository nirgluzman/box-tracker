import type { Timestamp } from 'firebase/firestore'

// boxes collection - SPEC 4.1
export interface Box {
  boxNumber: number
  packingNumber?: string // optional sequential label from the packing company, for identification
  room: string
  roomColor: string // hex, copied from rooms at save time
  description: string
  urgent: boolean
  photoUrls: string[]
  addedBy: string // auth user's email or display name
  createdAt: Timestamp // set on creation, never edited
}

// A Box plus its Firestore document id, for list/edit/CSV use.
export interface BoxDoc extends Box {
  id: string
}

// rooms collection - SPEC 4.2
export interface Room {
  name: string
  color: string // hex, e.g. "#EF9F27"
  rangeStart: number // start of this room's box-number range (size 100)
}

export interface RoomDoc extends Room {
  id: string
}
