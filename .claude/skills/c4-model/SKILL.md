# Skill: c4-model

Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Outputs Mermaid C4 diagrams to `docs/c4/`.

## When to use

Invoke this skill when asked to:
- Generate or refresh architecture diagrams
- Document how the system, containers, or components relate
- Produce an up-to-date view of the codebase structure for onboarding or review

## Files produced

| File | Content |
|------|---------|
| `docs/c4/context.md` | Layer 1 — System Context |
| `docs/c4/containers.md` | Layer 2 — Container diagram |
| `docs/c4/dashboard.md` | Layer 3 — Dashboard component diagram (AST-derived) |
| `docs/c4/api.md` | Layer 3 — API component diagram (AST-derived) |
| `docs/c4/database.md` | Database schema (requires `supabase start`) |

Intermediate JSON is written to `.claude/skills/c4-model/output/components.json` (gitignored).

## Prerequisites

Install skill dependencies (once, from repo root):

```bash
cd .claude/skills/c4-model && pnpm install --ignore-workspace
```

This installs `ts-morph` and `tsx` into `.claude/skills/c4-model/node_modules/`.

## Execution steps

### Step 1 — Extract component structure

Run the AST extraction script. It parses TypeScript/JavaScript source files,
resolves path aliases from tsconfig.json, counts Svelte files per directory,
and outputs structured JSON.

```bash
cd .claude/skills/c4-model && pnpm run extract
# or with depth overrides:
node node_modules/tsx/dist/cli.mjs extract.ts --dashboard-depth=4 --api-depth=3
```

Check the console output for warnings. If any component contains >50 files, the
depth is too shallow — increase it with `--<app>-depth=<n>`.

### Step 2 — Generate diagrams

Reads the JSON from Step 1 and writes Mermaid C4 diagrams to `docs/c4/`.

```bash
cd .claude/skills/c4-model && pnpm run generate
```

Layers 1 and 2 are architecturally grounded (static) because the container
boundaries are stable. Layer 3 is fully derived from the AST.

Run both steps in sequence:
```bash
cd .claude/skills/c4-model && pnpm run c4
```

### Step 3 (optional) — Database schema

Requires Supabase running locally (`supabase start`).

```bash
cd .claude/skills/c4-model && pnpm run db-schema
```

## Depth guidance

Component grouping depth controls how many directory segments form a "component key".

| Depth | Example keys (Dashboard) | Notes |
|-------|--------------------------|-------|
| 3 (default) | `src/lib/components`, `src/lib/utils`, `src/routes/org` | Good overview; `src/lib/utils` groups all services/stores together |
| 4 | `src/lib/utils/services`, `src/lib/utils/store`, `src/routes/org` | Exposes services vs store; splits `src/lib/components` into per-component dirs |

**Dashboard caveat at depth=4**: SvelteKit dynamic route segments (`[slug]`, `[courseId]`)
appear in keys. For routes, depth=3 is cleaner. For `lib/utils`, depth=4 is more useful.
The default of 3 is the safer choice for a first run.

| Depth | API keys | Notes |
|-------|----------|-------|
| 2 (default) | `src/routes`, `src/services`, `src/middlewares`, `src/utils` | Ideal for the API's flat structure |
| 3 | `src/routes/course`, `src/services/course` | More granular |

## Reviewing and interpreting output

After generation, read `docs/c4/dashboard.md` and `docs/c4/api.md`.
The Mermaid diagrams render in GitHub, VS Code (with Mermaid Preview), or
at mermaid.live.

The component table below each diagram lists every component key with file
counts — use this to assess whether the depth is right:
- A component with 0 TS files but many Svelte files is a pure UI directory.
- A component with many TS files and 0 Svelte files is likely a service/utility layer.

## Manual adjustments

Layer 1 and 2 diagrams are written as static Mermaid in `generate-diagrams.ts`.
If you need to add/remove an external system or change a container description,
edit the `generateContext()` or `generateContainers()` functions and re-run.

## References

- `references/c4-conventions.md` — Mermaid C4 syntax, alias rules, relationship labels
- https://c4model.com/abstractions/component — C4 component-level granularity guidance
- https://mermaid.js.org/syntax/c4.html — Full Mermaid C4 syntax reference
