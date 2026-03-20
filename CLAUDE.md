# ClassroomIO

## E2E Tests

**Stack:** playwright-bdd (Gherkin features) + @playwright/test + Supabase JS client

### Prerequisites

Services must be running before tests — they are NOT auto-started:

```bash
supabase start           # database (ports 54321-54324)
pnpm dev:container       # dashboard (5173) + api (3002) + website (5174)
```

### Running Tests

```bash
pnpm e2e                 # headless run (single command, from repo root)
pnpm e2e:ui              # interactive UI mode → http://localhost:9323
pnpm e2e:report          # open HTML report  → http://localhost:9400
```

Tests fail fast if Dashboard or Supabase are unreachable (preflight check in global setup).

### File Structure

```
e2e/
├── features/            # Gherkin .feature files (human-readable specs)
├── steps/               # Step definitions + fixtures.ts (Playwright test bindings)
├── support/
│   ├── auth.ts          # Programmatic Supabase login (creates test user/org if needed)
│   ├── cleanup.ts       # Deletes test data (courses matching "BDD Test%")
│   └── global-setup.ts  # Preflight service check + data reset before suite
├── playwright.config.ts # Config: traces/video/screenshots always on, 10s timeouts
└── .features-gen/       # Auto-generated spec files (gitignored)
```

### Writing New Tests

1. Add a `.feature` file in `e2e/features/`
2. Add matching `.steps.ts` in `e2e/steps/` — import `Given/When/Then` from `./fixtures`
3. Use `data-testid` attributes for selectors (add to components if missing)
4. For authenticated scenarios, use `Given I am logged in as an instructor` (programmatic auth via localStorage injection, not UI login)
5. Prefix test data with `BDD Test` so cleanup catches it
6. Run `pnpm e2e` to verify

### Config Highlights

- **Videos, screenshots, traces:** always captured (even on success) in `e2e/test-results/`
- **Timeouts:** 10s max for actions, navigation, and expect assertions
- **Data reset:** global setup truncates test data before each run
- **No auto-start:** tests expect services to already be running
- **Ports:** UI mode on 9323, HTML report on 9400 (both bound to 0.0.0.0 for devcontainer access)
