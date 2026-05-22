import { createBdd } from 'playwright-bdd';
import { resetTestData } from './reset-db';
import { seedDb } from './seed-db';

const { BeforeScenario } = createBdd();

// Give the hook 30s. execSync blocks the event loop, so this JS timeout cannot interrupt
// a hung docker exec — the 25 s OS-level timeout in each execSync call is the real guard.
BeforeScenario({ timeout: 30_000 }, async () => {
  await resetTestData();
  await seedDb();
});
