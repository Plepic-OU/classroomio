# Skill: c4-model

Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Outputs Mermaid diagrams to `docs/c4/`. Layer 3 components are derived from AST,
not hardcoded.

## Output files

**Mermaid (docs/c4/)**

| File | C4 Layer | How produced |
|------|----------|--------------|
| `docs/c4/c4-context.md` | L1 System Context | Static / curated |
| `docs/c4/c4-containers.md` | L2 Containers | Static / curated |
| `docs/c4/c4-components-api.md` | L3 API | AST extraction |
| `docs/c4/c4-components-dashboard.md` | L3 Dashboard | AST extraction |
| `docs/c4/database.md` | DB schema | Live Supabase (optional) |
| `docs/c4/components-{app}.json` | Intermediate | AST (gitignored) |

**Graphviz DOT (docs/graphviz/)**

| File | C4 Layer | How produced |
|------|----------|--------------|
| `docs/graphviz/context.dot` | L1 System Context | Static / curated |
| `docs/graphviz/containers.dot` | L2 Containers | Static / curated |
| `docs/graphviz/components-api.dot` | L3 API | AST extraction |
| `docs/graphviz/components-dashboard.dot` | L3 Dashboard | AST extraction |

Both formats share the same intermediate JSON — same nodes, same edges, same relationships.

## Known limitations

- `.svelte` files are **not parsed** (ts-morph can't handle Svelte syntax). Only `.ts`/`.js` files contribute to relationship edges. This means routes → component imports are underrepresented; lib-layer relationships are accurate.
- The diagram aggregates the depth=5 JSON to display depth=2 for the dashboard, keeping the diagram at 5–20 nodes (C4 convention). The JSON retains full depth for AI context.

## Prerequisites

- Run all commands from the **workspace root** (`/workspaces/classroomio`).
- For database extraction: `supabase start` must be running (Docker required).

---

## Step 1 — Install skill dependencies

```bash
ls .claude/skills/c4-model/node_modules/ts-morph 2>/dev/null \
  || npm install --prefix .claude/skills/c4-model --silent
```

---

## Step 2 — Extract AST components

Run both apps at their validated depths:

```bash
# dashboard at depth=5 (no >50-file warnings at this depth)
npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/extract-components.ts \
  --app=dashboard --depth=5

# api at depth=2 (13 components; ideal for this codebase size)
npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/extract-components.ts \
  --app=api --depth=2
```

If the output warns that any component has >50 files, increase that app's depth and re-run.

---

## Step 3 — Generate Mermaid diagrams

```bash
npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/generate-c4.ts
```

Each file is only written if its content has changed (timestamps excluded from comparison).
The script prints `(unchanged)` for files that need no update, and a short diff summary
(added/removed components and relationships) for files that do.

---

## Step 4 — Generate Graphviz DOT diagrams

```bash
npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/generate-dot.ts
```

Outputs four `.dot` files to `docs/graphviz/`. Only writes files whose content has changed.

To render to SVG (requires `graphviz` installed — `sudo apt-get install graphviz`):

```bash
for f in docs/graphviz/*.dot; do dot -Tsvg "$f" -o "${f%.dot}.svg"; done
```

---

## Step 5 — Extract database schema

Check if Supabase is running, then extract:

```bash
docker ps --format '{{.Names}}' 2>/dev/null | grep -qE 'supabase_db_|supabase-db' \
  && bash .claude/skills/c4-model/extract-database.sh \
  || echo "Supabase not running — skipping database extraction."
```

The script only overwrites `docs/c4/database.md` when the schema has changed.
It reports added/removed tables, or "column or type changes only" for subtler updates.

---

## Step 6 — Present results to the user

After all scripts complete:

1. Report the change summary printed by each script:
   - If all files are unchanged: "No changes — docs/c4/ and docs/graphviz/ are already up to date."
   - If files changed: list each updated file with its added/removed components, relationships, or tables.

2. Only read and display the markdown files that actually changed (skip unchanged ones).

3. Mention the JSON intermediates are gitignored; the `.md` and `.dot` files should be committed.

---

## Regeneration

Re-run Steps 2–4 whenever source code changes significantly. The `.md` diagrams are
the committed artefacts; the `.json` files are ephemeral intermediates.

## Depth reference

| App | Validated depth | Components in JSON | Notes |
|-----|-----------------|--------------------|-------|
| dashboard | 5 | 202 | No >50-file warnings |
| api | 2 | 13 | Ideal C4 granularity |

The diagram always aggregates to display depth=2 regardless of extraction depth.

## Reference material

- `.claude/skills/c4-model/references/c4-conventions.md` — C4 model rules + Mermaid syntax
