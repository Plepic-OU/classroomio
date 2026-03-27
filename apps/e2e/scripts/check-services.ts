async function checkService(name: string, url: string): Promise<void> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok && res.status !== 304) throw new Error(`HTTP ${res.status}`);
  } catch (err: unknown) {
    const e = err as { name?: string; code?: string; cause?: { code?: string } };
    if (e?.name !== 'AbortError' && e?.code !== 'ECONNREFUSED' && e?.cause?.code !== 'ECONNREFUSED') {
      throw err; // re-throw HTTP errors (e.g. 500) — server is up but broken
    }
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
  await checkService('Supabase', 'http://localhost:54321/rest/v1/');
  console.log('✅ All services are running.\n');
}

// Allow running directly: tsx scripts/check-services.ts
// Uses require.main check (works in both CJS and tsx-compiled contexts)
if (require.main === module) {
  globalSetup();
}
