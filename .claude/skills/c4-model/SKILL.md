# C4 Architecture Model Generator

Generate or update C4 architecture diagrams (Layers 1-3) for ClassroomIO, outputting Mermaid C4 diagrams to `docs/c4/`.

## When to use

Use this skill when the user asks to generate, update, or refresh C4 architecture diagrams, component diagrams, or system architecture documentation.

## Steps

### 1. Extract component structure from AST

Run the extraction script to deterministically parse the codebase:

```bash
./node_modules/.bin/tsx .claude/skills/c4-model/extract-components.ts
```

Options:
- `--depth-api N` — directory grouping depth for API (default: 3)
- `--depth-dashboard N` — directory grouping depth for Dashboard (default: 3)

If warnings appear about components with >50 files, increase the depth for that app and re-run.

Output: `docs/c4/components.json` (gitignored)

### 2. Extract database schema (requires local Supabase)

```bash
.claude/skills/c4-model/extract-database.sh
```

Output: `docs/c4/database.md`

If Supabase is not running, skip this step and note it in the output.

### 3. Generate Mermaid C4 diagrams

Using the extracted JSON and the references in `.claude/skills/c4-model/references/`, generate these files:

#### `docs/c4/L1-context.md` — Layer 1: System Context
Show ClassroomIO as a system, its users (Students, Instructors, Admins), and external systems (SMTP, S3/R2, Supabase).

```
C4Context
    title System Context - ClassroomIO

    Person(student, "Student", "Enrolled learner")
    Person(instructor, "Instructor", "Creates and manages courses")
    Person(admin, "Org Admin", "Manages organization settings")

    System(cio, "ClassroomIO", "Open-source LMS for course management, grading, and certificates")

    System_Ext(supabase, "Supabase", "Database, Auth, Edge Functions")
    System_Ext(r2, "Cloudflare R2 / S3", "File storage")
    System_Ext(smtp, "SMTP Provider", "Email delivery")

    Rel(student, cio, "Uses")
    Rel(instructor, cio, "Uses")
    Rel(admin, cio, "Manages")
    Rel(cio, supabase, "Reads/writes data, authenticates")
    Rel(cio, r2, "Stores/retrieves files")
    Rel(cio, smtp, "Sends emails")
```

#### `docs/c4/L2-container.md` — Layer 2: Container
Show the internal containers: Dashboard, API, Marketing Site, Docs, Supabase, R2.

```
C4Container
    title Container Diagram - ClassroomIO

    Person(user, "User", "Student, Instructor, or Admin")

    System_Boundary(cio, "ClassroomIO") {
        Container(dashboard, "Dashboard", "SvelteKit", "Main LMS web application")
        Container(api, "API", "Hono", "File uploads, PDFs, emails")
        Container(marketing, "Marketing Site", "SvelteKit", "classroomio.com")
        Container(docs, "Docs", "SvelteKit", "Documentation site")
    }

    SystemDb_Ext(supabase, "Supabase", "PostgreSQL + Auth + Edge Functions")
    System_Ext(r2, "Cloudflare R2", "S3-compatible file storage")
    System_Ext(smtp, "SMTP Provider", "Email delivery")

    Rel(user, dashboard, "Uses", "HTTPS")
    Rel(user, marketing, "Visits", "HTTPS")
    Rel(dashboard, supabase, "Auth, CRUD", "Supabase Client SDK")
    Rel(dashboard, api, "File ops, PDFs, emails", "HTTP/RPC")
    Rel(api, supabase, "Queries", "Service Role")
    Rel(api, r2, "Presigned URLs", "S3 API")
    Rel(api, smtp, "Sends email", "SMTP/API")
```

#### `docs/c4/L3-api.md` — Layer 3: API Components
Read `docs/c4/components.json` field `API.components`. For each component, create a `Component()` node inside a `Container_Boundary(api, "API")`. Use the component key as the alias (sanitized), the technology field, and derive a short description from the key name and exports. Draw `Rel()` edges from the `relationships` array. Include external system nodes that API components depend on (Supabase, R2, SMTP, Redis).

#### `docs/c4/L3-dashboard.md` — Layer 3: Dashboard Components
Same approach for `Dashboard.components`. Group components inside `Container_Boundary(dashboard, "Dashboard")`. Show relationships to external systems and to the API container.

### 4. Diagram generation rules

- Use Mermaid C4 syntax from `references/c4-mermaid-syntax.md`
- Sanitize component keys for aliases: replace `/` with `_`, `(root)` with `root`
- Keep descriptions concise (under 50 chars) — this is for AI context consumption
- Omit components with 0 TS files and 0 Svelte files (empty groupings)
- For Layer 3, if there are more than 20 components, group less-significant ones (few files, no cross-component relationships) under a single "Utilities" component
- Add `UpdateLayoutConfig(4, 2)` if diagrams have many nodes
- Each output file should be a markdown file with the Mermaid diagram in a fenced code block

### 5. Output summary

After generating all files, print a summary:
- Files created/updated
- Component counts per app
- Any warnings about granularity
- Whether database schema was extracted
