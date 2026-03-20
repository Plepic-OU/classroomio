import { World, setWorldConstructor, IWorldOptions } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export const BROWSER_TIMEOUT = 10_000;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export class PlaywrightWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  baseUrl = BASE_URL;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async openBrowser(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      baseURL: this.baseUrl,
      recordVideo: { dir: 'e2e/test-results/videos/' },
      viewport: { width: 1280, height: 720 },
    });
    this.context.setDefaultTimeout(BROWSER_TIMEOUT);
    this.page = await this.context.newPage();
  }

  /**
   * Navigate to a path and wait for SvelteKit hydration to complete.
   * Detects hydration by waiting for the page to have no `data-sveltekit-hydrate`
   * attribute (removed after hydration) or by confirming an interactive element is ready.
   *
   * Prefer this over page.goto() + waitForTimeout() for reliable, fast tests.
   */
  async navigateAndWaitForHydration(path: string): Promise<void> {
    await this.page.goto(path);
    // SvelteKit removes the data-sveltekit-hydrate attribute after hydration.
    // Wait for it to be absent, or fall back to networkidle if attribute not present.
    try {
      await this.page.waitForFunction(
        () => !document.querySelector('[data-sveltekit-hydrate]'),
        { timeout: BROWSER_TIMEOUT }
      );
    } catch {
      // Older SvelteKit versions may not use this attribute — networkidle as fallback
      await this.page.waitForLoadState('networkidle');
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}

setWorldConstructor(PlaywrightWorld);
