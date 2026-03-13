# C4 Architecture Model

Generate or update C4 model diagrams (Layers 1–3) for ClassroomIO, outputting Mermaid C4 diagrams to `docs/c4/`.

## Usage

Run `/c4-model` to regenerate all C4 diagrams. This will:

1. Extract component structure from `apps/dashboard` and `apps/api` via AST analysis
2. Extract database schema from local Supabase (requires `supabase start`)
3. Generate Mermaid C4 diagrams at all three layers

## Steps

### Step 1: AST Extraction

Run the extraction script to produce component JSON:

```bash
cd /workspaces/classroomio && npx tsx .claude/skills/c4-model/extract-components.ts
```

This outputs `docs/c4/components-api.json` and `docs/c4/components-dashboard.json`.

Review the JSON. If any component has >50 files, increase the depth config in the script for that app.

### Step 2: Database Schema Extraction

Extract the database schema from the local Supabase instance:

```bash
bash .claude/skills/c4-model/extract-db-schema.sh
```

This outputs `docs/c4/database.md`. Requires a running local Supabase (`supabase start`).

### Step 3: Generate C4 Diagrams

Using the extracted JSON and database schema, generate/update the following Mermaid files. Follow the conventions in `references/c4-conventions.md`:

#### Layer 1 — System Context (`docs/c4/c4-L1-context.md`)

Show ClassroomIO as a system, its users (Teachers, Students), and external systems (Supabase/PostgreSQL, S3/R2 Storage, SMTP Email, OpenAI).

#### Layer 2 — Container (`docs/c4/c4-L2-container.md`)

Zoom into ClassroomIO showing containers: Dashboard (SvelteKit), API (Hono.js), Landing Page (SvelteKit), Docs (Vite), Supabase DB, S3/R2 Storage. Show which containers talk to which.

#### Layer 3 — Component: API (`docs/c4/c4-L3-api.md`)

Use `docs/c4/components-api.json` to generate a C4Component diagram. Each JSON component becomes a `Component()` node. Use the relationships from the JSON to draw `Rel()` lines. Group components inside a `Container_Boundary` for the API.

#### Layer 3 — Component: Dashboard (`docs/c4/c4-L3-dashboard.md`)

Use `docs/c4/components-dashboard.json` to generate a C4Component diagram. Each JSON component becomes a `Component()` node. Use relationships from JSON. Group inside a `Container_Boundary` for the Dashboard. Note svelte file counts in component descriptions.

### Diagram Guidelines

- Use Mermaid C4 syntax (`C4Context`, `C4Container`, `C4Component`)
- Keep descriptions concise — this is for AI context consumption
- Component IDs should be valid Mermaid identifiers (alphanumeric, underscores)
- Sanitize component keys: replace `/`, `.`, `-`, `@` with `_`
- Include a brief text summary above each diagram for quick scanning
- Reference `references/c4-conventions.md` for syntax patterns
