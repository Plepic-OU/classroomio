# C4 Model — Generate / Update

Generate or refresh C4 model diagrams (Layers 1–3) for ClassroomIO using AST extraction.

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

Default depths: `--depth-dashboard 3`, `--depth-api 2`.
If the output warns that any component has >50 files, re-run with a higher depth:

```bash
pnpm exec tsx .claude/skills/c4-model/extract-components.ts --depth-dashboard 4
```

Extraction output: `.claude/skills/c4-model/extracted.json` (gitignored).

---

### 3 · Generate Mermaid diagrams

```bash
pnpm exec tsx .claude/skills/c4-model/generate-diagrams.ts
```

Output files in `docs/c4/`:
| File | Content |
|------|---------|
| `l1-context.md` | Layer 1 — System Context |
| `l2-containers.md` | Layer 2 — Containers |
| `l3-dashboard.md` | Layer 3 — Dashboard components (AST-derived) |
| `l3-api.md` | Layer 3 — API components (AST-derived) |

---

### 4 · (Optional) Extract database schema

Only if local Supabase is running (`npx supabase start` in `supabase/`):

```bash
bash .claude/skills/c4-model/extract-schema.sh
```

Output: `docs/c4/database.md` — compact table/column/FK reference.

---

### 5 · Report to user

After all steps complete, tell the user:
- How many components and relationships were found per app
- Paths of all files written to `docs/c4/`
- Any depth-validation warnings

## Options reference

| Flag | Default | Effect |
|------|---------|--------|
| `--depth-dashboard N` | `3` | Directory depth for dashboard component keys |
| `--depth-api N` | `2` | Directory depth for API component keys |
| `--output PATH` | `…/extracted.json` | Override JSON output path |

## Notes

- Diagrams are primarily for AI context consumption; Mermaid rendering of L3 may be dense.
- Svelte files are not parsed by ts-morph — they are counted per directory and appear in component metadata.
- Re-run the full skill after significant refactors to keep diagrams accurate.
