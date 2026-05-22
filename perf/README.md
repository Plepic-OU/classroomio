# Performance Harness

Lighthouse-based perf gate for the dashboard. Runs a fixed list of routes against the **production build**, writes per-route JSON reports, aggregates a summary, and compares against `perf/baseline.json` to fail CI on regression.

## Quick start

```bash
# 1. Local Supabase + perf seed data (one-time)
supabase start
pnpm seed:perf

# 2. Build + serve the dashboard prod build (see "Build/serve" below for the gotchas)
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
cd -

# 3. Take a baseline (first time only)
PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline

# 4. On subsequent runs, gate against the baseline
PERF_BASE_URL=http://localhost:3000 pnpm perf
```

## Build/serve sequence (read before debugging)

The harness measures the **production** build, never `pnpm dev`. Vite-dev ships ~27 MB of JS per page; code-level wins are invisible against that.

Three gotchas, all paid for already:

1. **`PUBLIC_IS_SELFHOSTED=true` must be set at both build and start.** It switches `svelte.config.js` between `adapter-node` and `adapter-vercel`. Without it the build emits `.vercel/output/` and **no `build/` directory exists** for `node build` to run.
2. **`node build` does not auto-load `.env`.** Source it manually in the same shell (`set -a; source .env; set +a`) or you'll get auth errors as soon as Lighthouse hits an authed route.
3. **The default Node 2 GB heap OOMs the SvelteKit build.** Use `NODE_OPTIONS="--max-old-space-size=6144"`.

## What gets measured

Routes are defined in `perf/routes.json`. Each entry is either a plain string (public) or `{ "path": "...", "as": "<userKey>" }` (Puppeteer logs in first). The user keys reference the `users` map at the top of the file.

For each route we capture: Lighthouse performance score, LCP, TBT, FCP, CLS, JS bytes, total bytes, `finalUrl`, and any `runtimeError`. Full Lighthouse JSON for each measurement lands in `perf/results/<timestamp>--<sanitized-path>.json` (gitignored).

Lighthouse is configured with the **desktop preset and simulated throttling** (`rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`). Localhost is effectively zero-latency, so without simulation a code-level win produces a sub-100ms delta that drowns in measurement noise. Simulation makes N HTTP roundtrips and M bytes of JS show up the way a real user would feel them.

Each route launches its own Chrome instance (per-route launch). Puppeteer logs in for authed routes, then Lighthouse shares that Chrome instance (`port: chrome.port`) so the localStorage session survives. We close Chrome after each route so the next route starts with a fresh cache.

### `/lms/mylearning` is expected to be broken in the initial baseline

With the seed (100 enrollments) and simulated throttling, this route emits `runtimeError: PAGE_HUNG` and returns null LCP/score/JS-bytes. **That is expected workshop content** — later workshops fix the underlying issue. The harness records the measurement with `PAGE_HUNG` in the NOTE column and moves on:

- null-LCP-vs-null-baseline: not a regression
- null-LCP-vs-real-baseline: regression (crash detection — gate trips)
- real-LCP-vs-null-baseline: silently treated as improvement (no Δ shown for null base)

## Gate thresholds

Only two metrics gate; the rest are display-only:

| Metric        | Threshold (regression if exceeded) |
|---------------|------------------------------------|
| JS bytes      | `+1%`                              |
| LCP           | `+100ms AND +5%` (both must hold)  |
| LCP (crash)   | baseline non-null → current null   |

TBT/FCP/CLS/total bytes appear in the table with Δ columns but never trip the gate. TBT in particular varies 30–60% per route between runs; gating it would false-trigger constantly.

## Exit codes

| Code | Meaning |
|------|---------|
| 0    | Pass (or `--save-baseline` / `--no-gate` / no baseline yet) |
| 1    | One or more regressions detected |
| 2    | Harness error (server unreachable, all routes errored, Chrome unavailable, malformed config) |

## Flags

- `--save-baseline` — write `perf/baseline.json` and exit 0 without gating
- `--no-gate` — measure, compare, print full table, but always exit 0

## Environment

- `PERF_BASE_URL` — base URL for measurement (default `http://localhost:3000`)
- `PERF_CHROME_PATH` — Chrome binary; otherwise resolved via Playwright's bundled Chromium, then `chrome-launcher` default

## Seed

`pnpm seed:perf` populates the local Supabase to realistic volume:

- 500 student users (`perf-student-N@workshop.local` / `123456`)
- 500 corresponding `organizationmember` rows under the udemy-test org
- 50 courses + 50 groups (slugs `perf-course-N`, group names `perf-group-N`)
- 500 lessons (10 per course)
- 5050 `groupmember` rows (100 students per course + admin@test.com as tutor on each)

Idempotent — a second run detects existing perf data and no-ops. Use `--clean` to wipe + reseed, or `--clean-only` to wipe without reseeding. Reads credentials from `apps/dashboard/.env` (or env directly).

## Files

```
perf/
  lighthouse.mjs       runner (this file)
  seed.mjs             Supabase seed
  routes.json          committed route + user list
  baseline.json        written by --save-baseline (gitignored)
  results/             per-route Lighthouse JSON (gitignored)
  README.md            this file
```
