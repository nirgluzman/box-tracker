# Adding a member (granting access to a new Google account)

Operational runbook for letting a new Google/Gmail account use BoxIndex. Access is
**not** automatic on sign-in — every account must be granted the `member` custom claim
that the Firestore/Storage rules require (see [SPEC.md](../SPEC.md) sections 5 and 10,
and [auth-flow.md](./auth-flow.md) for the full flow).

Two things are needed: a **service-account key** (to run the admin script) and the
**new account signing in once** (so an Auth user record exists to attach the claim to).

Project: `box-tracker-81539`. The script is `scripts/setMember.js`.

---

## One-time: get a service-account key

`scripts/setMember.js` uses the Firebase Admin SDK, which needs a service-account
private key. The key file (`serviceAccountKey.json`) is **gitignored and never committed**
(the repo is public), so it does not exist in a fresh clone — you must download it yourself.

1. Open the [Firebase Console](https://console.firebase.google.com/) and select the
   **box-tracker** project. Make sure you are signed in as the project owner
   (`the project owner account`), not another Google account.
2. Click the gear icon → **Project settings**.
3. Go to the **Service accounts** tab.
4. Click **Generate new private key**, then confirm with **Generate key**. A JSON file
   downloads.
5. Save/rename it to `serviceAccountKey.json` at the **repo root** (same folder as
   `package.json`). The script auto-detects it there.
   - Alternatively, point `GOOGLE_APPLICATION_CREDENTIALS` at the file's path instead of
     placing it at the repo root.

> Security: this key grants admin access to the whole Firebase project. Keep it local,
> never commit it (it is already in `.gitignore`), and don't paste it anywhere. To rotate,
> generate a new key and delete the old one under the same Service accounts tab.

---

## Per new member

1. **The new account signs in once.** Have the person open the app
   ([box-tracker-81539.web.app](https://box-tracker-81539.web.app)) and complete the
   Google sign-in with the account you want to add. They will be signed straight back out
   with "This account isn't authorized to use BoxIndex" — that is expected, and it creates
   the Firebase Auth user record the next step needs.

2. **Grant the claim** from the repo root:
   ```bash
   node scripts/setMember.js <email>
   ```
   On success it prints the granted email + UID. If it prints
   `No Auth user for <email>`, step 1 was skipped or used a different account.

3. **Refresh the member's token.** The claim only lands in the ID token after a token
   refresh. Easiest: the member signs out and signs in again. (Programmatically it is
   `getIdToken(true)`.) After that, the app loads normally for them.

---

## Revoking access

```bash
node scripts/setMember.js <email> --revoke
```

Clears the `member` claim (Admin SDK `setCustomUserClaims(uid, null)`). The change takes
effect on their next token refresh / re-sign-in. To fully remove the account, delete the
user under **Authentication → Users** in the Firebase Console.

---

## Admin role (delete permissions)

The **admin** controls who can delete boxes/photos (SPEC 5.1). Admin is a second custom
claim (`admin`), granted/removed the same way as `member`. No email is hardcoded anywhere -
the app reads `request.auth.token.admin`. **More than one admin is allowed.**

### `setMember.js` command reference

Two custom claims control access: **`member`** is the baseline (without it the rules reject
everything and the app signs the person out as unauthorized); **`admin`** is an extra claim on
top that adds the delete-permission powers. Every command takes effect only after the target's
**next token refresh** (sign out / back in, or `getIdToken(true)`).

| Command | `member` | `admin` | What it does |
|---|:--:|:--:|---|
| `node scripts/setMember.js <email>` | ✅ set | unchanged | Grant normal app access (the usual "add a member"). |
| `node scripts/setMember.js <email> --admin` | ✅ set | ✅ set | Make an admin; also ensures they are a member. Multiple admins are fine. |
| `node scripts/setMember.js <email> --admin --revoke` | unchanged | ❌ cleared | Demote: drop admin only, **keep** normal member access. |
| `node scripts/setMember.js <email> --revoke` | ❌ cleared | ❌ cleared | Remove **all** access (clears every claim). Person is locked out of the app entirely. |

```bash
# Make someone an admin (also ensures they are a member):
node scripts/setMember.js <email> --admin

# Remove admin only, keep their normal member access:
node scripts/setMember.js <email> --admin --revoke

# Remove all access (member + admin) - locks them out of the app:
node scripts/setMember.js <email> --revoke
```

> Don't remove the **last** admin unless intended: with no admin, the Config permission panel
> can't be changed by anyone, and you'd have to re-grant `--admin` via this script to recover.
> To also delete the account record, remove the user under **Authentication → Users** in the
> Firebase Console.

As with `member`, the target must have signed in once, and the change takes effect on their
next token refresh (sign out / back in). The one-time `firestore.rules` change that reads
`token.admin` must be deployed (it ships via CI on push to `main`) before the box-delete
gate is enforced server-side; granting/removing admin afterward needs **no redeploy**.

What admin unlocks: on the Config screen the admin sees every member with "delete boxes" /
"delete photos" toggles; everyone else sees their own permissions read-only. **Default-deny:**
no one can delete until the admin turns a toggle on (the admin is always allowed). Box-delete
blocking is enforced in rules; photo-delete blocking is UI-only (SPEC 5.1 / 15).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No credentials...` | `serviceAccountKey.json` is missing at the repo root and `GOOGLE_APPLICATION_CREDENTIALS` is unset. See "get a service-account key". |
| `No Auth user for <email>` | The member hasn't signed in once yet (step 1), or signed in with a different account. |
| Claim granted but app still rejects them | They haven't refreshed their token — sign out and back in. |
| Wrong project in the console | Confirm you selected **box-tracker** and are signed in as `the project owner account`. |
