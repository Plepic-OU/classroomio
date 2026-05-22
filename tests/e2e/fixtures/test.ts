/**
 * Central import surface for BDD fixtures, hooks, and step builders.
 *
 * Per design §3: every steps/*.steps.ts and fixtures/*.ts file imports
 * createBdd / Given / When / Then / BeforeScenario / AfterScenario from
 * here, NOT from playwright-bdd directly. This makes:
 *   - $tags-resolved storageState (auto-loads persona JSON by tag)
 *   - shared hooks (DB reset, hydration probe, AfterScenario triage)
 * available transparently to every scenario.
 *
 * playwright-bdd's bddgen guesses the test instance by walking step files,
 * so this file must be included in the BDD config's `steps` glob (set in
 * playwright.config.ts).
 */
import { test as base, createBdd } from 'playwright-bdd';
import { resolveStorageState } from './storage-state';

export const test = base.extend({
  storageState: async ({ $tags }, use, testInfo) => {
    const file = resolveStorageState($tags);
    if (file) {
      testInfo.annotations.push({ type: 'storageState', description: file });
    }
    await use(file);
  },
});

export const { Given, When, Then, Before, After, BeforeScenario, AfterScenario } =
  createBdd(test);
