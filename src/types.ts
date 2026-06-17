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

// members collection - SPEC 5. One doc per signed-in user (id = auth uid),
// holding their Google profile (for the admin panel) plus admin-set delete
// permissions. canDeleteBox/canDeletePhoto are OPTIONAL and default-deny: only
// an explicit true allows; absent or false blocks that user. The admin is never
// blocked (see members.ts).
export interface Member {
  email: string | null
  displayName: string | null
  photoURL: string | null
  // Mirror of the `admin` custom claim, written by the admin's own client so the
  // Config banner can show who the admin is without hardcoding an email. The
  // real authority is the token claim (rules); this is display-only.
  admin?: boolean
  canDeleteBox?: boolean
  canDeletePhoto?: boolean
}

export interface MemberDoc extends Member {
  id: string // = auth uid
}
