import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'testuser@classroomio.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!';

const ORG_NAME = 'Test Organization';
const ORG_SITE_NAME = 'testorg';

// Safety: refuse to run against non-localhost Supabase
if (!SUPABASE_URL.includes('localhost') && !SUPABASE_URL.includes('127.0.0.1')) {
  console.error(`FATAL: SUPABASE_URL (${SUPABASE_URL}) is not localhost. Refusing to seed.`);
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log('Seeding test data...');

  // Find or create auth user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId: string;
  const existingUser = existingUsers?.users?.find((u) => u.email === TEST_USER_EMAIL);

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Found existing auth user: ${userId}`);
    // Update password in case it changed
    await supabase.auth.admin.updateUserById(userId, {
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error('Failed to create auth user:', authError?.message);
      process.exit(1);
    }
    userId = authData.user.id;
    console.log(`Created auth user: ${userId}`);
  }

  // Upsert profile with email verified
  const { error: profileError } = await supabase.from('profile').upsert({
    id: userId,
    email: TEST_USER_EMAIL,
    fullname: 'Test User',
    username: 'testuser',
    is_email_verified: true,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (profileError) {
    console.error('Failed to upsert profile:', profileError.message);
    process.exit(1);
  }
  console.log('Upserted profile');

  // Find or create organization
  let orgId: string;
  const { data: existingOrg } = await supabase
    .from('organization')
    .select('id')
    .eq('siteName', ORG_SITE_NAME)
    .single();

  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`Found existing organization: ${orgId}`);
  } else {
    const { data: orgData, error: orgError } = await supabase
      .from('organization')
      .insert({ name: ORG_NAME, siteName: ORG_SITE_NAME })
      .select('id')
      .single();

    if (orgError || !orgData) {
      console.error('Failed to create organization:', orgError?.message);
      process.exit(1);
    }
    orgId = orgData.id;
    console.log(`Created organization: ${orgId}`);
  }

  // Ensure organization member exists with Admin role (role_id = 1)
  const { data: existingMember } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .single();

  if (!existingMember) {
    const { error: memberError } = await supabase.from('organizationmember').insert({
      organization_id: orgId,
      profile_id: userId,
      role_id: 1,
    });

    if (memberError) {
      console.error('Failed to create org member:', memberError.message);
      process.exit(1);
    }
    console.log('Created organization member (Admin)');
  } else {
    console.log('Organization member already exists');
  }

  console.log('Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
