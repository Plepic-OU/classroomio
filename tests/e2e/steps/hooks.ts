import { createBdd } from 'playwright-bdd';
import { resetTestData } from '../helpers/reset-db';

const { BeforeScenario } = createBdd();

BeforeScenario({ tags: '@write' }, async () => {
  resetTestData();
});
