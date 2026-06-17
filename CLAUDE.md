# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

@SPEC.md is the complete spec for this project. Treat it as authoritative for data model, screens, numbering, CSV, security rules, and the build checklist. When code and SPEC disagree, flag it.

## Status

Built and deployed (live at `box-tracker-81539.web.app`). All main screens implemented (`Login`, `AddBox`, `Browse`, `Config`, `Nav`); CI/CD, rules, and Groq LLM wiring in place. Remaining work is on-device testing (PLAN Phase 11). GitHub repo name is `box-tracker` (public); app display name is `BoxIndex`.

## Stack

Vite + React + TypeScript SPA. Firebase Auth (Google sign-in only), Firestore, Storage, Hosting. `vite-plugin-pwa`. Web Speech API for voice. CI/CD via GitHub Actions → Firebase Hosting on push to `main`.

## Tooling

UI work: use the `frontend-design` plugin for design/component patterns and the `web-design-guidelines` skill for accessibility review. Use the `context7` MCP for version-specific React/Vite/Firebase API docs instead of relying on memory. See README "Built with Claude Code" for the full list.

## Non-obvious constraints

- **Android Chrome is the primary target** (box adding: voice, camera, PWA install). **Desktop/laptop Chrome is a supported secondary target** for review/browse/config (table view, popup auth). iOS Safari is not supported (no Web Speech API). Don't add iOS fallbacks. Set `recognition.lang = 'he-IL'` explicitly — there is no "auto".
- **Firestore offline persistence** uses the modern cache API: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Do NOT use the deprecated `enableIndexedDbPersistence`.
- **Box numbering** = `max boxNumber in room + 1` (not count), read from local cache so it works offline; first box in a room gets the room's `rangeStart`. Assigned at save time, never reuses deleted numbers. See SPEC 4.3.
- **CSV export is always the full `boxes` collection**, ignoring active filters — import infers deletions from absent rows, so a filtered export would wrongly delete boxes. See SPEC 8.
- **Photos** are stored under `boxPhotos/{docId}/` using a client-generated `docId` (`doc(collection(db,'boxes')).id`) created when the Add Box form opens, before the document is written. Handle orphaned-photo cleanup per SPEC 6.2.
- **Env vars** are `VITE_*` (bundled into public client JS, not secret). Local dev uses `.env.local` (gitignored); CI uses GitHub repo secrets. `llm.ts` runs in passthrough mode until an LLM provider is chosen.
- **Auth = Google sign-in only**, gated by a `member` custom claim (NOT just `request.auth != null`). Same claim secures Firestore and Storage rules — it's the only check both rule engines can read (Storage can't read Firestore). Grant via `node scripts/setMember.js <email>` / revoke with `--revoke` (needs a gitignored `serviceAccountKey.json`). Repo is public, so keep all emails/keys out of committed source.
- **Delete permissions / admin (SPEC 5.1).** A second optional `admin` custom claim (granted with `node scripts/setMember.js <email> --admin`, dropped with `--admin --revoke`) gates deletion. The admin's email is NOT hardcoded anywhere - rules and client read `request.auth.token.admin`; `members/{uid}` docs hold per-user `canDeleteBox`/`canDeletePhoto` (default-deny: only explicit `true` allows, absent/`false` blocks; admin never blocked). **Box delete is rules-enforced + UI; photo delete is UI-only** (Storage can't read Firestore - see SPEC 15 for the claims/Cloud-Function migration). Members may write only their own `members` profile, never the protected keys (`canDeleteBox`/`canDeletePhoto`/`admin`) - enforced in `firestore.rules`. Multiple admins are allowed.
- **Hybrid sign-in flow:** `signInWithPopup` on desktop/laptop, `signInWithRedirect` on Android (`useRedirect = /Android/i.test(navigator.userAgent)` in `Login.tsx`). Desktop redirect silently fails (Chrome storage partitioning drops the result); Android popups are unreliable in the standalone PWA. Do NOT collapse this back to redirect-only. See SPEC 5/6.1 and `docs/auth-flow.md`.
