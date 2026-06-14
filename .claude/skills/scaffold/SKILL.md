---
name: scaffold
description: Scaffold the BoxBuddy (box-tracker) Vite + React + TypeScript + Firebase project from SPEC.md. Use only on the initial empty repo before any code exists.
disable-model-invocation: true
---

# Scaffold BoxBuddy

Bootstraps the project per @SPEC.md (sections 3 and 14). Run only when the repo has no `package.json`/`src/` yet. Stop and ask if code already exists.

## Steps

1. **Confirm empty repo.** If `package.json` or `src/` exists, stop and report — do not overwrite.
2. **Create the Vite app** in place: `npm create vite@latest . -- --template react-ts`, then `npm install`.
3. **Install runtime deps:** `npm install firebase` and `npm install -D vite-plugin-pwa`.
4. **Create the file tree** from SPEC section 3: `src/components/{Login,AddBox,Browse,Unpack,Config,Nav}.tsx`, `src/{firebase,llm,types,App,main}.ts(x)`, plus `firebase.json`, `firestore.rules`, `storage.rules`, `.env.example`, `.github/workflows/deploy.yml`, `public/icons/`.
5. **types.ts:** define `Box` and `Room` interfaces matching SPEC 4.1 / 4.2.
6. **firebase.ts:** init app from `VITE_*` env vars; export `auth`, `db`, `storage`. Enable offline persistence with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` (NOT the deprecated `enableIndexedDbPersistence`).
7. **llm.ts:** export `summarize(transcript)`; passthrough (return input unchanged) until an LLM provider is chosen (SPEC 7).
8. **vite-plugin-pwa:** configure manifest (name/short_name "BoxBuddy", icons from `public/icons/`, theme color) and a service worker with cache-first runtime caching for Firebase Storage photo URLs (SPEC 13).
9. **Rules files:** write `firestore.rules` and `storage.rules` exactly per SPEC 10.
10. **.env.example:** the keys from SPEC 11 with empty values. Add `.env.local` to `.gitignore`.
11. **deploy.yml:** push-to-`main` workflow — checkout, Node, `npm ci`, `npm run build` (env from secrets), deploy `dist/` to Firebase Hosting, and `firebase deploy --only firestore:rules,storage:rules` (SPEC 12).

Build screens/components incrementally after scaffolding, following SPEC section 6. Do not implement the full UI in this skill — just produce a compiling skeleton (`npm run build` succeeds).
