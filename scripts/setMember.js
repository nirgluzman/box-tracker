// Grant the `member` custom claim that the Firestore/Storage rules require
// (SPEC 5/10), and optionally the `admin` claim. Run once per member, AFTER they
// have signed in with Google once (so their Auth user record exists):
//
//   node scripts/setMember.js <email>                   # grant member
//   node scripts/setMember.js <email> --admin           # grant member + admin
//   node scripts/setMember.js <email> --revoke          # revoke all access
//   node scripts/setMember.js <email> --admin --revoke  # drop admin, keep member
//
// WHY A CLAIM (not an email in config or rules): the app is a public repo. The
// `admin` custom claim identifies the single admin without putting the email
// anywhere - not in committed source, not in the public client bundle, and not
// in firestore.rules (which check request.auth.token.admin). It is set
// server-side here with the Admin SDK and is fully decoupled from deploys:
// granting/revoking admin is just re-running this script, no rebuild/redeploy.
// The admin is the only account that can change other members' delete
// permissions, and is never blocked from deleting (SPEC 5).
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
const admin = process.argv.includes('--admin')

if (!email || email.startsWith('--')) {
  console.error('Usage: node scripts/setMember.js <email> [--admin] [--revoke]')
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
  // Merge with existing claims so an isolated change (e.g. dropping admin) does
  // not clobber the member claim. setCustomUserClaims replaces the whole object.
  const current = user.customClaims ?? {}
  let claims
  let summary
  if (revoke && admin) {
    // Drop admin only, keep member access.
    claims = { ...current }
    delete claims.admin
    summary = `Revoked admin claim for ${email} (still a member)`
  } else if (revoke) {
    // Revoke all access.
    claims = null
    summary = `Revoked all claims for ${email}`
  } else {
    claims = { ...current, member: true }
    if (admin) claims.admin = true
    summary = `Granted ${admin ? 'member + admin' : 'member'} claim to ${email}`
  }
  await getAuth().setCustomUserClaims(user.uid, claims)
  console.log(`${summary} (${user.uid}).`)
  console.log('They must re-sign-in (or call getIdToken(true)) for the change to take effect.')
} catch (e) {
  if (e.code === 'auth/user-not-found') {
    console.error(`No Auth user for ${email}. They must sign in with Google once first.`)
  } else {
    console.error('Failed:', e.message)
  }
  process.exit(1)
}
