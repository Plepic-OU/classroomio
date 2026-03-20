# C4 Architecture Model Generator for ClassroomIO

Generate C4 architecture diagrams (Layers 1–3) for the ClassroomIO monorepo using Mermaid syntax.

## Instructions

1. **Read reference materials** for C4 conventions and Mermaid syntax:
   - Read `.claude/skills/c4-model/references/c4-conventions.md`
   - Read `.claude/skills/c4-model/references/mermaid-c4-syntax.md`

2. **Extract component data** by running these commands:
   - Run `npx tsx .claude/skills/c4-model/extract-components.ts` to produce AST-based component JSON at `.claude/skills/c4-model/ast-output.json`
   - Run `bash .claude/skills/c4-model/extract-db-schema.sh` to extract the database schema from local Supabase

3. **Read the extracted data**:
   - Read `.claude/skills/c4-model/ast-output.json` for component/relationship data
   - Use the DB schema output from step 2

4. **Generate C4 diagrams** — create/update the following files in `docs/c4/`:

   ### `docs/c4/L1-system-context.md` — Layer 1: System Context
   Show ClassroomIO as the central system with external actors and systems:
   - **People**: Teachers/Instructors, Students, Administrators
   - **External Systems**: Supabase (Auth + PostgreSQL), Cloudflare (Video), AWS S3 (Files), Email providers (SMTP/Zeptomail), Payment providers (Polar/LemonSqueezy), Sentry (Error tracking), Redis (Cache)
   - Use `C4Context` Mermaid diagram type

   ### `docs/c4/L2-container.md` — Layer 2: Container
   Show the containers (deployable units) within ClassroomIO:
   - Dashboard (`apps/dashboard`) — SvelteKit 1.x, port 5173
   - API (`apps/api`) — Hono on Node, port 3002
   - Marketing Site (`apps/classroomio-com`) — SvelteKit 2.x, port 5174
   - Docs Site (`apps/docs`) — React/Fumadocs, port 3000
   - Supabase PostgreSQL — Database
   - Redis — Cache/Rate limiting
   - Show relationships between containers and to external systems
   - Use `C4Container` Mermaid diagram type

   ### `docs/c4/L3-api-components.md` — Layer 3: API Components
   Derive components from the AST extraction JSON for `apps/api`:
   - Routes, middlewares, services, utils grouped logically
   - Show internal relationships between components
   - Use `C4Component` Mermaid diagram type

   ### `docs/c4/L3-dashboard-components.md` — Layer 3: Dashboard Components
   Derive components from the AST extraction JSON for `apps/dashboard`:
   - Group by major feature areas (Course, Org, LMS, Auth, etc.)
   - Show key internal relationships
   - Use `C4Component` Mermaid diagram type

   ### `docs/c4/database.md` — Database Schema
   Format the extracted DB schema into a readable reference document with:
   - Table listings with columns and types
   - Foreign key relationships
   - Logical groupings (auth, courses, organizations, etc.)

5. **Formatting rules**:
   - Each diagram file should start with a heading and brief description
   - Wrap Mermaid diagrams in ` ```mermaid ` code blocks
   - Use consistent naming: PascalCase for systems/containers/components, lowercase for relationships
   - Keep relationship labels concise (e.g., "Uses", "Reads/Writes", "Sends email via")
