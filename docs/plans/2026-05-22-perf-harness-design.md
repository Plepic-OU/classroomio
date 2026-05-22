# Performance Harness Design — 2026-05-22

## Goal

A CLI harness that runs Lighthouse against the production build of the ClassroomIO dashboard, saves per-route results, compares to a committed baseline, and exits non-zero on regression. Acts as a second gate alongside the BDD suite.

---

## File Layout

```
perf/
  lighthouse.mjs       # runner (ESM, no build step)
  seed.mjs             # seed script
  routes.json          # committed route list + credentials
  baseline.json        # gitignored; written by --save-baseline
  results/             # gitignored; per-run full Lighthouse JSON
  .gitignore
  README.md
```

New devDependencies (root):
- `lighthouse` — programmatic API
- `chrome-launcher` — fallback system-Chrome detection
- `playwright-core` — must be declared explicitly even though it is a transitive dep of `@playwright/test`; pnpm strict isolation means `perf/lighthouse.mjs` cannot import it without a direct declaration. Pin to the same version as `@playwright/test` (currently `^1.53.0`) to avoid a dual-Chromium install.

Root `package.json` scripts:
```json
"perf": "node perf/lighthouse.mjs",
"seed:perf": "node perf/seed.mjs"
```

---

## Chrome Lifecycle and Session Management

Routes are grouped by user role (`null` = public, `"admin"`, `"student"`).

For each user group:
1. Launch one Chrome instance with remote debugging enabled (via `playwright-core`)
2. For authed users: drive login once via Playwright CDP (fill email/password, wait for redirect away from `/login`)
3. For each route in the group:
   a. Clear HTTP cache via CDP `Network.clearBrowserCache` (preserves localStorage)
   b. Run Lighthouse with `port: chrome.port` (connects to our Chrome)
   c. `disableStorageReset: true` for authed routes (preserves ALL browser storage — cookies, localStorage, IndexedDB — Supabase JS v2 stores the session token in localStorage, so this must be `true` to keep the session alive), `false` for public routes
   d. After authed run: if `lhr.finalUrl` ends with `/login` instead of the requested path, the session was lost — treat as harness error (exit 2), not a perf regression (exit 1)
4. Close Chrome after all routes in the group are measured

Chrome resolution order:
1. `PERF_CHROME_PATH` env var
2. Playwright's bundled Chromium (`chromium.executablePath()` from `playwright-core`)
3. System Chrome via `chrome-launcher` defaults

---

## Lighthouse Configuration

Applied to every run:

```js
{
  extends: 'lighthouse:default',
  settings: {
    preset: 'desktop',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    disableStorageReset: <true for authed, false for public>,
  }
}
```

---

## Metric Extraction

Per-route metrics extracted from the Lighthouse result (`lhr`):

| Metric     | Source |
|------------|--------|
| score      | `lhr.categories.performance.score * 100` |
| LCP (ms)   | `lhr.audits['largest-contentful-paint'].numericValue` |
| TBT (ms)   | `lhr.audits['total-blocking-time'].numericValue` |
| FCP (ms)   | `lhr.audits['first-contentful-paint'].numericValue` |
| CLS        | `lhr.audits['cumulative-layout-shift'].numericValue` |
| JS bytes   | sum of `transferSize` where `resourceType === 'Script'` in `network-requests` items |
| Total bytes| sum of all `transferSize` in `network-requests` items |

**Crash / PAGE_HUNG handling**: if `lhr.runtimeError` is set, or LCP is null/undefined, record all metrics as `null` and tag the row with `runtimeError.code`. This is a valid measurement result, not a harness error (exit 2). `/lms/mylearning` is expected to PAGE_HUNG in the initial baseline.

Full Lighthouse JSON saved to:
```
perf/results/<ISO-timestamp>--<sanitized-path>.json
```
where sanitized = path with `/` → `-`, leading `-` stripped.

---

## Baseline Format

`perf/baseline.json`:
```json
{
  "timestamp": "2026-05-22T10:00:00.000Z",
  "routes": {
    "/login": {
      "score": 92, "lcp": 1240, "tbt": 80, "fcp": 900,
      "cls": 0.01, "jsBytes": 1420000, "totalBytes": 1800000,
      "runtimeError": null
    },
    "/lms/mylearning": {
      "score": null, "lcp": null, "tbt": null, "fcp": null,
      "cls": null, "jsBytes": null, "totalBytes": null,
      "runtimeError": "PAGE_HUNG"
    }
  }
}
```

---

## Output Table

Printed to stdout on every run:

```
Route               Score  Δ     LCP(ms)  ΔLCP    JS(MB)  ΔJS      TBT    FCP    CLS    Error
/login              92     +0    1240     +0ms    1.42   +0.00    80     900   0.01    -
/lms/mylearning      -      -     -        -       -      -        -      -     -      PAGE_HUNG
```

TBT, FCP, CLS, total bytes shown with Δ but **not gated**.

---

## Gate Rules (exit 1)

A regression is triggered if **any** of these conditions hold:

1. **JS bytes regression**: `currentJsBytes > baselineJsBytes * 1.05 AND currentJsBytes > baselineJsBytes + 50_000` on any route (both conditions must hold — mirrors the LCP dual-condition pattern to avoid false positives from minor build-hash churn)
2. **LCP regression**: `currentLcp > baselineLcp + 100` **and** `currentLcp > baselineLcp * 1.05` on any route (both conditions must hold)
3. **Crash regression**: baseline LCP was non-null but current LCP is null on any route

**Not a regression**:
- null vs null (e.g. `/lms/mylearning` stays crashed) — not gated
- null baseline + real current LCP — treated as improvement

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Pass (or `--save-baseline` / `--no-gate`) |
| 1    | Regression detected |
| 2    | Harness error (server unreachable, Chrome crash, unhandled exception) |

---

## CLI Flags

- `--save-baseline` — write current results to `perf/baseline.json`, always exit 0
- `--no-gate` — measure + print table, always exit 0

Environment variables:
- `PERF_BASE_URL` — base URL to test against (default: `http://localhost:4000`)
- `PERF_CHROME_PATH` — override Chrome executable path

---

## routes.json Schema

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

Plain string = public route. Object with `"as"` = Playwright CDP-driven login as that user.

---

## Seed Script (`perf/seed.mjs`)

Reads credentials from `apps/dashboard/.env`:
- `PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `PRIVATE_SUPABASE_SERVICE_ROLE` or `SUPABASE_SERVICE_ROLE_KEY`

### What it creates (FK-safe order)

1. **500 auth users** — `perf-student-{1..500}@workshop.local` / `123456` via `auth.admin.createUser({ email_confirm: true })`
2. **500 profile rows** — inserted manually (no auto-create trigger exists); `id` = auth user uuid, `fullname` = `Perf Student N`, `username` = `perf-student-N`
3. **50 courses** — slug `perf-course-{1..50}`, `is_published = true`, under org `1a1dcddd-1abc-4f72-b644-0bd18191a289`. Must set `is_published = true`: the course RLS SELECT policy is `is_published OR is_user_in_course_group_or_admin(group_id)`, so public Lighthouse runs against `/course/perf-course-1` return a 404/empty page on unpublished courses.
4. **50 groups** — one per course (same org)
5. **500 lessons** — 10 per course
6. **1 `organizationmember` row** — upsert `admin@test.com` as ADMIN (`role_id: 1`) in org `1a1dcddd-1abc-4f72-b644-0bd18191a289` if not already present. Required so `/org/udemy-test` renders the admin dashboard rather than a 403 or redirect.
7. **5050 `groupmember` rows** — 100 students per course (`role_id: 3`) + `admin@test.com` as tutor (`role_id: 2`) on each course. Use chunked INSERTs of 500 rows at a time to stay under PostgREST body/timeout limits.

**Pre-flight check**: before inserting courses, verify org `1a1dcddd-1abc-4f72-b644-0bd18191a289` exists. If it does not, exit with a clear error pointing the developer to run `supabase db reset` (which applies `supabase/seed.sql` containing the `udemy-test` org). The seed only works against a database that has `supabase/seed.sql` applied.

**Concurrency**: `auth.admin.createUser` is a REST call with no bulk endpoint. Run in parallel batches of 20–50 to avoid a minutes-long sequential run. Insert `profile` rows in bulk (single INSERT per batch of users).

### Idempotency

Detection key: any course with `slug LIKE 'perf-course-%'`. If found and `--clean` not passed, print status and exit 0.

### Flags

- `--clean` — delete existing perf data then reseed
- `--clean-only` — delete, no reseed

### Cleanup Order (FK-safe)

`groupmember` → `lesson` → `course` → `group` → `organizationmember` (perf admin row only) → `profile` → auth users (via `auth.admin.deleteUser`, batched; or bulk SQL `DELETE FROM auth.users WHERE email LIKE 'perf-student-%'` via service-role for speed)

### Roles (inline constants — no separate file)

```js
const ROLE = { ADMIN: 1, TUTOR: 2, STUDENT: 3 };
```

- Admin user is enrolled as TUTOR (`role_id: 2`) in each course's `groupmember`, and as ADMIN (`role_id: 1`) in the org's `organizationmember`
- Perf students enrolled as STUDENT (`role_id: 3`) in `groupmember`

---

## Build / Serve Sequence (documented in `perf/README.md`)

```bash
# 1. Build with adapter-node (PUBLIC_IS_SELFHOSTED=true is required)
PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
  pnpm build --filter=@cio/dashboard

# 2. Start the prod server (must source .env manually — node build does not auto-load it)
cd apps/dashboard
set -a; source .env; set +a
PUBLIC_IS_SELFHOSTED=true PORT=4000 node build &

# 3. Run harness
PERF_BASE_URL=http://localhost:4000 pnpm perf -- --save-baseline
```

**Gotchas (already paid for):**
- `PUBLIC_IS_SELFHOSTED=true` must be set at both build-time and start-time. Without it, `svelte.config.js` picks `adapter-vercel` and outputs `.vercel/output/` with no `build/` dir.
- `node build` does not auto-load `.env` — source it manually before starting.
- Default Node.js 2 GB heap OOMs the dashboard build — use `--max-old-space-size=6144`.
- **PORT must not be 3000**: that port is occupied by the docs app (`apps/docs`) in the devcontainer. Use `PORT=4000` (and `PERF_BASE_URL=http://localhost:4000`) to avoid silently measuring the docs site.
- **Turbo cache gap**: `turbo.json` currently lists build outputs as `.svelte-kit/**`, `.vercel/**`, `dist/**` — it does not include `build/**`. If Turbo replays a cache hit, the `build/` directory will not be restored and `node build` will fail. Add `"build/**"` to the dashboard's build outputs in `turbo.json` before using the harness in CI.

---

## Done-When Checklist

1. `PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline` writes `perf/baseline.json` and exits 0. `/lms/mylearning` shows null metrics + PAGE_HUNG; run still exits 0.
2. `PERF_BASE_URL=http://localhost:3000 pnpm perf` exits 0 with near-zero Δ columns. Null-vs-null on `/lms/mylearning` is not a regression.
3. `pnpm seed:perf` is idempotent — second run no-ops with a status line.
4. For an authed route that renders (e.g. `/org/<slug>`), `lhr.finalUrl` matches the requested path, not `/login`.
5. `perf/README.md` documents the build/serve sequence with gotchas and notes `/lms/mylearning` is expected broken in the initial baseline.
