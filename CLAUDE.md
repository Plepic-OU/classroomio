# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

ClassroomIO — an open-source LMS. pnpm + Turborepo monorepo, SvelteKit 1 / Svelte 4
frontends, a Hono API on `@hono/node-server`, Supabase (Postgres + Auth + Storage) as the backend.

Node `^20.19.3` (container ships 20.20.2), turbo `1.13.4`, pnpm 10.x via corepack — the
Dockerfile pins `pnpm@10.28.2` but there is no `packageManager` field, so the running version
drifts. Do not bump these without a reason.

## Layout

| Path | Package | What it is |
|---|---|---|
| `apps/dashboard` | `@cio/dashboard` | The LMS web app (SvelteKit, port 5173) — the main app |
| `apps/api` | `@cio/api` | Hono API: PDF, video, mail, notifications (port 3002) |
| `apps/classroomio-com` | `@cio/classroomio-com` | Marketing site (port 5174) |
| `apps/docs` | `@cio/docs-v2` | Fumadocs documentation site (port 3000) |
| `apps/course-app` | `@cio/course-app` | Standalone single-course app |
| `packages/shared` | `shared` | Types/helpers shared across apps |
| `packages/tsconfig` | `tsconfig` | Shared TS configs |
| `supabase/` | — | `config.toml`, 37 migrations, `seed.sql`, edge functions |
| `tests/e2e` | — | Playwright + `playwright-bdd` (`.feature` + `.steps.ts`) |

`pnpm-workspace.yaml` also globs `packages/course-app/src/*`.

## Development

Everything runs inside the devcontainer (`.devcontainer/`). It provisions pnpm, turbo,
Supabase CLI, Playwright deps, Claude Code, and Docker-in-Docker.

```bash
devcontainer up --workspace-folder .          # build/start
devcontainer exec --workspace-folder . bash   # shell inside
```

Inside the container:

```bash
pnpm dev:container                 # all four apps, bound to 0.0.0.0 so the host can reach them
pnpm dev --filter=@cio/dashboard   # dashboard only, :5173
pnpm dev --filter=@cio/api         # api only, :3002
```

`.devcontainer/setup.sh` (postCreate) runs `pnpm install`, copies each `.env.example` to
`.env`, starts a Redis container and `supabase start`, then rewrites `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY` and `PRIVATE_SUPABASE_SERVICE_ROLE` in `apps/dashboard/.env`
and `apps/api/.env`. Re-run it if Supabase keys go stale; don't hand-edit those three keys.

Supabase local ports: API 54321, DB 54322, Studio 54323, Inbucket (mail) 54324.

## Build, lint, test

```bash
pnpm build            # turbo run build   (@cio/dashboard build depends on @cio/api build)
pnpm lint             # turbo run lint
pnpm format           # prettier . --write
pnpm --filter @cio/dashboard test    # jest
pnpm --filter @cio/api test          # vitest
pnpm test:e2e                        # bddgen + playwright, needs the apps already running
pnpm test:e2e:ui                     # :9324    pnpm test:e2e:report  # :9323
```

The e2e config has **no** `webServer` — start the apps first or `helpers/preflight` fails.

Always run the relevant test command and `pnpm lint` after changing code.

## Conventions

- Prettier is the formatter: single quotes, no tabs, no trailing commas, width 100,
  with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`. Run `pnpm format`
  rather than hand-formatting.
- Svelte 4 syntax (stores, `$:`, `export let`) — not runes.
- Styling is Tailwind 3 plus Carbon components (`@carbon/charts-svelte`).
- Dashboard code is organised under `src/lib`: `components/` (by feature: `Course`, `LMS`,
  `Org`, `AI`, …), `utils/store/` (`app`, `org`, `user`, `attendance`), `utils/services/`
  (one folder per domain), `utils/translations/`, `utils/functions/`, `utils/types/`.
  Put new code in the matching folder instead of inventing a new top-level one.
- Imports use SvelteKit aliases (`$lib/...`); cross-package imports use `workspace:*` deps.

## Things worth knowing before you change them

- **Auth on dashboard API routes** goes through `apps/dashboard/src/hooks.server.ts`. Only
  paths containing `/api` are validated; `PUBLIC_API_ROUTES` is an explicit allowlist that
  matches by `includes()`. Adding a route there makes it unauthenticated — be deliberate.
- **Multi-tenancy** is host-based: `PRIVATE_APP_SUBDOMAINS` + `PRIVATE_APP_HOST` derive the
  org from the request domain. Org state lives in `utils/store/org.ts`.
- **i18n**: 10 locales in `utils/translations/*.json` via `sveltekit-i18n`. When you add UI
  strings, add the key to `en.json` at minimum — don't hardcode English in components.
- **DB changes** are migrations in `supabase/migrations/` (timestamped SQL). Never edit an
  applied migration; add a new one. RLS policies live there too.
- **Secrets**: `.env` files are generated from `.env.example`. Never commit `.env`, and add
  any new variable to the matching `.env.example` with an empty value.
- `PUBLIC_IS_SELFHOSTED` gates cloud-only features (LemonSqueezy/Polar/Stripe billing,
  Sentry). Keep self-hosted paths working when touching those.

## Git

Fork/branch per change, small PRs, follow the repo PR template (see `CONTRIBUTING.md`).
Releases use `standard-version`, so commit messages should follow Conventional Commits.
