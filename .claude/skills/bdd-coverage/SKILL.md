# BDD Coverage Skill

Generate, run, and extend BDD test coverage for ClassroomIO. Each invocation
runs a five-phase READ → ANALYSE → WRITE → RUN → DIFF loop, targets one gap,
and produces a diff for human review. Nothing is committed automatically.

---

## Phase 1 — READ

Scan all existing feature files and step definitions:

```bash
find tests/e2e/features -name "*.feature" | sort
find tests/e2e/steps    -name "*.steps.ts" | sort
```

Read every `.feature` file. Build a list of `(file, scenario-title)` pairs
that represent currently covered behaviour.

---

## Phase 2 — ANALYSE

Scan the dashboard route tree:

```bash
find apps/dashboard/src/routes -name "+page.svelte" | sort
```

Map each route to its wave using this static table:

```
Wave 1: /login  /signup  /logout
Wave 2: /org/[slug]/courses  /invite/s/[hash]  /invite/t/[hash]  /lms/explore
Wave 3: /courses/[id]/lessons  /courses/[id]/lessons/[...lessonParams]  /lms/mylearning
Wave 4: /lms/exercises  /courses/[id]/submissions  /courses/[id]/marks
```

Routes not in this table are out of scope — flag them in the diff summary but
do not write scenarios for them.

Diff the covered list against the table. Rank gaps by wave number ascending,
then alphabetically. Select the top gap as the target for this invocation.

If all in-scope routes are covered, report "Coverage complete for in-scope
routes" and stop.

---

## Phase 3 — WRITE

For the target gap:

1. Read the relevant `+page.svelte` source files to derive real selectors.
2. Write a `.feature` file to `tests/e2e/features/<domain>/<name>.feature`.
3. Write the matching `.steps.ts` to `tests/e2e/steps/<domain>/<name>.steps.ts`.

Do not stage or commit. Stop after writing these two files.

### Feature file rules

- One `Feature:` block per file, named after the domain directory.
- Scenario titles: `[Role] [action] [object]` — e.g. `Student accepts a course invite`.
- No `Background:` blocks — the global `Before` hook handles DB state.
- Use an explicit `Given I am logged in as "admin@test.com"` step in every
  scenario that requires auth.
- Use `Scenario Outline` + `Examples` only when there are 3+ data variants;
  otherwise plain `Scenario`.

### Step definition rules

Follow this exact template:

```typescript
import { createBdd } from 'playwright-bdd';
import { waitForHydration } from '../helpers/hydration';
import { loginAs } from '../helpers/login';

const { Given, When, Then } = createBdd();
```

Selector preference order (strict):
1. `getByRole`
2. `getByPlaceholder` / `getByLabel`
3. `getByText`
4. `[data-testid]` — last resort only

---

## Phase 4 — RUN

```bash
pnpm test:e2e 2>&1 | tee /tmp/e2e-run.txt; echo "EXIT:$?"
```

Read `/tmp/e2e-run.txt` in full after the command exits.

---

## Phase 5 — DIFF

### Classify each failure

| Class | Signal | Action |
|-------|--------|--------|
| Missing step | `bddgen: No steps found for "…"` | Write the step; re-run once |
| Broken selector | `TimeoutError: locator … not found` | Read target `+page.svelte`; fix locator |
| Wrong assertion | `expect(received).toBe(expected)` mismatch | Update the `Then` step; add quirk note |
| Hydration timeout | `TimeoutError` on `waitForHydration` | Increase per-step timeout; add quirk note |
| Real app bug | Failure persists after selector/assertion fix | Tag scenario `@known-failing`; note in summary |

### Write exactly three artefacts

1. **Proposed file changes on disk** — unstaged `.feature` and `.steps.ts` files.
2. **`/tmp/bdd-coverage-diff.md`** — human-readable summary: gap targeted,
   files written, test outcome, proposed fixes, learnings.
3. **Updated `## Known Quirks` section below** — append one line per new quirk.
   Never rewrite or delete existing entries.

---

## Known Quirks

- All pages: SvelteKit SSR renders inputs as `type="text"` until hydration; call `waitForHydration(page)` before any form interaction.
- All pages: `workers` must stay at `1` in `playwright.config.ts`; parallel execution breaks per-scenario DB reset safety.
