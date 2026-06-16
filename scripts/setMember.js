// Grant the `member` custom claim that the Firestore/Storage rules require
// (SPEC 5/10). Run once per member, AFTER they have signed in with Google once
// (so their Auth user record exists):
//
//   node scripts/setMember.js <email>            # grant
//   node scripts/setMember.js <email> --revoke   # revoke
//
// Auth: set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key, or
// place the key at ./serviceAccountKey.json (repo root). The key is gitignored
// and must never be committed (the repo is public).
//
// The member must re-sign-in (or call getIdToken(true)) for the claim to apply.

import { existsSync, readFileSync } from 'node:fs'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2]
const revoke = process.argv.includes('--revoke')

if (!email || email.startsWith('--')) {
  console.error('Usage: node scripts/setMember.js <email> [--revoke]')
  process.exit(1)
}

const keyPath = './serviceAccountKey.json'
const credential =
  process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : existsSync(keyPath)
      ? cert(JSON.parse(readFileSync(keyPath, 'utf8')))
      : null

if (!credential) {
  console.error(
    'No credentials. Set GOOGLE_APPLICATION_CREDENTIALS or add serviceAccountKey.json at the repo root.',
  )
  process.exit(1)
}

initializeApp({ credential })

try {
  const user = await getAuth().getUserByEmail(email)
  await getAuth().setCustomUserClaims(user.uid, revoke ? null : { member: true })
  console.log(
    `${revoke ? 'Revoked member claim for' : 'Granted member claim to'} ${email} (${user.uid}).`,
  )
  console.log('They must re-sign-in for the change to take effect.')
} catch (e) {
  if (e.code === 'auth/user-not-found') {
    console.error(`No Auth user for ${email}. They must sign in with Google once first.`)
  } else {
    console.error('Failed:', e.message)
  }
  process.exit(1)
}
