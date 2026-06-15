// Per-device confirmation preferences. Each destructive action can have its
// "Are you sure?" prompt turned off in Config. Stored in localStorage (not
// Firestore) on purpose: in a shared 4-user app, one person disabling a delete
// guard must not remove the safety net for everyone else, and the preference
// should travel with the device, not the account.

export type ConfirmKey =
  | 'deleteBox'
  | 'deletePhoto'
  | 'deleteRoom'
  | 'deletePaletteColor'
  | 'deleteOrphans'

// Order here is the order shown in Config.
export const CONFIRM_LABELS: Record<ConfirmKey, string> = {
  deleteBox: 'Deleting a box',
  deletePhoto: 'Deleting a photo',
  deleteRoom: 'Deleting a room',
  deletePaletteColor: 'Deleting a palette color',
  deleteOrphans: 'Deleting orphaned photos',
}

const KEYS = Object.keys(CONFIRM_LABELS) as ConfirmKey[]
const STORAGE_KEY = 'boxbuddy.confirmPrefs'
export const CONFIRM_PREFS_EVENT = 'boxbuddy-confirm-prefs'

export type ConfirmPrefs = Record<ConfirmKey, boolean>

// Default: every confirmation is ON (safe).
function defaults(): ConfirmPrefs {
  return Object.fromEntries(KEYS.map((k) => [k, true])) as ConfirmPrefs
}

export function getConfirmPrefs(): ConfirmPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults()
  } catch {
    return defaults()
  }
}

export function setConfirmPref(key: ConfirmKey, value: boolean): void {
  const next = { ...getConfirmPrefs(), [key]: value }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  // Notify same-tab listeners (the native 'storage' event only fires cross-tab).
  window.dispatchEvent(new Event(CONFIRM_PREFS_EVENT))
}

// Returns true to proceed. Skips window.confirm when the user disabled the
// prompt for this action.
export function confirmAction(key: ConfirmKey, message: string): boolean {
  if (!getConfirmPrefs()[key]) return true
  return window.confirm(message)
}
