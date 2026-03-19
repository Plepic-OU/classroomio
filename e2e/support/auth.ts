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

const TEST_USER_EMAIL = 'test-e2e@classroomio.com';
const TEST_USER_PASSWORD = 'TestPass123!';
const TEST_ORG_NAME = 'BDD Test Org';
const TEST_ORG_SITENAME = 'bdd-test-org';

async function ensureTestUserExists() {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase.auth.admin.listUsers();
  let user = existing?.users?.find((u) => u.email === TEST_USER_EMAIL);

  if (!user) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    user = created.user;
  }

  return user;
}

async function ensureProfileExists(userId: string) {
  const supabase = getSupabaseClient();

  const { data: profile } = await supabase
    .from('profile')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) {
    const { error } = await supabase.from('profile').insert({
      id: userId,
      username: `test-e2e-${Date.now()}`,
      fullname: 'E2E Test User',
      email: TEST_USER_EMAIL,
      is_email_verified: true,
    });
    if (error) console.warn(`Profile seed warning: ${error.message}`);
  }
}

async function ensureOrgExists(userId: string) {
  const supabase = getSupabaseClient();

  // Check if org already exists
  const { data: existingOrg } = await supabase
    .from('organization')
    .select('id')
    .eq('siteName', TEST_ORG_SITENAME)
    .single();

  let orgId: string;

  if (existingOrg) {
    orgId = existingOrg.id;
  } else {
    const { data: newOrg, error } = await supabase
      .from('organization')
      .insert({ name: TEST_ORG_NAME, siteName: TEST_ORG_SITENAME })
      .select('id')
      .single();
    if (error) {
      console.warn(`Org seed warning: ${error.message}`);
      return;
    }
    orgId = newOrg.id;
  }

  // Ensure membership exists
  const { data: existingMember } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .single();

  if (!existingMember) {
    const { error } = await supabase.from('organizationmember').insert({
      organization_id: orgId,
      profile_id: userId,
      role_id: 1,
      verified: true,
    });
    if (error) console.warn(`Org member seed warning: ${error.message}`);
  }
}

export async function getTestUserSession() {
  const user = await ensureTestUserExists();
  await ensureProfileExists(user.id);
  await ensureOrgExists(user.id);

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
