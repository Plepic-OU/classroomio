# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (runs across all apps via Turborepo)
```bash
pnpm dev                          # Start all apps in development mode
pnpm build                        # Build all apps
pnpm lint                         # Lint all apps
pnpm format                       # Format all files with Prettier
```

### Filter to a specific app
```bash
pnpm dev --filter=@cio/dashboard
pnpm dev --filter=@cio/api
pnpm dev --filter=@cio/classroomio-com
pnpm dev --filter=@cio/docs
```

### Dev container (binds to 0.0.0.0 for external access)
```bash
pnpm dev:container
```

### Dashboard (`apps/dashboard`)
```bash
pnpm test                         # Run Jest tests
pnpm test:watch                   # Run tests in watch mode
pnpm lint                         # ESLint
```

### API (`apps/api`)
```bash
pnpm test                         # Run Vitest tests
pnpm test:coverage                # Run tests with coverage
pnpm lint                         # ESLint
```

### Supabase (local)
```bash
supabase start                    # Start local Supabase (requires Docker)
supabase stop
```

### Default dev ports
- `dashboard`: http://localhost:5173
- `api`: http://localhost:3002
- `classroomio-com`: http://localhost:5174
- `docs`: http://localhost:3000
- Supabase Studio: http://localhost:54323

### Default local login
- Email: `admin@test.com`
- Password: `123456`

## Architecture

This is a **pnpm + Turborepo monorepo** with the following apps and packages:

### Apps
- **`apps/dashboard`** — The main LMS web app (SvelteKit + TailwindCSS). This is the teacher/student-facing dashboard at `app.classroomio.com`.
- **`apps/api`** — Backend service (Hono on Node.js) for long-running tasks: PDF generation, video upload pre-signing, email delivery, course cloning, and KaTeX rendering. Runs on port 3002.
- **`apps/classroomio-com`** — Marketing/landing site (SvelteKit).
- **`apps/docs`** — Documentation site.

### Packages
- **`packages/shared`** — Shared TypeScript types and constants (e.g., plan names, roles) used across apps.
- **`packages/tsconfig`** — Shared TypeScript config.
- **`packages/course-app`** — Standalone course app package.

### Database
Supabase (Postgres) is the sole database and auth provider. Migrations live in `supabase/migrations/`. The dashboard uses the Supabase JS client (`apps/dashboard/src/lib/utils/functions/supabase.ts`) initialized from `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

### Dashboard architecture (`apps/dashboard`)
- **Routing**: SvelteKit file-based routing under `src/routes/`. Key route groups:
  - `/org/[slug]/` — Teacher/admin organization views
  - `/courses/[id]/` — Course management (lessons, people, marks, submissions, etc.)
  - `/lms/` — Student-facing views (my learning, community, exercises)
  - `/api/` — SvelteKit server routes (email sending, AI completion, analytics, domain management)
- **State management**: Svelte stores in `src/lib/utils/store/` (org, user, app, attendance). Key stores: `currentOrg`, `orgs`, `isOrgAdmin`, `isFreePlan`.
- **Auth**: `hooks.server.ts` validates JWT tokens on all `/api/*` routes except a public allowlist. Auth uses Supabase sessions.
- **API client**: `src/lib/utils/services/api/index.ts` exports `apiClient` (generic fetch wrapper with retry/timeout) and `classroomio` (typed Hono RPC client via `hcWithType` from `@cio/api/rpc-types`).
- **Components**: Feature-organized under `src/lib/components/` (Course, Org, Apps, Navigation, etc.), not by type.
- **i18n**: `@sveltekit-i18n` with ICU message format. Translation files are separate from components.
- **AI**: OpenAI integration via `src/routes/api/completion/` routes for course content, exercises, and grading prompts.

### API architecture (`apps/api`)
- **Framework**: Hono with `@hono/node-server`.
- **Routes**: `/course` (PDF/certificate download, lesson management, presigned S3 URLs, course cloning) and `/mail` (transactional emails via Nodemailer/ZeptoMail).
- **Typed RPC**: The API exports types via `rpc-types` entry point, consumed by the dashboard's `classroomio` client for end-to-end type safety.
- **Validation**: Zod schemas on all routes via `@hono/zod-validator`.
- **Path aliases**: `$src` maps to `src/` (via `tsc-alias`).

### Environment variables
- **Dashboard** (`apps/dashboard/.env.example`): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`, `PUBLIC_SERVER_URL` (points to API), `OPENAI_API_KEY`, `PUBLIC_IS_SELFHOSTED`.
- **API** (`apps/api/.env.example`): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_ROLE`, Cloudflare S3 credentials (for video uploads), SMTP credentials (for email).

### C4 architecture diagrams

Run `/c4-model` to generate or update the C4 model diagrams in `docs/c4/`. The skill uses ts-morph AST extraction (`extract.ts`) to derive Layer 3 components from source, and `db-schema.mjs` to extract the database schema from the running local Supabase instance.

- Layer 1 — System Context: @docs/c4/context.md
- Layer 2 — Containers: @docs/c4/containers.md
- Layer 3 — Dashboard Components: @docs/c4/dashboard-components.md
- Layer 3 — API Service Components: @docs/c4/api-components.md
- Database schema: @docs/c4/database.md

### Self-hosting flag
`PUBLIC_IS_SELFHOSTED=true` disables plan/billing checks in the dashboard. The `isFreePlan` store short-circuits to `false` when self-hosted.
