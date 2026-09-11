---
name: c4-model
description: Generate or update ClassroomIO's C4 model (Layers 1-3 — System Context, Container, Component) as Mermaid diagrams in docs/c4/. Use when asked to create/update architecture diagrams, a C4 model, component diagrams, or to document the dashboard/API structure or database schema for AI/human context.
---

# C4 model generator

Produces/refreshes `docs/c4/`: System Context (L1), Container (L2), Component diagrams for the `dashboard` and `api` containers (L3, AST-derived), and a database schema summary. Output is optimized for token-efficient AI context, not pixel-perfect diagrams — see `references/c4-conventions.md` before writing or editing any diagram by hand.

## Hard rule

**Layer 3 (`docs/c4/level3-dashboard.md`, `docs/c4/level3-api.md`) is always machine-generated.** Never hand-write or hand-edit the Mermaid in those two files — run the scripts. If the output looks wrong, fix the script or its `--depth`, don't patch the Mermaid. Layers 1-2 and `database.md` are the only files meant for direct editing (L1/L2 by a human/LLM reading the repo; `database.md` by re-running its script).

## Workflow

1. **Extract component structure (AST).** From the repo root:
   ```bash
   pnpm exec tsx .claude/skills/c4-model/scripts/extract-components.ts dashboard
   pnpm exec tsx .claude/skills/c4-model/scripts/extract-components.ts api
   ```
   Each writes `docs/c4/.data/<app>-components.json` (gitignored — regenerate, don't commit) and prints a summary line plus any "component exceeds 50 files" warnings to stderr/stdout.

   - If a warning fires, that subtree's grouping is probably too coarse. Re-run just that app with a higher `--depth` (e.g. `--depth=5`) and compare — but don't chase zero warnings at all costs; a single dense subtree (e.g. a big feature folder) is a legitimate signal about the codebase, not necessarily a bug in the depth. See `references/c4-conventions.md` for the depth tradeoff.
   - `--depth` and `--out` are both overridable flags; defaults live in `APPS` at the top of `extract-components.ts` (dashboard=4, api=2 as of this writing — codebase growth may eventually warrant revisiting these).

2. **Render Mermaid from the extraction JSON.**
   ```bash
   pnpm exec tsx .claude/skills/c4-model/scripts/render-mermaid.ts dashboard
   pnpm exec tsx .claude/skills/c4-model/scripts/render-mermaid.ts api
   ```
   Writes `docs/c4/level3-dashboard.md` and `docs/c4/level3-api.md`. Purely mechanical — no judgment calls, so there's nothing to review here beyond "did it run."

3. **Extract the database schema** (requires `supabase start` already running locally):
   ```bash
   .claude/skills/c4-model/scripts/extract-database.sh
   ```
   Writes `docs/c4/database.md` from the live local Postgres instance's `information_schema`/`pg_catalog` (public schema, base tables only). If Supabase isn't running, the script exits with a clear error — start it first, don't skip silently, since a stale/missing `database.md` misleads whoever reads it next.

4. **Update Layers 1-2 by hand** (`docs/c4/level1-system-context.md`, `docs/c4/level2-container.md`). These have no AST source, so re-derive them from the actual repo rather than assuming the existing files are still accurate:
   - `CLAUDE.md` for the monorepo layout and architecture notes.
   - `apps/*/package.json` dependencies for external systems actually integrated (billing SDKs, AI SDKs, storage SDKs, analytics, email, etc.) — don't list an integration that isn't a real dependency, and don't drop one that's newly added.
   - `supabase/` (migrations, functions, config.toml) for auth/storage/edge-function containers.
   Keep both files in the same style as what's already there: a short "hand-authored, re-derive don't trust blindly" note at the top, then a single ```mermaid``` block (`C4Context` / `C4Container`). Prefer editing in place over a rewrite if the change is incremental.

5. **Sanity check before finishing:**
   - Every `docs/c4/*.md` file should have exactly one fenced ` ```mermaid ` block using the right diagram type (`C4Context`, `C4Container`, `C4Component`) per `references/c4-conventions.md`.
   - No duplicate Mermaid aliases within a file (would silently merge nodes).
   - `docs/c4/.data/` must stay gitignored (check `.gitignore`); everything else under `docs/c4/` is meant to be committed.
   - Report which files changed and any depth warnings that are still outstanding — don't silently swallow them.

## Layout

```
.claude/skills/c4-model/
  SKILL.md                    this file
  scripts/
    extract-components.ts     ts-morph AST extraction -> docs/c4/.data/<app>-components.json
    render-mermaid.ts         JSON -> docs/c4/level3-<app>.md (deterministic, no LLM judgment)
    extract-database.sh       docker exec + information_schema -> docs/c4/database.md
  references/
    c4-conventions.md         C4 layer definitions, depth tradeoffs, Mermaid syntax cheat sheet
docs/c4/
  level1-system-context.md    hand-authored
  level2-container.md         hand-authored
  level3-dashboard.md         generated
  level3-api.md                generated
  database.md                 generated
  .data/                      gitignored intermediate JSON
```
