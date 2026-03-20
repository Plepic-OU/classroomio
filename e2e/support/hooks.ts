import { Before, After, BeforeAll, AfterAll, Status, setDefaultTimeout } from '@cucumber/cucumber';

// 10s step timeout per acceptance criteria
setDefaultTimeout(10_000);
import { PlaywrightWorld } from './world';
import { resetDatabase } from './db-reset';
import * as fs from 'fs';
import * as path from 'path';

// Ensure test-results directories exist
BeforeAll(function () {
  console.log('[e2e] Preparing test environment...');
  const dirs = ['e2e/test-results', 'e2e/test-results/videos', 'e2e/test-results/screenshots'];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log('[e2e] Test results directories ready.');
});

// Reset database and open browser before each scenario
Before(async function (this: PlaywrightWorld, { pickle }) {
  console.log(`[e2e] Scenario: ${pickle.name}`);
  await resetDatabase();
  console.log('[e2e] Opening browser...');
  await this.openBrowser();
});

// Capture screenshot and close browser after each scenario
After(async function (this: PlaywrightWorld, { result, pickle }) {
  if (this.page) {
    // Always take a screenshot (pass or fail)
    const screenshotName = pickle.name.replace(/[^a-zA-Z0-9]/g, '_');
    const status = result?.status === Status.PASSED ? 'passed' : 'failed';
    const screenshotPath = path.join(
      'e2e/test-results/screenshots',
      `${screenshotName}_${status}.png`
    );

    try {
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[e2e] Screenshot saved: ${screenshotPath}`);
    } catch {
      // Page may have already been closed
    }
  }

  await this.closeBrowser();
  const statusText = result?.status === Status.PASSED ? 'PASSED' : 'FAILED';
  console.log(`[e2e] Scenario ${statusText}: ${pickle.name}`);
});
