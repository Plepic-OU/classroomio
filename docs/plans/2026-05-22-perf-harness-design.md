# Performance harness — design

**Date:** 2026-05-22
**Status:** Approved (brainstorming + validation complete)
**Scope:** A second gate alongside the BDD suite. Runs Lighthouse against a fixed route list, compares to a (gitignored) baseline, exits non-zero on regression. Plus a Supabase seeder that bulks the local DB to realistic volume so DB-shaped perf issues surface.

---

## 1. Constraints (from spec, locked)

These are not design choices, they are inputs. Listed here so the rest of the doc can refer back.

- **Measure prod build only.** `pnpm dev` is unusable — Vite-dev ships ~27 MB JS/page vs ~1.4 MB prod. Build/serve sequence:
  ```bash
  PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
    pnpm build --filter=@cio/dashboard

  cd apps/dashboard
  set -a; source .env; set +a
  PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
  ```
  Gotchas: `PUBLIC_IS_SELFHOSTED=true` at **both** build and start time. `node build` does NOT auto-load `.env`. The default Node 2 GB heap OOMs. **`pnpm dev` must not be running** — it occupies port 3000 via `apps/docs`.

- **Lighthouse: desktop preset, simulated throttling.** `rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`, `throttlingMethod: 'simulate'`.

- **`disableStorageReset: true`** for all routes. *(Spec originally said `false`; corrected during validation — per Lighthouse docs, `true` = preserve cookies/storage = session survives from Puppeteer login into the Lighthouse run. `false` would wipe the session.)*

- **Authed routes** via Puppeteer login on the same Chrome instance as Lighthouse (`port: chrome.port` shared).

- **Gate metrics:** JS bytes (+1%) and LCP (+100 ms or +5 %, whichever larger). Single-run; the +100 ms floor absorbs variance on small-baseline pages. Display TBT, FCP, CLS, total bytes with deltas but **don't gate** on them.

- **Crash detection:** baseline real LCP + current null LCP → regression.

- `/lms/mylearning` is **expected** to PAGE_HUNG and produce null metrics in the initial baseline. Workshop content, not a harness bug. Do not widen `maxWaitForLoad`.

- **Files:** `perf/lighthouse.mjs`, `perf/routes.json` (committed), `perf/baseline.json` (gitignored), `perf/results/*.json` (gitignored), `perf/README.md`, `perf/.gitignore`.

- **Scripts:** `pnpm perf` and `pnpm perf -- --save-baseline`. *(No `pnpm perf:baseline` alias — single form to avoid duplication.)*

- **Chrome resolution order:** `PERF_CHROME_PATH` → `playwright-core`'s `chromium.executablePath()` (stat-validated) → `chrome-launcher` default.

---

## 2. Layout & dependencies

```
perf/
  lighthouse.mjs          # runner (CLI entry, ESM)
  seed.mjs                # Supabase bulk seeder
  routes.json             # committed; user/route config
  README.md               # workflow doc
  .gitignore              # baseline.json, results/
  baseline.json           # written by --save-baseline; gitignored
  results/                # per-route JSON dumps; gitignored
```

**Dependency placement:** root `package.json` `devDependencies` — `perf/` is **not** a workspace package (same pattern as Cypress lives at the root). README will note this so a future contributor doesn't promote `perf/` to a workspace and break Node's module resolution.

- `lighthouse` — programmatic API
- `chrome-launcher` — launches Chrome with debugging port
- `puppeteer-core@^22` — connects to launched Chrome over CDP for the login flow
- `playwright-core` — only for `chromium.executablePath()` in the Chrome resolution chain
- `@supabase/supabase-js@^2.31.0` — pinned to match `apps/dashboard` for pnpm dedup
- `dotenv` — load `apps/dashboard/.env` from the seed script

**Root `package.json` scripts:**
```json
"perf": "node perf/lighthouse.mjs",
"seed:perf": "node perf/seed.mjs"
```

README documents `pnpm perf -- --save-baseline` form.

---

## 3. `lighthouse.mjs` — runner

### 3.1 Top-level flow

1. Parse args: `--save-baseline`, `--no-gate`.
2. Read `perf/routes.json`; validate shape (users object, routes array of strings | `{path, as}`).
3. Read `PERF_BASE_URL` (default `http://localhost:3000`); ping `/` once. Not reachable → exit 2 with `[harness] server unreachable at <url>`.
4. **Pre-flight seed check:** if any route has `as`, hit Supabase REST (anon key) and confirm `profile` with `email='perf-student-1@workshop.local'` exists. Missing → exit 2 with `[harness] perf seed not present; run pnpm seed:perf first`.
5. Resolve `chromePath`: `PERF_CHROME_PATH` → `playwright-core`'s `chromium.executablePath()` (with `fs.statSync` — if the path doesn't exist on disk, fall through) → `undefined` (let `chrome-launcher` decide). Log which one was picked.
6. **For each route** in `routes.json.routes`:
   1. `chrome-launcher.launch({ chromePath, chromeFlags: ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] })`.
   2. If route has `as`: `puppeteer.connect({ browserURL: 'http://localhost:'+chrome.port, defaultViewport: null })`, open new page, go to `BASE_URL + '/login'`, wait for `input[placeholder="you@domain.com"]` to be visible (hydration), then:
      - `await page.type('input[placeholder="you@domain.com"]', email)`
      - `await page.type('input[placeholder="************"]', password)`
      - `await page.click('button[type=submit]')`
      - `await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 })`
        — Supabase signin is client-side, so wait on URL change, not navigation.
      - On timeout → exit 2 with `[harness] login failed for <email>`.
   3. Run `lighthouse(BASE_URL + path, { port: chrome.port, output: 'json', logLevel: 'error' }, lhConfig)`.
   4. Write the full `lhr` JSON to `perf/results/<ISO-timestamp>--<sanitized-path>.json`. Sanitization: `replace(/[^a-z0-9]+/gi, '-')`, strip leading/trailing `-`, fall back to `'root'` for `/`.
   5. Extract per-route summary (see 3.3).
   6. `await chrome.kill()` (it returns a Promise) in a `finally`.
7. If `--save-baseline`: write summary array to `perf/baseline.json`, print table, exit 0.
8. Else: load `perf/baseline.json` if present; compute deltas; print table; apply gate (see 3.4) → exit 0 or 1.
9. Any thrown error or unhandled rejection in the loop → exit 2 with a distinct stderr prefix per cause (`[harness] chrome launch failed`, `[harness] session lost on /<path>`, `[harness] unhandled rejection`, `[harness] lighthouse threw on /<path>`).

Chrome lifecycle: **fresh per route** (decided in brainstorming) — bulletproof cache/cookie isolation. Cost is negligible for ~5 routes.

### 3.2 Lighthouse config

```js
{
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350, height: 940,
      deviceScaleFactor: 1, disabled: false
    },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    disableStorageReset: true   // preserve Puppeteer-established session into the audit
  }
}
```

`maxWaitForLoad` left at the Lighthouse default of 45 s. We do **not** widen it to "rescue" `/lms/mylearning`.

### 3.3 Per-route summary record

```js
{
  path, finalUrl,
  runtimeError: lhr.runtimeError?.code ?? null,
  score:      lhr.categories.performance?.score ?? null,
  lcp:        lhr.audits['largest-contentful-paint']?.numericValue ?? null,
  fcp:        lhr.audits['first-contentful-paint']?.numericValue ?? null,
  tbt:        lhr.audits['total-blocking-time']?.numericValue ?? null,
  cls:        lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
  jsBytes:    sumBytes(lhr, 'Script'),
  totalBytes: sumBytes(lhr, '*'),
}
```

`sumBytes` reads `audits['network-requests'].details.items[]` and sums `transferSize`, filtered by `resourceType`. Returns `null` when the audit object is null/missing (PAGE_HUNG case).

**Session-lost check:** if `route.as` is set and `new URL(finalUrl).pathname === '/login'` and no `runtimeError`, mark `sessionLost: true` and the run exits 2 (harness failure, not a regression).

### 3.4 Gate logic

Only when not `--save-baseline`, not `--no-gate`, and `perf/baseline.json` exists.

For each route present in both baseline and current:

| Baseline | Current | Verdict |
|---|---|---|
| JS bytes real | JS bytes real, `current > baseline * 1.01` | **regression** |
| LCP real | LCP null | **regression** (crash) |
| LCP real | LCP real, `current - baseline > max(100, baseline * 0.05)` | **regression** |
| LCP null | LCP null | no-op (e.g. `/lms/mylearning` known PAGE_HUNG) |
| LCP null | LCP real | `recovered` — no gate, table notes "rebaseline" |
| JS bytes null on either side | n/a | no-op |

- Routes in baseline but missing from current → skip (config drift).
- Routes in current but missing from baseline → print as `new`, no gate.

Exit 1 on any regression; exit 0 otherwise. `--no-gate` always exits 0.

### 3.5 Output

Hand-built fixed-width table (avoid `console.table`'s truncation).
Columns: `route | score Δ | LCP Δ | TBT Δ | FCP Δ | CLS Δ | JS bytes Δ | total Δ | notes`.
`notes` carries `PAGE_HUNG`, `sessionLost`, `new`, `recovered`, etc.

### 3.6 Exit codes

| Code | Cause |
|---|---|
| 0 | Pass, or `--save-baseline`, or `--no-gate` |
| 1 | Regression(s) detected |
| 2 | Harness error: server unreachable / seed missing / chrome launch / session lost / unhandled rejection — each with distinct stderr prefix |

---

## 4. `seed.mjs` — Supabase bulk seeder

### 4.1 Flow

1. Parse args: `--clean`, `--clean-only`.
2. `dotenv.config({ path: 'apps/dashboard/.env' })`. Resolve `url = PUBLIC_SUPABASE_URL || SUPABASE_URL` and `serviceRole = PRIVATE_SUPABASE_SERVICE_ROLE || SUPABASE_SERVICE_ROLE_KEY`. Missing either → exit 1.
3. **Localhost guard:** parse `url`; if the hostname is not `localhost` / `127.0.0.1`, exit 1 with `[seed] refusing to run against non-local Supabase (got <host>)`. Prevents accidental prod/staging seeding with hardcoded password `123456`.
4. Build service-role client: `createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })`.
5. **Idempotency probe** (skipped under `--clean`/`--clean-only`):
   - `from('course').select('*', { count: 'exact', head: true }).like('slug', 'perf-course-%')`
   - `from('profile').select('*', { count: 'exact', head: true }).like('email', 'perf-student-%')`
   - Either > 0 → print `seed already present (<N> courses, <M> profiles); use --clean to reseed` and exit 0.
6. **Cleanup** (only under `--clean`/`--clean-only`), FK-safe order:
   1. `from('groupmember').delete().in('group_id', perfGroupIds)` and `.in('profile_id', perfProfileIds)` (two passes to keep query strings sane)
   2. `from('lesson_completion').delete().in('profile_id', perfProfileIds)` *(belt-and-suspenders; no cascade from profile)*
   3. `from('lesson').delete().in('course_id', perfCourseIds)`
   4. `from('organizationmember').delete().in('profile_id', perfProfileIds)` *(no cascade from profile)*
   5. `from('group').delete().like('name', 'perf-group-%')`
   6. `from('course').delete().like('slug', 'perf-course-%')`
   7. `from('profile').delete().like('email', 'perf-student-%')`
   8. Page `auth.admin.listUsers`; for each user with email matching `perf-student-%@workshop.local`, `auth.admin.deleteUser(id)`.
   Print row counts at each step. If `--clean-only` → exit 0 here.
7. **Seed** (order chosen for FK):
   1. **500 auth users** via `auth.admin.createUser({ email: 'perf-student-N@workshop.local', password: '123456', email_confirm: true })`. Batches of 25 in parallel (drop to 10 if local Supabase becomes CPU-bound on bcrypt). On `User already registered`, page `listUsers` to recover the existing id.
   2. **500 profile rows.** Each: `{ id: authUserId, fullname: 'Perf Student N', username: 'perf-student-N', email: 'perf-student-N@workshop.local' }`. `is_restricted` left to its default `false`. Chunked insert of 500.
   3. **500 organizationmember rows** under org `1a1dcddd-1abc-4f72-b644-0bd18191a289`, `role_id=3` (student). Without this `/lms/mylearning` shows an empty shell (page keys off `currentOrg.id` populated from this table).
   4. Look up `admin@test.com`'s profile id once.
   5. **50 group rows.** Each: `{ name: 'perf-group-N', organization_id: '1a1dcddd-...' }`.
   6. **50 course rows.** Each: `{ title: 'Perf Course N', description: 'Perf seed course N', slug: 'perf-course-N', group_id: <perf-group-N.id>, is_published: true }`. Defaults handle `currency/status/version/metadata/logo`. `is_published: true` so unauthenticated `/course/perf-course-1` renders under the current RLS policy.
   7. **500 lesson rows**, 10 per course, `{ title: 'Perf Lesson N-K', course_id: <perf-course-N.id> }`. *(`lesson.course_id` is the FK — `lesson` has no `group_id` column.)*
   8. **5050 groupmember rows:**
      - 50 tutor rows: `(admin_profile_id, group_id, role_id=2)`.
      - 5000 student rows: for course `c` (0..49), enroll students `[c*10 .. c*10+99] mod 500`, `role_id=3`. Uniform distribution — every student ends up in ~10 courses (5000/500).
   9. Bulk inserts: chunks of 500 for `groupmember`, 50/500 for the smaller tables.
8. Print final counts and `ok`.

### 4.2 Cleanup FK note

Schema does **not** have `ON DELETE CASCADE` from `auth.users` to `profile`, and no cascade from `profile` to `organizationmember` / `lesson_completion`. The cleanup walk handles these explicitly. `course → submission` cascade exists; we don't create submissions so it doesn't matter here.

---

## 5. `routes.json`

```json
{
  "users": {
    "admin":   { "email": "admin@test.com", "password": "123456" },
    "student": { "email": "perf-student-1@workshop.local", "password": "123456" }
  },
  "routes": [
    "/login",
    "/course/perf-course-1",
    { "path": "/lms/mylearning", "as": "student" },
    { "path": "/org/udemy-test", "as": "admin" }
  ]
}
```

`/org/udemy-test` is the existing test org slug (org id `1a1dcddd-1abc-4f72-b644-0bd18191a289`). `admin@test.com` already exists in `supabase/seed.sql`. `perf-student-1` and `perf-course-1` come from `seed.mjs`.

---

## 6. README.md outline

1. **Quick start (in order)** — `pnpm seed:perf` → build/serve sequence (the verbatim block from §1, with `pnpm dev` warning) → `pnpm perf -- --save-baseline` → `pnpm perf`. Note all `pnpm perf*` and `pnpm seed:perf` commands run from repo root.
2. **What gets measured** — the metric list, simulated throttling values, cold-cache guarantee from fresh-per-route Chrome.
3. **Gate thresholds** — the +1 % JS, +100 ms-or-+5 % LCP rules; crash-detection rule; null→real recovery case. Why TBT/FCP/CLS aren't gated.
4. **Exit codes** — table from §3.6, including the distinct stderr prefixes.
5. **Expected weirdness** — `/lms/mylearning` is intentionally slow workshop content and PAGE_HUNGs under simulated throttling with the seed data. Null metrics + `PAGE_HUNG` tag is normal for the initial baseline. **Do not widen `maxWaitForLoad`** — that would mask the very thing the workshop is meant to surface.
6. **Chrome resolution order** — `PERF_CHROME_PATH` → `playwright-core` (stat-validated) → `chrome-launcher` default. Note the Playwright Chromium binary in this devcontainer lives at `~/.cache/ms-playwright/chromium-*/chrome-linux/chrome`.
7. **Files** — what's written, what's gitignored, where results live.
8. **Dep placement** — root `node_modules` resolves all imports. Don't add a `perf/package.json` (would turn `perf/` into a workspace package and break resolution).

---

## 7. Done-when (from spec)

1. With prod build on `localhost:3000`, `PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline` writes `perf/baseline.json`, exits 0. `/lms/mylearning` showing null + `PAGE_HUNG` is expected.
2. `PERF_BASE_URL=http://localhost:3000 pnpm perf` re-runs, exits 0, table shows near-zero deltas. Null vs null on `/lms/mylearning` is not a regression.
3. `pnpm seed:perf` second run no-ops with a status line.
4. For an authed route that **does** render (`/org/<slug>`), results JSON `finalUrl` matches the requested path (not `/login`). `/lms/mylearning` may PAGE_HUNG before reaching this state — covered by check #1, not a session-lost failure.
5. `perf/README.md` documents the build/serve sequence with hint #1 gotchas, and notes the expected `/lms/mylearning` weirdness.
