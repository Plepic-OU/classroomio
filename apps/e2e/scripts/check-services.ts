async function checkService(name: string, url: string): Promise<void> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(`\n❌ ${name} is not running at ${url}`);
    if (name === 'Dashboard') {
      console.error('   Start it with: pnpm dev --filter=@cio/dashboard');
    } else {
      console.error('   Start it with: supabase start');
    }
    process.exit(1);
  }
}

export default async function globalSetup() {
  console.log('🔍 Checking required services...');
  await checkService('Dashboard', process.env.BASE_URL ?? 'http://localhost:5173');
  await checkService('Supabase', 'http://localhost:54321/health');
  console.log('✅ All services are running.\n');
}

// Allow running directly: tsx scripts/check-services.ts
globalSetup();
