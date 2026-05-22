# Perf harness

A second gate alongside `pnpm test:e2e`. Runs Lighthouse against a fixed list of routes (mix of public and authed), compares the run to a committed-less baseline, and exits non-zero on regression.

All `pnpm perf*` and `pnpm seed:perf` commands run from the **repo root**.

## Quick start

```bash
# 1. Seed local Supabase with realistic volume (500 students, 50 courses, etc.)
pnpm seed:perf

# 2. Build the dashboard for production
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

# 3. Serve the prod build on :3000
#    (in a separate terminal, or backgrounded)
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
cd -

# 4. Save the initial baseline
PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline

# 5. Future runs (compares to baseline, exits 1 on regression)
PERF_BASE_URL=http://localhost:3000 pnpm perf
```

### Gotchas in step 2/3 (the build/serve sequence)

These are paid-for lessons; don't deviate without good reason.

- **Always measure the prod build, never `pnpm dev`.** Vite-dev ships ~27 MB of JS per page and ~900 sub-resource requests; code-level wins are invisible against that noise floor.
- **`PUBLIC_IS_SELFHOSTED=true` at both build and start time.** It conditionally switches `svelte.config.js` between `adapter-node` (what we want) and `adapter-vercel`. Without it at build time you get `.vercel/output/` and no `build/` directory.
- **`node build` does NOT auto-load `.env`.** Source the env vars in the shell first (the `set -a; source .env; set +a` line).
- **The default 2 GB Node heap OOMs the dashboard build.** Bump it with `NODE_OPTIONS="--max-old-space-size=6144"`.
- **`pnpm dev` must not be running.** `apps/docs` also uses port 3000; the prod serve will silently fail to bind, the harness will hang, and Lighthouse will report `NO_FCP`.

## What gets measured

Per route, one Lighthouse run with the desktop preset and **simulated** throttling:

| Setting | Value | Why |
|---|---|---|
| `formFactor` | desktop | Workshop content targets desktop browsers |
| `throttlingMethod` | `simulate` | Localhost is ~0 ms RTT; without simulation, code-level wins produce sub-100 ms deltas indistinguishable from measurement noise |
| `rttMs` | 40 | Simulates a typical broadband connection |
| `throughputKbps` | 10240 | 10 Mbps down |
| `cpuSlowdownMultiplier` | 1 | No CPU throttling for desktop preset |
| `disableStorageReset` | `true` | Preserves the Puppeteer-established login session into the audit (`true` = preserve; despite the field name, `false` would wipe cookies/storage) |

Chrome runs **fresh per route** (launch → optional Puppeteer login → Lighthouse → kill). Cache, cookies, and localStorage cannot leak between routes.

Per route the harness records: Lighthouse perf score, LCP, FCP, TBT, CLS, total JS bytes transferred, total bytes transferred, plus `finalUrl` and `runtimeError`. The full Lighthouse JSON for each run is written to `perf/results/<timestamp>--<path>.json` for post-hoc inspection.

## Gate thresholds

A regression is **only** one of:

- **JS bytes** grew by more than **+1 %** on any route (deterministic — bytes are bytes)
- **LCP** grew by more than **+100 ms or +5 %** (whichever is larger) on any route
- **Crash detection:** baseline had a non-null LCP but this run produced null LCP (page hung or crashed)

TBT, FCP, CLS, and total bytes are **displayed with deltas but not gated** — they're noisier and would false-trigger constantly.

**Null → real (recovery):** if the baseline had null metrics (e.g. PAGE_HUNG) but this run produced real numbers, the row is flagged `recovered — rebaseline` in the table. Not a regression; do `pnpm perf -- --save-baseline` to capture the new floor.

## Exit codes

| Code | Cause | Distinct stderr |
|---|---|---|
| 0 | Pass, or `--save-baseline`, or `--no-gate` | — |
| 1 | One or more gated regressions | `[harness] regressions detected:` followed by per-route lines |
| 2 | Harness error: server unreachable / seed missing / chrome launch failed / session lost / unhandled rejection / lighthouse threw | `[harness] <distinct cause>` |

## Expected weirdness: `/lms/mylearning`

`/lms/mylearning` is **intentionally slow** workshop content under the production build with this seed data. Under simulated throttling with 100 enrollments, Lighthouse will likely emit a `runtimeError: PAGE_HUNG` and return null LCP/score/JS-bytes for this route.

That is **expected** and is part of the workshop. Later workshops fix it. Treatment by the harness:

- Initial `--save-baseline` records nulls + `PAGE_HUNG` for the route. Run still exits 0.
- Re-runs that also PAGE_HUNG (null → null) are **not** regressions.
- A future run that produces real metrics shows as `recovered — rebaseline`, not a regression.
- If a later run goes back to null after being fixed, that **is** a regression (the crash-detection rule).

**Do not widen `maxWaitForLoad` to "rescue" `/lms/mylearning`.** That masks the very thing the workshop is meant to surface.

## Chrome resolution order

For Lighthouse to know which Chrome to run, the harness picks the first valid binary from:

1. `PERF_CHROME_PATH` env var (file must exist)
2. Playwright's bundled Chromium via `playwright-core`'s `chromium.executablePath()` (file must exist on disk)
3. Whatever `chrome-launcher` finds via its default search (system `google-chrome` / `chromium`)

In this devcontainer the Playwright binary lives at `~/.cache/ms-playwright/chromium-*/chrome-linux/chrome` (installed by `.devcontainer/setup.sh`). If you skip the postCreate step that path won't resolve and you'll need to set `PERF_CHROME_PATH` or install a system Chrome.

## Files

| Path | Tracked? | Notes |
|---|---|---|
| `perf/lighthouse.mjs` | yes | The runner |
| `perf/seed.mjs` | yes | The Supabase bulk seeder |
| `perf/routes.json` | yes | Route + user config |
| `perf/README.md` | yes | This file |
| `perf/.gitignore` | yes | Hides `baseline.json` and `results/` |
| `perf/baseline.json` | **no** | Per-developer / per-machine. Written by `--save-baseline` |
| `perf/results/*.json` | **no** | Full Lighthouse JSON dumps; one per route per run |

## Dependency placement

All deps live in the **root** `package.json` `devDependencies` and resolve via the workspace-root `node_modules`. `perf/` is **not** a workspace package — same pattern as `cypress`/`@playwright/test`/etc. at the root. **Do not add a `perf/package.json`** unless you intentionally promote `perf/` to a workspace; doing so accidentally would break Node's module resolution for these scripts.

## Seed details (`pnpm seed:perf`)

| Object | Count | Notes |
|---|---|---|
| auth users | 500 | `perf-student-N@workshop.local` / `123456`, via `auth.admin.createUser` |
| profile | 500 | One per auth user |
| organizationmember | 500 | All under org `1a1dcddd-1abc-4f72-b644-0bd18191a289` (Udemy Test), role 3 |
| group | 50 | Under the same org |
| course | 50 | Slugs `perf-course-1..50`, `is_published: true` so `/course/perf-course-1` works unauthed |
| lesson | 500 | 10 per course |
| groupmember | 5050 | 50 tutor rows (admin) + 5000 student rows; students rotate `[c*10 .. c*10+99] mod 500` per course |

**Idempotent:** detects existing seed by `slug LIKE 'perf-course-%'` or `email LIKE 'perf-student-%'` and no-ops with a status line.

**Flags:**

- `pnpm seed:perf` — seed if not already seeded
- `pnpm seed:perf --clean` — wipe perf data and reseed
- `pnpm seed:perf --clean-only` — wipe perf data, do not reseed

The cleanup walks foreign keys in safe order: `groupmember` → `lesson_completion` → `lesson` → `organizationmember` → `group` → `course` → `profile` → `auth.users`. The schema does not cascade `auth.users → profile`, so profile deletion is explicit.

The seeder **refuses to run** unless `PUBLIC_SUPABASE_URL` points at `localhost` / `127.0.0.1` — guards against accidentally seeding staging/prod with 500 accounts at password `123456`.

## Environment variables

Read from `apps/dashboard/.env` (by `seed.mjs` via `dotenv`) and from the shell (by `lighthouse.mjs`):

| Var | Used by | Purpose |
|---|---|---|
| `PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) | seed + harness pre-flight | Local Supabase endpoint |
| `PRIVATE_SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`) | seed | Bypasses RLS for bulk insert |
| `PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`) | harness pre-flight (optional) | Anon-key query to verify seed has run |
| `PERF_BASE_URL` | harness | URL of the served prod build (default `http://localhost:3000`) |
| `PERF_CHROME_PATH` | harness | Override Chrome binary (first in resolution chain) |
