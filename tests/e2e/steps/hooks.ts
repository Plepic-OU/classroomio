import { BeforeAll } from '../fixtures';
import { resetTestData } from '../helpers/reset-db';

BeforeAll({ tags: '@resets-db' }, async () => {
  resetTestData();
});
