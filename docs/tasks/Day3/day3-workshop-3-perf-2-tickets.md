# Day 3, perf 2 — Three perf tickets, no hand-holding

**Target:** Land three production perf fixes the way you'd do them at work — from a one-line bug report, with Claude Code doing the digging.
**Done when:** All three tickets fixed. `pnpm perf` exits 0, `pnpm test:e2e` is green, and you can explain what the agent figured out for each.
**Domain:** Mixed — frontend asset loading, auth/state, Postgres RPC. One ticket per layer.
**Difficulty:** Diagnosis ramps up; the typing is small in all three.
**Est.:** 60–90 min for all three. Each ticket is ~15–30 min depending on how much your agent thrashes.

## The point of this workshop

You get the kind of bug report a non-engineer might file in Slack — *"the page is slow"* — and you drive an agent to find the root cause from that.

The real lesson is the gate. You have:

- `pnpm test:e2e` — behavioral correctness. If a "fix" breaks login, this catches it.
- `pnpm perf` — Lighthouse-measured perf with a baseline diff. If a "fix" tanks bundle size or crashes a route, this catches it.

With both gates green, you can let the agent iterate semi-autonomously. Without them, you can't trust any "done" report. The aha isn't *"the bug was X."* It's *"the agent figured X out because I gave it tools to verify itself."*

**Try each ticket without hints first.** Hints for all three live at the bottom of this file under `<details>` blocks — open them only after your agent has been flailing for ~10 min, or after you finish and want to compare. Premature spoiling replaces the diagnostic loop with a follow-the-recipe exercise.

## Setup (do this once before starting any ticket)

Prereq: perf 1 done (`perf/baseline.json` exists, harness works, e2e suite green).

You need three things in place before any ticket: perf seed data in Supabase, the dashboard built and serving in selfhosted prod mode on `localhost:3000`, and a fresh `pnpm perf` baseline. Let the agent do it — pasting this prompt is also a small warm-up in how the rest of the workshop will feel.

**Paste into Claude Code:**

> Get the perf harness into a known clean state before I hand you a ticket. Don't start investigating anything yet — I'll give you the actual task after I've reviewed the baseline.
>
> 1. Run `pnpm seed:perf` — it's idempotent, no-ops if data exists.
> 2. Build and serve the dashboard in selfhosted prod mode on port 3000, in the background. The full build/serve sequence with all the gotchas is in `perf/README.md` — read it first; getting it wrong (wrong env var, wrong adapter, unsourced `.env`) wastes ~5 min per attempt.
> 3. Once `http://localhost:3000` responds, capture a fresh baseline: `PERF_BASE_URL=http://localhost:3000 pnpm perf -- --save-baseline`.
> 4. Print the per-route table from the baseline run so I can see the starting state, then stop.

**Before moving on, verify:**

- `curl -sI http://localhost:3000` returns a 200 or 302.
- `perf/baseline.json` exists and is non-empty.
- The agent's printed table includes rows for `/login`, `/lms/mylearning`, and at least one `/org/*` route — those are the three targets for the tickets below.

---

## Ticket #1 — "Login is really slow"

**Reported by:** Marketing
**Affects:** `/login` (public)
**Done when:** cold `/login` LCP drops by at least 50% vs. baseline; gates green.

> Hey, we've been doing user testing and folks bounce off the login page. Lighthouse says perf score in the 50s, takes 5 seconds to render. It's a login form. Can someone look?

_Hints for this ticket are at the bottom of the file. Try without them first._

**Paste into Claude Code:**

> A teammate reports that `/login` on the ClassroomIO dashboard (SvelteKit 1.x / Svelte 4 / Carbon, `apps/dashboard`) is much slower than it should be — Lighthouse perf score in the 50s, LCP around 5 seconds for a simple login form. The current baseline is saved in `perf/baseline.json`; per-route full Lighthouse JSON is in `perf/results/*`.
>
> Your task: figure out what's making it slow and fix it. Cold LCP must drop by at least 50% vs. the baseline.
>
> Constraints:
> - `pnpm test:e2e` must stay green.
> - `pnpm perf` must exit 0. Don't pass `--no-gate`, don't re-save the baseline to mask a regression.
> - Prove your hypothesis from data before changing code.
>
> When done, report: before/after `/login` LCP (cold and warm if you measured both), before/after total request count, one-line explanation of the root cause.

**Verifying:**

- `/login` row in `pnpm perf` shows a large green negative LCP Δ.
- Open `http://localhost:3000/login` in a real browser — it still looks like a usable login form. Minor typography differences fine; missing inputs or console errors not fine.
- `pnpm test:e2e` green.

---

## Ticket #2 — "mylearning page is broken"

**Reported by:** Support (forwarded from a student)
**Affects:** `/lms/mylearning` for student accounts in selfhosted prod
**Done when:** route stabilises; `pnpm perf` produces a real (non-null) LCP for it; gates green.

> A student wrote in saying the My Learning page just keeps reloading and never settles. We reproduced on the `perf-student-1@workshop.local` test account (pwd is 123456) in our selfhosted build. Lighthouse won't even score it — says PAGE_HUNG. Please fix.

_Hints for this ticket are at the bottom of the file. Try without them first._

**Paste into Claude Code:**

> A student reports that `/lms/mylearning` is unusable on the ClassroomIO dashboard in selfhosted prod mode (`PUBLIC_IS_SELFHOSTED=true`). The page renders once and then enters what looks like an infinite reload loop. Reproduces on `perf-student-1@workshop.local` / `123456`.
>
> `pnpm perf` reports null LCP / score 0 / `PAGE_HUNG` for the route — Lighthouse can't get a stable measurement window, so it's not the right tool here. There may be other measurement scripts in `perf/`, or write your own. Characterise the symptom before guessing at causes.
>
> Your task: stop the loop. After your fix, whatever you measure with should show the route settling, and `pnpm perf` should report a real LCP for it.
>
> Constraints:
> - `pnpm test:e2e` must stay green.
> - `pnpm perf` must exit 0.
> - Don't disable Supabase's `onAuthStateChange` — other features depend on it.
> - The post-login redirect for students (`/login` → `/lms`) must keep working.
>
> When done, report: probe output before/after as fenced blocks, the `/lms/mylearning` row from `pnpm perf` before/after, 2–3 sentences on the root cause.

**Verifying:**

- Probe final URL is `/lms/mylearning` with no further navigations after it settles.
- `pnpm perf` shows a real LCP (~3s) for the route, gate passes.
- Manual: log in as `perf-student-1@workshop.local`, navigate to `/lms/mylearning`, refresh once — page stays put.

---

## Ticket #3 — "Student dashboard sluggish at scale"

**Reported by:** Customer success (forwarded from our biggest org)
**Affects:** student courses listing under high enrollment volume
**Depends on:** Ticket #2 fixed — otherwise `/lms/mylearning` doesn't stabilise and the e2e suite can't validate this work.
**Done when:** the slow DB call's row count and buffer pages drop substantially for a student loading their courses (proven via `EXPLAIN ANALYZE`); admin behavior unchanged; gates green.

> Our biggest customer is complaining that as they've added more courses, individual student page loads feel slower. They're at ~50 courses with ~100 students each. Our DB metrics show the courses fetch is doing more work than seems necessary for one student loading their own enrollments. Please investigate.

_Hints for this ticket are at the bottom of the file. Try without them first._

**Paste into Claude Code:**

> A customer reports their student dashboard feels sluggish under load. Symptoms: ~50 courses in the org, ~100 students each, individual student page loads. DB metrics suggest something on the courses fetch is doing more work than it should for a single student loading their own enrollments.
>
> Architecture note: the dashboard talks directly to Supabase via PostgREST + RLS — there's no Node CRUD layer.
>
> Tools:
> - `docker exec -i supabase_db_classroomio psql -U postgres -d postgres` runs SQL against the local Postgres. `EXPLAIN (ANALYZE, BUFFERS)` is your friend. Multi-line SQL via heredoc.
> - Perf seed creds: `perf-student-1@workshop.local` / `123456`. Org id for the perf seed: `1a1dcddd-1abc-4f72-b644-0bd18191a289`.
> - `pnpm perf` may or may not move depending on what you change — but it still must pass, to confirm you didn't regress anything else.
>
> Your task: investigate and fix. Whatever you change should hold up under `EXPLAIN ANALYZE` — prove the fix actually does less work, not just rearranges it. Admin behavior must be unchanged (admins must still see every course in the org).
>
> Constraints:
> - `pnpm test:e2e` must stay green.
> - `pnpm perf` must exit 0.
> - Verify admin behavior by logging in as `admin@test.com` / `123456`.
> - If you add a migration: add a new one, don't edit historical ones. After: `supabase db reset` + `pnpm seed:perf` + rebuild + restart dashboard so the change is actually in the running DB.
>
> When done, report: `EXPLAIN (ANALYZE, BUFFERS)` before/after as fenced blocks, a small table of row counts and buffer hits, the `pnpm perf` summary, and 2–3 sentences explaining the root cause and why your fix works.

**Verifying:**

- `EXPLAIN ANALYZE` for the path the dashboard now uses returns ~10 rows for `perf-student-1`, buffer hits dropped 30%+.
- `pnpm perf` still green; `/lms/mylearning` LCP within ±100ms of its post-ticket-#2 value.
- Manual: `perf-student-1` sees only enrolled courses; `admin@test.com` still sees all 50.

---

## Reset

```bash
git restore apps/dashboard/src/ supabase/migrations/
supabase db reset
pnpm seed:perf
# rebuild + restart dashboard
```

If the agent re-saved the baseline (it shouldn't, per the prompts), recapture a clean one from the reset state with `pnpm perf -- --save-baseline`.

---

## Hints

**Stop here unless your agent has been thrashing for 10+ min on a ticket, or you've finished and want to compare your diagnosis to the dry-run notes.** Opening these early replaces the workshop with a typing exercise.

<details>
<summary>Ticket #1 hint — Login is really slow</summary>

The fix is almost certainly one line. Three places worth looking:

- `apps/dashboard/src/app.html`
- `apps/dashboard/src/app.postcss`
- `apps/dashboard/src/routes/+layout.svelte`

The Lighthouse `network-requests` audit gives the diagnosis cleanly if you bucket the items by `resourceType` and `statusCode`. A request count in the high hundreds for a login form is suspicious. A large bucket of *failed* requests is more suspicious. If most failures share a domain not present in the CSP `font-src`, you've found it.

Dry-run impact: cold LCP 5464ms → 2326ms (-57%), cold request count 613 → 131 (-79%), warm Lighthouse score 63 → 100.

</details>

<details>
<summary>Ticket #2 hint — mylearning loop</summary>

The bug spans three files; the fix is ~2 lines.

Start with the probe to confirm the cadence (~1.1s between reloads — debounce + roundtrips). Then trace what happens when a student session starts:

- `apps/dashboard/src/routes/+layout.svelte` — `onMount`, around the Supabase `onAuthStateChange` listener (~lines 79–111). What runs on `INITIAL_SESSION`?
- That handler calls `getProfileDebounced`. Follow it to its definition in `apps/dashboard/src/lib/utils/functions/appSetup.ts` (`getProfile`).
- Inside `getProfile`, the `else if (profileData)` branch has four sibling redirect paths. Three of them gate the actual `goto(...)` behind a function called `shouldRedirectOnAuth(path)`. One doesn't.
- The ungated path uses `window.location.replace(...)` in prod — a full page reload that wipes every Svelte store. That's why it loops instead of just misdirecting once.

Fix: wrap the ungated branch in `if (shouldRedirectOnAuth(path)) { ... }`. The login redirect still works because `path` is `''` right after auth, and the gate returns `true` for `''`.

Dry-run impact: probe settles on `/lms/mylearning`; Lighthouse LCP goes from null/PAGE_HUNG/0 to ~3100ms / score 75. This also unblocks ticket #3.

</details>

<details>
<summary>Ticket #3 hint — Courses fetch doesn't scale</summary>

The slow call: `apps/dashboard/src/lib/utils/services/courses/index.ts → fetchCourses` calls RPC `get_courses` and then applies `.match({ member_profile_id: profileId })`. That `.match()` is a *server-side PostgREST filter* — but it runs after Postgres has already scanned every active course in the org and computed three correlated subqueries per row.

The function is defined in `supabase/migrations/*update_get_courses*.sql`. Notice it has *no* join on `groupmember` in the `FROM` clause — `member_profile_id` comes from a correlated subquery. That's why the PostgREST filter works at all, and why it's doing all the work upfront.

Two viable approaches:

1. Rewrite `get_courses` in a new migration so it always filters in the join. Riskier — the admin path currently expects all courses regardless of caller.
2. Add a sibling function `get_courses_for_member` that joins on `groupmember.profile_id = profile_id_arg`. Route to it from `fetchCourses` when `get(isOrgAdmin)` is false. Admin path keeps its existing shape.

The dry-run pick is option 2.

Dry-run impact (perf-student-1, perf seed): rows 53 → 8, buffers 2,394 → 1,230, 10× hot-path bench 6.2ms → 1.1ms (~5.6× faster). Lighthouse barely moves on `/lms/mylearning` because the fetch isn't on the LCP critical path — explain that in your report rather than pretending it did.

</details>

---

## When you finish early

Try a 4th ticket with no prep at all — pick any other route in `perf/routes.json` and ask the agent: *"This feels slow under our perf seed. See what you can find."* No hints in this file for it. That's the real test of whether the gate-driven workflow holds up when nobody has already teed up a known answer.
