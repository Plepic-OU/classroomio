import { test as base, createBdd } from 'playwright-bdd';

// Extend base test with shared fixtures here (e.g., authenticated page state).
export const test = base.extend({});
export const { Given, When, Then } = createBdd(test);
