import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// Seed user from supabase/seed.sql — admin@test.com
const TEST_USER_ID = '7ac00503-8519-43c8-a5ea-b79aeca900b1';
const TEST_USER_EMAIL = 'admin@test.com';
const TEST_USER_PASSWORD = 'TestPass123!';

// Seed org from supabase/seed.sql — Udemy Test
const TEST_ORG_SITENAME = 'udemy-test';

/**
 * Set a known password on the seed user so tests can sign in.
 * Called once during global setup after database reset + reseed.
 */
export async function prepareSeedUser() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.admin.updateUserById(TEST_USER_ID, {
    password: TEST_USER_PASSWORD,
  });
  if (error) {
    throw new Error(`Failed to set seed user password: ${error.message}`);
  }
}

/**
 * Sign in as the seed test user and return the session.
 */
export async function getTestUserSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return data.session;
}

export { TEST_USER_EMAIL, TEST_ORG_SITENAME };
