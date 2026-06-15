import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// A shared, curated list of colors (settings/palette). Rooms pick their color
// from this list instead of a free color input, keeping the scheme consistent.
const paletteRef = doc(db, 'settings', 'palette')

// Used until the user customizes the palette (matches the seed-room colors).
export const DEFAULT_PALETTE = [
  '#ef9f27',
  '#5dcaa5',
  '#afa9ec',
  '#f0997b',
  '#85b7eb',
  '#97c459',
  '#b4b2a9',
]

// Normalize so '#EF9F27' and '#ef9f27' don't both end up in the list.
export function normalizeColor(hex: string): string {
  return hex.trim().toLowerCase()
}

export function addPaletteColor(color: string) {
  return setDoc(paletteRef, { colors: arrayUnion(normalizeColor(color)) }, { merge: true })
}

export function removePaletteColor(color: string) {
  return setDoc(paletteRef, { colors: arrayRemove(normalizeColor(color)) }, { merge: true })
}

// Seed the palette doc with the defaults (offered when it's still untouched).
export function seedPalette() {
  return setDoc(paletteRef, { colors: DEFAULT_PALETTE }, { merge: true })
}
