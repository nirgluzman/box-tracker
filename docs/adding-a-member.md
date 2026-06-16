# Adding a member (granting access to a new Google account)

Operational runbook for letting a new Google/Gmail account use BoxBuddy. Access is
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
   with "This account isn't authorized to use BoxBuddy" — that is expected, and it creates
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

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `No credentials...` | `serviceAccountKey.json` is missing at the repo root and `GOOGLE_APPLICATION_CREDENTIALS` is unset. See "get a service-account key". |
| `No Auth user for <email>` | The member hasn't signed in once yet (step 1), or signed in with a different account. |
| Claim granted but app still rejects them | They haven't refreshed their token — sign out and back in. |
| Wrong project in the console | Confirm you selected **box-tracker** and are signed in as `the project owner account`. |
