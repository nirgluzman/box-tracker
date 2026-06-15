import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { BoxDoc } from '../types'

// Real-time boxes list, ordered by boxNumber. Reads from local cache when
// offline (SPEC 13). Used by Browse and overlap checks in Config.
export function useBoxes() {
  const [boxes, setBoxes] = useState<BoxDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'boxes'), orderBy('boxNumber'))
    return onSnapshot(q, (snap) => {
      setBoxes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoxDoc, 'id'>) })))
      setLoading(false)
    })
  }, [])

  return { boxes, loading }
}
