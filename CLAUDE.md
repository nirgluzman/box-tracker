# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

@SPEC.md is the complete spec for this project. Treat it as authoritative for data model, screens, numbering, CSV, security rules, and the build checklist. When code and SPEC disagree, flag it.

## Status

Scaffolded and building. Vite project exists under `src/` with all main screens (`Login`, `AddBox`, `Browse`, `Config`, `Nav`). GitHub repo name is `box-tracker` (public); app display name is `BoxBuddy`.

## Stack

Vite + React + TypeScript SPA. Firebase Auth (Google sign-in only), Firestore, Storage, Hosting. `vite-plugin-pwa`. Web Speech API for voice. CI/CD via GitHub Actions → Firebase Hosting on push to `main`.

## Tooling

UI work: use the `frontend-design` plugin for design/component patterns and the `web-design-guidelines` skill for accessibility review. Use the `context7` MCP for version-specific React/Vite/Firebase API docs instead of relying on memory. See README "Built with Claude Code" for the full list.

## Non-obvious constraints

- **Android-only target.** iOS Safari is not supported (no Web Speech API). Don't add iOS fallbacks. Set `recognition.lang = 'he-IL'` explicitly — there is no "auto".
- **Firestore offline persistence** uses the modern cache API: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Do NOT use the deprecated `enableIndexedDbPersistence`.
- **Box numbering** = `max boxNumber in room + 1` (not count), read from local cache so it works offline; first box in a room gets the room's `rangeStart`. Assigned at save time, never reuses deleted numbers. See SPEC 4.3.
- **CSV export is always the full `boxes` collection**, ignoring active filters — import infers deletions from absent rows, so a filtered export would wrongly delete boxes. See SPEC 8.
- **Photos** are stored under `boxPhotos/{docId}/` using a client-generated `docId` (`doc(collection(db,'boxes')).id`) created when the Add Box form opens, before the document is written. Handle orphaned-photo cleanup per SPEC 6.2.
- **Env vars** are `VITE_*` (bundled into public client JS, not secret). Local dev uses `.env.local` (gitignored); CI uses GitHub repo secrets. `llm.ts` runs in passthrough mode until an LLM provider is chosen.
- **Auth = Google sign-in only**, gated by a `member` custom claim (NOT just `request.auth != null`). Same claim secures Firestore and Storage rules — it's the only check both rule engines can read (Storage can't read Firestore). Grant via `node scripts/setMember.js <email>` (needs a gitignored `serviceAccountKey.json`). Repo is public, so keep all emails/keys out of committed source.
