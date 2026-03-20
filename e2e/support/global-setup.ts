import 'dotenv/config';
import { resetDatabase } from './cleanup';
import { prepareSeedUser } from './auth';

async function checkService(name: string, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    await fetch(url, { signal: controller.signal });
  } catch {
    throw new Error(`${name} is not reachable at ${url}`);
  } finally {
    clearTimeout(timeout);
  }
}

export default async function globalSetup() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';

  // 1. Preflight service checks
  console.log('\n🔍 Preflight: checking services...');

  const checks = [
    { name: 'Dashboard', url: baseUrl },
    { name: 'Supabase', url: `${supabaseUrl}/rest/v1/` },
  ];

  const results = await Promise.allSettled(
    checks.map(({ name, url }) => checkService(name, url))
  );

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? checks[i].name : null))
    .filter(Boolean);

  if (failures.length > 0) {
    console.error(`\n❌ Service(s) not reachable: ${failures.join(', ')}`);
    console.error('\nStart services before running E2E tests:');
    console.error('  pnpm dev:container  # dashboard + api');
    console.error('  supabase start      # database\n');
    process.exit(1);
  }

  console.log('✅ Services reachable\n');

  // 2. Truncate all public tables + reseed from seed.sql
  console.log('🗄️  Resetting database (truncate + reseed)...');
  const resetStart = Date.now();
  await resetDatabase();
  console.log(`✅ Database reset in ${Date.now() - resetStart}ms\n`);

  // 3. Set known password on seed user for test authentication
  console.log('🔑 Preparing seed user for authentication...');
  await prepareSeedUser();
  console.log('✅ Seed user ready\n');
}
