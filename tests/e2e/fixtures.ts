import { test as base, createBdd } from 'playwright-bdd';
import { resetTestData } from './helpers/reset-db';

export const test = base.extend<{ _dbReset: void }>({
  _dbReset: [
    async ({}, use) => {
      resetTestData();
      await use();
    },
    { auto: true, scope: 'test' },
  ],
});

export const { Given, When, Then, Before, After } = createBdd(test);
