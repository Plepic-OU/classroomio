---
name: c4-plantuml
description: Generate or refresh C4 architecture diagrams (Layers 1-3) for ClassroomIO as PlantUML (`.puml`) files. Use when the user asks for a C4 model, context/container/component diagram, or wants to refresh `docs/c4/*.puml`. Outputs C4-PlantUML diagrams driven by AST extraction of `apps/dashboard` and `apps/api`. Prefer this skill over `c4-model` when the user views diagrams in IntelliJ (PlantUML Integration plugin) or wants better auto-layout than Mermaid offers.
---

# c4-plantuml — ClassroomIO C4 diagrams (L1–L3) as PlantUML

Generates **C4-PlantUML diagrams** in `docs/c4/`, with Layer 3 components
derived from AST analysis (ts-morph) — never hardcoded. Same workflow as
`c4-model`; only the UML engine differs.

## When to use

- "Generate C4 diagrams as PlantUML"
- "Refresh `docs/c4/*.puml`"
- "I view diagrams in IntelliJ — give me .puml"
- "Update the PlantUML C4 model"

If the user hasn't specified an engine and just says "C4 diagram", prefer
`c4-model` (Mermaid) — it renders natively in GitHub. Use this skill when
PlantUML is explicitly requested or implied (IntelliJ, JetBrains, `.puml`).

## Outputs

| File | Contents |
|---|---|
| `docs/c4/layer1-context.puml` | System context (users + external systems around ClassroomIO) |
| `docs/c4/layer2-containers.puml` | Containers (dashboard, api, marketing, docs, course-app, db, edge functions) |
| `docs/c4/layer3-api.puml` | Components inside the **api** container, from AST |
| `docs/c4/layer3-dashboard.puml` | Components inside the **dashboard** container, from AST |
| `docs/c4/database.md` | DB schema (from running Supabase) — token-efficient table list + FK refs |
| `docs/c4/components.json` | Raw AST extraction output (gitignored) |

L1 and L2 are stable architectural facts (described in
`references/classroomio-context.md`). L3 is regenerated from code every run.

The `.puml` files coexist with any Mermaid `.md` files left by `c4-model` —
this skill does not delete them. If the user has switched engines and wants
the Mermaid files gone, they should remove them explicitly.

## Workflow

Run the steps in order. **Stop and ask** if a step fails — do not invent
components.

### 1. Extract components from AST

```bash
node .claude/skills/c4-plantuml/scripts/extract-components.mjs
```

Identical to the `c4-model` extractor — same script, just shipped alongside
this skill so it's self-contained. The script:

- Auto-installs `ts-morph` into the skill directory if missing (no monorepo
  changes).
- Reads `apps/dashboard/tsconfig.json` and `apps/api/tsconfig.json`, parses
  `compilerOptions.paths` to build alias maps dynamically.
- Walks `.ts` / `.js` files with ts-morph; parses `<script>` blocks from
  `.svelte` files with a regex fallback.
- Groups files into components by directory at a configurable **depth per
  app** (defaults: dashboard=5, api=2).
- Records cross-component imports as relations with edge counts.
- **Validates depth**: if any component contains >50 files, the script exits
  non-zero and tells you to increase depth.

Output: `docs/c4/components.json` (gitignored).

Override depth if validation fails:
```bash
node .claude/skills/c4-plantuml/scripts/extract-components.mjs --depth-dashboard=6 --depth-api=3
```

### 2. Extract database schema

Requires `supabase start` to be running.

```bash
node .claude/skills/c4-plantuml/scripts/extract-db-schema.mjs
```

Queries `information_schema` + `pg_catalog` via `docker exec` on the Supabase
Postgres container. Writes `docs/c4/database.md` as a compact table list with
FK refs — not full DDL.

If Supabase isn't running, the script tells you and exits cleanly; don't
fabricate schema.

### 3. Generate PlantUML C4 diagrams

Read:
- `docs/c4/components.json` (from step 1)
- `references/classroomio-context.md` (L1+L2 facts)
- `references/plantuml-c4.md` (PlantUML C4 syntax cheat sheet)
- `references/c4-layers.md` (granularity rules)

Then write the four `.puml` files under `docs/c4/`. Each file is a standalone
`@startuml … @enduml` block with a single `!include <C4/C4_*>` at the top.
Keep each diagram **concise** — this is for AI context, not a poster.

**If a `.puml` file already exists, update it in place** (overwrite via
`Write`, or `Edit` the changed sections) — do not create a parallel
`*-v2.puml` or new file. The four filenames above are the canonical
locations. The same applies to `database.md` and `components.json`.

Concretely:
- **L1** (`layer1-context.puml`): `!include <C4/C4_Context>`. 1 Person actor
  per role (teacher, student), 1 `System(classroomio, …)`, all external
  systems from `classroomio-context.md` as `System_Ext`. ~8–12 nodes.
- **L2** (`layer2-containers.puml`): `!include <C4/C4_Container>`.
  `System_Boundary` around ClassroomIO with one `Container` /
  `ContainerDb` per app/service in `apps/`. External systems remain at the
  perimeter. ~10–14 nodes.
- **L3 per container** (`layer3-{api,dashboard}.puml`): `!include
  <C4/C4_Component>`. `Container_Boundary` around the container; one
  `Component` per key in `components.json` for that app. Cross-component
  edges from the relations array — collapse edges with count <2 unless
  they're the only edge for that component.

Don't list every component as a separate `Component()` call if the file has
>30 — group siblings under a meaningful parent and note the count in the
description. Readability beats completeness at this layer.

Include `LAYOUT_WITH_LEGEND()` on each diagram. Don't stack extra layout or
skinparam tweaks unless the default layout is genuinely broken.

## Viewing the output

- **IntelliJ**: install "PlantUML Integration" plugin → open the `.puml` →
  preview renders in a side panel. Requires Graphviz locally (`brew install
  graphviz` / `apt install graphviz`).
- **VS Code**: install "PlantUML" extension.
- **CLI render** to PNG/SVG (optional, for embedding in markdown):
  ```bash
  plantuml -tsvg docs/c4/layer1-context.puml
  ```

The `.puml` source is the canonical artifact — rendered images are
disposable.

## Re-running

The script is idempotent. Re-run any time the AST changes. JSON output is
gitignored; the four `.puml` files are checked in and reviewed like docs.
