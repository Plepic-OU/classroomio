import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Your email').fill(email);
    await this.page.getByLabel('Your password').fill(password);
    await this.page.getByRole('button', { name: 'Log In' }).click();
  }

  async expectDashboard() {
    await this.page.waitForURL('**/org/**');
  }
}
