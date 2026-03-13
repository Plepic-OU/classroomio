# C4 Architecture Diagrams — ClassroomIO

Generated: 2026-03-13

## Diagrams

| File | Layer | Description |
|------|-------|-------------|
| [layer1-context.md](./layer1-context.md) | L1 — System Context | ClassroomIO in relation to users and external systems |
| [layer2-containers.md](./layer2-containers.md) | L2 — Containers | Dashboard, API, Marketing site, Supabase, Cloudflare R2 |
| [layer3-api.md](./layer3-api.md) | L3 — API Components | Internal components of the Hono API (AST-derived) |
| [layer3-dashboard.md](./layer3-dashboard.md) | L3 — Dashboard Components | Routes, UI components, stores, services (AST-derived) |
| [database.md](./database.md) | DB Schema | PostgreSQL table definitions from local Supabase |

## Gitignored files (intermediate artifacts)

- `docs/c4/dashboard-components.json` — raw AST extraction output for dashboard
- `docs/c4/api-components.json` — raw AST extraction output for API

## Regenerating

Run from the monorepo root:

```bash
# Re-extract AST (writes JSON artifacts)
node .claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts

# Re-extract DB schema (requires supabase start)
bash .claude/skills/c4-model/db-schema.sh

# Then use /c4-model to regenerate diagrams from the JSON
```
