import { test as base, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_ROLE!
);

type Fixtures = {
  authenticatedPage: Page;
  supabaseAdmin: SupabaseClient;
};

export const test = base.extend<Fixtures>({
  supabaseAdmin: async ({}, use) => {
    await use(supabaseAdmin);
  },

  // Auth state is loaded from auth-state.json (set by global-setup.ts).
  // No browser login needed — page is already authenticated.
  authenticatedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from '@playwright/test';
