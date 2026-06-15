import { useEffect, useState } from 'react'
import {
  CONFIRM_PREFS_EVENT,
  getConfirmPrefs,
  setConfirmPref,
  type ConfirmKey,
} from '../data/confirmPrefs'

// Reactive view of the per-device confirmation prefs for the Config toggles.
export function useConfirmPrefs() {
  const [prefs, setPrefs] = useState(getConfirmPrefs)

  useEffect(() => {
    const sync = () => setPrefs(getConfirmPrefs())
    window.addEventListener(CONFIRM_PREFS_EVENT, sync)
    window.addEventListener('storage', sync) // other tabs
    return () => {
      window.removeEventListener(CONFIRM_PREFS_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { prefs, setPref: (key: ConfirmKey, value: boolean) => setConfirmPref(key, value) }
}
