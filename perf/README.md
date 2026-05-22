# Performance Harness

Measures ClassroomIO dashboard routes against a saved baseline and exits non-zero on regression.

---

## Quick start

```bash
# 1. Seed the local Supabase with realistic volume
pnpm seed:perf

# 2. Build the production bundle
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

# 3. Start the production server
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &

# 4. Save a baseline
PERF_BASE_URL=http://localhost:3000 pnpm perf:baseline

# 5. Re-run and compare
PERF_BASE_URL=http://localhost:3000 pnpm perf
```

---

## Build / serve sequence — gotchas

### `PUBLIC_IS_SELFHOSTED=true` must be set at **both** build and start time

`svelte.config.js` switches between `adapter-node` (selfhosted) and `adapter-vercel` based on this variable:

- Without it at **build** time: the build outputs to `.vercel/output/` instead of `build/`, so `node build` finds nothing.
- Without it at **start** time: the adapter's server entrypoint may fail to locate static assets.

Always set it in both commands:
```bash
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" pnpm build --filter=@cio/dashboard
# ...
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build
```

### `node build` does NOT auto-load `.env`

Unlike `pnpm dev` (which uses Vite's `.env` loading), the production `node build` server reads only from the process environment. You must source `.env` manually before starting:

```bash
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
```

### The default Node heap (2 GB) OOMs the build

The dashboard build SSR-bundles several large dependencies. Increase the heap:

```bash
NODE_OPTIONS="--max-old-space-size=6144" pnpm build --filter=@cio/dashboard
```

### Port 3000 conflict

The docs app (`apps/docs`) also defaults to port 3000 when running `pnpm dev`. If you have the full dev stack running, stop it before starting the production dashboard server, or choose a different port and set `PERF_BASE_URL` accordingly:

```bash
PUBLIC_IS_SELFHOSTED=true PORT=4001 node build &
PERF_BASE_URL=http://localhost:4001 pnpm perf
```

### Never measure against `pnpm dev`

The Vite dev server ships ~27 MB of JS per page (vs ~1.4 MB in prod) and serves close to 900 sub-resource requests on some routes. Performance numbers against the dev server are meaningless.

---

## What gets measured

Routes are defined in `perf/routes.json`. The default set:

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | Login page |
| `/course/perf-course-1` | public | Course landing page |
| `/lms/mylearning` | student | **Expected to `PAGE_HUNG`** in the initial baseline — see below |
| `/org/udemy-test` | admin | Org dashboard |

### `/lms/mylearning` — expected to be slow (PAGE_HUNG)

With 100 enrollments per student and simulated throttling, Lighthouse will emit `runtimeError: PAGE_HUNG` for this route in the initial baseline. This is **intentional workshop content** that later exercises will fix — it is not a bug in the harness.

The harness handles this correctly:
- Null metrics are recorded in `baseline.json`
- `--save-baseline` exits 0 even with null metrics
- Null-vs-null on subsequent runs is **not** a regression
- A run that produces a real LCP after the page is fixed shows up as an improvement (exit 0)
- A run that goes back to null after being fixed trips the gate (exit 1)

---

## Gate thresholds

The gate fires (exit 1) when, compared to baseline:

| Metric | Threshold | Rationale |
|---|---|---|
| **LCP** | > max(100ms, 5% of baseline) | Covers both tiny and large pages |
| **JS bytes** | > 1% | Intentionally tight — use `--no-gate` for non-regression chunk-hash churn |

**Not gated** (displayed in table but ignored): TBT, FCP, CLS, total bytes. TBT varies 30–60% between runs on localhost — gating it would false-trigger constantly.

**Note on 1% JS gate:** A single string change in a shared Svelte module can cascade Vite chunk hashes and shift byte counts by 1–2% with no real regression. If this triggers on a PR that has no intentional JS changes, run `pnpm perf -- --no-gate` to measure without gating, confirm the delta is noise, and re-baseline with `pnpm perf:baseline`.

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Pass (or `--no-gate` / `--save-baseline`) |
| 1 | Performance regression detected |
| 2 | Harness error (server unreachable, Chrome crash) |

---

## CLI flags

```bash
pnpm perf                           # measure + compare to baseline + gate
pnpm perf:baseline                  # measure + write baseline.json + exit 0
pnpm perf -- --no-gate              # measure + print table + always exit 0
```

Or with a custom base URL:
```bash
PERF_BASE_URL=http://localhost:4001 pnpm perf
```

Override the Chrome executable (defaults to Playwright's bundled Chromium):
```bash
PERF_CHROME_PATH=/usr/bin/google-chrome pnpm perf
```

---

## Seed script

```bash
pnpm seed:perf                      # seed (idempotent — no-op if already seeded)
pnpm seed:perf -- --clean           # wipe + reseed
pnpm seed:perf -- --clean-only      # wipe, no reseed
```

The seed creates:
- 500 auth users: `perf-student-1@workshop.local` … `perf-student-500@workshop.local` (password: `123456`)
- 50 courses + groups under the `udemy-test` org
- 500 lessons (10 per course)
- 5050 groupmember rows (100 students + admin tutor per course)

**Important:** `routes.json` contains test credentials (`admin@test.com` / `123456`, `perf-student-1` / `123456`). These are local-only test accounts for the local Supabase instance. They must never match credentials in a staging or production Supabase project.

---

## Baseline persistence in CI

`baseline.json` is gitignored. CI baseline persistence (e.g. `actions/cache` keyed on main branch SHA) is a follow-up task — see project backlog. Until that is set up, the gate only fires in local development.

---

## Files

```
perf/
  lighthouse.mjs       Lighthouse runner
  seed.mjs             Seed script
  routes.json          Committed route config
  baseline.json        Gitignored — written by --save-baseline
  results/             Gitignored — per-run full Lighthouse JSONs
  .gitignore
  README.md            This file
```
