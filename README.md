# BoxBuddy

> GitHub repo: `box-tracker` · App display name: **BoxBuddy**

A small PWA for tracking packed moving boxes during a household shipment. Each box gets an auto-assigned number, a room, photos, and a short AI-summarized description. Family members add boxes while packing and search by box number while unpacking.

## Objectives

- **Pack:** quickly capture a box via voice (Hebrew transcription) and camera, with an automatically assigned, per-room box number to write on the physical box.
- **Unpack:** search by box number to instantly see its room, description, urgency, and photos.
- **Manage:** browse/filter/edit all boxes in real time, configure rooms and number ranges, and round-trip the full dataset via CSV.
- **Work anywhere:** installable, offline-capable PWA so packing continues without a connection; changes sync on reconnect.

## Context

- **Target platform:** Android (Chrome) only. iOS Safari is not supported (no Web Speech API).
- **Audience:** a closed set of 4 family users, equal permissions, accounts created manually in the Firebase Console.
- **Stack:** Vite + React + TypeScript SPA · Firebase Auth / Firestore / Storage / Hosting · `vite-plugin-pwa` · Web Speech API · LLM summarization (provider TBD) · GitHub Actions → Firebase Hosting CI/CD.

The complete specification lives in [SPEC.md](./SPEC.md) — the authoritative source for data model, screens, numbering scheme, CSV import/export, security rules, and the build checklist.

## Status

Greenfield — spec'd but not yet scaffolded. Run the `/scaffold` skill (see below) to bootstrap the project.

## Built with Claude Code

This project is developed with [Claude Code](https://claude.com/claude-code). All required tooling is configured **inside this repo** (`.claude/`, `.mcp.json`) so the setup is self-contained — nothing depends on machine-global config and no secrets are needed.

### Plugins
- `firebase@claude-plugins-official` — Firebase project, deploy, rules, and SDK tooling (`.claude/settings.json`).
- `frontend-design@claude-plugins-official` — design principles and component patterns for polished React UI (`.claude/settings.json`).

### MCP servers
- `chrome-devtools` — drive Chrome for inspection, screenshots, and debugging (`.mcp.json`).
- `context7` — fetch current library/framework/API docs (`.mcp.json`). Uses the public HTTP endpoint, no API key required.

### Skills (installed)
- `vercel-react-best-practices` — React/Next.js performance patterns.
- `vercel-react-view-transitions` — View Transition API animations.
- `web-design-guidelines` — UI accessibility and Web Interface Guidelines review.

### Custom skills
- `/scaffold` — bootstraps the Vite + React + TS + Firebase skeleton from SPEC.md (`.claude/skills/scaffold/`).

### Project guidance
- [CLAUDE.md](./CLAUDE.md) — persistent instructions and non-obvious constraints for Claude Code sessions.
