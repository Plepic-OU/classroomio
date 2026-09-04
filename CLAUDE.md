# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

ClassroomIO — an open-source LMS. pnpm + Turborepo monorepo (`apps/*`, `packages/*`, plus `packages/course-app/src/*`). Node is pinned to `^20.19.3` (`.nvmrc`); use `pnpm`, never npm/yarn.

## Development

The devcontainer (`.devcontainer/setup.sh`) already installs deps, copies each `.env.example` to `.env`, starts Redis + Supabase, injects the local Supabase keys into `apps/dashboard/.env` and `apps/api/.env`, and installs Playwright's chromium. Assume this has run.

```bash
pnpm dev                       # all apps (turbo prepare, then dev)
pnpm dev:container             # same, but binds 0.0.0.0 so ports are reachable from the host
pnpm dev --filter=@cio/dashboard   # single app
pnpm build                     # turbo build (dashboard build depends on api build)
pnpm lint                      # eslint via turbo
pnpm format                    # prettier over the repo (root .prettierrc: single quotes, no trailing comma, width 100)
```

Ports: dashboard 5173, website 5174, docs 3000, api 3002, Supabase API/DB/Studio/Inbucket 54321–54324, Playwright report/UI 9323–9324.

Package names for `--filter`: `@cio/dashboard`, `@cio/api`, `@cio/classroomio-com`, `@cio/docs-v2` (the README's `@cio/docs` is stale), `@cio/course-app`, `@classroomio/course-app`, `shared`.

Local login: `admin@test.com` / `student@test.com`, password `123456` (seeded by `supabase/seed.sql`).

## Tests

```bash
# Dashboard unit tests (jest + ts-jest, colocated *.spec.ts under src/lib/utils/functions)
pnpm --filter @cio/dashboard test
pnpm --filter @cio/dashboard test -- src/lib/utils/functions/date.spec.ts   # single file
pnpm --filter @cio/dashboard test -- -t "formats the date"                  # single test

# API unit tests (vitest)
pnpm --filter @cio/api test

# E2E (Playwright + playwright-bdd, Gherkin in tests/e2e/features, steps in tests/e2e/steps)
pnpm test:e2e          # bddgen, then playwright
pnpm test:e2e:ui
pnpm test:e2e:report
npx playwright test --config tests/e2e/playwright.config.ts <path>   # single test, after bddgen
```

E2E has **no `webServer`** — Supabase and the apps must already be running. `tests/e2e/helpers/preflight.ts` is the globalSetup: it polls dashboard/api/Supabase and warms Vite compilation, failing with instructions if nothing is up. `helpers/reset-db.ts` truncates the public schema via `docker exec supabase_db_classroomio psql`, preserving the seed tables listed in `PRESERVE_TABLES` (profile, organization, role, etc.) — new seed-dependent tables must be added there. SSR renders inputs as `type="text"`; use `waitForHydration()` from `helpers/hydration.ts` before interacting.

Cypress (`cypress/`, `pnpm ci`) is the older, largely superseded E2E setup.

## Architecture

**apps/dashboard** (`@cio/dashboard`) — the LMS itself. SvelteKit 4 + Tailwind + Carbon components, talking to Supabase directly from the client (`$lib/utils/functions/supabase.ts` holds a lazily-created singleton client). Two surfaces share the app:
- `/org/[slug]/...` — teacher/admin side (courses, audience, community, quiz, settings).
- `/lms/...` — student side (mylearning, explore, exercises, community).

`src/routes/+layout.server.ts` is the multi-tenancy entry point: it resolves an org from the request host — custom domain, subdomain, `PRIVATE_APP_SUBDOMAINS`, or the `?org=` / `_orgSiteName` cookie escape hatch on localhost — and returns `org` / `isOrgSite` to every page. `PUBLIC_IS_SELFHOSTED=true` short-circuits that logic, disables SSR, and switches `svelte.config.js` from the Vercel adapter to the Node adapter. Self-hosted vs. cloud behaviour diverges in exactly these places plus `store/org.ts` (plan gating).

`src/hooks.server.ts` validates the Supabase access token for `/api/*` routes only, allow-listing the routes in `PUBLIC_API_ROUTES`, and injects `user_id` into request headers.

Cross-cutting conventions: Svelte stores in `$lib/utils/store` (`user`, `org`, `app`), data access in `$lib/utils/services/*`, roles are numeric (`ROLE.ADMIN=1`, `TUTOR=2`, `STUDENT=3` in `constants/roles.js`) and gated in the UI via `components/RoleBasedSecurity`, and all user-facing strings go through `@sveltekit-i18n` with JSON catalogues in `$lib/utils/translations/*.json` (`en.json` is the source; `scripts/translate.cjs` fills the rest). A strict CSP is declared in `svelte.config.js` — a new external script/style/font/connect origin must be added there (both `directives` and `reportOnly`) or it will be blocked.

**apps/api** (`@cio/api`) — Hono server for work the dashboard can't do in the browser: PDF/certificate generation, S3/Cloudflare uploads and presigning, KaTeX rendering, course cloning, transactional email. Routes are chained onto a single `app` in `src/app.ts` so Hono can infer RPC types; `src/rpc-types.ts` re-exports `hcWithType`.

**The dashboard↔api contract is type-level.** `apps/dashboard/vite.config.ts` aliases `@cio/api` to `../api/dist`, and the dashboard's API client (`$lib/utils/services/api/index.ts`) builds on `hcWithType`. So the api must be compiled before the dashboard typechecks or builds — `apps/api`'s `dev` runs `tsx watch` and `tsc --watch` in parallel to keep `dist/` fresh, and `turbo.json` makes `@cio/dashboard#build` depend on `@cio/api#build`. If dashboard types for API calls look broken, build the api first.

Route handlers use `zValidator` with Zod schemas from `src/types/`; auth and rate limiting are in `src/middlewares/`. Path aliases use `$src/*` (resolved at build time by `tsc-alias`).

**apps/classroomio-com** — marketing site + mdsvex blog. **apps/docs** — Fumadocs/TanStack Start docs (React, unlike everything else). **apps/course-app** — Svelte 5 course-site app. **packages/course-app** — the published `@classroomio/course-app` CLI that scaffolds a course site from `src/template` (itself a workspace member) using the list in `templates.json`. **packages/shared** — plan/pricing constants shared by dashboard and website, imported as `shared/src/...`.

**supabase/** — the single source of truth for the schema. `migrations/` (timestamped SQL), `seed.sql` (local auth users/orgs), `data.sql` (large reference dataset), `functions/` (edge functions). Push with `pnpm supabase:push` (needs `PROJECT_ID`). Postgres RLS policies live in the migrations — schema changes usually mean a new migration plus a policy.

## Notes

- `turbo prepare` (svelte-kit sync) is marked `persistent`; `pnpm dev` runs it before `dev` deliberately.
- Deployment targets differ per app: dashboard → Vercel (or Node for self-host), api → Fly.io (`apps/api/fly.toml`) / Railway (`railway.json`), self-host → `docker/docker-compose.yaml` with `classroomio/api` and `classroomio/dashboard` images.
- Releases use `standard-version` (`pnpm release`) against `CHANGELOG.md`.
