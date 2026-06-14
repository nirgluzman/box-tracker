import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import type { RoomDoc } from '../types'

// Real-time rooms list, ordered by rangeStart. Reads from local cache when
// offline (SPEC 13).
export function useRooms() {
  const [rooms, setRooms] = useState<RoomDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'rooms'), orderBy('rangeStart'))
    return onSnapshot(q, (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoomDoc, 'id'>) })))
      setLoading(false)
    })
  }, [])

  return { rooms, loading }
}
