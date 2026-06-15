# BoxBuddy — Project Spec

GitHub repo name: `box-tracker`. App display name (browser tab, login screen): `BoxBuddy`.

## 1. Purpose
Track packed moving boxes for a household shipment. Each box gets a number, room, photo, and a short description. Family members add boxes while packing and search by box number while unpacking.

## 2. Tech Stack
- Target platform: **Android only** (Chrome on Android). Mic/voice and PWA install are validated on Android; iOS Safari is not a supported target (it lacks Web Speech API support).
- Vite + React + TypeScript (SPA)
- Firebase Authentication (email/password)
- Firestore (real-time database)
- Firebase Storage (photos)
- Web Speech API (voice transcription)
- LLM API for description summarization — provider TBD (e.g. Gemini 2.0 Flash)
- vite-plugin-pwa (service worker, offline support, installable app)
- GitHub Actions → Firebase Hosting (CI/CD)

## 3. Project Structure
```
box-tracker/
├── .github/workflows/deploy.yml
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

## 5. Authentication
- Email/password only at launch.
- 4 users added manually in Firebase Console: Nir, Oshra, Idan, Itay.
- All users have equal permissions, no roles.
- Auth state persists per device.
- Sign-out button in the app header (visible on every screen once signed in); signing out returns to the Login screen.
- No self-service password reset in-app; a forgotten password is handled by an admin in the Firebase Console (or via the console's "send password reset email").

## 6. Screens

### 6.1 Login
- Email + password fields, sign-in button.
- On success, redirect to Add Box screen.
- On failure, show inline error message.

### 6.2 Add Box
- Box number not shown on the form; assigned automatically on save (see section 4.3).
- Room picker: color-coded pills, one per `rooms` document.
- Mic button starts Web Speech API recognition.
- Live transcript shown while speaking.
- On stop, send transcript to the LLM module for summarization (provider TBD, see section 7).
- Summary is appended to the description field (never overwrites existing text), editable before save - so the user can dictate in several passes until everything is captured. Appended after the current text, comma-separated.
- The box's Firestore document ID is generated client-side when the form opens (e.g. `doc(collection(db, 'boxes')).id`), so photos can be stored under a stable path before the document is written.
- Photo button opens camera or gallery, uploads to Storage under `boxPhotos/{docId}/...`, appends the download URL to photoUrls. The rear-camera "Take photo" button (`capture='environment'`) is enabled on touch devices only (detected via `pointer: coarse`); on laptops/desktops it is shown but disabled/grayed out (with a tooltip), since there is no useful rear camera and `capture` is ignored - "Gallery" upload and voice input remain available there. Same rule applies to the Edit form on Browse.
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
- Mobile: card per box, color-coded by room.
- Desktop: table view, same data.
- Each box has Edit and Delete actions, shown as icons (pencil / trash) for clarity. Delete doubles as "unpacked" — deleting a box that has been opened and emptied is the intended unpacking action.
- Edit opens an inline form, prefilled with current values. The form can also add photos (rear camera or gallery) and remove existing photos on the box, which persist immediately (section 13 — the "type now, add photos later" flow).
- Delete removes the Firestore document and all files in photoUrls from Storage, after a confirmation prompt. Removing an individual photo also prompts for confirmation.
- Boxes with a duplicate `boxNumber` within the same room (see section 4.3) are flagged with a warning badge.
- "Export CSV" button triggers CSV download of the **full dataset**, ignoring any active room/urgent filters (see section 8).

### 6.4 Unpack — merged into Browse
The Unpack screen no longer exists as a separate screen; its capabilities (search by box number / packing number / contents, view photos, and delete an emptied box) are part of Browse (section 6.3). Card view shows room, description, urgent flag, and photos for each match.

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
- While dictating, a live mic-level visualizer (equalizer bars driven by Web Audio `AnalyserNode` on the mic stream) gives feedback that the mic is capturing. Recognition errors (`not-allowed`, `audio-capture`, `no-speech`, `network`, ...) are surfaced as an inline message instead of failing silently. Works in desktop Chrome as well as Android.
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

### 10.1 Firestore Rules
Stored in `firestore.rules`, deployed via Firebase CLI (see section 12).
```
match /boxes/{box} {
  allow read, write: if request.auth != null;
}
match /rooms/{room} {
  allow read, write: if request.auth != null;
}
```

### 10.2 Storage Rules
Stored in `storage.rules`, deployed via Firebase CLI (see section 12).
```
match /boxPhotos/{allPaths=**} {
  allow read, write: if request.auth != null;
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

`.env.example` contains the same keys with empty values, committed to the repo. `VITE_LLM_API_KEY` name and provider TBD (section 7); `llm.ts` can run in passthrough mode without it.

## 12. CI/CD — GitHub Actions
- Workflow file: `.github/workflows/deploy.yml`.
- Trigger: push to `main`.
- Steps: checkout, set up Node, `npm ci` (reproducible install from lockfile), `npm run build` (env vars from secrets), deploy `dist/` to Firebase Hosting, deploy `firestore.rules` and `storage.rules` via `firebase deploy --only firestore:rules,storage` (note: Storage has no `:rules` sub-target — `storage:rules` is parsed as a named bucket target and fails; use `storage`).
- Additional secret required: `FIREBASE_SERVICE_ACCOUNT` (JSON key for deploy auth, used for both Hosting and rules deploys).

## 13. Offline / PWA Support
- App is a PWA: installable to phone home screen, opens full-screen.
- `vite-plugin-pwa` generates the service worker and manifest.
- Manifest: name "BoxBuddy", short_name "BoxBuddy", icons from `public/icons/`, theme color matches app branding.
- Service worker precaches the app shell (JS, CSS, HTML) so the app loads with no connection.
- Runtime caching: Firebase Storage photo URLs cached with a cache-first strategy, so previously viewed photos stay visible offline.
- Firestore offline persistence enabled in `firebase.ts` via the modern cache API (`enableIndexedDbPersistence` is deprecated). Use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. `persistentMultipleTabManager` avoids the single-tab failure of the old API. Reads return cached data when offline. Writes queue locally and sync automatically once reconnected.
- Offline indicator: small banner shown when `navigator.onLine` is false, e.g. "Offline — changes will sync when reconnected".
- Add Box screen when offline:
  - Box number, room, description (typed manually), and urgent flag save normally, queued by Firestore.
  - Mic button disabled, with a note that voice input needs a connection.
  - Photo button disabled, with a note: "Add photos later when back online".
  - Box is created without photos. Photos are added afterward via Edit on the Browse screen, once back online.

## 14. Build Checklist
1. Create Firebase project, enable Auth (email/password), Firestore, Storage, Hosting.
2. Add 4 users manually in Firebase Console.
3. Write `firestore.rules` and `storage.rules` in the repo (section 10).
4. (Deferred) Once an LLM provider is chosen, restrict its API key by HTTP referrer (section 7).
5. Scaffold Vite + React + TypeScript project (`npm create vite@latest -- --template react-ts`), install firebase SDK.
6. Define shared interfaces in `types.ts`: `Box` and `Room`, matching sections 4.1 and 4.2.
7. Build `firebase.ts`: initialize app, export auth, db, storage instances, enable Firestore offline persistence via `initializeFirestore` + `persistentLocalCache`/`persistentMultipleTabManager` (section 13).
8. Install and configure `vite-plugin-pwa`: manifest (name, icons, theme color) and service worker with photo runtime caching.
9. Build `Login.tsx`: email/password sign-in.
10. Build `Nav.tsx`: responsive nav, bottom bar on mobile, top bar on desktop. App header shows the BoxBuddy title and a sign-out button (section 5).
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

- **Google sign-in.** Add "Sign in with Google" as an auth provider alongside email/password. Removed from launch to keep auth to manually-provisioned email/password accounts. Revisit if the user base grows beyond the 4 known users or self-service onboarding is wanted.
- **Username sign-in (instead of full email).** Let users enter just a username at login. Firebase email/password auth still needs an email internally, so map it client-side before `signInWithEmailAndPassword`. Preferred approach for the closed audience: a synthetic email domain (e.g. username `nir` → `nir@boxbuddy.app`), with the Console accounts provisioned using those synthetic emails — no extra Firestore reads or relaxed rules. Alternative: a publicly-readable `usernames/{username}` → email mapping read before sign-in (more moving parts, exposes the mapping). Deferred; launch uses full email.
- **LLM summarization provider.** `llm.ts` ships in passthrough mode (returns the raw transcript). Choose a provider (e.g. Gemini 2.0 Flash), wire `summarize()`, and restrict the API key by HTTP referrer (section 7 / 10.3). If abuse/cost is a concern, move summarization behind a server-side proxy (e.g. a Cloud Function) so the key never ships to the client.
- **Self-service password reset.** Currently handled by an admin in the Firebase Console (section 5). Could add an in-app "forgot password" flow.
- **iOS support.** Android-only at launch because iOS Safari lacks Web Speech API (section 2). A text-only fallback (no mic) could open the app to iOS.
- **Bundle size.** The Firebase SDK produces a single large chunk (~600 KB). Consider route-level code-splitting / dynamic imports if load time becomes an issue.
- **Branded PWA icons.** Launch ships placeholder solid-color icons under `public/icons/`; replace with designed artwork.
