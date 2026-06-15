import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_PALETTE } from '../data/palette'

// Real-time shared color palette (settings/palette). Falls back to the default
// list until the doc exists; an explicit empty list (user cleared it) is kept.
export function usePalette() {
  const [colors, setColors] = useState<string[]>(DEFAULT_PALETTE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'palette'), (snap) => {
      const data = snap.data()
      setColors(snap.exists() && Array.isArray(data?.colors) ? data.colors : DEFAULT_PALETTE)
      setLoading(false)
    })
  }, [])

  return { colors, loading }
}
