import { Given, goToOrgDashboard } from './fixtures';

Given('I am on the org dashboard', async ({ page }) => {
  await goToOrgDashboard(page);
});
