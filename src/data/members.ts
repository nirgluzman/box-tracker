import { doc, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../firebase'

// Admin is identified by the `admin` custom claim (SPEC 5), granted with
// `node scripts/setMember.js <email> --admin` - the same Admin SDK mechanism as
// the `member` claim. The email lives nowhere (not in source, not in the client
// bundle, not in firestore.rules); rules check request.auth.token.admin and the
// client reads it from the ID token. The admin is never blocked from deleting
// anything; it is the only account that can change other members' permissions.

export type DeletePerm = 'canDeleteBox' | 'canDeletePhoto'

// Upsert the signed-in user's profile into members/{uid} on each sign-in, so the
// admin's Config screen can list everyone with their photo (SPEC 5). Writes
// profile fields ONLY - never the permission flags, which are admin-only
// (firestore.rules). `admin` mirrors the token claim and is written only when
// this user IS the admin (rules forbid anyone else from writing that key), so
// the Config banner can show who the admin is. A brand-new doc has no permission
// flags, which means "allowed" by permAllowed below.
export function registerMember(user: User, isAdmin: boolean): Promise<void> {
  const data: Record<string, unknown> = {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
  if (isAdmin) data.admin = true
  return setDoc(doc(db, 'members', user.uid), data, { merge: true })
}

// Admin action: set/clear a delete permission for a member. Storing true is the
// same as the absent default; we store it explicitly so the toggle reflects the
// last choice instead of reverting to an implicit default.
export function setDeletePerm(uid: string, field: DeletePerm, allowed: boolean): Promise<void> {
  return setDoc(doc(db, 'members', uid), { [field]: allowed }, { merge: true })
}

// Absent flag = allowed; only an explicit false blocks. The admin override is
// applied by the caller (usePermissions / the admin panel), not here.
export const permAllowed = (value?: boolean): boolean => value !== false
