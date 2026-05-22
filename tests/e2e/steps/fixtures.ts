import { test as base, createBdd } from 'playwright-bdd';
import type { World } from '../helpers/world';

type TestFixtures = {
  world: World;
};

export const test = base.extend<TestFixtures>({
  world: async ({}, use) => use({}),
});

export const { Given, When, Then, BeforeScenario } = createBdd(test);
