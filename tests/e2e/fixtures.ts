import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './helpers/reset-db';

type Ctx = { courseId?: string };

export const test = base.extend<{ ctx: Ctx }>({
  ctx: async ({}, use) => { await use({}); },
  storageState: async ({ $tags }, use) => {
    const state = $tags.includes('@noauth')
      ? { cookies: [], origins: [] }
      : $tags.includes('@student')
        ? 'tests/e2e/.auth/student.json'
        : $tags.includes('@teacher')
          ? 'tests/e2e/.auth/teacher.json'
          : 'tests/e2e/.auth/admin.json';
    await use(state);
  },
});

export const { Given, When, Then, Before, After } = createBdd(test);

Before(() => { resetTestData(); });
