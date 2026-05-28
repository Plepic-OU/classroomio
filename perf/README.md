# Performance harness (Lighthouse gate)

A second behavioural gate alongside the BDD suite (`pnpm test:e2e`). It runs
Lighthouse against a fixed list of routes under the **production** build,
aggregates deterministic metrics, compares them to a saved baseline, and exits
non-zero on regression.

Design doc: [`docs/plans/2026-05-28-perf-harness-design.md`](../docs/plans/2026-05-28-perf-harness-design.md).

---

## Quick start

```bash
# 1. Seed the local Supabase with realistic volume (one-time; idempotent).
pnpm seed:perf

# 2. Build + serve the PRODUCTION dashboard on :3000 (see "Build/serve" below).
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
cd ../..

# 3. Capture a baseline (writes perf/baseline.json, always exits 0).
PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline

# 4. Re-run to gate against the baseline (exit 1 on regression).
PERF_BASE_URL=http://localhost:3000 pnpm perf
```

`--no-gate` measures + prints + always exits 0 (useful for ad-hoc inspection).

---

## Build/serve sequence (read this — it has paid-for gotchas)

**Always measure the production build, never `pnpm dev`.** Vite-dev ships ~27 MB
of JS per page (vs ~1.4 MB in prod) and hundreds of sub-resource requests; any
code-level win is invisible against that noise floor.

```bash
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
```

Gotchas:

- **`PUBLIC_IS_SELFHOSTED=true` at both build and start time.** It switches
  `svelte.config.js` between adapter-node and adapter-vercel. Without it at build
  time you get `.vercel/output/` and **no `build/` dir**, and `node build` has
  nothing to run.
- **`node build` does NOT auto-load `.env`.** The `set -a; source .env; set +a`
  line is required so the server gets the Supabase keys.
- **The default 2 GB Node heap OOMs the build** — hence
  `--max-old-space-size=6144`. On a smaller host drop to `4096`, and don't run
  `supabase` / `pnpm dev` concurrently (the devcontainer has ~7.7 GB total RAM,
  so there's little headroom).
- **Port 3000 also belongs to the `docs` app** (`apps/docs` defaults to `:3000`).
  Stop any `pnpm dev` / docs dev server first, or you'll measure the wrong app.
  The harness preflight asserts the served origin is actually the dashboard and
  exits 2 otherwise.
- **Headless Chrome flags `--no-sandbox --disable-dev-shm-usage` are mandatory**
  in the devcontainer (`/dev/shm` is only 64 MB). Benign dbus `ERROR` lines on
  stderr are not failures.

---

## What gets measured

Routes are defined in [`routes.json`](./routes.json):

- A plain string is a **public** route (measured anonymous, cold).
- An object `{ "path": "...", "as": "admin" | "student" }` logs that persona in
  first (fresh UI login on the perf origin) and preserves the localStorage
  session into the Lighthouse run.

Lighthouse runs the **desktop** preset with **simulated** throttling
(`rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`) so the cost of
HTTP roundtrips and JS bytes shows up the way a real user would feel it. The HTTP
cache is cleared before every route so JS-byte numbers reflect a cold network.

For each route the harness:

- writes the full Lighthouse report to
  `perf/results/<timestamp>--<sanitized-path>.json`, and
- aggregates a per-route summary: Lighthouse score, LCP, TBT, FCP, CLS, JS bytes,
  total bytes (and a `runtimeError` tag when the page didn't stabilise).

### `/lms/mylearning` is expected to be broken in the initial baseline

With the seed volume, `/lms/mylearning` is **intentionally slow** — Lighthouse
will emit a `PAGE_HUNG` runtime error and return null metrics for it. **That is
expected workshop content that a later workshop fixes — not a harness bug.** The
route is still measured (null metrics + `PAGE_HUNG` in the table) and the run
still exits 0. The gate's crash detection means: null-from-baseline-too is not a
regression; a later run that produces a real LCP is just an improvement; if it
regresses back to null after being fixed, the gate trips.

---

## Gate thresholds

Deltas are vs `perf/baseline.json`, matched per route by `(path, as)`. A
**regression** (exit 1) is any of:

| Metric   | Trips the gate when…                                            |
| -------- | --------------------------------------------------------------- |
| JS bytes | grew by **> +1%**                                               |
| LCP      | grew by **> max(+100ms, +5%)** (whichever is larger)            |
| Crash    | baseline had a non-null LCP but this run is null (page crashed) |

TBT, FCP, CLS, total bytes, and Lighthouse score are shown with Δ columns but
**do not gate** — TBT alone swings 30–60% between runs, and the Lighthouse score
is a version-dependent composite. The gate only trusts the deterministic metrics:
JS bytes (what we ship) and LCP (what users feel).

If `perf/baseline.json` is absent (fresh clone — it's gitignored), a plain
`pnpm perf` prints the measurements without Δ columns and exits 0.

---

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| 0    | pass; or `--save-baseline`; or `--no-gate`; or no baseline present          |
| 1    | at least one gated regression                                               |
| 2    | harness error (server unreachable / wrong app, Chrome crash, login failure) |

`PAGE_HUNG` is **not** a harness error — it's recorded and the run continues.

---

## Environment inputs

| Var                                                           | Used by | Default / source                                                 |
| ------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `PERF_BASE_URL`                                               | runner  | `http://localhost:3000`                                          |
| `PERF_CHROME_PATH`                                            | runner  | optional; else Playwright's bundled Chromium, else system Chrome |
| `PUBLIC_SUPABASE_URL` / `SUPABASE_URL`                        | seed    | read from `apps/dashboard/.env`                                  |
| `PRIVATE_SUPABASE_SERVICE_ROLE` / `SUPABASE_SERVICE_ROLE_KEY` | seed    | read from `apps/dashboard/.env`                                  |

The localStorage auth key the harness injects is `sb-localhost-auth-token`,
derived from the local Supabase URL host. If you ever point the harness at a
non-localhost Supabase, that key changes.

---

## Seeding (`pnpm seed:perf`)

Bulks the local Supabase to realistic volume so DB-shaped perf issues surface
under the production build:

- 500 student users `perf-student-N@workshop.local` / `123456`
- 1 admin user `perf-admin@workshop.local` / `123456`, org admin of Udemy Test
- 50 courses + 50 groups under the Udemy Test org, slugs `perf-course-1..50`
- 500 lessons (10 per course)
- 5050 `groupmember` rows (100 students per course + `admin@test.com` as tutor)

Idempotent — re-running detects existing seed data and no-ops with a status line.

> **Why `perf-admin@workshop.local` and not `admin@test.com`?** The spec's
> `routes.json` originally named `admin@test.com`, but the production build
> force-logs-out any `@test.com` email (`appSetup.ts:79`, guarded by `!dev`), so
> that account can't hold a session under `node build`. The harness uses a
> seeded `workshop.local` org admin instead — mirroring the student persona,
> which already dodges the guard. This is the minimum-deviation fix that keeps
> the admin route a real authenticated measurement.

```bash
pnpm seed:perf               # seed (no-op if already seeded)
node perf/seed.mjs --clean   # wipe + reseed
node perf/seed.mjs --clean-only  # wipe, no reseed
```

The perf personas (`perf-student-1@workshop.local`, `perf-admin@workshop.local`)
are **distinct** from the BDD suite's `student@test.com` / `admin@test.com` — the
two suites have separate personas, and the perf ones intentionally avoid the
`@test.com` prod-logout guard.
