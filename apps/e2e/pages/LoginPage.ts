import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    // Wait for Svelte to hydrate — the Supabase client fires INITIAL_SESSION
    // immediately on init, which triggers a profile request. That request
    // completing is our signal that the form's event handlers are attached.
    await this.page
      .waitForRequest((req) => req.url().includes('54321'), { timeout: 8000 })
      .catch(() => {}); // ignore if already logged in (no profile fetch)
    await this.page.getByLabel('Your email').waitFor();
  }

  async fillEmail(email: string) {
    await this.page.getByLabel('Your email').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByLabel('Your password').fill(password);
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click();
  }

  async errorMessage() {
    return this.page.locator('p.text-red-500').last();
  }
}
