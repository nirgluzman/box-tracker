# BoxIndex — Project Spec

GitHub repo name: `box-tracker`. App display name (browser tab, login screen): `BoxIndex`.

## 1. Purpose
Track packed moving boxes for a household shipment. Each box gets a number, room, photo, and a short description. Family members add boxes while packing and search by box number while unpacking.

## 2. Tech Stack
- Target platform: **Android Chrome is primary** — box *adding* (voice, camera, PWA install) is validated there and is the main packing-time device. **Desktop/laptop Chrome is a supported secondary target** for review/browse/config, where the table view and a larger screen are easier (sign-in uses popup there, section 5; responsive layout in section 9). **iOS Safari is not supported** (it lacks Web Speech API support).
- Vite + React + TypeScript (SPA)
- Firebase Authentication (Google sign-in only)
- Firestore (real-time database)
- Firebase Storage (photos)
- Web Speech API (voice transcription)
- LLM API for description summarization — Groq (`llama-3.3-70b-versatile`, section 7)
- vite-plugin-pwa (service worker, offline support, installable app)
- GitHub Actions → Firebase Hosting (CI/CD)

## 3. Project Structure
```
box-tracker/
├── .github/workflows/deploy.yml
├── docs/
│   ├── architecture.md       # system architecture diagram + component overview
│   ├── auth-flow.md          # Google auth flow + manual one-time setup steps
│   └── adding-a-member.md    # runbook: service-account key + grant/revoke a member
├── scripts/
│   └── setMember.js          # Admin SDK: grant `member` claim by email (section 5)
├── public/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── components/
│   │   ├── Login.tsx
│   │   ├── AddBox.tsx
│   │   ├── Browse.tsx
│   │   ├── Config.tsx
│   │   └── Nav.tsx
│   ├── firebase.ts
│   ├── llm.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── firebase.json
├── firestore.rules
├── storage.rules
└── README.md
```

## 4. Data Model

### 4.1 `boxes` collection

| Field | Type | Notes |
|---|---|---|
| boxNumber | number | Unique per room range. Assigned automatically at save time as `max existing number in room + 1` (see section 4.3). Not editable on Add Box; editable later via Edit or CSV. |
| packingNumber | string (optional) | The packing company's own sequential label on the box, entered manually for extra identification. Free text (preserves leading zeros / alphanumeric). Editable on Add Box, Edit, and CSV. Searchable in Browse. |
| room | string | Room name, matches a `rooms` document name. |
| roomColor | string | Hex color, copied from `rooms` at save time. |
| description | string | AI-summarized, 1-2 sentences. |
| urgent | boolean | Default false. |
| photoUrls | array of strings | Firebase Storage download URLs. |
| addedBy | string | Auth user's email or display name. |
| createdAt | timestamp | Set on creation, never edited. |

### 4.2 `rooms` collection

| Field | Type | Notes |
|---|---|---|
| name | string | Room name, e.g. "מטבח". |
| color | string | Hex color, e.g. "#EF9F27". |
| rangeStart | number | Start of this room's box-number range. Set in Config. Default range size is 100 (rangeStart to rangeStart + 99). |

Seed rooms (optional starting set):

| Name | Hebrew | Color | Range |
|---|---|---|---|
| Kitchen | מטבח | #EF9F27 | 100–199 |
| Living room | סלון | #5DCAA5 | 200–299 |
| Parents' bedroom | חדר הורים | #AFA9EC | 300–399 |
| Children's bedroom | חדר ילדים | #F0997B | 400–499 |
| Office | משרד | #85B7EB | 500–599 |
| Bathroom | אמבטיה | #97C459 | 600–699 |
| Basement | מחסן | #B4B2A9 | 700–799 |

### 4.3 Box Numbering Scheme
- Each room has a `rangeStart` (e.g. 100, 200, 300...), set in Config when the room is created. Default range size is 100 numbers per room (rangeStart to rangeStart + 99).
- Box number = `max boxNumber among existing boxes in that room + 1`, read from local cache (works offline, includes pending unsynced boxes). If the room has no boxes yet, the first box gets `rangeStart`.
  - Using max+1 (not count) means deleting a box never causes the next box to reuse a live number. Numbers may have gaps after deletes; that is acceptable.
- Assigned automatically at save time. Not shown or editable while filling out the Add Box form.
- Range overflow: if `max + 1` exceeds `rangeStart + 99`, still assign it but surface a warning in the save confirmation, e.g. "Box #200 exceeds the Kitchen range (100–199) — consider widening the range in Config." This prevents silent overflow into the next room's range.
- After save, a confirmation shows the assigned number for labeling the box, e.g. "Saved as Box #205 (Kitchen) — write this on the box."
- Recommended workflow: per room, only one person enters box data at a time, so two people don't compute the same number for that room. (Each room is handled by one person.)
- Safety net: the Browse screen flags any duplicate `boxNumber` values (same number within the same room) with a warning badge, fixable via Edit.

### 4.4 `members` collection
One doc per signed-in user, id = auth uid. Drives the admin's delete-permission panel (section 5.1).

| Field | Type | Notes |
|---|---|---|
| email | string \| null | Google email, for display in the admin panel. Self-written on sign-in. |
| displayName | string \| null | Google display name. Self-written on sign-in. |
| photoURL | string \| null | Google profile photo URL. Self-written on sign-in. |
| admin | boolean (optional) | Display-only mirror of the `admin` claim; written only by the admin's own client (rules forbid anyone else). Real authority is the token claim. |
| canDeleteBox | boolean (optional) | Admin-set. Default-deny: only explicit `true` allows; absent/`false` blocks. Enforced in rules + UI. |
| canDeletePhoto | boolean (optional) | Admin-set. Default-deny: only explicit `true` allows; absent/`false` blocks. UI-only (Storage rules can't read Firestore). |

## 5. Authentication
- **Google sign-in only.** No email/password, no in-app passwords. One "Sign in with Google" button (official Google logo + wordmark, per Google's branding guidelines).
- The 4 members (Nir, Oshra, Idan, Itay) each sign in with their own Google account. On their own phone they stay signed in (auth state persists per device).
- **Sign-in method is device-dependent (hybrid popup/redirect).** Android (the primary target) uses `signInWithRedirect`, because popups are unreliable in the standalone PWA. Desktop/laptop Chrome uses `signInWithPopup`, because the redirect flow silently fails there (it round-trips but Chrome's storage partitioning loses the result, dropping the user back on Login with no error) - this also covers localhost dev and the shared-laptop case. The branch is `useRedirect = /Android/i.test(navigator.userAgent)` in `Login.tsx`. Either way the member-claim check is handled centrally on app load (App.tsx) via `onAuthStateChanged`; the redirect result is additionally read via `getRedirectResult`.
- **Shared laptop:** the provider is configured with `setCustomParameters({ prompt: 'select_account' })` so Google always shows the account chooser instead of silently resuming the last user. Combined with the header sign-out button, any of the 4 can sign in on one laptop.
- **Access control via custom claims (allowlist).** Being signed in with *any* Google account is not enough — the Firestore/Storage rules require a `member` custom claim (section 10). Only the 4 provisioned accounts carry it, so a random Google account is rejected even though `request.auth != null`. This keeps the audience closed without putting any email addresses in the (public) repo.
  - Claims are provisioned with `scripts/setMember.js`, a small Firebase Admin SDK script run once per member: `node scripts/setMember.js <email>`. It looks the user up by email and sets `{ member: true }`. The member must have signed in once first (so the Auth user record exists), then refresh their token (re-sign-in or `getIdToken(true)`) for the claim to take effect.
  - The script authenticates with a service-account JSON key referenced via `GOOGLE_APPLICATION_CREDENTIALS` (or `serviceAccountKey.json` at repo root). The key is **gitignored, never committed** (the repo is public). Generating that key and the full add/revoke runbook are in [docs/adding-a-member.md](docs/adding-a-member.md).
  - To revoke access: `node scripts/setMember.js <email> --revoke` (clears the claim via Admin SDK `setCustomUserClaims(uid, null)`), or delete the user in the Console.
- Members are equal except for an optional **admin** role used to gate deletion (below). The two claims are `member` (required for any access) and `admin` (the deletion gatekeeper). Any number of users can hold the `admin` claim - the design is not limited to one admin.
- Sign-out button in the app header (visible on every screen once signed in); signing out returns to the Login screen.
- The header shows the signed-in user's Google **profile photo** in a circle (not the email). `addedBy` on each box still records the user's email for change tracking (section 4.1).
- No password reset needed - Google handles account recovery.

### 5.1 Delete permissions (admin)
Guards against a family member (e.g. a child) deleting boxes or photos. Editing a box description is always allowed; only deletion is gated. **Default-deny:** no one can delete until the admin grants it (the admin itself is always allowed).
- **Admin identity = `admin` custom claim**, granted alongside `member` via `node scripts/setMember.js <email> --admin` (drop it again with `--admin --revoke`). The admin's email appears **nowhere** - not in committed source, not in the public client bundle, not in `firestore.rules`. Rules and client both read `request.auth.token.admin`. This is decoupled from deploys: granting/revoking admin is just re-running the script (no rebuild/redeploy); only the one-time rules change ships through CI.
- **Per-user permissions** live on a `members/{uid}` doc (section 4.4): `canDeleteBox` and `canDeletePhoto`. **Default-deny**: only an explicit `true` allows; absent or `false` blocks that user. The admin is never blocked.
- **Config screen (section 6.5):** the admin sees every member (profile photo + name) with two toggles (delete boxes / delete photos); their own row shows "Admin - full access". Non-admins see their own two permissions **read-only**, plus who the admin is.
- **Enforcement is asymmetric:**
  - *Box deletion* is enforced in **`firestore.rules`** (the rule reads the member doc) **and** in the UI - real security.
  - *Photo deletion* is **UI-only** (button hidden when blocked). Firebase **Storage rules cannot read Firestore**, so a live admin-toggle can't be enforced there. UI-only photo protection is therefore weak (a determined user could bypass it); see section 15 for the claims/Cloud-Function migration that would make it real.
- **Self-registration:** on each sign-in the client upserts its own `members/{uid}` profile (email, displayName, photoURL) so the admin panel can show photos. Rules forbid a member from writing the protected keys (`canDeleteBox`, `canDeletePhoto`, `admin`) on any doc; only the admin (claim) can. The admin's client also writes `admin: true` on its own doc as a display-only mirror so the Config banner can show the admin's email.

## 6. Screens

### 6.1 Login
- Single "Sign in with Google" button using the official Google logo (per Google branding guidelines), centered under the BoxIndex title.
- Hybrid sign-in with `prompt: 'select_account'` (section 5): `signInWithRedirect` on Android, `signInWithPopup` on desktop/laptop. The redirect result is read on return via `getRedirectResult` in App.tsx; the popup result resolves in-place. Both paths run the member-claim gate through `onAuthStateChanged` in App.tsx.
- On success, redirect to Add Box screen.
- On failure (redirect error, network, or a signed-in account without the `member` claim), show inline error message. A non-member is signed back out with a clear "This account isn't authorized to use BoxIndex" message.

### 6.2 Add Box
- Box number not shown on the form; assigned automatically on save (see section 4.3).
- Room picker: color-coded pills, one per `rooms` document.
- Mic button starts Web Speech API recognition.
- Live transcript shown while speaking.
- On stop, send transcript to the LLM module for summarization (Groq, see section 7).
- Summary is appended to the description field (never overwrites existing text), editable before save - so the user can dictate in several passes until everything is captured. Appended after the current text, comma-separated.
- The box's Firestore document ID is generated client-side when the form opens (e.g. `doc(collection(db, 'boxes')).id`), so photos can be stored under a stable path before the document is written.
- Photo button opens camera or gallery, uploads to Storage under `boxPhotos/{docId}/...`, appends the download URL to photoUrls. The rear-camera "Take photo" button (`capture='environment'`) is enabled on touch devices only (detected via `pointer: coarse`); on laptops/desktops it is shown but disabled/grayed out (with a tooltip), since there is no useful rear camera and `capture` is ignored - "Gallery" upload and voice input remain available there. Same rule applies to the Edit form on Browse.
- Phone gallery: the app uses a plain `<input type="file">`, so it has no access to the device gallery and never deletes anything from it. The captured/selected file is only copied up to Storage. "Gallery" picks an existing photo (stays in the gallery). For "Take photo" (`capture`), whether the shot is also saved to the camera roll is up to Android / the OEM camera app - most devices do not add web-capture photos to the gallery; the app neither relies on nor prevents this.
- Orphaned photos: if the user uploads photos then leaves the form without saving (navigates away, resets, or closes the app), those files would otherwise stay under that `docId` path with no document. Handling:
  - Track the set of uploaded photo paths for the current draft in component state.
  - On abandon (navigation away / component unmount / reset without save) while uploaded photos exist for an unsaved box, prompt the user: "You added N photo(s) but didn't save this box. Delete them?" with **Delete** (removes the files from Storage) and **Keep** options.
  - If the prompt can't run (app killed, crash, lost connection mid-exit), the files remain. Config offers an "Orphaned photos" cleanup: scan `boxPhotos/` for `docId` folders that have no matching `boxes` document and let the user delete them. This is the after-the-fact safety net.
- Urgent toggle, default off.
- Save button computes the box number (`max boxNumber in room + 1`, or `rangeStart` if the room is empty; see section 4.3) and writes the document to `boxes` using the pre-generated `docId`.
- After save, a confirmation shows the assigned number, e.g. "Saved as Box #205 (Kitchen) — write this on the box." plus the range-overflow warning if applicable (section 4.3).
- Form resets after save.
- Offline behavior: see section 13.

### 6.3 Browse (also serves Unpack)
Browse is the single screen for both browsing while packing and finding a box while unpacking; the former separate Unpack screen has been merged in.
- Real-time list of all boxes from `boxes`, ordered by boxNumber.
- Search controls (three separate fields): **box number** (exact), **packing number** (`packingNumber`, exact, case-insensitive), and **contents** (fuzzy text over `description`). Box number and packing number are separate fields on purpose — the two numbering schemes can collide. All search fields and the filters below AND together; empty fields are ignored.
- Contents search is token-based and tolerant: each query word matches if it equals, contains, or is contained by any description word (bidirectional substring, >=2 chars). This handles plurals (`glass` ↔ `glasses`) and Hebrew attached prefixes (`צלחות` ↔ `וצלחות`) without an LLM or stemmer.
- Filter controls: by room (multi-select pills — pick one or several rooms, or "All" to clear) and by urgent flag.
- "Group by room" option: when enabled, the list is split into per-room sections (ordered by `rangeStart`, deleted-room names last) with a color-coded header and box count; otherwise it stays a flat boxNumber-ordered list. Works in both card and table views.
- Mobile: a compact card per box, color-coded by room, tuned for scanning 200+ boxes. The card is a glance view — box number plus a 2-line (clamped) description, then a small meta line (room, packing #, urgent, duplicate badge, and a photo icon + count when the box has photos). Tapping the card opens a **detail popup** (full description, photo thumbnails, "Added by", and Edit/Delete actions); it closes on the backdrop, the × (top-right), Escape, or the Android back button.
- Desktop: table view, same data, including a Photos column (photo icon + count) and inline Edit/Delete actions per row.
- Photos open a full-screen, swipeable, pinch-to-zoom viewer (via the photo icon + count on a card/row, or a thumbnail in the mobile detail popup).
- Each box has Edit and Delete actions, shown as icons (pencil / trash) for clarity — inline in the row on desktop, inside the detail popup on mobile. Delete doubles as "unpacked" — deleting a box that has been opened and emptied is the intended unpacking action.
- Edit opens an inline form, prefilled with current values (on mobile it replaces the card in the list). The form can also add photos (rear camera or gallery) and remove existing photos on the box, which persist immediately (section 13 — the "type now, add photos later" flow).
- Delete removes the Firestore document and all files in photoUrls from Storage, after a confirmation prompt. Removing an individual photo also prompts for confirmation.
- Delete actions respect the admin's per-user delete permissions (section 5.1): a blocked user sees the box-delete button disabled (tooltip "Deleting is disabled by the admin") and the per-photo remove button hidden. Editing is unaffected.
- Boxes with a duplicate `boxNumber` within the same room (see section 4.3) are flagged with a warning badge.
- "Export CSV" button triggers CSV download of the **full dataset**, ignoring any active room/urgent filters (see section 8).

### 6.4 Unpack — merged into Browse
The Unpack screen no longer exists as a separate screen; its capabilities (search by box number / packing number / contents, view photos, and delete an emptied box) are part of Browse (section 6.3). On mobile the card shows the box number, room, a 2-line description glance, urgent flag, and a photo indicator; tapping it opens the detail popup with the full description and photos for each match.

### 6.5 Config
- Room manager: list of rooms with name, color swatch, and number range.
- Color palette: a curated, shared list of colors (`settings/palette` doc, default = seed-room colors). Config has a palette manager to add / remove colors. Rooms pick their color from this palette rather than a free picker, keeping the scheme consistent. Removing a palette color does not change rooms already using it; an out-of-palette color stays selectable when editing that room.
- Color UI (no Hue/Saturation/Value picker - users found continuous SV pickers, including the OS-native `<input type="color">` dialog and `react-colorful`, unnatural):
  - **Picking a room color** = swatch selection from the palette (the existing color pills).
  - **Adding / editing a palette color** = a honeycomb color-wheel picker (`SwatchGridPicker`): a hexagon-shaped SVG honeycomb of hex cells where hue is the angle around the center, saturation grows with distance, and lightness fades to white at the center (full spectrum). Tap a cell to choose it; the selected cell is outlined. No SV square, no native color dialog, no hex text field. Stored as a hex string in `settings/palette`. Editing a palette color recolors every room/box using it (one batch).
- Add room: name input, color (chosen from the palette), and range start (number input, auto-suggested as the next available multiple of 100, editable).
- Adding a room warns if the entered range start overlaps with (a) an existing room's range (rangeStart to rangeStart + 99), or (b) box numbers already in use by any box (including boxes whose room was since deleted). This prevents a new room from reusing a freed range and colliding with orphaned boxes.
- Edit room: change name, color, or range start. Updates the `rooms` document. Changing range start does not renumber existing boxes, only affects boxes added afterward.
- Delete room: removes from `rooms`. Boxes already assigned to that room keep their stored room name, color, and numbers.
- Delete permissions (section 5.1): the admin sees a per-member panel (profile photo + name, with "delete boxes" / "delete photos" toggles); their own row shows "Admin - full access". Non-admins see their own two permissions read-only plus who the admin is. The panel also surfaces the admin's email (the "admin message" on this screen).
- Confirmation prompts: per-device toggles (one per destructive action: delete box, delete photo, delete room, delete palette color, delete orphaned photos) to enable/disable the "Are you sure?" prompt. Default all on. Stored in `localStorage`, not Firestore, so one user disabling a guard does not remove the safety net for the other 3 users. The CSV mass-deletion confirmation (section 8.2) and the Add Box unsaved-photos prompt (section 6.2) are always on and not toggleable.
- "Download CSV" button (same as Browse export).
- "Upload CSV" button (see section 8.2).
- "Orphaned photos" cleanup: scans `boxPhotos/` for `docId` folders with no matching `boxes` document, lists them with thumbnails/counts, and lets the user delete them (section 6.2). Requires a connection.

## 7. Voice-to-Summary Flow
- Web Speech API (`webkitSpeechRecognition` on Android Chrome). There is no "auto" language value, and the API recognizes only one language per recording. A small language selector by the mic sets `recognition.lang` - default `he-IL`, plus `en-US` and `de-DE`. This lets the user dictate foreign items in their own language so they keep their original script (a Hebrew recognizer would transliterate, e.g. spoken "Teller" → `טלר`). Recordings append (see below), so German/English and Hebrew passes combine into one list.
- On `onresult`, collect final transcript.
- Transcript is sent to `llm.ts`, a small abstraction module with one function (`summarize(transcript)`). Provider: **Groq** (`llama-3.3-70b-versatile`, OpenAI-compatible endpoint). Gemini was evaluated but its free tier is region-blocked.
- The goal is a tight box-contents label, not a prose summary: extract only the physical items packed, as a concise comma-separated list, dropping filler, repetitions, hesitations, side comments, and background talk. Keep each word in its original language — any English or German word is kept exactly as-is in its original Latin letters (never translated, never transliterated into Hebrew); Hebrew words stay in Hebrew. Output only the list — no preamble or quotes. If no items are found, return the transcript with filler removed. Implemented as a system prompt:

```
You label moving boxes. From the spoken transcript of one box's contents,
extract a concise, comma-separated list of the physical items only. Keep each
word in its original language: if a word is written in English or German (Latin
letters), copy it verbatim - never translate it and never transliterate it into
Hebrew, EVEN IF it has a common Hebrew equivalent. Hebrew words stay in Hebrew.
For example, the transcript "Teller וכוסות" must output exactly "Teller, כוסות"
(Teller stays German), and "screwdriver וברגים" must output "screwdriver, ברגים".
Remove filler words, repetitions, hesitations, side comments, and any background
talk or anything that is not an item being packed. Output ONLY the list — no
introduction, no explanation, no quotes, no trailing punctuation. If no items
can be identified, return the transcript with filler removed.
```

- Response text is appended to the description field (comma-separated), preserving anything already there, so multiple recordings accumulate rather than overwrite.
- While dictating, an animated equalizer ("listening") indicator is shown. It is CSS-driven only — deliberately NOT a second `getUserMedia` stream, since opening one concurrently with `SpeechRecognition` starves recognition of the mic on some devices. Recognition errors (`not-allowed`, `audio-capture`, `no-speech`, `network`, ...) are surfaced as an inline message instead of failing silently. To make a completed recording reliable, `onend` falls back to the latest interim transcript when the engine never marks a result `isFinal` (common in desktop Chrome). Works in desktop Chrome as well as Android.
- User can edit the result before saving (manual keyboard editing is always available).
- If no LLM key is set or the request fails, `llm.ts` returns the raw transcript unchanged (passthrough), so voice input never blocks saving.

## 8. CSV Import/Export

### 8.1 Export
- Triggered from Browse or Config screen.
- Always exports the **complete `boxes` collection**, regardless of any filters active on the Browse screen. This is required because import (section 8.2) infers deletions from rows absent in the file — a filtered export re-imported would wrongly delete the filtered-out boxes.
- Columns, in order: `Box Number, Packing Number, Room, Description, Urgent, Added By, Date Added, _docId`.
- `Urgent` written as `Yes` or `No`.
- `Date Added` formatted `YYYY-MM-DD`, derived from `createdAt`.
- `_docId` is the Firestore document ID, last column.
- File encoded UTF-8 with BOM.
- `photoUrls` excluded.

### 8.2 Import
- User selects an edited CSV file.
- Parse rows, match each row to a `boxes` document by `_docId`.
- Row with existing `_docId`: update boxNumber, room, roomColor (looked up from `rooms` by room name), description, urgent. Leave photoUrls untouched.
- Row with empty `_docId`: create a new `boxes` document with these fields, photoUrls set to empty array.
- Existing `_docId` not present in the uploaded file: mark for deletion. (Safe only because export is always the full dataset, section 8.1.)
- Before committing, show a summary: count of updates, new boxes, and deletions. If the deletion count is large relative to the dataset (e.g. the file looks like a partial/filtered export), require explicit extra confirmation to guard against accidental mass deletion.
- On confirm, apply changes. Deletions also remove associated Storage files.
- On cancel, discard parsed data.

## 9. Responsive Design
- Single codebase, CSS breakpoints, no separate mobile/desktop components.
- Breakpoint: 768px.
- Below 768px: bottom tab navigation bar, card-based lists, large touch targets for mic and camera buttons.
- Above 768px: top navigation bar, table-based lists, Add Box form shown alongside a live preview panel.

## 10. Security

Access is gated by the `member` custom claim (section 5), not just by being signed in. Custom claims are the only mechanism readable by **both** the Firestore and Storage rule engines (Storage rules cannot read Firestore), so the same `request.auth.token.member == true` check secures both services. No email addresses appear in these (committed, public) files.

### 10.1 Firestore Rules
Stored in `firestore.rules`, deployed via Firebase CLI (see section 12). `boxes`
delete is gated per user by the admin (section 5.1); the `members` collection
lets a user write only their own profile, never the protected permission keys.
```
function isMember()  { return request.auth.token.member == true; }
function isAdmin()   { return request.auth.token.admin  == true; }
function canDeleteBox() {
  let path = /databases/$(database)/documents/members/$(request.auth.uid);
  // Default-deny: blocked unless the admin set canDeleteBox == true. Admin never blocked.
  return isAdmin() || (exists(path) && get(path).data.get('canDeleteBox', false) == true);
}

match /boxes/{box} {
  allow read, create, update: if isMember();
  allow delete: if isMember() && canDeleteBox();
}
match /rooms/{room}   { allow read, write: if isMember(); }
match /settings/{doc} { allow read, write: if isMember(); }
match /members/{uid} {
  allow read: if isMember();
  // Self may write own profile only; admin may write anything. Protected keys:
  // canDeleteBox / canDeletePhoto / admin.
  allow create: if isAdmin() || (isMember() && request.auth.uid == uid &&
    !request.resource.data.keys().hasAny(['canDeleteBox','canDeletePhoto','admin']));
  allow update: if isAdmin() || (isMember() && request.auth.uid == uid &&
    !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['canDeleteBox','canDeletePhoto','admin']));
  allow delete: if isAdmin();
}
```

### 10.2 Storage Rules
Stored in `storage.rules`, deployed via Firebase CLI (see section 12).
```
match /boxPhotos/{allPaths=**} {
  allow read, write: if request.auth.token.member == true;
}
```

### 10.3 API Key Restrictions
- Firebase config values are not secret. Security comes from rules above plus Auth.
- LLM API key: `VITE_*` env vars are bundled into the public client JS and are therefore visible to anyone. The only mitigation client-side is restricting the key in the provider's console to HTTP referrer = the Firebase Hosting domain (set once provider is chosen, section 7). If LLM abuse/cost becomes a concern, move summarization behind a small server-side proxy (e.g. a Cloud Function) so the key never ships to the client. Accepted as client-side for launch given the closed 4-user audience.

## 11. Environment Variables
Stored as GitHub repo secrets, injected at build time, and in `.env.local` for local dev (gitignored).

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_LLM_API_KEY=
```

`.env.example` contains the same keys with empty values, committed to the repo. `VITE_LLM_API_KEY` holds the Groq API key (provider chosen, section 7); `llm.ts` still runs in passthrough mode if it is absent.

## 12. CI/CD — GitHub Actions
- Workflow file: `.github/workflows/deploy.yml`.
- Trigger: push to `main`.
- Steps: checkout, set up Node, `npm ci` (reproducible install from lockfile), `npm run build` (env vars from secrets), deploy `dist/` to Firebase Hosting, deploy `firestore.rules` and `storage.rules` via `firebase deploy --only firestore:rules,storage` (note: Storage has no `:rules` sub-target — `storage:rules` is parsed as a named bucket target and fails; use `storage`).
- Additional secret required: `FIREBASE_SERVICE_ACCOUNT` (JSON key for deploy auth, used for both Hosting and rules deploys).

## 13. Offline / PWA Support
- App is a PWA: installable to phone home screen, opens full-screen.
- `vite-plugin-pwa` generates the service worker and manifest.
- Manifest: name "BoxIndex", short_name "BoxIndex", icons from `public/icons/`, theme color matches app branding.
- Service worker precaches the app shell (JS, CSS, HTML) so the app loads with no connection.
- Runtime caching: Firebase Storage photo URLs cached with a cache-first strategy, so previously viewed photos stay visible offline.
- Firestore offline persistence enabled in `firebase.ts` via the modern cache API (`enableIndexedDbPersistence` is deprecated). Use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. `persistentMultipleTabManager` avoids the single-tab failure of the old API. Reads return cached data when offline. Writes queue locally and sync automatically once reconnected.
- Offline indicator: small banner shown when `navigator.onLine` is false, e.g. "Offline — changes will sync when reconnected".
- Back-button handling: navigation is mirrored into `history` so the Android back button moves between screens. In the installed PWA (`display-mode: standalone`, no URL bar) a `guard` history entry is seeded below the root so that, once back reaches the first screen, further back presses are absorbed instead of exiting the app — exiting would drop auth state and force a re-auth/re-sync on relaunch. In a normal browser tab the trap is skipped and back behaves normally. Implemented in `App.tsx`.
- Add Box screen when offline:
  - Box number, room, description (typed manually), and urgent flag save normally, queued by Firestore.
  - Mic button disabled, with a note that voice input needs a connection.
  - Photo button disabled, with a note: "Add photos later when back online".
  - Box is created without photos. Photos are added afterward via Edit on the Browse screen, once back online.

## 14. Build Checklist
1. Create Firebase project, enable Auth (**Google** sign-in provider), Firestore, Storage, Hosting. Add the OAuth support email and authorized domains (Hosting domain auto-added; add `localhost` for dev).
2. Each of the 4 members signs in once with Google (creates their Auth user record), then grant the `member` claim: `node scripts/setMember.js <email>` per member (needs a service-account key, gitignored). Members re-sign-in to pick up the claim. Full runbook (incl. generating the service-account key): [docs/adding-a-member.md](docs/adding-a-member.md).
3. Write `firestore.rules` and `storage.rules` in the repo, gated on `request.auth.token.member == true` (section 10).
4. (Deferred) Once an LLM provider is chosen, restrict its API key by HTTP referrer (section 7).
5. Scaffold Vite + React + TypeScript project (`npm create vite@latest -- --template react-ts`), install firebase SDK.
6. Define shared interfaces in `types.ts`: `Box` and `Room`, matching sections 4.1 and 4.2.
7. Build `firebase.ts`: initialize app, export auth, db, storage instances, enable Firestore offline persistence via `initializeFirestore` + `persistentLocalCache`/`persistentMultipleTabManager` (section 13).
8. Install and configure `vite-plugin-pwa`: manifest (name, icons, theme color) and service worker with photo runtime caching.
9. Build `Login.tsx`: "Sign in with Google" button (official logo), hybrid `signInWithPopup` (desktop) / `signInWithRedirect` (Android) + `prompt: 'select_account'`; redirect result + member-claim check handled in App.tsx (sections 5, 6.1).
10. Build `Nav.tsx`: responsive nav, bottom bar on mobile, top bar on desktop. App header shows the BoxIndex title, the user's Google profile photo in a circle, and a sign-out button (section 5).
11. Build offline indicator component, shown when `navigator.onLine` is false.
12. Seed `rooms` collection with starting rooms, colors, and ranges (section 4.2), or build empty and let Config screen populate it.
13. Build `Config.tsx`: room manager (add/edit/delete, palette swatch selection for room color + discrete `SwatchGridPicker` (preset grid + hex field, no SV picker) for adding/editing palette colors, range start with auto-suggest and overlap warning), orphaned-photos cleanup (section 6.2/6.5).
14. Build `AddBox.tsx`: pre-generate `docId` on open, room pills, mic (`he-IL`) + `llm.ts` summary (passthrough until provider chosen), photo upload to `boxPhotos/{docId}/`, urgent toggle, save with automatic box-number assignment (`max+1`, section 4.3), range-overflow warning, and post-save confirmation, mic/photo disabled offline.
15. Build `Browse.tsx`: real-time list, search (box number / packing number / contents), filters, card/table responsive views, edit/delete (delete = unpacked), duplicate box-number warning badge, CSV export. Absorbs the former Unpack screen.
16. (Merged into step 15 — no separate Unpack screen.)
17. Implement CSV export (section 8.1) — always full dataset, filters ignored.
18. Implement CSV import with confirmation summary (section 8.2).
19. Write `.github/workflows/deploy.yml`, including the rules-deploy step.
20. Add Firebase config values as GitHub repo secrets. Add LLM API key once provider is chosen.
21. Add `FIREBASE_SERVICE_ACCOUNT` secret for deploy.
22. Push to `main`, verify app deploy to Firebase Hosting and rules deploy to Firestore/Storage.
23. Test offline: enable airplane mode, add a box with typed description and no photo, reconnect, verify it syncs to Firestore and photos can be added via Edit.
24. Test on an Android phone (primary target): Hebrew voice input, photo upload, CSV full round-trip (export → edit → import, verify no unintended deletions), install as PWA.

## 15. Future Development & Improvements
Out of scope for the initial launch (closed 4-user audience, Android-only). Captured here so the decisions aren't lost.

- **Self-service member onboarding.** Today the `member` custom claim is granted manually via `scripts/setMember.js` (section 5). If the user base grows, move provisioning to an admin UI or a Cloud Function (e.g. auto-grant for an allowed email domain on first sign-in).
- **Real (rules-enforced) photo-delete permission.** Box deletion is enforced in `firestore.rules`, but the per-user photo-delete block (section 5.1) is **UI-only** because Firebase **Storage rules cannot read Firestore** - so a determined user could bypass it, making UI-only protection for photos effectively meaningless against anything but accidents. To make it real, mirror the permission into a **custom claim** (the only thing Storage rules can read) and gate `storage.rules` on it (`allow delete: if request.auth.token.canDeletePhoto != false`). Because claims can only be set server-side, the admin's toggle would call a small **Cloud Function** (Admin SDK `setCustomUserClaims`) instead of writing Firestore directly, and the affected user would pick up the change on next token refresh. Consider this if the audience widens beyond trusted family or if accidental-only protection proves insufficient.
- **LLM summarization key exposure.** Provider is **Groq** (`llama-3.3-70b-versatile`), wired in `llm.ts` (passthrough fallback if no key). Groq keys cannot be HTTP-referrer-restricted, so the `VITE_LLM_API_KEY` ships in the public client bundle — accepted for the closed 4-user audience. If abuse/cost becomes a concern, move summarization behind a server-side proxy (e.g. a Cloud Function) so the key never ships to the client (section 7 / 10.3).
- **iOS support.** Android-only at launch because iOS Safari lacks Web Speech API (section 2). A text-only fallback (no mic) could open the app to iOS.
- **Bundle size.** The Firebase SDK produces a single large chunk (~600 KB). Consider route-level code-splitting / dynamic imports if load time becomes an issue.
- **Branded PWA icons.** Launch ships placeholder solid-color icons under `public/icons/`; replace with designed artwork.
