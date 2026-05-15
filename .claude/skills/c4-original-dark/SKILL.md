---
name: c4-original-dark
description: Generate or update the C4 architecture model (Layers 1–3) for ClassroomIO. Extracts components via ts-morph AST, maps cross-directory imports as relationships, and writes Mermaid C4 diagrams in dark mode to docs/c4/.
---

# c4-original-dark

Generates or refreshes the ClassroomIO C4 model at three levels:

| Output file | Description |
|---|---|
| `docs/c4/l1-system-context.md` | L1 — actors and external systems |
| `docs/c4/l2-containers.md` | L2 — deployable containers |
| `docs/c4/l3-dashboard.md` | L3 — Dashboard internals (AST-derived) |
| `docs/c4/l3-api.md` | L3 — API Service internals (AST-derived) |
| `docs/c4/database.md` | DB schema reference (requires running Supabase) |
| `docs/c4/components.json` | Intermediate AST data — gitignored |

All diagrams use `%%{init: {'theme': 'dark'}}%%` Mermaid C4 syntax.

## Execution steps

When this skill is invoked, run the following from the repo root (`/workspaces/classroomio`).

The scripts use their own local `node_modules` (installed with `npm install` inside the scripts
directory — **not** pnpm, which would hoist to the workspace root).

### 1. Install script dependencies (once, or after `npm install` was never run)

```bash
cd .claude/skills/c4-original-dark/scripts && npm install --silent && cd -
```

Verify: `.claude/skills/c4-original-dark/scripts/node_modules/.bin/tsx` must exist.

### 2. Extract component structure via AST

```bash
.claude/skills/c4-original-dark/scripts/node_modules/.bin/tsx \
  .claude/skills/c4-original-dark/scripts/extract-components.ts
```

Flags (all optional):
- `--depth-dashboard=N` — directory levels per component for Dashboard (default: `4`)
- `--depth-api=N` — directory levels per component for API (default: `2`)
- `--out=PATH` — override JSON output path (default: `docs/c4/components.json`)
- `--root=PATH` — repo root (default: `cwd`)

If a warning appears (`component X has >50 files — depth may be too shallow`), re-run
with `--depth-dashboard=5` (or `--depth-api=3`) to increase granularity.

### 3. Generate Mermaid diagrams

```bash
.claude/skills/c4-original-dark/scripts/node_modules/.bin/tsx \
  .claude/skills/c4-original-dark/scripts/generate-diagrams.ts
```

Flags (all optional):
- `--in=PATH` — input JSON (default: `docs/c4/components.json`)
- `--out=DIR` — output directory (default: `docs/c4`)

### 4. Extract database schema (optional — requires `supabase start`)

```bash
bash .claude/skills/c4-original-dark/scripts/extract-db.sh
```

## Prerequisites

- Node.js ≥ 20
- Docker running (for step 4 only)
- Local Supabase started (`pnpm supabase:start`) for step 4 only

## References

`references/c4-conventions.md` — C4 model conventions, depth guidance, Mermaid syntax quick-reference.
