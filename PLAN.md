# BoxBuddy — Build Plan

Tracking checklist for building the app. Source of truth: `SPEC.md`. Check items off as completed.

---

## Phase 0 — Firebase project setup (console, manual)
- [ ] Create Firebase project; enable Auth (email/password), Firestore, Storage, Hosting
- [ ] Add 4 users manually in Firebase Console (Nir, Oshra, Idan, Itay)
- [ ] Collect Firebase config values (for `.env.local` + GitHub secrets)

## Phase 1 — Scaffold project
- [ ] `npm create vite@latest -- --template react-ts`
- [ ] Install `firebase`, `vite-plugin-pwa`
- [ ] Commit base scaffold; confirm `package.json`, `src/`, `index.html` exist
- [ ] `.env.example` (all `VITE_*` keys, empty) + `.gitignore` (`.env.local`)

## Phase 2 — Core infra
- [ ] `types.ts`: `Box` and `Room` interfaces (SPEC 4.1 / 4.2)
- [ ] `firebase.ts`: init app; export auth, db, storage
  - [ ] Offline persistence via `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager` (NOT `enableIndexedDbPersistence`)
- [ ] `llm.ts`: `summarize(transcript)` — passthrough mode (returns raw transcript)
- [ ] `vite-plugin-pwa` config: manifest (name/short_name "BoxBuddy", icons, theme color) + SW with photo runtime caching (cache-first)
- [ ] Add PWA icons to `public/icons/` (192, 512)

## Phase 3 — Security rules
- [ ] `firestore.rules` (boxes + rooms: auth != null) — SPEC 10.1
- [ ] `storage.rules` (boxPhotos: auth != null) — SPEC 10.2
- [ ] `firebase.json` wiring hosting + rules

## Phase 4 — Shell & navigation
- [ ] `App.tsx`: auth state routing
- [ ] `Login.tsx`: email/password sign-in, disabled Google button, inline errors
- [ ] `Nav.tsx`: responsive (bottom bar < 768px, top bar ≥ 768px)
- [ ] Offline indicator banner (shown when `navigator.onLine` false)

## Phase 5 — Rooms / Config
- [ ] Seed `rooms` collection (SPEC 4.2) OR populate via Config
- [ ] `Config.tsx`: room manager (add/edit/delete, color picker)
  - [ ] Range start: auto-suggest next multiple of 100, editable
  - [ ] Overlap warning vs existing ranges AND in-use box numbers (incl. orphaned)
  - [ ] Download CSV / Upload CSV buttons
  - [ ] Orphaned-photos cleanup (scan `boxPhotos/` for folders w/o matching doc)

## Phase 6 — Add Box (core flow)
- [ ] Pre-generate `docId` on form open (`doc(collection(db,'boxes')).id`)
- [ ] Room picker pills (color-coded, one per room)
- [ ] Mic: Web Speech API, `recognition.lang = 'he-IL'`, live transcript
- [ ] On stop → `llm.summarize()` → fills editable description
- [ ] Photo upload to `boxPhotos/{docId}/`, append download URL
- [ ] Orphaned-photo abandon prompt (Delete / Keep on unmount/reset/nav-away)
- [ ] Urgent toggle (default off)
- [ ] Save: compute boxNumber (`max in room + 1`, else `rangeStart`) from cache
- [ ] Range-overflow warning if `max+1 > rangeStart+99`
- [ ] Post-save confirmation ("Saved as Box #N — write this on the box")
- [ ] Form resets after save
- [ ] Offline: mic + photo disabled with notes; rest saves/queues normally

## Phase 7 — Browse
- [ ] Real-time list ordered by boxNumber
- [ ] Filters: by room, by urgent
- [ ] Responsive: cards < 768px / table ≥ 768px
- [ ] Edit (inline, prefilled) + Delete (confirm; removes doc + Storage files)
- [ ] Duplicate boxNumber warning badge (same number, same room)
- [ ] Export CSV button (full dataset)

## Phase 8 — Unpack
- [ ] Search by box number
- [ ] Match → room, description, urgent, photos (show all on multi-match)
- [ ] No match → "Box not found"

## Phase 9 — CSV
- [ ] Export: full `boxes` collection (ignore filters), UTF-8 + BOM
  - [ ] Columns: `Box Number, Room, Description, Urgent, Added By, Date Added, _docId`
- [ ] Import: parse, match by `_docId`
  - [ ] Existing → update fields (leave photoUrls); empty `_docId` → create
  - [ ] Absent `_docId` → mark delete (also remove Storage files)
  - [ ] Confirmation summary; extra confirm on large deletion ratio

## Phase 10 — CI/CD & deploy
- [ ] `.github/workflows/deploy.yml`: checkout, Node, `npm ci`, `npm run build`, deploy `dist/` + rules
- [ ] Add Firebase config values as GitHub repo secrets
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` secret
- [ ] Add LLM API key secret (once provider chosen)
- [ ] Push to `main`; verify Hosting deploy + rules deploy

## Phase 11 — Testing (Android primary target)
- [ ] Offline: airplane mode → add box (typed, no photo) → reconnect → verify sync + add photos via Edit
- [ ] Hebrew voice input
- [ ] Photo upload
- [ ] CSV full round-trip (export → edit → import, no unintended deletions)
- [ ] Install as PWA

---

## Deferred / TBD
- [ ] Choose LLM provider; wire real `summarize()`; restrict API key by HTTP referrer (SPEC 7 / 10.3)
