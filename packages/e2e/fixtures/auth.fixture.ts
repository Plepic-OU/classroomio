import { test as base } from 'playwright-bdd';

export const test = base.extend<{ authenticatedPage: void }>({
  // The storageState is applied at the project level via playwright.config.ts,
  // so `page` is already authenticated in the 'tests' project.
  // This fixture file exists so defineBddConfig's importTestFrom has a target.
});
