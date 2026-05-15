# C4 Model — Generate / Update

Generate or refresh C4 model diagrams (Layers 1–3) for ClassroomIO using AST extraction.

Each script skips its work automatically when nothing has changed since the last run.
Pass `--force` to any script to bypass the cache and regenerate unconditionally.

## When invoked

Run these steps in order. Show brief progress to the user between steps.

---

### 1 · Check prerequisites

```bash
node -e "require('ts-morph')" 2>/dev/null || pnpm add -D ts-morph tsx -w
```

---

### 2 · Extract component structure (ts-morph)

```bash
pnpm exec tsx .claude/skills/c4-model/extract-components.ts
```

- Skips automatically if source files are unchanged since the last run (hash stored in `.component-hash`).
- On repeated runs the last-used depth is remembered automatically — no depth flag needed.
- On the **first run** (no cache), starts at depth 3. If the output warns that any component has >50 files, increment the depth and retry until warnings clear (up to depth 6):

```bash
pnpm exec tsx .claude/skills/c4-model/extract-components.ts --depth-dashboard 4
pnpm exec tsx .claude/skills/c4-model/extract-components.ts --depth-dashboard 5
```

Extraction output: `.claude/skills/c4-model/extracted.json` (gitignored).

---

### 3 · Generate diagrams

Run both generators. Each skips if its output files are already newer than `extracted.json`.

```bash
pnpm exec tsx .claude/skills/c4-model/generate-diagrams.ts
pnpm exec tsx .claude/skills/c4-model/generate-dot-diagrams.ts
```

Output files in `docs/c4/`:

| File | Format | Content |
|------|--------|---------|
| `l1-context.md` | Mermaid | Layer 1 — System Context |
| `l2-containers.md` | Mermaid | Layer 2 — Containers |
| `l3-dashboard.md` | Mermaid | Layer 3 — Dashboard components (AST-derived) |
| `l3-api.md` | Mermaid | Layer 3 — API components (AST-derived) |
| `l1-context.dot` | Graphviz | Layer 1 — System Context |
| `l2-containers.dot` | Graphviz | Layer 2 — Containers |
| `l3-dashboard.dot` | Graphviz | Layer 3 — Dashboard components (AST-derived) |
| `l3-api.dot` | Graphviz | Layer 3 — API components (AST-derived) |

---

### 4 · (Optional) Extract database schema

Only if local Supabase is running (`npx supabase start` in `supabase/`).
Skips automatically if migration files are unchanged since the last run (hash stored in `.schema-hash`).

```bash
bash .claude/skills/c4-model/extract-schema.sh
```

Output: `docs/c4/database.md` — compact table/column/FK reference + Mermaid ER diagram.

---

### 5 · Report to user

After all steps complete, tell the user:
- Which steps ran and which were skipped (unchanged)
- How many components and relationships were found per app (only if extraction ran)
- Paths of all files written to `docs/c4/`
- Any depth-validation warnings

## Options reference

| Flag | Default | Effect |
|------|---------|--------|
| `--depth-dashboard N` | `3` | Directory depth for dashboard component keys |
| `--depth-api N` | `2` | Directory depth for API component keys |
| `--output PATH` | `…/extracted.json` | Override JSON output path |
| `--force` | off | Skip change detection and regenerate unconditionally |

## Notes

- Diagrams are primarily for AI context consumption; Mermaid rendering of L3 may be dense.
- Svelte files are not parsed by ts-morph — they are counted per directory and appear in component metadata.
- `.component-hash` and `.schema-hash` are gitignored cache files; delete them to force a full refresh without `--force`.
- Re-run the full skill after significant refactors to keep diagrams accurate.
