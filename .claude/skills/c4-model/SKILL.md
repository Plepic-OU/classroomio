---
name: c4-model
description: Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO, outputting Mermaid C4 diagrams to docs/c4/
user_invocable: true
---

# C4 Architecture Model Generator

Generate or update C4 model diagrams (Layers 1–3) for ClassroomIO with Mermaid C4 syntax. Layer 3 components are derived from AST extraction, not hardcoded.

## Instructions

When the user invokes this skill, follow these steps in order:

### Step 1: Run AST Extraction

Install ts-morph if not already available, then run the extraction script:

```bash
cd /workspaces/classroomio
npx tsx .claude/skills/c4-model/extract-components.ts
```

The default depth is 3 for dashboard and 2 for API. Use `--depth-dashboard 4` (recommended) to get better granularity:

```bash
npx tsx .claude/skills/c4-model/extract-components.ts --depth-dashboard 4
```

If any component still has >50 files, consider increasing depth further.

Read the output at `docs/c4/extracted-components.json`.

### Step 2: Extract Database Schema (if Supabase is running)

```bash
cd /workspaces/classroomio
.claude/skills/c4-model/extract-db-schema.sh
```

If Supabase is not running, skip this step and note it in the output. The user can run `supabase start` and re-invoke.

### Step 3: Generate Layer 1 — System Context

Create `docs/c4/L1-system-context.md` with a `C4Context` Mermaid diagram showing:

- **Person**: Teacher, Student
- **System**: ClassroomIO ("Open-source LMS for managing courses, students, and learning content")
- **External Systems**: Supabase (Auth + DB), OpenAI (AI content generation), Stripe/Lemon Squeezy (Payments), Cloudflare R2 (File storage), SMTP (Email), PostHog (Analytics), Sentry (Error tracking)
- **Relationships**: Users → ClassroomIO, ClassroomIO → each external system with protocol/purpose labels

### Step 4: Generate Layer 2 — Container

Create `docs/c4/L2-container.md` with a `C4Container` Mermaid diagram showing:

- **Container_Boundary** for ClassroomIO:
  - Container: Dashboard (SvelteKit, "Main LMS web app — teacher and student views")
  - Container: API (Hono.js, "Backend API — email, PDF, video, course cloning")
  - Container: Marketing Site (SvelteKit, "Landing page at classroomio.com")
  - Container: Docs (React/Fumadocs, "Documentation site")
  - ContainerDb: PostgreSQL (Supabase, "Core data — users, orgs, courses, lessons")
  - Container: Edge Functions (Deno/Supabase, "Serverless functions — notifications, grades")
  - Container: Redis ("Rate limiting and caching")
- **External**: Cloudflare R2, OpenAI, Stripe, SMTP, PostHog, Sentry
- **Relationships**: Dashboard → API (HTTP/RPC), Dashboard → PostgreSQL (Supabase client), API → PostgreSQL, API → Redis, API → R2, API → SMTP, Dashboard → PostHog, etc.

### Step 5: Generate Layer 3 — Component Diagrams

Read `docs/c4/extracted-components.json` and generate:

#### `docs/c4/L3-dashboard.md`

A `C4Component` diagram for the Dashboard container. Map extracted components to C4 Component elements:

- Group components into logical boundaries (e.g., "UI Components", "Services", "State Management", "Routes", "Utilities")
- Use the `relationships` field from the JSON to draw `Rel()` lines between components
- Include technology labels (e.g., "Svelte Component", "TypeScript Service", "Svelte Store")
- Note svelte file counts in descriptions where relevant
- Keep the diagram readable — if there are many components, group small ones or omit purely internal utility components that have few relationships

#### `docs/c4/L3-api.md`

A `C4Component` diagram for the API container. Same approach:

- Group into boundaries: "Routes", "Services", "Middleware", "Config/Utils"
- Map relationships from the JSON
- Include technology labels (Hono route, TypeScript service, etc.)

### Step 6: Validate Output

After generating all files, verify:
1. All Mermaid diagrams use valid C4 syntax (C4Context, C4Container, C4Component)
2. Alias names contain only alphanumeric characters and underscores (no spaces, hyphens, or dots)
3. All `Rel()` references point to defined aliases
4. No component has been hardcoded — everything in L3 comes from the extraction JSON

### Output Format Guidelines

- Files are Markdown with Mermaid code blocks
- Keep descriptions concise — this is for AI context consumption
- Each file should have a brief header explaining what layer it represents
- Include a generation timestamp comment at the bottom

## References

Read `.claude/skills/c4-model/references/c4-conventions.md` for Mermaid C4 syntax and conventions.
