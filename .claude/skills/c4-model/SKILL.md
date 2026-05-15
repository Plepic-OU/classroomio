# C4 Model Skill

Generate or update a C4 architecture model (Layers 1–3) for ClassroomIO.
Outputs Mermaid C4 diagrams to `docs/c4/`. Components are derived from AST, not hardcoded.

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
npx tsx .claude/skills/c4-model/c4.ts
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
- Writes to `docs/c4/`:
  - `l1-system-context.md` — Mermaid C4Context diagram
  - `l2-containers.md` — Mermaid C4Container diagram
  - `l3-dashboard.md` — Mermaid C4Component diagram for Dashboard
  - `l3-api.md` — Mermaid C4Component diagram for API
  - `components.json` — structured JSON (gitignored; AI context)

## Step 3 — Database schema (optional)

Only run this if the user asks for database schema, or if `supabase start` is confirmed running:

```bash
bash .claude/skills/c4-model/db-schema.sh
```

Requires local Supabase (`pnpx supabase start`). Outputs `docs/c4/database.md`.

## Step 4 — Show the user what was generated

After running, read `docs/c4/l1-system-context.md`, `l2-containers.md`, and summarize:
- Component counts per app
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
