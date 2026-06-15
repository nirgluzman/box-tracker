# BoxBuddy — Build Plan

Tracking checklist for building the app. Source of truth: `SPEC.md`. Check items off as completed.

---

## Phase 0 — Firebase project setup (console, manual)
- [x] Create Firebase project; enable Auth (email/password), Firestore, Storage, Hosting
- [x] Add 4 users manually in Firebase Console (Nir, Oshra, Idan, Itay)
- [x] Collect Firebase config values (for `.env.local` + GitHub secrets)

## Phase 1 — Scaffold project
- [x] `npm create vite@latest -- --template react-ts`
- [x] Install `firebase`, `vite-plugin-pwa`
- [x] Commit base scaffold; confirm `package.json`, `src/`, `index.html` exist
- [x] `.env.example` (all `VITE_*` keys, empty) + `.gitignore` (`.env.local`)

## Phase 2 — Core infra
- [x] `types.ts`: `Box` and `Room` interfaces (SPEC 4.1 / 4.2)
- [x] `firebase.ts`: init app; export auth, db, storage
  - [x] Offline persistence via `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager` (NOT `enableIndexedDbPersistence`)
- [x] `llm.ts`: `summarize(transcript)` — passthrough mode (returns raw transcript)
- [x] `vite-plugin-pwa` config: manifest (name/short_name "BoxBuddy", icons, theme color) + SW with photo runtime caching (cache-first)
- [x] Add PWA icons to `public/icons/` (192, 512) — placeholder solid-color PNGs, replace with branded art

## Phase 3 — Security rules
- [x] `firestore.rules` (boxes + rooms: auth != null) — SPEC 10.1
- [x] `storage.rules` (boxPhotos: auth != null) — SPEC 10.2
- [x] `firebase.json` wiring hosting + rules

## Phase 4 — Shell & navigation
- [x] `App.tsx`: auth state routing
- [x] `Login.tsx`: email/password sign-in, disabled Google button, inline errors
- [x] `Nav.tsx`: responsive (bottom bar < 768px, top bar ≥ 768px)
- [x] Offline indicator banner (shown when `navigator.onLine` false)

## Phase 5 — Rooms / Config
- [x] Seed `rooms` collection (SPEC 4.2) OR populate via Config — "Seed starting rooms" button when empty
- [x] `Config.tsx`: room manager (add/edit/delete, color picker)
  - [x] Range start: auto-suggest next multiple of 100, editable
  - [x] Overlap warning vs existing ranges AND in-use box numbers (incl. orphaned)
  - [x] Download CSV (export) + Upload CSV (import with confirmation summary) wired
  - [x] Orphaned-photos cleanup (scan `boxPhotos/` for folders w/o matching doc) — `listOrphanedFolders`/`deleteOrphanFolder` in `data/photos.ts`, wired in Config (online-only, thumbnails)

## Phase 6 — Add Box (core flow)
- [x] Pre-generate `docId` on form open (`doc(collection(db,'boxes')).id`)
- [x] Room picker pills (color-coded, one per room)
- [x] Mic: Web Speech API, `recognition.lang = 'he-IL'`, live transcript
- [x] On stop → `llm.summarize()` → fills editable description
- [x] Photo upload to `boxPhotos/{docId}/`, append download URL
- [x] Orphaned-photo abandon prompt (Delete / Keep on unmount/reset/nav-away)
- [x] Urgent toggle (default off)
- [x] Save: compute boxNumber (`max in room + 1`, else `rangeStart`) from cache
- [x] Range-overflow warning if `max+1 > rangeStart+99`
- [x] Post-save confirmation ("Saved as Box #N — write this on the box")
- [x] Form resets after save
- [x] Offline: mic + photo disabled with notes; rest saves/queues normally

## Phase 7 — Browse
- [x] Real-time list ordered by boxNumber
- [x] Filters: by room, by urgent
- [x] Responsive: cards < 768px / table ≥ 768px
- [x] Edit (inline, prefilled) + Delete (confirm; removes doc + Storage files)
- [x] Duplicate boxNumber warning badge (same number, same room)
- [x] Export CSV button (full dataset)

## Phase 8 — Unpack
- [x] Search by box number
- [x] Match → room, description, urgent, photos (show all on multi-match)
- [x] No match → "Box not found"

## Phase 9 — CSV
- [x] Export: full `boxes` collection (ignore filters), UTF-8 + BOM — `data/csv.ts`, wired to Browse
  - [x] Columns: `Box Number, Room, Description, Urgent, Added By, Date Added, _docId`
- [x] Import: parse, match by `_docId` — `data/csv.ts` (parseCsv/csvToRecords/planImport) + `applyImportPlan`
  - [x] Existing → update fields (leave photoUrls); empty `_docId` → create
  - [x] Absent `_docId` → mark delete (also remove Storage files)
  - [x] Confirmation summary; extra confirm on large deletion ratio

## Phase 10 — CI/CD & deploy
- [x] `.github/workflows/deploy.yml`: checkout, Node, `npm ci`, `npm run build`, deploy `dist/` + rules
- [x] Add Firebase config values as GitHub repo secrets (7 × `VITE_*` via `gh secret set`)
- [x] Add `FIREBASE_SERVICE_ACCOUNT` secret (box-tracker-81539 adminsdk key)
- [x] Add LLM API key secret (Groq `gsk_…` via `gh secret set`)
- [x] Push to `main`; verify Hosting deploy + rules deploy (live at box-tracker-81539.web.app, HTTP 200)

## Phase 11 — Testing (Android primary target)
- [ ] Offline: airplane mode → add box (typed, no photo) → reconnect → verify sync + add photos via Edit
- [ ] Hebrew voice input
- [ ] Photo upload
- [ ] CSV full round-trip (export → edit → import, no unintended deletions)
- [ ] Install as PWA

---

## Deferred / TBD
- [x] Choose LLM provider; wire real `summarize()` — **Groq** `llama-3.3-70b-versatile` (Gemini free tier region-blocked). Note: Groq keys can't be HTTP-referrer-restricted; client-side exposure accepted for closed audience, or move behind a proxy later (SPEC 10.3)
