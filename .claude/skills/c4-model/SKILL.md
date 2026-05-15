# C4 Model Skill

Generate or update a C4 architecture model (Layers 1–3) for ClassroomIO.
Outputs structured markdown files to `docs/c4/`. Each file contains a prose description, a grouped elements/components table (readable as plain text in context), and a Mermaid diagram. Components are derived from AST, not hardcoded.

## When this skill is invoked

Run the extraction script to regenerate all diagrams from source, then report what changed.
Optionally extract database schema if the user requests it or if Supabase is running.

---

## Step 1 — Ensure ts-morph is installed

```bash
node -e "require('ts-morph')" 2>/dev/null || pnpm add -w -D ts-morph tsx
```

## Step 2 — Run the extractor

```bash
npx tsx .claude/skills/c4-model/c4.ts                  # Mermaid only (default)
npx tsx .claude/skills/c4-model/c4.ts --dot            # DOT (Graphviz) only
npx tsx .claude/skills/c4-model/c4.ts --all            # both formats
```

Optional depth overrides (increase if any component has >50 files):
```bash
npx tsx .claude/skills/c4-model/c4.ts --depth-dashboard=4 --depth-api=2
```

The script:
- Parses `.ts`/`.js` files in `apps/dashboard/src` and `apps/api/src` using ts-morph
- Resolves path aliases (`$lib/*`, `$src/*`) from each app's `tsconfig.json`
- Groups files into components by directory depth (dashboard=3, api=1)
- Maps cross-component import relationships
- Counts `.svelte` files per component directory (ts-morph cannot parse .svelte)
- Warns if any component contains >50 files (depth too shallow)

**Mermaid output** (`docs/c4/`) — each file has: description → elements table → Mermaid diagram:
  - `l1-system-context.md` — Users and External Systems tables + C4Context diagram
  - `l2-containers.md` — Internal Containers, Data & Auth, External Services tables + C4Container diagram
  - `l3-dashboard.md` — Components grouped by UI Components / Utilities / Server Routes / Page Routes + C4Component diagram
  - `l3-api.md` — Components grouped by Routes / Services / Utils / Types / Middleware + C4Component diagram
  - `components.json` — structured JSON (gitignored; AI context)

**DOT output** (`docs/c4/dot/`) — four raw `.dot` files, openable directly in IntelliJ IDEA (Graphviz integration plugin) or any Graphviz tool. Color-coded by component group (blue = UI, green = utils, orange = server routes, purple = page routes). Each file has a comment header linking to its Mermaid counterpart for the elements table and description. Render with `dot -Tsvg` or paste into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/).

## Step 3 — Database schema (optional)

Only run this if the user asks for database schema, or if `supabase start` is confirmed running:

```bash
bash .claude/skills/c4-model/db-schema.sh
```

Requires local Supabase (`pnpx supabase start`). Outputs `docs/c4/database.md`.

## Step 4 — Show the user what was generated

After running, summarize:
- Component counts per app (from extractor stdout)
- Any depth warnings
- Whether database schema was generated
- Suggest next steps: `/c4-model` again after adding new routes or services

## Conventions

See `.claude/skills/c4-model/references/c4-conventions.md` for C4 granularity rules.
See `.claude/skills/c4-model/references/mermaid-c4-syntax.md` for Mermaid C4 syntax.

## Depth tuning guide

| Symptom | Fix |
|---------|-----|
| Warning: component has >50 files | Increase `--depth-<app>` by 1 |
| <5 components total for an app | Decrease depth by 1 |
| Dashboard `lib/components` swallows everything | Use `--depth-dashboard=4` |
| API has only 1 component | Use `--depth-api=2` |
