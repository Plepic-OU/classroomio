import 'dotenv/config';

async function healthCheck(url: string, label: string, startHint: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    // Any HTTP response means the service is up (Supabase returns 404 on root)
    console.log(`  ✓ ${label} is running at ${url} (HTTP ${res.status})`);
  } catch {
    console.error(`\nFATAL: ${label} not running at ${url}`);
    console.error(`Start it with: ${startHint}\n`);
    process.exit(1);
  }
}

async function globalSetup() {
  console.log('Preflight checks...');
  await healthCheck('http://localhost:5173', 'Dashboard', 'pnpm dev:container');
  await healthCheck('http://localhost:54321', 'Supabase API', 'supabase start');

  console.log('Running seed script...');
  const { execSync } = await import('child_process');
  const seedCwd = import.meta.dirname ?? new URL('.', import.meta.url).pathname;
  execSync('npx tsx seed/test-users.ts', {
    cwd: seedCwd,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('Running waitlist seed script...');
  execSync('npx tsx seed/waitlist-courses.ts', {
    cwd: seedCwd,
    stdio: 'inherit',
    env: process.env,
  });
}

export default globalSetup;
