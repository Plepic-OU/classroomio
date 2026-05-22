import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

export const test = base.extend<{}>({
  storageState: async ({ $tags }, use, testInfo) => {
    if ($tags.includes('@noauth')) {
      await use({ cookies: [], origins: [] });
    } else {
      await use(testInfo.project.use.storageState);
    }
  },
});

export const { Given, When, Then, BeforeScenario, AfterScenario } = createBdd(test);

BeforeScenario({ tags: '@needs-reset' }, async () => resetTestData());
