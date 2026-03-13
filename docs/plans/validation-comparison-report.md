# Validation Comparison Report: BDD Playwright Design Document

> Generated: 2026-03-13
> Target document: `docs/plans/2026-03-13-bdd-playwright-setup-design.original.md`
> Comparison document: `docs/plans/2026-03-13-bdd-playwright-setup-design.md`
> Agents: claude-haiku-4-5 | claude-opus-4-6 | claude-sonnet-4-6

---

## 1. Agent Performance Cross-Table

| Metric | Haiku | Opus | Sonnet |
|---|---|---|---|
| **Model** | claude-haiku-4-5 | claude-opus-4-6 | claude-sonnet-4-6 |
| **Duration** | 89.8s | 113.9s | 339.5s |
| **Speed delta** | fastest | +26.8% slower | +278% slower |
| **Total tokens used** | 46,991 | 38,101 | 50,789 |
| **Token delta** | middle | fewest | most |
| **Tool uses** | 26 | 29 | 74 |
| **Overall verdict** | PASS WITH CAVEATS | FAIL | FAIL |

---

## 2. Issues Found Cross-Table

| Severity | Haiku count | Opus count | Sonnet count |
|---|---|---|---|
| **CRITICAL** | 1 | 1 | 2 |
| **MAJOR** | 3 | 4 | 8 |
| **MINOR** | 2 | 3 | 4 |
| **NOTE** | 2 | 3 | 3 |
| **TOTAL** | **8** | **11** | **17** |

---

## 3. Issue-by-Issue Comparison

| # | Issue | Haiku | Opus | Sonnet | Present in updated doc? |
|---|---|---|---|---|---|
| 1 | Wrong step import API (`Given` direct import vs `createBdd()`) | CRITICAL | CRITICAL | CRITICAL | Fixed — updated uses `createBdd()` |
| 2 | Missing `bddgen` generation step in npm scripts | — | — | CRITICAL | Fixed — updated uses `defineBddProject` which auto-generates |
| 3 | Login selectors (`getByLabel`) don't match TextField component | CRITICAL | MAJOR | MAJOR (×2) | Fixed — updated uses `locator('input[type=...]')` |
| 4 | Login button label `'Login'` vs actual `'Log In'` | (merged into #3) | MAJOR | MAJOR | Fixed — updated uses `'Log In'` |
| 5 | Course creation flow missing multi-step modal (type selector + Next + Finish) | MAJOR | MAJOR | MAJOR (×2) | Fixed — updated adds `I select a course type` step + "Finish" |
| 6 | Course page URL `/courses` doesn't include org slug | MAJOR | MAJOR | MAJOR | Fixed — updated uses sidebar nav link + `waitForURL('**/org/**/courses')` |
| 7 | Button label `'New Course'` vs actual `'Create Course'` | (merged into #5) | (merged) | MAJOR | Fixed — updated uses `'Create Course'` |
| 8 | Submit button `'Create'` vs actual `'Finish'` | MAJOR | (merged into #5) | MAJOR | Fixed — updated uses `'Finish'` |
| 9 | Post-login redirect goes to `/org/[slug]`, not `/home` | — | NOTE | MAJOR | Fixed — updated uses `**/org/**` |
| 10 | `defineBddConfig` deprecated in playwright-bdd v7 | — | MINOR | — | Fixed — updated uses `defineBddProject` |
| 11 | `common.steps.ts` empty / missing `'I am logged in as a teacher'` step | MAJOR | MINOR | MINOR | Fixed — updated merges into `login.steps.ts` |
| 12 | devcontainer.json uses invalid JSON ellipsis syntax | MAJOR | — | NOTE | Not fixed — updated doc still uses `[..., 9323]` |
| 13 | No `.gitignore` for `.features-gen/` and `node_modules/` | NOTE | NOTE | MINOR | Fixed — updated adds `.gitignore` note |
| 14 | No test data isolation / cleanup strategy | MINOR | NOTE | NOTE | Fixed — updated adds `After` cleanup hook + `.env` |
| 15 | `npm install` in a pnpm monorepo (toolchain inconsistency) | — | MINOR | MINOR | Fixed — updated uses `pnpm install` |
| 16 | Version constraint too loose / outdated (`^7.0.0`) | MINOR | — | MINOR (×2) | Partially — updated bumps to `^8.0.0` |
| 17 | `baseURL` hardcoded, no env var override | NOTE | — | — | Not fixed — still hardcoded |
| 18 | Existing Cypress suite not acknowledged | — | — | NOTE | Not addressed |

---

## 4. What Each Agent Caught (Exclusive)

| Issue | Haiku only | Opus only | Sonnet only |
|---|---|---|---|
| devcontainer JSON ellipsis syntax invalid | ✓ | | |
| `baseURL` env var override missing | ✓ | | |
| `defineBddConfig` deprecated | | ✓ | |
| Missing `bddgen` step in scripts | | | ✓ |
| Login label text `'Your email'` / `'Your password'` (i18n exact values) | | | ✓ |
| Existing Cypress suite not acknowledged | | | ✓ |
| Outdated `@playwright/test` version (`^1.44.0`) | | | ✓ |

---

## 5. Original vs Updated Document — What Changed

| Section | Original | Updated | Driven by validation finding? |
|---|---|---|---|
| **Maturity tag** | (none) | `> Maturity: MVP` | No — editorial |
| **Versions** | playwright-bdd `^7.0.0`, @playwright/test `^1.44.0` | `^8.0.0`, `^1.45.0` | Yes — API fix |
| **playwright.config.ts** | `defineBddConfig()` + top-level `testDir` | `defineBddProject()` inside `projects[]` | Yes — issue #10 |
| **Directory structure** | 3 step files incl. `common.steps.ts` | 2 step files; shared step merged into `login.steps.ts` | Yes — issue #11 |
| **Step imports** | `import { Given } from 'playwright-bdd'` | `import { createBdd } from 'playwright-bdd'` | Yes — issue #1 |
| **Login selectors** | `getByLabel('Email')` | `locator('input[type="email"]')` | Yes — issue #3 |
| **Login button label** | `'Login'` | `'Log In'` | Yes — issue #4 |
| **Login redirect assertion** | `waitForURL('**/home')` | `waitForURL('**/org/**')` | Yes — issue #9 |
| **Course creation button** | `'New Course'` | `'Create Course'` | Yes — issue #7 |
| **Course creation scenario** | 4 steps (no type selector) | 6 steps (adds type + description) | Yes — issue #5 |
| **Course creation button labels** | `'Create'` | `'Next'` + `'Finish'` | Yes — issue #8 |
| **Courses nav** | `page.goto('/courses')` | sidebar nav link click + `waitForURL('**/org/**/courses')` | Yes — issue #6 |
| **Running tests toolchain** | `npm install` / `npm test` | `pnpm install` / `pnpm test` | Yes — issue #15 |
| **Playwright install** | `npx playwright install chromium` | `pnpm exec playwright install --with-deps chromium` | Yes — completeness |
| **devcontainer rebuild note** | (none) | "A devcontainer rebuild is required" | Editorial |
| **After cleanup hook** | (none) | `After` hook deletes test course via Supabase REST | Yes — issue #14 |
| **`.env` for anon key** | (none) | `SUPABASE_ANON_KEY` + `dotenv` config | Yes — issue #14 |
| **appSetup.ts critical note** | (none) | Warning about dev-only login bypass | New finding (not in any agent) |
| **`createBdd()` fixture scope note** | (none) | Explains `createBdd(test)` for custom fixtures | New finding |
| **.gitignore note** | (none) | `.features-gen/` + `node_modules/` | Yes — issue #13 |
| **setup.sh instruction** | (none) | `cd tests/e2e && pnpm install` in devcontainer | New finding |
| **Success criteria** | (none) | Explicit pass criteria for fresh env | Editorial |

---

## 6. Issues Still Not Addressed in Updated Doc

| Issue | Flagged by | Status |
|---|---|---|
| devcontainer JSON ellipsis (`[..., 9323]`) still invalid JSON | Haiku, Sonnet | **Open** — still present in updated doc |
| `baseURL` hardcoded (no `PLAYWRIGHT_BASE_URL` env var) | Haiku | **Open** — still hardcoded |
| Version caret still present (`^8.0.0` vs pinned) | Haiku, Sonnet | **Open** — acceptable tradeoff |
| Existing Cypress suite not acknowledged | Sonnet | **Open** — not addressed |
| `@playwright/test` still not on latest (`^1.45.0` vs `^1.58.0`) | Sonnet | **Open** — minor but noted |

---

## 7. Verdict Summary

| Dimension | Haiku | Opus | Sonnet |
|---|---|---|---|
| **Verdict on original** | PASS WITH CAVEATS | FAIL | FAIL |
| **Blocking issues (CRITICAL+MAJOR)** | 4 | 5 | 10 |
| **Unique valid issues found** | 2 | 4 | 7 |
| **False positives** | Low | Low | Low |
| **Depth of analysis** | Surface-level | Deep API + routing | Deepest — actual i18n values, bddgen step, Cypress coexistence |
| **Token efficiency** | Middle (46k / 8 issues = 5.9k/issue) | Best (38k / 11 issues = 3.5k/issue) | Lowest (51k / 17 issues = 3.0k/issue) |
| **Speed** | Fastest (89.8s) | Middle (113.9s) | Slowest (339.5s) |
| **Tool uses** | 26 | 29 | 74 |
| **Recommended for** | Fast first-pass review | Thorough pre-implementation sign-off | Deep audit with codebase access |
