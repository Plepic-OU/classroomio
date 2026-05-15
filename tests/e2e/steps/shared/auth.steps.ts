import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given } = createBdd();

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});
