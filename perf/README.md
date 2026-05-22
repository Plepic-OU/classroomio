# Performance Harness

Lighthouse-based performance gate for the ClassroomIO dashboard. Measures a fixed set of routes against the **production build** and compares to a baseline.

---

## Quick Start

```bash
# 1. Seed the database (once, idempotent)
pnpm seed:perf

# 2. Build and serve the production app (see section below)
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard
cd apps/dashboard && set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &

# 3. Save baseline (first time)
PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline

# 4. Re-run and compare
PERF_BASE_URL=http://localhost:3000 pnpm perf
```

---

## Build / Serve Sequence — Required Gotchas

### `PUBLIC_IS_SELFHOSTED=true` must be set at **both** build and serve time

`svelte.config.js` switches between `adapter-node` (selfhosted) and `adapter-vercel` based on this flag.
Without it at build time you get `.vercel/output/` instead of `build/` and `node build` fails to start.
Without it at serve time the server skips the Node.js entrypoint setup.

### `.env` is **not** auto-loaded by `node build`

SvelteKit's adapter-node server does not call `dotenv`. You must source the env manually:

```bash
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=3000 node build
```

### Default Node heap OOMs during the build

The dashboard's production build peaks above the 2 GB default heap.
Always pass `NODE_OPTIONS="--max-old-space-size=6144"` to the build command.

### Measure against the production build — never `pnpm dev`

Vite dev-mode ships ~27 MB of JS per page (vs ~1.4 MB prod) and makes close to 900 sub-resource
requests on some routes. Code-level improvements are invisible against that noise floor.

---

## What Gets Measured

Routes are defined in `perf/routes.json`.  Public routes are measured cold (no prior cache).
Authed routes require a Puppeteer-driven login first; the session is preserved into the
Lighthouse run via a shared Chrome instance.

| Route | Auth |
|---|---|
| `/login` | public |
| `/course/perf-course-1` | public |
| `/lms/mylearning` | as student (`perf-student-1@workshop.local`) |
| `/org/udemy-test` | as admin (`perf-admin@workshop.local`) |

**Why not `admin@test.com`?** The production build (`!dev`) auto-logouts any `@test.com` email
in `appSetup.ts` (line ~79). `perf-admin@workshop.local` is a dedicated perf org-admin that
doesn't trigger this guard. The seed script creates it automatically.

### `/lms/mylearning` — potential `PAGE_HUNG`

With enough concurrent load or simulated throttling, Lighthouse may emit a `PAGE_HUNG` runtime
error for this route. That is expected workshop content to be fixed later. A `PAGE_HUNG` entry
in the baseline is **not** a regression trigger — only a subsequent run where LCP goes from
non-null back to null trips the gate.

---

## Gate Thresholds

The gate (exit code 1) fires when, compared to the baseline:

- **JS bytes grew by more than +1%** on any route
- **LCP grew by more than max(+100 ms, +5%)** on any route
- **LCP was non-null in the baseline but is null now** (page crashed or hung after being healthy)

TBT, FCP, CLS, and total bytes are displayed in the table with Δ columns but **do not gate**.
TBT variance alone is 30–60% per run; gating it would produce constant false triggers.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass (or `--save-baseline` / `--no-gate` mode) |
| 1 | Regression detected |
| 2 | Harness error (Chrome failed to launch, server unreachable, etc.) |

---

## CLI Flags

```bash
pnpm perf                        # measure + compare + gate
pnpm perf -- --save-baseline     # measure + write perf/baseline.json, exit 0
pnpm perf -- --no-gate           # measure + print table, always exit 0
```

### Env vars

| Variable | Default | Purpose |
|---|---|---|
| `PERF_BASE_URL` | `http://localhost:3000` | URL of the running prod server |
| `PERF_CHROME_PATH` | (auto-detected) | Override path to Chrome/Chromium binary |

Chrome resolution order: `PERF_CHROME_PATH` → playwright-core bundled Chromium → chrome-launcher default.

---

## Seed Script

```bash
pnpm seed:perf                   # idempotent — no-ops if perf-course-* exists
pnpm seed:perf -- --clean        # wipe existing perf data and reseed
pnpm seed:perf -- --clean-only   # wipe perf data, do not reseed
```

The seed creates:

- `perf-admin@workshop.local` — org ADMIN for `udemy-test`, used by routes.json for `/org/udemy-test`
- 500 auth users (`perf-student-1@workshop.local` … `perf-student-500@workshop.local`, password `123456`)
- 50 courses (`perf-course-1` … `perf-course-50`) under the test org
- 500 lessons (10 per course)
- 5 050 `groupmember` rows (100 students + `admin@test.com` as TUTOR per course)

Reads Supabase credentials from `apps/dashboard/.env` (`PUBLIC_SUPABASE_URL` + `PRIVATE_SUPABASE_SERVICE_ROLE`).

---

## Files

```
perf/
  lighthouse.mjs      main runner
  seed.mjs            seed script
  routes.json         committed route list
  baseline.json       written by --save-baseline (gitignored)
  results/            per-route full Lighthouse JSON (gitignored)
  .gitignore
  README.md
```
