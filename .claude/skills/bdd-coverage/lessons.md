# bdd-coverage — lessons

Append-only diary written by the `/bdd-coverage` skill. Humans promote durable rules from here
into `SKILL.md` via PR review.

Format (per entry):

```
## YYYY-MM-DD — short title
Symptom: <what went wrong / surprised us>
Cause:   <root cause>
Fix:     <what we did>
Promoted to SKILL.md? <Yes (date)/No (one-off so far)>
```

---

## 2026-05-22 — `createBdd(test)` requires playwright-bdd's base test, not @playwright/test's
Symptom: `Error: createBdd() should use 'test' extended from "playwright-bdd"`.
Cause:   `import { test as base } from '@playwright/test'` produces a test whose extend
         chain is invisible to playwright-bdd. The wrapper test in `playwright-bdd` is required.
Fix:     `import { test as base, createBdd } from 'playwright-bdd'` in `fixtures/test.ts`.
         Pass `<object>` as the generic when overriding a built-in fixture (storageState).
Verified via context7 `/vitalets/playwright-bdd` on 2026-05-22.
Promoted to SKILL.md? Yes (2026-05-22, "Library cheatsheet" already references playwright-bdd's
own `test as base` via the auth section).

## 2026-05-22 — BDD config `steps` must include the fixtures file
Symptom: `Can't guess test instance for: features/.../*.feature. Your tests use custom test
         instance, produced by base.extend().`
Cause:   `defineBddConfig({ steps: 'steps/**/*.steps.ts' })` does not glob `fixtures/test.ts`,
         so playwright-bdd cannot discover the extended `test`.
Fix:     `steps: ['steps/**/*.steps.ts', 'fixtures/test.ts']` (or set `importTestFrom`).
Promoted to SKILL.md? No (one-off, captured in a comment inside `playwright.config.ts`).

## 2026-05-22 — Literal `/` in Gherkin steps is parsed as Cucumber alternative
Symptom: `Alternative may not be empty` at parse time for a step like
         `And I see a Sign Up link pointing at /signup`.
Cause:   Cucumber expression treats `/` as the alternative separator.
Fix:     Use a quoted parameter — `pointing at "/signup"` + `{string}` in the step text.
Promoted to SKILL.md? Yes (2026-05-22, "Library cheatsheet" → Cucumber expression gotcha).

## 2026-05-22 — playwright-bdd step args must use object destructuring
Symptom: `Error: First argument must use the object destructuring pattern: _ctx (...) => {...}`.
Cause:   playwright-bdd parses the first argument's destructuring pattern to know which fixtures
         to inject. A named placeholder like `_ctx` is rejected by `innerFixtureParameterNames`.
Fix:     Use `({}, expected: number) => {...}` even when no fixtures are needed.
Promoted to SKILL.md? Yes (2026-05-22, "Library cheatsheet" — first step arg must destructure).

## 2026-05-22 — Local mail server is Mailpit, not Inbucket
Symptom: Design refers to "Inbucket" at `:54324` with API `/api/v1/mailbox/<local-part>`.
         Actually `curl http://localhost:54324/api/v1/mailbox/admin` returns 404; the title
         tag on `/` is "Mailpit".
Cause:   Supabase shipped Mailpit (`public.ecr.aws/supabase/mailpit:v1.22.3`) but kept the
         `[inbucket]` config block name for backwards compatibility (`supabase/config.toml`).
Fix:     Use Mailpit's API instead — `GET /api/v1/messages` to list, or
         `GET /api/v1/search?query=to:<email>` to filter. Full message via
         `GET /api/v1/message/<ID>` (returns text + headers). No URL-encoding of local-part needed.
Promoted to SKILL.md? Yes (2026-05-22, project pointers — replace Inbucket with Mailpit).

## 2026-05-22 — Post-login landing differs by persona
Symptom: `page.waitForURL(/\/org\//)` worked for admin, timed out for student
         (student lands at `/lms`, no trailing slash, no path segment).
Cause:   Admin lands on `/org/<slug>/...`, student on `/lms` directly.
Fix:     Match either with a regex tolerant of trailing slash or path: `/\/(org|lms)(\/|$)/`.
Promoted to SKILL.md? No (one-off, captured in `helpers/login.ts`).
