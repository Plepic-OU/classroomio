# Day 3, perf 1 — Build the perf harness from scratch

**Target:** A working `perf/` directory with Lighthouse-based measurement, baseline diff, and gated exit codes.
**Done when:** `pnpm perf -- --save-baseline` succeeds against the prod build, `pnpm perf` re-runs and exits 0 with a per-route delta table, and an authed route lands somewhere other than `/login`.
**Domain:** Tooling. Node scripts, Lighthouse API, Puppeteer login flow.
**Difficulty:** Open-ended. Most of the constraints are spelled out; the work is in stitching them together.
**Est.:** 30-60 min.

## Why this workshop

You're going to spend the rest of the workshop driving Claude Code at perf-tuning a real codebase. To do that you need two gates: behavioral (`pnpm test:e2e` — already green on this branch) and performance (`pnpm perf` — doesn't exist yet).

Building the perf harness is itself a non-trivial Claude Code exercise. It's also a useful warm-up because:

- The shape of the tool — a measurement runner with a baseline diff and a hard-fail gate — is the same shape you'll be using to validate every subsequent change.
- A previous attempt without these hints burned hours on dead ends (measuring the dev server, asserting "Carbon is heavy" without checking, mis-configuring throttling). The hints below encode those lessons so you can skip them.

## Setup

Make sure the BDD suite is green first — that's the prerequisite gate:

```bash
pnpm i
supabase start
pnpm test:e2e   # must be green before you start
```

The harness you're building will measure the **production build**, not `pnpm dev`. See hint #1 below for why; you don't need to run the build yet.

When E2E tests are working, copy the prompt to claude code. While it's running, read the prompt and familiarize what will be built.

## Prompt (paste into Claude Code)

> I'm working on the ClassroomIO dashboard (SvelteKit 1.x / Svelte 4 / Carbon, in `apps/dashboard`). It's a Supabase-backed LMS. The BDD suite at `pnpm test:e2e` is the behavioural gate and currently passes. I need a second gate — a performance harness — that runs Lighthouse against a list of routes, compares to a baseline, and exits non-zero on regression. None of it exists yet.
>
> Use the `/brainstorming` skill to walk through the design with me before writing code. Keep the brainstorm tight — most of the constraints below are non-negotiable, so the design phase should mostly converge on *how* to wire them together, not whether to. When the design is settled, implement it.
>
> **What it must do:**
>
> - Run Lighthouse against a list of routes (mix of public and authed)
> - For each route, save the full Lighthouse JSON to `perf/results/<timestamp>--<sanitized-path>.json`
> - Aggregate to a per-route summary (Lighthouse score, LCP, TBT, FCP, CLS, JS bytes, total bytes)
> - Compare to `perf/baseline.json` if it exists; print a table with `Δ` columns
> - Exit 0 on pass, 1 on regression, 2 on harness error (server unreachable, Chrome crash, etc.)
> - Support `--save-baseline` (write current measurement to `perf/baseline.json` and exit 0) and `--no-gate` (measure + print but always exit 0)
> - Be runnable from the repo root as `pnpm perf` and `pnpm perf -- --save-baseline`
>
> **Hard hints — read these before brainstorming. They encode lessons from a previous attempt that didn't have them:**
>
> 1. **Measure against the production build, NEVER `pnpm dev`.** Vite-dev ships ~27 MB of JS per page (vs ~1.4 MB in prod) and serves close to 900 sub-resource requests on some routes. Code-level wins are invisible against that noise floor. Use this build/serve sequence — it works in this devcontainer:
>    ```bash
>    PUBLIC_IS_SELFHOSTED=true NODE_OPTIONS="--max-old-space-size=6144" \
>      pnpm build --filter=@cio/dashboard
>
>    cd apps/dashboard
>    set -a; source .env; set +a
>    PUBLIC_IS_SELFHOSTED=true PORT=3000 node build &
>    ```
>    Gotchas already paid for: `PUBLIC_IS_SELFHOSTED=true` must be set at **both** build and start time (switches `svelte.config.js` between adapter-node and adapter-vercel — without it you get `.vercel/output/` and no `build/` dir). `node build` does NOT auto-load `.env`. The default Node 2 GB heap OOMs the build. Document this sequence in `perf/README.md` so the next person doesn't pay for it again.
>
> 2. **Use Lighthouse's desktop preset with *simulated* throttling.** Set `throttlingMethod: 'simulate'`, `rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`. Without simulation, localhost is ~0ms RTT and any code-level win produces a sub-100ms delta that's invisible against measurement variance. Simulation makes the cost of N HTTP roundtrips and M bytes of JS show up the way a real user would feel them.
>
> 3. **Clear the HTTP cache before every measurement.** Otherwise Puppeteer's login flow (or a prior run on the same Chrome instance) primes the cache and JS-byte numbers stop reflecting a cold network. Lighthouse has `disableStorageReset: false`, but verify it actually clears across measurements — if you're reusing a Chrome instance, you may need to clear explicitly via CDP.
>
> **Heads-up on the route list:** `/lms/mylearning` is *intentionally slow* under the production build with the seed data. With 100 enrollments + simulated throttling, Lighthouse will likely emit a `runtimeError` of `PAGE_HUNG` and return null LCP/score/JS-bytes for it. That is **expected workshop content** that later workshops will fix — not a bug in your harness, not a reason to widen the load timeout, and not a reason to drop the route. Record the measurement (null metrics + a `runtimeError` tag in the table) and move on. The crash-detection rule in hint #6 already gives you the right behaviour on the next run: null-LCP-from-baseline-too is not a regression; a later run that produces a real LCP just shows up as an improvement; if it goes back to null after being fixed, the gate trips. None of the other "done when" checks depend on `/lms/mylearning` having a score.
>
> 4. **Authed routes require Puppeteer-driven login.** Schema for `perf/routes.json`:
>    ```json
>    {
>      "users": {
>        "admin":   { "email": "admin@test.com", "password": "123456" },
>        "student": { "email": "perf-student-1@workshop.local", "password": "123456" }
>      },
>      "routes": [
>        "/login",
>        "/course/perf-course-1",
>        { "path": "/lms/mylearning", "as": "student" },
>        { "path": "/org/udemy-test", "as": "admin" }
>      ]
>    }
>    ```
>    Plain string = public. Object with `"as": "<user>"` = Puppeteer logs in as that user, then the localStorage session is preserved into the Lighthouse run on the same Chrome instance (`port: chrome.port` in the Lighthouse config). After each authed measurement, verify `finalUrl` in the Lighthouse result is the requested path and not `/login` — if it's `/login`, the session didn't survive.
>
> 5. **Gate on the deterministic metrics only.** A regression is:
>    - JS bytes grew by more than **+1%** on any route, OR
>    - LCP grew by more than **+100ms or +5%** (whichever is larger) on any route
>
>    Display TBT, FCP, CLS, total bytes in the table with Δ but do **not** gate on them. TBT in particular varies 30–60% per route between runs — gating it would false-trigger constantly.
>
> 6. **Crash detection in the gate.** If a route had a non-null LCP in the baseline but produces a null LCP this run, that's a regression too (the page crashed or didn't stabilize). Trip the gate, exit 1.
>
> 7. **Don't pre-judge "what's slow."** A previous attempt declared "Carbon Components are the heavy bundle hitter" without measuring — turned out Carbon CSS was 72 kB out of a 1.4 MB bundle and not the leading contributor. When you're tempted to assert anything about *why* a number is what it is, prove it from the Lighthouse JSON (`audits['network-requests'].details.items`, `audits['largest-contentful-paint-element']`, etc.). Same applies to your own implementation — don't add "optimisations" without measuring.
>
> **Required interface (so the rest of the workshop can drop in without renaming things):**
>
> - `perf/lighthouse.mjs` — the runner
> - `perf/routes.json` — committed; schema as above
> - `perf/baseline.json` — written by `--save-baseline`; **add it to `perf/.gitignore`**
> - `perf/results/<timestamp>--<sanitized-path>.json` — per-route full Lighthouse report; **gitignored**
> - `perf/.gitignore` — excludes `baseline.json` and `results/`
> - `perf/README.md` — workflow doc covering: quick start, the build/serve sequence, what gets measured, gate thresholds, exit codes
> - Root `package.json` scripts: `"perf": "node perf/lighthouse.mjs"` and a way to run it with `--save-baseline` (either a separate `perf:baseline` script or document `pnpm perf -- --save-baseline`)
>
> **Required seed (`perf/seed.mjs`, runnable as `pnpm seed:perf`):**
>
> The harness measures authed routes for `perf-student-1@workshop.local`, who doesn't exist yet. Build a seed script that bulks up the local Supabase to realistic volume so DB-shaped perf issues surface:
>
> - 500 student auth users (`perf-student-N@workshop.local` / `123456`) — use Supabase's admin `auth.admin.createUser`, not the public signup endpoint
> - 50 courses + 50 groups under the existing test org (org id `1a1dcddd-1abc-4f72-b644-0bd18191a289`)
> - 500 lessons (10 per course)
> - 5050 enrollment rows (`groupmember`) — 100 students per course + `admin@test.com` as tutor on each
> - Idempotent: re-running should detect existing seed data and no-op with a status line (detection key: any course with `slug LIKE 'perf-course-%'` or any profile with `email LIKE 'perf-student-%'`)
> - Support `--clean` (wipe + reseed) and `--clean-only` (wipe, no reseed). Walk FK order on cleanup — this schema has no `ON DELETE CASCADE` for profiles
> - Read credentials from `apps/dashboard/.env` — needs `PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `PRIVATE_SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`)
>
> Roles are numeric per `apps/dashboard/src/lib/utils/constants/roles.js`: `ADMIN=1`, `TUTOR=2`, `STUDENT=3`. Tutors and students share the `groupmember` table — distinguish by `role_id`.
>
> **Chrome resolution order for Lighthouse:**
>
> 1. `PERF_CHROME_PATH` env var if set
> 2. Playwright's bundled Chromium — `@playwright/test` is already a devDep; import `chromium` from `playwright-core` and use `chromium.executablePath()`
> 3. Fall back to system Chrome via `chrome-launcher` defaults
>
> **Done when:**
>
> 1. With the prod build running on `localhost:3000`, `PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline` writes `perf/baseline.json` and exits 0. The baseline table for `/lms/mylearning` showing null metrics + `PAGE_HUNG` is expected; the run still exits 0.
> 2. `PERF_BASE_URL=http://localhost:3000 pnpm perf` re-runs and exits 0 with a table showing per-route metrics and (near-zero) deltas. Null-vs-null on `/lms/mylearning` is not a regression.
> 3. `pnpm seed:perf` is idempotent — second run no-ops with a status line
> 4. For an authed route that **does** render (e.g. `/org/<slug>`) the results JSON `finalUrl` matches the requested path (not `/login`). `/lms/mylearning` may PAGE_HUNG before it gets that far — that's covered by check #1 and is not a session-lost failure.
> 5. `perf/README.md` documents the build/serve sequence with the gotchas from hint #1 *and* notes that `/lms/mylearning` is expected to be broken in the initial baseline
>
> When you're done, print a short summary: file list created, command transcript proving the four "done when" checks, and any deliberate decisions you made where the spec was ambiguous.

## Verifying

After Claude Code reports done, check that you can access http://localhost:3000 and that perf/baseline.json has values.

You can try logging in with the perf test user and witness a reload loop. We'll fix that later.

Bonus visual check: open one of the `perf/results/*.json` files and confirm it has the shape of a Lighthouse report (`audits`, `categories.performance.score`, etc.). If the file is tiny or empty, something failed silently.

Make sure CLAUDE.md is updated with the perf testing setup info.

## When bored or ready before others

Explore with 2nd claude code session possible perf tuning possibilities.