import { BeforeScenario } from './fixtures';
import { resetTestData } from '../helpers/reset-db';

BeforeScenario(async () => {
  await resetTestData();
});
