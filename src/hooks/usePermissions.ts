import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { permAllowed } from '../data/members'
import type { Member } from '../types'

// The signed-in user's effective delete permissions (SPEC 5), reactive to
// admin changes via members/{uid}. The admin (token.admin claim) can always
// delete; for everyone else it is default-deny - blocked unless the admin has
// explicitly set the flag to true.
//
// Box delete is also enforced server-side in firestore.rules; this hook drives
// the UI (hide/disable the button). Photo delete is UI-only - Storage rules
// can't read Firestore (see SPEC 5/15).
export function usePermissions() {
  const user = auth.currentUser
  const [isAdmin, setIsAdmin] = useState(false)
  const [member, setMember] = useState<Member | null>(null)

  useEffect(() => {
    if (!user) return
    // Read the admin claim from the cached ID token (no network unless expired).
    user.getIdTokenResult().then((r) => setIsAdmin(r.claims.admin === true))
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'members', user.uid), (snap) => {
      setMember((snap.data() as Member) ?? null)
    })
  }, [user])

  return {
    isAdmin,
    canDeleteBox: isAdmin || permAllowed(member?.canDeleteBox),
    canDeletePhoto: isAdmin || permAllowed(member?.canDeletePhoto),
  }
}
