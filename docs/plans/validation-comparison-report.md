# Validation Comparison Report: BDD Playwright Design Document

> Generated: 2026-03-13
> Target document: `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
> Comparison document: `docs/plans/2026-03-13-bdd-playwright-setup-design.md`

---

## 1. Agent Performance Cross-Table

| Metric | Haiku | Opus |
|---|---|---|
| **Model** | claude-haiku-4-5 | claude-opus-4-6 |
| **Duration** | 89.8s | 113.9s |
| **Speed delta** | baseline (faster) | +26.8% slower |
| **Total tokens used** | 46,991 | 38,101 |
| **Token delta** | +23.3% more tokens | baseline (fewer) |
| **Tool uses** | 26 | 29 |
| **Overall verdict** | PASS WITH CAVEATS | FAIL |

---

## 2. Issues Found Cross-Table

| Severity | Haiku count | Opus count | Overlap? |
|---|---|---|---|
| **CRITICAL** | 1 | 1 | Yes — both flagged wrong step import API |
| **MAJOR** | 3 | 4 | Partial — see detail below |
| **MINOR** | 2 | 3 | Partial |
| **NOTE** | 2 | 3 | Partial |
| **TOTAL** | **8** | **11** | |

---

## 3. Issue-by-Issue Comparison

| # | Issue | Haiku | Opus | Present in updated doc? |
|---|---|---|---|---|
| 1 | Wrong step import API (`Given` direct import vs `createBdd()`) | CRITICAL | CRITICAL | Fixed — updated uses `createBdd()` |
| 2 | Login selectors (`getByLabel`) don't match TextField component | CRITICAL | MAJOR | Fixed — updated uses `locator('input[type=...]')` |
| 3 | Login button label `'Login'` vs actual `'Log In'` | (merged into #2) | MAJOR | Fixed — updated uses `'Log In'` |
| 4 | Course creation flow missing multi-step modal (type selector + Next + Finish) | MAJOR | MAJOR | Fixed — updated adds `I select a course type` step + "Finish" |
| 5 | Course page URL `/courses` doesn't include org slug | MAJOR | MAJOR | Fixed — updated uses sidebar nav link + `waitForURL('**/org/**/courses')` |
| 6 | `defineBddConfig` deprecated in playwright-bdd v7 | (not flagged) | MINOR | Fixed — updated uses `defineBddProject` |
| 7 | `common.steps.ts` empty / missing `'I am logged in as a teacher'` step | MAJOR | MINOR | Fixed — updated merges into `login.steps.ts` |
| 8 | devcontainer.json uses invalid JSON ellipsis syntax | MAJOR | (not flagged) | Not fixed — updated doc still uses `[..., 9323]` |
| 9 | No `.gitignore` for `.features-gen/` and `node_modules/` | NOTE | NOTE | Fixed — updated adds `.gitignore` note |
| 10 | No test data isolation / cleanup strategy | MINOR | NOTE | Fixed — updated adds `After` cleanup hook + `.env` for anon key |
| 11 | `npm install` in a pnpm monorepo (toolchain inconsistency) | (not flagged) | MINOR | Fixed — updated uses `pnpm install` |
| 12 | Post-login redirect URL may not be `/home` | (not flagged) | NOTE | Fixed — updated uses `**/org/**` |
| 13 | Version constraint too loose (`^7.0.0`) | MINOR | (not flagged) | Partially fixed — updated bumps to `^8.0.0` (caret still present) |
| 14 | `baseURL` hardcoded, no env var override | NOTE | (not flagged) | Not fixed — updated doc still hardcodes `localhost:5173` |

---

## 4. What Each Agent Caught (Exclusive)

| Issue | Caught only by Haiku | Caught only by Opus |
|---|---|---|
| devcontainer JSON ellipsis syntax invalid | ✓ | |
| `baseURL` env var override missing | ✓ | |
| `defineBddConfig` deprecated | | ✓ |
| Org-scoped URL (`/org/[slug]/courses`) | | ✓ |
| Login button label wrong (`'Login'` vs `'Log In'`) | | ✓ (as separate issue) |
| Post-login redirect to `**/home` may be wrong | | ✓ |

---

## 5. Original vs Updated Document — What Changed

| Section | Original | Updated | Driven by validation finding? |
|---|---|---|---|
| **Maturity tag** | (none) | `> Maturity: MVP` | No — editorial |
| **Versions** | playwright-bdd `^7.0.0`, @playwright/test `^1.44.0` | `^8.0.0`, `^1.45.0` | Yes — API fix |
| **playwright.config.ts** | `defineBddConfig()` + top-level `testDir` | `defineBddProject()` inside `projects[]` | Yes — issue #6 |
| **Directory structure** | 3 step files incl. `common.steps.ts` | 2 step files; shared step merged into `login.steps.ts` | Yes — issue #7 |
| **Step imports** | `import { Given } from 'playwright-bdd'` | `import { createBdd } from 'playwright-bdd'` | Yes — issue #1 |
| **Login selectors** | `getByLabel('Email')` | `locator('input[type="email"]')` | Yes — issue #2 |
| **Login button label** | `'Login'` | `'Log In'` | Yes — issue #3 |
| **Login redirect assertion** | `waitForURL('**/home')` | `waitForURL('**/org/**')` | Yes — issue #12 |
| **Course creation button** | `'New Course'` | `'Create Course'` | Yes — issue #4 |
| **Course creation scenario** | 4 steps (no type selector) | 6 steps (adds type + description) | Yes — issue #4 |
| **Course creation button labels** | `'Create'` | `'Next'` + `'Finish'` | Yes — issue #4 |
| **Courses nav** | `page.goto('/courses')` | sidebar nav link click + `waitForURL('**/org/**/courses')` | Yes — issue #5 |
| **Running tests toolchain** | `npm install` / `npm test` | `pnpm install` / `pnpm test` | Yes — issue #11 |
| **Playwright install** | `npx playwright install chromium` | `pnpm exec playwright install --with-deps chromium` | Yes — completeness |
| **devcontainer rebuild note** | (none) | "A devcontainer rebuild is required" | Editorial |
| **After cleanup hook** | (none) | `After` hook deletes test course via Supabase REST | Yes — issue #10 |
| **`.env` for anon key** | (none) | `SUPABASE_ANON_KEY` + `dotenv` config | Yes — issue #10 |
| **appSetup.ts critical note** | (none) | Warning about dev-only login bypass | New finding not in either agent |
| **`createBdd()` fixture scope note** | (none) | Explains `createBdd(test)` for custom fixtures | New finding |
| **.gitignore note** | (none) | `.features-gen/` + `node_modules/` | Yes — issue #9 |
| **setup.sh instruction** | (none) | `cd tests/e2e && pnpm install` in devcontainer | New finding |
| **Success criteria** | (none) | Explicit pass criteria for fresh env | Editorial |

---

## 6. Issues Still Not Addressed in Updated Doc

| Issue | Flagged by | Status |
|---|---|---|
| devcontainer JSON ellipsis (`[..., 9323]`) still invalid JSON | Haiku only | **Open** — still present in updated doc |
| `baseURL` hardcoded (no `PLAYWRIGHT_BASE_URL` env var) | Haiku only | **Open** — still hardcoded |
| Version caret still present (`^8.0.0` vs pinned) | Haiku (as minor) | **Open** — acceptable tradeoff |

---

## 7. Verdict Summary

| Dimension | Haiku | Opus |
|---|---|---|
| **Verdict on original** | PASS WITH CAVEATS | FAIL |
| **Blocking issues identified** | 4 (marked CRITICAL/MAJOR) | 5 (marked CRITICAL/MAJOR) |
| **Unique valid issues found** | 2 (devcontainer JSON, baseURL) | 4 (defineBddConfig, org URL, button label, redirect) |
| **False positives** | Low — all issues confirmed valid | Low — all issues confirmed valid |
| **Depth of analysis** | Good — caught format/config issues | Better — deeper API and routing knowledge |
| **Token efficiency** | Lower (46k tokens, 8 issues) | Higher (38k tokens, 11 issues) |
| **Speed** | Faster (89.8s) | Slower (113.9s) |
| **Recommended for** | Fast first-pass review | Thorough pre-implementation sign-off |
