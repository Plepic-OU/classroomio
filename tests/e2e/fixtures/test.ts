// Important: import `test as base` from playwright-bdd, NOT from @playwright/test.
// createBdd(test) only accepts a test extended from playwright-bdd's wrapper —
// passing the raw @playwright/test base errors with "createBdd() should use 'test' extended from
// 'playwright-bdd'". Verified via context7 (/vitalets/playwright-bdd) on 2026-05-22.
import { test as base, createBdd } from 'playwright-bdd';
import path from 'node:path';

// Tag-driven storageState fixture override.
// Design 2026-05-15 §3 (Auth) + §5 (fixtures/test.ts).
//
// Scenarios opt into a persona via a tag:
//   @persona-admin   — admin@test.com (also covers @persona-teacher; seeded as both)
//   @persona-student — student@test.com
//
// Sign-up / login / logout / boundary scenarios run **without** a tag (use === undefined)
// so they exercise the real unauthenticated flow.
//
// Storage-state JSON is produced by the `auth-setup` project (one-time UI login per persona)
// and lives in tests/e2e/.auth/<persona>.json (gitignored). Do NOT mutate these files mid-run.
// Generic `object` keeps strict typing when overwriting a built-in fixture (storageState).
// Per playwright-bdd docs on custom fixtures.
export const test = base.extend<object>({
  storageState: async ({}, use, testInfo) => {
    const tags = testInfo.tags ?? [];
    const authDir = path.resolve(__dirname, '..', '.auth');

    if (tags.includes('@persona-student')) {
      await use(path.join(authDir, 'student.json'));
    } else if (tags.includes('@persona-admin') || tags.includes('@persona-teacher')) {
      await use(path.join(authDir, 'admin.json'));
    } else {
      // Unauthenticated context — auth feature scenarios use this path.
      await use(undefined);
    }
  }
});

// Re-export the BDD bindings so step files use the same fixtured test.
// All `tests/e2e/steps/**/*.steps.ts` files must import { Given, When, Then } from this module
// (not from 'playwright-bdd' directly) so the storageState override applies.
export const { Given, When, Then, Before, After, BeforeWorker, AfterWorker } = createBdd(test);
