# C4 Architecture Model Generator

Generate or update C4 model diagrams (Layers 1–3) for ClassroomIO, outputting Mermaid C4 diagrams to `docs/c4/`.

## Instructions

When the user asks to generate, update, or refresh the C4 architecture diagrams:

### Step 1: Extract component structure from AST

Run the extraction script to parse the codebase and produce `docs/c4/extracted-structure.json`:

```bash
cd /workspaces/classroomio && npx tsx .claude/skills/c4-model/extract-structure.ts
```

Review the JSON output. If any component has >50 files, edit the `APPS` config in `extract-structure.ts` to increase `componentDepth` for that app and re-run.

### Step 2: Extract database schema (optional, requires Supabase)

If `supabase` is running locally, extract the DB schema:

```bash
bash .claude/skills/c4-model/extract-db-schema.sh
```

This produces `docs/c4/database.md`. If Supabase isn't running, skip this step and note it in the output.

### Step 3: Generate Mermaid C4 diagrams

Read `docs/c4/extracted-structure.json` and the reference file at `.claude/skills/c4-model/references/c4-conventions.md`, then generate three files:

#### `docs/c4/c4-context.md` — Layer 1: System Context

Show ClassroomIO as a system with external actors and systems:

- **Actors**: Teacher, Student, Admin
- **External Systems**: Supabase (Auth + DB + Storage), Email Provider, S3/R2 (File Storage)
- Use `C4Context` diagram type
- Keep concise — this is for AI context consumption

#### `docs/c4/c4-container.md` — Layer 2: Container

Show the internal containers of ClassroomIO:

- **Dashboard** (SvelteKit) — Main web app for teachers and students
- **API** (Hono/Node.js) — Backend for PDF gen, email, file uploads, course cloning
- **Landing Site** (SvelteKit) — Marketing site
- **Docs** (Fumadocs/React) — Documentation site
- **Supabase** — PostgreSQL DB, Auth, Storage (external)
- **Redis** — Rate limiting cache (external)
- **S3/R2** — Presigned URL file storage (external)
- Use `C4Container` diagram type

#### `docs/c4/c4-component-dashboard.md` — Layer 3: Dashboard Components

Use the extracted JSON to generate a `C4Component` diagram for the Dashboard container:

- Each component from the JSON becomes a `Component()` element
- Group related components using `Container_Boundary`
- Relationships come from the `relationships` array in the JSON (only show importCount >= 3)
- Derive technology labels from directory context (e.g., routes/* → "SvelteKit Route", components/* → "Svelte Component", services/* → "TypeScript Service")
- Components with high svelte file counts should note "Svelte" as technology

#### `docs/c4/c4-component-api.md` — Layer 3: API Components

Same as above but for the API container:

- Components from the API extraction in the JSON
- Technology labels: routes/* → "Hono Route", middlewares/* → "Hono Middleware", utils/* → "TypeScript Utility", services/* → "TypeScript Service"

### Diagram format rules

- Use fenced Mermaid code blocks (` ```mermaid ... ``` `)
- Keep descriptions short (under 80 chars)
- Use aliases that are lowercase-hyphenated
- Only show relationships with importCount >= 3 to keep diagrams readable
- Add a brief title comment above each diagram explaining what it shows
- Include generation timestamp at the bottom of each file

### Step 4: Summary

After generating all files, print a summary of:
- Number of components extracted per app
- Any warnings (>50 file components, missing Supabase, etc.)
- List of generated files

## Output Files

| File | Content |
|------|---------|
| `docs/c4/extracted-structure.json` | Raw AST extraction (gitignored) |
| `docs/c4/database.md` | DB schema (if Supabase available) |
| `docs/c4/c4-context.md` | Layer 1: System Context diagram |
| `docs/c4/c4-container.md` | Layer 2: Container diagram |
| `docs/c4/c4-component-dashboard.md` | Layer 3: Dashboard components |
| `docs/c4/c4-component-api.md` | Layer 3: API components |
