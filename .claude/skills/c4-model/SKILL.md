---
name: c4-model
description: Generate or refresh C4 model diagrams (Layers 1-3) for ClassroomIO. Runs a ts-morph AST extractor over apps/dashboard and apps/api, pulls the live Supabase schema via docker exec, then writes Mermaid C4 diagrams plus a concise database reference to docs/c4/.
---

# C4 model for ClassroomIO

This skill produces / refreshes:

- `docs/c4/01-context.md` — Layer 1 (System Context): users, ClassroomIO as a single system, and external systems it talks to.
- `docs/c4/02-container.md` — Layer 2 (Containers): dashboard, API, Supabase, plus external integrations and how containers talk to each other.
- `docs/c4/03-component-dashboard.md` — Layer 3 (Components) for `apps/dashboard`, derived from the AST.
- `docs/c4/03-component-api.md` — Layer 3 (Components) for `apps/api`, derived from the AST.
- `docs/c4/database.md` — concise Postgres schema reference (tables, columns, PKs, FKs).

Everything is in Mermaid C4 syntax (`C4Context`, `C4Container`, `C4Component`).

## How it works

1. **AST extraction** — `scripts/extract.ts` (ts-morph) walks `.ts`/`.js` in each app, resolves imports (relative + tsconfig path aliases) to component keys, and emits JSON to `docs/c4/.cache/<app>.json`. `.svelte` files are not parsed (ts-morph can't), but are counted per directory so component metadata reflects real file footprint.
2. **DB extraction** — `scripts/extract-db.sh` runs `psql` inside the local Supabase container against `information_schema` + `pg_catalog`, then renders a terse markdown reference. Requires `supabase start` to be running.
3. **Diagram synthesis** — read the JSON outputs and assemble Mermaid C4 diagrams using the conventions in `references/`. Components are derived from the AST data — do **not** hardcode them.

The component grouping (how many directory levels form a component) is configurable per app in `config.json` under `apps.<name>.componentGroups`. If any component ends up with more than `fileLimitPerComponent` files (default 50), the extractor emits a warning telling you which group's depth to increase.

## Procedure

Run these steps in order. Each step's output feeds the next.

### 1. Make sure Supabase is running (DB step only)

```bash
docker ps --format '{{.Names}}' | grep -E '^supabase_db_' || supabase start
```

If you can't start Supabase (no Docker, etc.), skip step 3 and note in the database doc that it could not be regenerated.

### 2. Run the AST extractor for both apps

```bash
.claude/skills/c4-model/scripts/run.sh dashboard api
```

The first run installs `ts-morph` + `tsx` into `.claude/skills/c4-model/scripts/node_modules` (uses `--ignore-workspace` so it doesn't touch the monorepo). Subsequent runs reuse it.

The script writes `docs/c4/.cache/dashboard.json` and `docs/c4/.cache/api.json`. Read both before doing anything else — they are the ground truth for Layer 3.

If the extractor emits `[c4-model] warn: Component "X" has N files (limit 50)` lines, **stop and tune `config.json`** before generating diagrams. Increase the depth for the named group (e.g. `"src/lib/components": 2`) until no warnings remain. Re-run.

### 3. Run the DB extractor

```bash
.claude/skills/c4-model/scripts/extract-db.sh
```

Writes `docs/c4/database.md`. If Supabase isn't running, this errors out cleanly — proceed without it.

### 4. Generate the four Mermaid diagram files

Use `references/c4-conventions.md` for what each layer should contain and `references/mermaid-c4-syntax.md` for syntax.

For **Layer 1 and Layer 2**, write the diagram by hand from your knowledge of ClassroomIO (it's a small fixed set: users, dashboard, API, Supabase, plus the external systems that show up under `externalRelationships` in either JSON). Don't invent integrations that don't appear in the extracted data.

For **Layer 3** of each app:

- Use the `components` array from `docs/c4/.cache/<app>.json` to emit `Component(...)` lines. Each component's `key` becomes its alias (sanitise to valid Mermaid identifier: replace `/`, `-`, `.` with `_`); use `name` as the label; use the `group` + counts to write a one-line description like `12 TS + 8 Svelte`.
- Use the `relationships` array for internal `Rel(...)` edges. Each edge's `count` is the number of import sites — useful for picking which edges matter, but don't put it on the label. Label the edge by the verb of the connection if it's obvious from the directions; otherwise use a generic `uses`.
- Use the `externalRelationships` array to draw edges out to external systems (Supabase, OpenAI, Redis, S3, etc.). Group by `system` so each external appears once, with one inbound edge per source component.
- Wrap internal components in a `Container_Boundary(boundary, "<App> container")` block.

To keep diagrams readable, **prune low-weight edges**: if a Layer 3 diagram ends up with more than ~25 edges, drop edges where `count == 1` first, then `count <= 2`, until the graph is comfortable. Note the pruning threshold at the top of the file in an HTML comment.

Layer 3 component descriptions should be terse — Layer 3 is mainly for AI context, not human design review.

### 5. Sanity-check

- Open each `.md` file and read the Mermaid block to check identifiers don't collide and edges reference declared aliases.
- The four files plus `database.md` should be the only changes (besides the `.cache/` JSON, which is gitignored).

## What goes in each layer

- **Layer 1 (Context)** — One box for ClassroomIO. People: Student, Instructor, Org admin. External systems: only those that show up in either app's `externalRelationships`.
- **Layer 2 (Container)** — Dashboard (SvelteKit), API (Hono), Supabase (Postgres + Auth + Storage). Edges between them and to externals. Include `PUBLIC_IS_SELFHOSTED` as a note if relevant.
- **Layer 3 (Component)** — One file per app. Components from the AST extractor. Edges from `relationships` + `externalRelationships`.

## Files in this skill

- `SKILL.md` — this file
- `config.json` — depth config per app + external-system mapping
- `scripts/extract.ts` — ts-morph extractor
- `scripts/extract-db.sh` — Supabase schema extractor
- `scripts/run.sh` — wrapper that installs deps then runs `extract.ts` per app
- `scripts/package.json` — ts-morph + tsx, isolated from the monorepo via `--ignore-workspace`
- `references/c4-conventions.md` — what each C4 layer should contain
- `references/mermaid-c4-syntax.md` — Mermaid C4 syntax cheat sheet

## Tuning tips

- Path aliases are read straight from each app's `tsconfig.json` `paths` field. If a new alias is added there, the extractor will pick it up — no skill change needed.
- To add a new external system to the L2/L3 diagrams, append it to `externalSystems` in `config.json` and re-run. The key is the npm package name (suffix `/` for a prefix match).
- To split a too-large component, bump the corresponding `componentGroups` depth or add a more specific sub-prefix with its own depth. The longest matching prefix wins.
