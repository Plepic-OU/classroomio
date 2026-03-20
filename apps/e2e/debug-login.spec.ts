import { test, expect } from '@playwright/test';

test('debug - wait for hydration', async ({ page }) => {
  const authCalls: string[] = [];
  page.on('request', req => {
    if (req.url().includes('auth/v1')) authCalls.push(req.method() + ' ' + req.url());
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait until SvelteKit has fully hydrated - detect by waiting for a client-side only store effect
  // The supabase client initialization triggers requests, so wait for network to settle
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000); // extra time for SvelteKit JS execution + supabase init
  
  console.log('[test] URL before fill:', page.url());
  
  // Use placeholder selectors (more reliable than label for this component)
  await page.locator('input[placeholder="you@domain.com"]').fill('admin@test.com');
  await page.locator('input[placeholder="************"]').fill('123456');
  
  const emailVal = await page.locator('input[placeholder="you@domain.com"]').inputValue();
  console.log('[test] email after fill:', emailVal);
  
  // Wait for button to be enabled and click
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.waitFor({ state: 'visible' });
  console.log('[test] clicking submit button...');
  await submitBtn.click();
  
  await page.waitForTimeout(8000);
  console.log('[test] URL after 8s:', page.url());
  console.log('[test] Auth calls:', authCalls);
});
