import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './reset-db';

const AUTH_TAGS = ['@auth-admin', '@auth-student', '@auth-teacher', '@no-auth'] as const;

export const test = base.extend<{ storageState: string | { cookies: []; origins: [] } }>({
  storageState: async ({ $tags, storageState }, use) => {
    if (!($tags as string[]).some((t) => (AUTH_TAGS as readonly string[]).includes(t))) {
      throw new Error(`Scenario missing required auth tag. Add one of: ${AUTH_TAGS.join(', ')}`);
    }
    if (($tags as string[]).includes('@auth-admin')) storageState = '.auth/admin.json';
    if (($tags as string[]).includes('@auth-student')) storageState = '.auth/student.json';
    if (($tags as string[]).includes('@auth-teacher')) storageState = '.auth/teacher.json';
    if (($tags as string[]).includes('@no-auth')) storageState = { cookies: [], origins: [] };
    await use(storageState);
  },
});

export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

BeforeScenario(async () => {
  await resetTestData();
});
