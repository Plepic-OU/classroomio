# Functional Test Coverage — ClassroomIO

Produce or update `docs/test-coverage.md` — a coverage map written from the perspective of **user-facing behaviours**,
not lines of code. Re-run whenever tests are added or removed.

---

## What "functional coverage" means here

Line/branch coverage tells you which code ran. Functional coverage tells you **which LMS features a human could actually
use** and whether any test would catch a regression in each one. A utility function tested 10 ways still leaves a login
flow completely unprotected.

The report answers two questions:

1. Which user-facing behaviours have at least one test?
2. Which feature domains have no tests at all?

---

## Feature Domains

These are the canonical functional areas for ClassroomIO. Every test maps to exactly one.

| Domain                    | What it covers                                                                                 |
|---------------------------|------------------------------------------------------------------------------------------------|
| **Auth & Profiles**       | Login, logout, signup, password reset, email verification, OAuth, profile edit                 |
| **Course Management**     | Create/edit/delete/publish/clone/price courses                                                 |
| **Lesson Management**     | Create/edit/delete lessons, sections, ordering, video, docs, live calls, locking, i18n content |
| **Exercise & Grading**    | Create exercises, question types, student submissions, teacher grading, AI grading, scoring    |
| **Student Experience**    | Course viewer, lesson progress, certificates, attendance, enrollment                           |
| **Organisation Admin**    | Create/configure org, invite members, roles, custom domain, customisation, settings            |
| **Community**             | Q&A questions/answers, course newsfeed posts/comments, reactions, votes                        |
| **Polls & Quizzes**       | Poll creation/submission, live quiz game sessions                                              |
| **Analytics**             | Attendance reports, lesson-completion rates, submission statistics                             |
| **Billing**               | Polar checkout, subscription activation/deactivation, plan gates                               |
| **Email & Notifications** | Invitation, submission-graded, enrollment, verification emails                                 |
| **API Endpoints**         | Hono routes — mail, course CRUD, file pre-sign, KaTeX rendering                                |
| **Core Utilities**        | Pure functions: date, string, UUID, validation helpers with no domain logic                    |

---

## How to Regenerate

### 1. Run the extractor

```bash
apps/api/node_modules/.bin/tsx .claude/skills/coverage/extract.ts
```

Writes `docs/c4/test-inventory.json` (gitignored).

### 2. Read the inventory

```bash
cat docs/c4/test-inventory.json
```

### 3. Build the coverage map

For each file in the inventory:

- Assign it to exactly one **Feature Domain** using the path and describe/test names as signals.
- Note how many tests it contains and what behaviour each tests (one phrase, not a copy of the test name).
- Note what the domain is **missing** — behaviours implied by the DB schema or routes that have no test.

Classifying edge cases:

- A utility function (date formatter, validator) that is *called by* a feature belongs in that feature's domain, not
  Core Utilities, **only if** it encodes domain logic (e.g. `isSubmissionEarly` → Exercise & Grading). Pure generic
  helpers (UUID, dedup) → Core Utilities.
- A Playwright test that exercises a UI flow belongs in the domain of the primary feature being exercised, not "E2E".

### 4. Write `docs/test-coverage.md`

Use the template below. Keep it compact — Claude should be able to hold the whole file in context.

```markdown
# Functional Test Coverage — ClassroomIO

> Generated: YYYY-MM-DD · N tests · N files · Jest (dashboard) + Playwright + Vitest (course-app)
> Re-generate: `apps/api/node_modules/.bin/tsx .claude/skills/coverage/extract.ts` then run /coverage

## Summary

| Domain | Status | Tests | Notes |
|--------|--------|-------|-------|
| Auth & Profiles | ⚠ utilities only | N | |

...

## Covered Behaviours

### Domain Name

- **`file.spec.ts`** (framework) — N tests
  - one-phrase behaviour description per test
  - …
  - *Gap:* uncovered behaviours in this domain

…

## Untested Domains

- **Domain** — what's missing
```

Status legend for the Summary table:

- `✓ unit` — unit tests cover core logic paths
- `✓ E2E` — end-to-end / integration tests
- `⚠ utilities only` — only pure-function helpers tested, no flow or integration coverage
- `✗ none` — zero tests

### 5. Update CLAUDE.md if not already linked

Add to the "Architecture maps" section:

```
Test coverage (functional): [docs/test-coverage.md](docs/test-coverage.md)
```

---

## Output File

`docs/test-coverage.md` — load on demand; link from CLAUDE.md.
