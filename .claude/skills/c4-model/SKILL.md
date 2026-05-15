# c4-model skill

Generate or refresh C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Components are extracted deterministically from AST using ts-morph; L1/L2 are
derived from known architecture.

## Output files

| File | Layer | Source |
|------|-------|--------|
| `docs/c4/system-context.md` | L1 | Hardcoded (stable architecture) |
| `docs/c4/containers.md` | L2 | Hardcoded (stable architecture) |
| `docs/c4/dashboard-components.md` | L3 | AST-derived from `apps/dashboard` |
| `docs/c4/api-components.md` | L3 | AST-derived from `apps/api` |
| `docs/c4/database.md` | DB schema | Live Supabase instance |

Intermediate JSON files (`docs/c4/*-components.json`) are gitignored.

## Steps

### 1. Install skill dependencies (once, or after package.json changes)

```bash
cd .claude/skills/c4-model && npm install && cd -
```

### 2. Run AST extraction

From the repo root:

```bash
.claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
```

With custom depths (default: `--depth-dashboard=3 --depth-api=2`):

```bash
.claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts \
  --depth-dashboard=4 --depth-api=2
```

**Depth tuning**: if any warning appears saying a component has >50 files,
increase the depth for that app by 1 and re-run.

### 3. Generate Mermaid diagrams

```bash
.claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts
```

### 4. Extract database schema (optional — requires `supabase start`)

```bash
bash .claude/skills/c4-model/db-extract.sh
```

### 5. Report results to the user

- List the generated files.
- Show any depth warnings from step 2.
- Read `docs/c4/dashboard-components.md` and `docs/c4/api-components.md` to
  verify diagrams look reasonable (components named by directory, not hardcoded).
- If the user wants a partial refresh (L3 only, or DB only), skip the other steps.

## Depth reference

Component key depth is measured in directory levels from each app's `src/` dir:

| Depth | Dashboard example key | API example key |
|-------|----------------------|-----------------|
| 2 | `lib/components` | `routes/course` |
| 3 | `lib/components/Course` | `routes/course` |
| 4 | `lib/components/Course/components` | — |

Default: `dashboard=3`, `api=2`.

## Constraints

- L3 diagrams must be derived from the AST — never hardcode component names.
- Mermaid C4 diagram syntax only (no PlantUML).
- Output is intentionally concise for AI context consumption.
- `.svelte` files are counted per component but not parsed (ts-morph limitation).
