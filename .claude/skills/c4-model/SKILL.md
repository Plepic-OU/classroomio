# c4-model Skill

Generates or updates C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Layer 3 components are deterministically derived from AST analysis of `apps/dashboard` and `apps/api`.

## Invocation forms

| Command | Action |
|---------|--------|
| `/c4-model` | Full refresh: extract → generate all layers |
| `/c4-model update` | Same as above (alias) |
| `/c4-model layer=3` | Re-generate Layer 3 only (skips L1/L2 rewrite, faster) |
| `/c4-model db` | Extract database schema only (`supabase start` required) |

## Prerequisites

- Node.js ≥ 20, pnpm
- `ts-morph` in workspace devDependencies (step 1 installs it if missing)
- For `/c4-model db`: Docker running with `supabase start`

---

## Steps

### Step 1 — Ensure ts-morph is installed

```bash
cd /workspaces/classroomio
node -e "require('ts-morph')" 2>/dev/null || pnpm add -D -w ts-morph
```

If `pnpm add` runs, commit the `package.json` / `pnpm-lock.yaml` changes separately.

### Step 2 — Run AST extraction

```bash
cd /workspaces/classroomio
./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
```

This writes `.claude/skills/c4-model/output/structure.json` (gitignored).

**Inspect the output** — check component counts and warnings:
- If any component has >50 TS files → increase depth: `DASHBOARD_DEPTH=5 ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts`
- Good targets: dashboard ~30–60 components, api ~8–15 components

### Step 3 — Generate diagrams

```bash
./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts
```

Writes `docs/c4/L1-context.md`, `docs/c4/L2-containers.md`, `docs/c4/L3-api.md`, `docs/c4/L3-dashboard.md`, `docs/c4/README.md`.

For Layer 3 only (after step 2):
```bash
./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts 3
```

### Step 4 — (Optional) Extract database schema

Only if the user requested `/c4-model db` or a full refresh with DB included.
Requires Supabase running locally.

```bash
bash .claude/skills/c4-model/db-extract.sh
```

Writes `docs/c4/database.md`.

### Step 5 — Report back

After generation, report:
1. How many components were found per app
2. Any depth warnings
3. List the files written to `docs/c4/`
4. Suggest reviewing `docs/c4/L3-dashboard.md` and `docs/c4/L3-api.md` — if the diagrams are too wide/tall for the use case, suggest increasing depth

---

## Reference material

- `references/c4-mermaid.md` — Mermaid C4 syntax and ClassroomIO conventions
- C4 model: https://c4model.com/abstractions/component
- Mermaid C4: https://mermaid.js.org/syntax/c4.html

## Output locations

| Path | Description |
|------|-------------|
| `docs/c4/README.md` | Index |
| `docs/c4/L1-context.md` | Layer 1 System Context |
| `docs/c4/L2-containers.md` | Layer 2 Container |
| `docs/c4/L3-dashboard.md` | Layer 3 Dashboard components (AST-derived) |
| `docs/c4/L3-api.md` | Layer 3 API components (AST-derived) |
| `docs/c4/database.md` | DB schema (optional, from Supabase) |
| `.claude/skills/c4-model/output/structure.json` | Intermediate JSON (gitignored) |

## Depth configuration

Component granularity is controlled per app:

| App | Default depth | Example keys at that depth |
|-----|--------------|---------------------------|
| dashboard | 4 | `lib/components/Course`, `lib/utils/store`, `routes/api/courses` |
| api | 2 | `routes/course`, `services/course`, `utils/redis` |

Override via env vars: `DASHBOARD_DEPTH=5` or `API_DEPTH=3`.

Rule: if any single component key contains >50 TS files, the depth is too shallow.
