# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (runs across all apps via Turbo)
```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm lint         # Lint all apps
pnpm format       # Format with Prettier
pnpm ci           # Run Cypress E2E tests
pnpm supabase:push  # Link and push DB migrations to remote Supabase
```

### Dashboard (SvelteKit, port 5173)
```bash
pnpm --filter @cio/dashboard dev
pnpm --filter @cio/dashboard build
pnpm --filter @cio/dashboard test
pnpm --filter @cio/dashboard test --testPathPattern=<filename>  # single test file
pnpm --filter @cio/dashboard lint
```

### API (Hono.js, port 3002)
```bash
pnpm --filter @cio/api dev
pnpm --filter @cio/api build
pnpm --filter @cio/api test
pnpm --filter @cio/api test <filename>.test.ts  # single test file
pnpm --filter @cio/api lint
```

### Course App (SvelteKit, student-facing)
```bash
pnpm --filter @cio/course-app dev
pnpm --filter @cio/course-app test
```

### Shared Package
```bash
pnpm --filter @cio/shared test
```

### Supabase (local dev)
```bash
supabase start   # Start local stack (API :54321, DB :54322, Studio :54323)
supabase db push # Push migrations to remote
```

## Architecture

### Monorepo Layout
```
apps/
  dashboard/      # Main teacher/admin LMS (SvelteKit v1, Vercel/Node adapters)
  api/            # Backend service (Hono.js v4, Node.js)
  course-app/     # Student-facing course viewer (SvelteKit v2)
  classroomio-com/ # Marketing site (SvelteKit v2 + MDsVex)
  docs/           # Documentation (React v19, TanStack Start, Fumadocs)
packages/
  shared/         # Plan definitions, shared types, utilities
  course-app/     # CLI tool for scaffolding course templates
  tsconfig/       # Shared TypeScript base configs
```

### Dashboard (`apps/dashboard`)
- **Routing**: SvelteKit file-based routing. `+page.server.ts` for server loads, `+page.svelte` for UI, `+layout.svelte` for layout inheritance. Auth guard in `hooks.server.ts`.
- **State**: Svelte `writable`/`derived` stores — no Redux/Pinia. Each major feature has its own store file under `src/lib/utils/store/`. Service functions call stores after API requests.
- **Data fetching**: Supabase client (`@supabase/supabase-js`) called from service functions in `src/lib/utils/services/`. Realtime subscriptions used for live updates.
- **Adapter selection**: Node adapter when `PUBLIC_IS_SELFHOSTED=true`, Vercel adapter otherwise (configured in `svelte.config.js`).
- **Testing**: Jest v29 with `svelte-jester` and `@testing-library/svelte`. Config in `jest.config.ts`. Test files use `.spec.ts` extension.
- **UI**: Carbon Components Svelte + Tailwind CSS. Path alias `$lib` → `src/lib`.

### API (`apps/api`)
- **Framework**: Hono.js — lightweight, edge-compatible. Entry: `src/index.ts` (Node HTTP server), app setup: `src/app.ts`.
- **Routes**: Two top-level routers — `courseRouter` (`/course/*`) and `mailRouter` (`/mail/*`). Course sub-routes handle certificates, PDF export, S3 presigning, lesson ops, KaTeX rendering, and course cloning.
- **Auth**: Supabase service-role key used server-side. Auth middleware in `src/middlewares/auth.ts`.
- **Testing**: Vitest v1. Config in `vitest.config.ts`. Path alias `$src` → `src/`.
- **RPC types**: `src/rpc-types.ts` exports TypeScript types consumed by the dashboard frontend.
- **External services**: AWS S3 (file storage), Cloudflare (video), Nodemailer/Zeptomail (email), OpenAI (course generation).

### Database (Supabase)
- Migrations live in `supabase/migrations/` — applied automatically on `supabase start`.
- Edge functions in `supabase/functions/` with shared helpers in `_shared/`.
- RLS policies enforce tenant isolation. Multi-tenant via org-based subdomain routing.
- `supabase/seed.sql` for local dev data.

### Multi-tenancy
- Org routing is subdomain-based. The dashboard detects subdomain to scope all data to an org.
- `PUBLIC_IS_SELFHOSTED` env var switches adapter and disables cloud-only features.

### Key Environment Variables
Each app has a `.env.example`. Required variables include Supabase URL/keys, S3 credentials, and feature flags. The devcontainer setup script (`devcontainer/setup.sh`) injects Supabase credentials automatically.

### Node version
v20.19.3 (see `.nvmrc`).
