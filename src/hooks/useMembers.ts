import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import type { MemberDoc } from '../types'

// Real-time list of all members (SPEC 5), for the admin's permission panel in
// Config. Each doc is one signed-in user, keyed by auth uid.
export function useMembers() {
  const [members, setMembers] = useState<MemberDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(collection(db, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemberDoc, 'id'>) })))
      setLoading(false)
    })
  }, [])

  return { members, loading }
}
