import { test as base, createBdd } from 'playwright-bdd';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_USERS } from './helpers/test-users';
import { loginAs } from './helpers/login';
import { isStorageStateFresh } from './helpers/auth-state';

type Role = keyof typeof TEST_USERS;
type WorkerStorageState = Record<Role, string>;

/**
 * Single shared `test` instance for all step defs. Centralizing it here (instead of each
 * steps/*.steps.ts file calling createBdd() locally) is what lets the workerStorageState
 * fixture below be reused across every feature without repeating the login flow.
 */
export const test = base.extend<{}, { workerStorageState: WorkerStorageState }>({
  workerStorageState: [
    async ({ browser }, use) => {
      // Cached in the source tree (not project.outputDir, which is wiped every run) so
      // repeated local runs skip two real UI logins — freshness is what keeps this safe,
      // not the file's location, since Supabase rotates refresh tokens.
      const authDir = path.resolve(__dirname, '.auth');
      fs.mkdirSync(authDir, { recursive: true });

      const states = {} as WorkerStorageState;
      const entries = Object.entries(TEST_USERS) as [Role, (typeof TEST_USERS)[Role]][];

      // Each role's login opens its own page/context, so they're independent — running
      // them concurrently roughly halves the cold-cache-build cost that's the whole reason
      // this fixture needs a larger-than-default setup timeout (below).
      await Promise.all(
        entries.map(async ([role, user]) => {
          const file = path.resolve(authDir, `${role}-${test.info().parallelIndex}.json`);

          if (isStorageStateFresh(file)) {
            states[role] = file;
            return;
          }

          const page = await browser.newPage({ storageState: undefined });
          await loginAs(page, user.email);
          await page.context().storageState({ path: file });
          await page.close();

          states[role] = file;
        })
      );

      await use(states);
    },
    // Building this cache cold (two real UI logins) can exceed the project's 10s
    // per-scenario timeout on the first test that touches it; a warm cache (see
    // isStorageStateFresh) makes every run after that fast again. Give only this
    // one-time setup its own larger budget rather than raising the shared default.
    { scope: 'worker', timeout: 30_000 }
  ]
});

export const { Given, When, Then, BeforeAll, AfterAll } = createBdd(test);
