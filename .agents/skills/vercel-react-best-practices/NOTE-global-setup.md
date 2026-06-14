# Note: Self-contained Claude Code setup

All MCP servers, plugins, and skills this repo needs are configured **inside the repo** — nothing relies on machine-global (`~/.claude`) config. Clone the repo and the tooling comes with it.

## Where things live
- **MCP servers** (`.mcp.json`): `chrome-devtools`, `context7`. Enabled in `.claude/settings.json` under `enabledMcpjsonServers`.
- **Plugins** (`.claude/settings.json` → `enabledPlugins`): `firebase@claude-plugins-official`, `frontend-design@claude-plugins-official`.
- **Skills** (`.claude/skills/`): `vercel-react-best-practices`, `vercel-react-view-transitions`, `web-design-guidelines`, and the custom `/scaffold`.

## No external requirements
`context7` uses the public HTTP endpoint and needs no API key. Clone the repo, start Claude Code, and the tooling works as-is.

## Why this matters for this skill
When using these React-performance rules, lean on the project-local `context7` MCP server to confirm version-specific React/Vite APIs rather than relying on training data.
