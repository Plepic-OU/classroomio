---
name: c4-model
description: Generate or refresh C4 model diagrams (Layers 1-3) for ClassroomIO. Uses AST extraction (ts-morph) to derive Layer 3 components for apps/dashboard and apps/api, and pg_catalog introspection for the database schema. Emits Mermaid C4 diagrams to docs/c4/. Invoke when the user asks to (re)generate, update, or refresh the C4 model, component diagrams, or architecture diagrams for this repo.
---

# c4-model — ClassroomIO C4 model generator

Produces a C4 model (Layers 1-3) for ClassroomIO as Mermaid diagrams in `docs/c4/`. Layer 3 components are derived from the source AST — not hardcoded — via ts-morph, so the output stays in sync with the codebase. Output is intentionally terse: it's read by humans occasionally and by AI agents often.

## Layers produced

| Layer | File                          | Source                                         |
|-------|-------------------------------|------------------------------------------------|
| 1     | `docs/c4/layer1-context.md`   | `references/classroomio-system.md` (curated)   |
| 2     | `docs/c4/layer2-containers.md`| `references/classroomio-system.md` (curated)   |
| 3     | `docs/c4/layer3-dashboard.md` | `extract-components.mjs` on `apps/dashboard`   |
| 3     | `docs/c4/layer3-api.md`       | `extract-components.mjs` on `apps/api`         |
| DB    | `docs/c4/database.md`         | `extract-database.sh` on local Supabase docker |

Layers 1 and 2 are curated facts (people, external systems, container topology) maintained in `references/classroomio-system.md`. Edit that file when those facts change, then regenerate. Layer 3 is fully derived.

## How to run

```bash
cd .claude/skills/c4-model
pnpm install --ignore-workspace # first run only: installs ts-morph locally to the skill

# extract structure → docs/c4/.extraction/{dashboard,api}.json (gitignored)
node extract-components.mjs dashboard
node extract-components.mjs api

# extract DB → docs/c4/database.md (requires `pnpx supabase start`)
bash extract-database.sh

# render Mermaid → docs/c4/layer{1,2,3-*}.md
node generate-diagrams.mjs
```

A single end-to-end refresh:

```bash
cd .claude/skills/c4-model && pnpm install --ignore-workspace --silent \
  && node extract-components.mjs dashboard \
  && node extract-components.mjs api \
  && bash extract-database.sh \
  && node generate-diagrams.mjs
```

## Component-key depth (Layer 3 granularity)

The most consequential knob in `extract-components.mjs`. A file at `src/<a>/<b>/<c>/foo.ts` with `depth=N` becomes part of the component keyed by the first N path segments below `src/`. Too-shallow depth collapses unrelated modules into mega-components; too-deep depth creates a noisy, unreadable diagram.

Defaults (configured in `extract-components.mjs`):

- `dashboard`: depth **3** — keeps `lib/components/Course` distinct from `lib/components/AI` etc.
- `api`: depth **2** — keeps `routes/course` distinct from `services/course`.

Override per invocation: `node extract-components.mjs dashboard --depth 2`.

**Validation:** if any component contains more than 50 source files the script exits non-zero with a warning — usually a sign depth is too shallow.

## What the extractor handles

- Path aliases — parsed dynamically from each app's `tsconfig.json` `compilerOptions.paths`, plus `baseUrl`. No hardcoding.
- Relative imports (`./foo`, `../bar`).
- `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` — full ts-morph parse.
- `.svelte` — script blocks (`<script lang="ts">…</script>`) parsed via regex for `import …` statements; presence counted in component metadata. ts-morph itself can't parse Svelte.
- External (npm) imports are ignored.
- Self-loops (a file in component X importing another file in component X) are ignored.

The output JSON shape is documented at the top of `extract-components.mjs`.

## When to use it

Invoke this skill when the user asks to:

- "generate/refresh/update the C4 model / component diagram / architecture diagrams"
- "show me what the dashboard's internal structure looks like"
- "regenerate `docs/c4/...`"

Do **not** invoke for one-off questions about architecture that can be answered by reading code directly — the skill is for materializing the diagram set, not for answering individual questions.

## References

- `references/c4-model.md` — what a Layer 3 component is, what NOT to call a component.
- `references/mermaid-c4-syntax.md` — Mermaid C4 quirks and the subset this skill uses.
- `references/classroomio-system.md` — curated Layer 1/2 facts. Edit this file when external systems, people roles, or container topology change.
