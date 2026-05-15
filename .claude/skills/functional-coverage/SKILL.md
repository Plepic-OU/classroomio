# Functional Coverage Skill

Generate a functional test coverage report — coverage from the perspective of user-facing behaviour (pages, server routes, API endpoints), not lines of code.
Outputs to `docs/coverage/functional.md`.

## When this skill is invoked

Run the extractor script, then report the summary numbers and notable gaps.

---

## Step 1 — Ensure ts-morph is installed

```bash
node -e "require('ts-morph')" 2>/dev/null || pnpm add -w -D ts-morph tsx
```

## Step 2 — Run the extractor

```bash
npx tsx .claude/skills/functional-coverage/coverage.ts
```

The script:
- Walks `apps/dashboard/src/routes/` and finds all SvelteKit pages (`+page.svelte`) and internal server routes (`+server.ts`)
- Parses `apps/api/src/` with ts-morph to find all Hono endpoint registrations (`.get`, `.post`, `.put`, `.delete`, `.patch`), prefixing with the router's mount path where detectable
- Checks each route/endpoint for a co-located `*.test.ts` / `*.spec.ts` file
- Scans `cypress/` for `cy.visit()` calls and `cy.url().should('contain', ...)` assertions to detect e2e coverage
- Writes `docs/coverage/functional.md`

## Step 3 — Report to the user

After running, summarise:
- Coverage percentages per layer (pages / server routes / API endpoints)
- Most critical gaps (auth flows, data-mutation endpoints, etc.)
- Suggest: add E2E tests for critical pages first; unit tests for server routes and API endpoints
