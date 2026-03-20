import 'dotenv/config';
import { deleteTestCourses } from './cleanup';

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

  console.log('✅ Services reachable — cleaning test data...');
  await deleteTestCourses();
  console.log('✅ Test data reset complete');
}
