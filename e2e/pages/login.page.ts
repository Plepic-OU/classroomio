import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    // Wait for SvelteKit hydration — the theme attribute on <html> is set
    // by Carbon's <Theme> component which only renders after client-side hydration
    await this.page.locator('html[theme]').waitFor({ state: 'attached' });
  }

  async fillEmail(email: string) {
    await this.page.getByPlaceholder('you@domain.com').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByPlaceholder('************').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Log In' }).click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async expectDashboardRedirect() {
    await expect(this.page).toHaveURL(/\/org\/.+/);
  }

  async expectError() {
    await expect(this.page.locator('p.text-red-500')).toBeVisible();
  }
}
