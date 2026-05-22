# Performance Harness

Measures Lighthouse scores against the **production build** and gates on regressions.

---

## Quick Start

```bash
# 1. Seed the database (one-time; idempotent)
pnpm seed:perf

# 2. Build the dashboard (adapter-node — see gotchas below)
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

# 3. Start the production server
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=4000 node build &
cd -

# 4. Save a baseline
PERF_BASE_URL=http://localhost:4000 pnpm perf:baseline

# 5. Measure and gate
PERF_BASE_URL=http://localhost:4000 pnpm perf
```

---

## Build / Serve Gotchas (already paid for)

**`PUBLIC_IS_SELFHOSTED=true` is required at both build AND start time.**
`svelte.config.js` switches between `adapter-vercel` and `adapter-node` on this flag. Without it at build time you get `.vercel/output/` instead of `build/` and `node build` fails.

**`node build` does not auto-load `.env`.**
Source the env file manually before starting: `set -a; source .env; set +a`. Without Supabase credentials the server starts but auth calls fail.
If `.env` has Windows CRLF line endings (you'll see `$'\r': command not found` warnings), use: `set -a; source <(sed 's/\r//' .env); set +a`.

**Default Node.js 2 GB heap OOMs the build.**
Use `NODE_OPTIONS="--max-old-space-size=6144"` (6 GB). The dashboard build is large.

**Do not use PORT=3000.**
Port 3000 is occupied by `apps/docs` in the devcontainer. The prod server must use a different port (4000 by default). `PERF_BASE_URL` must match.

**Do not measure against `pnpm dev`.**
The Vite dev server emits ~27 MB of JS per page (vs ~1.4 MB in prod) and generates ~900 sub-requests on some routes. Measuring dev is meaningless noise.

---

## What Gets Measured

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | |
| `/course/perf-course-1` | public | requires `pnpm seed:perf` |
| `/lms/mylearning` | student | **expected PAGE_HUNG in initial baseline** — see below |
| `/org/udemy-test` | perf-admin | uses `perf-admin@workshop.local` — see note below |

### `/org/udemy-test` uses `perf-admin@workshop.local`, not `admin@test.com`

The production build's `appSetup.ts` contains a guard that auto-logs out any user whose email ends in `@test.com` when `dev === false`. Using `admin@test.com` would cause an immediate redirect to `/logout` after every login, making the measurement worthless. The seed script creates a dedicated `perf-admin@workshop.local` user with `role_id=1` on the `udemy-test` org specifically to avoid this.

---

### `/lms/mylearning` is intentionally broken

With 100 enrollments + simulated throttling, Lighthouse emits `PAGE_HUNG` and returns null metrics for this route. This is expected workshop content that later workshops will fix. The harness records null metrics with a `PAGE_HUNG` tag and continues. It does **not** trip the regression gate (null-vs-null is not a regression).

---

## Gate Thresholds

A regression is flagged (exit 1) if **any** route:

- **JS bytes** grew by more than +5% **and** +50 kB vs baseline
- **LCP** grew by more than +100 ms **and** +5% vs baseline (both must hold)
- Had a non-null LCP in baseline but returns null this run (crash regression)

**Not gated:** TBT, FCP, CLS, total bytes (shown in table with Δ but never exit 1).

---

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Pass |
| 1 | Regression detected |
| 2 | Harness error (server unreachable, Chrome crash, session lost) |

---

## CLI Flags & Env Vars

```bash
pnpm perf                          # measure + gate
pnpm perf -- --no-gate             # measure only, always exit 0
pnpm perf:baseline                 # save baseline, always exit 0
```

| Variable | Default | Description |
|---|---|---|
| `PERF_BASE_URL` | `http://localhost:4000` | URL of the running prod server |
| `PERF_CHROME_PATH` | auto | Override Chrome executable path |

Chrome resolution order: `PERF_CHROME_PATH` → Playwright bundled Chromium → system Chrome.

---

## Seed Script

```bash
pnpm seed:perf                     # seed (idempotent, no-op if already seeded)
pnpm seed:perf -- --clean          # wipe + reseed
pnpm seed:perf -- --clean-only     # wipe only
```

Creates:
- 500 auth users (`perf-student-{1..500}@workshop.local` / `123456`)
- 50 published courses (`perf-course-{1..50}`) + groups under the `udemy-test` org
- 500 lessons (10 per course)
- 5050 groupmember rows (students 1–100 enrolled in all 50 courses + admin as tutor)

**Prerequisite:** `supabase start` must be running and `supabase db reset` must have been applied (the seed depends on the `udemy-test` org from `supabase/seed.sql`).

---

## Output Files

```
perf/baseline.json          ← gitignored; written by --save-baseline
perf/results/<ts>--<path>.json  ← gitignored; full Lighthouse JSON per run
```

---

## Resetting the Baseline

After a deliberate bundle change that you want to accept:

```bash
PERF_BASE_URL=http://localhost:4000 pnpm perf:baseline
```

`baseline.json` is gitignored. In a CI pipeline, store it as a build artifact and restore it on subsequent runs before calling `pnpm perf`.
