---
name: c4-model
description: Generate or update a C4 architecture model (levels 1-3 only — Context, Container, Component) for the current project. Use this whenever the user asks for a C4 model, C4 diagram, architecture diagram, system context diagram, container diagram, component diagram, architecture documentation, or wants to visualize how their system is structured. Also use when the user asks to "update", "refresh", or "regenerate" any of the above. Skip Level 4 (Code) — it's intentionally out of scope.
---

# C4 model — ClassroomIO

Generate or update a [C4 model](https://c4model.com/) of this repository at levels 1-3:

- **Level 1 — System Context**: ClassroomIO as a black box, plus users and external systems.
- **Level 2 — Containers**: deployable units (dashboard, API, marketing, docs, Supabase, Redis).
- **Level 3 — Components**: derived from AST extraction (see below) for the dashboard and API.

Skip Level 4. Source is the source of truth at that resolution.

Output lives in `docs/c4/`. The output is intended for **AI context consumption** — keep it concise, dense, and machine-readable. Avoid prose that restates what diagrams already show.

## Workflow

Run phases in order. Don't skip extraction — Level 3 must be derived from AST data, not memory.

### 1. Detect existing model

```bash
ls docs/c4 2>/dev/null
```

If `docs/c4/` exists, treat this run as an **update**. Preserve element aliases used in existing diagrams (`Person(student, ...)`, `Container(api, ...)`, etc.) so diffs stay readable. Read each file before editing.

If nothing exists, create `docs/c4/` from scratch.

### 2. Install skill deps (once per checkout)

```bash
cd .claude/skills/c4-model && pnpm install --silent
```

The skill has its own isolated `package.json` pinning `ts-morph` and `tsx`. It does not pollute the workspace.

### 3. Extract components (AST) — Layer 3 source of truth

Run the extractor against each container that has meaningful internal structure. For ClassroomIO that's the dashboard and the API:

```bash
node .claude/skills/c4-model/extract-components.mjs \
  --app apps/dashboard \
  --name dashboard \
  --depth 2 \
  --out .claude/skills/c4-model/.out/dashboard.json

node .claude/skills/c4-model/extract-components.mjs \
  --app apps/api \
  --name api \
  --depth 3 \
  --out .claude/skills/c4-model/.out/api.json
```

Flags:

- `--app` repo-relative path to the app (must contain `tsconfig.json` and `src/`).
- `--name` short id used in the output and as the diagram filename suffix.
- `--depth` directory levels under `src/` that form a component key. Start at 2; increase if validation warns.
- `--out` JSON output path. Gitignored.

**Path aliases.** The extractor reads `tsconfig.json#compilerOptions.paths` (and follows `extends`) to resolve aliases dynamically. Both `$lib/*` (dashboard) and `$src/*` (API) resolve correctly without hardcoding.

**Svelte.** `.svelte` files are not parsed (ts-morph can't). The extractor counts them per directory as metadata (`svelteCount`) and parses co-located `.ts` / `.js` for imports. Component sizing uses **total files** (svelte + ts), so a route folder with 30 .svelte files still appears as a chunky component.

**Validation.** If any component contains >50 files, the extractor emits a warning. When you see one, re-run with a deeper `--depth` for that app. Don't ignore it — a 67-file mega-component is a Layer 4 dump in disguise.

Inspect the JSON before drawing diagrams:

```bash
jq '.warnings, (.components | length), [.components[] | {key, fileCount}] | sort_by(.fileCount) | reverse' .claude/skills/c4-model/.out/dashboard.json
```

Aim for ~5-15 components per container (after merging small leaves or splitting large ones in prose, **not** by editing the JSON). If the extractor's grouping diverges from a sensible architectural grouping, label the diagram boxes by responsibility but keep their identity traceable to the extracted keys.

### 4. Extract database schema (optional but recommended)

Requires `supabase start` running locally:

```bash
bash .claude/skills/c4-model/extract-db.sh > docs/c4/database.md
```

Output is a token-efficient table summary: `table.column type [PK|FK→other.column|NULL|NOT NULL]` — not full DDL. Foreign keys are preserved so you can read the relational graph. If Supabase isn't running, the script exits non-zero with a clear message; skip it and note in the summary.

### 5. Discover the rest

For levels 1 and 2, read (or spawn an **Explore** subagent for, if the repo is large):

1. `README.md`, top-level `CLAUDE.md`.
2. `pnpm-workspace.yaml`, `turbo.json`, each `apps/*/package.json` — deployable units.
3. `supabase/config.toml`, `docker-compose*.yml`, `.devcontainer/setup.sh` — infrastructure.
4. `.env.example` files across the repo — external dependencies (Stripe, OpenAI, PostHog, R2, SMTP, …).
5. `apps/api/src/app.ts` and dashboard `src/hooks.server.ts` — cross-container traffic.

### 6. Draft diagrams

**Level 1 (`01-context.md`).** One diagram. ClassroomIO as a single System. Around it: persons (student, instructor, admin) and external systems (auth providers, payment, mail, R2, analytics). Self-hosted Postgres/Redis are **NOT** external systems — they're Level 2 containers.

**Level 2 (`02-container.md`).** One diagram. Inside the system box: dashboard, API, marketing, docs, Supabase (Postgres/Auth/Edge), Redis. Skip shared `packages/*` — those are code, not deployable units. Label with technology and a short description; verb + protocol on every edge.

**Level 3 (`03-component-<name>.md`).** One file per extracted container. Components come from the AST JSON — name boxes after their `key`, sized by `fileCount`. Cross-container edges reuse the Level 2 aliases. If extracted relationships expose a structure the prose disagrees with, **trust the AST and update the prose**.

### 7. File layout

```
docs/c4/
├── README.md                      # index + how-to-update
├── 01-context.md                  # Level 1
├── 02-container.md                # Level 2
├── 03-component-dashboard.md      # Level 3, from .out/dashboard.json
├── 03-component-api.md            # Level 3, from .out/api.json
└── database.md                    # optional, from extract-db.sh
```

Each diagram file: one short paragraph of context, the Mermaid C4 fence, then a "Notes" section (~5 bullets) covering anything the diagram can't show — fragile contracts, intentional omissions, important flows.

### 8. Format

Mermaid C4 (`C4Context`, `C4Container`, `C4Component`). Renders natively on GitHub. See `references/mermaid-c4.md` for syntax gotchas (boundaries, line breaks, `UpdateRelStyle`). See `references/c4-conventions.md` for naming and edge-labeling rules.

### 9. Verify

- Every `Rel(a, b, ...)` references aliases defined in the same diagram.
- Every external system at L1 reappears as an edge target at L2.
- Every L2 container is reachable from at least one user/external system.
- L3 components edge out using the same aliases as L2.
- No component exceeds 50 files in the JSON (re-extract with deeper `--depth` if it does).
- Mermaid blocks have balanced braces; every `Boundary(...) { ... }` closes.

End with a short summary: what changed, which apps got L3 diagrams, which were skipped and why.

## Updating an existing model

Re-run extraction first. Diff JSON output against what the existing L3 diagrams claim. Prefer surgical `Edit`s — rename when an element moved, only rewrite a whole file when more than half changed. Don't reflow diagrams for cosmetics.

## What this skill does NOT do

- **No Level 4 / code-level diagrams.**
- **No deployment diagrams** unless explicitly requested.
- **No sequence / dynamic diagrams** unless explicitly requested.
- **No hand-written Level 3 component lists.** Extract from AST, then cluster — don't invent.
