import { BeforeAll } from '../fixtures';
import { resetTestData } from '../helpers/reset-db';

// Fires at most ONCE per worker process, not once per @resets-db-tagged file: playwright-bdd
// registers this as a single hook object and guards it with `hook.executed` (dist/hooks/
// worker.js), so only the first tagged file to run in a worker actually gets a reset — every
// other @resets-db file after it runs against whatever that first file left behind. This is
// why @resets-db-tagged scenarios must use unique entity names (see course-creation.steps.ts,
// lessons.steps.ts) rather than assuming a fresh table each time. Raising `workers` above 1
// wouldn't give each file its own reset either — see helpers/reset-db.ts's own comment.
BeforeAll({ tags: '@resets-db' }, async () => {
  resetTestData();
});
