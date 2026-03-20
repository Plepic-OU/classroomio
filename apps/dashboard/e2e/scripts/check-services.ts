const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173' },
  { name: 'Supabase', url: 'http://localhost:54321/rest/v1/' },
];

const RETRIES = 10;
const RETRY_DELAY_MS = 3000;

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitForService(name: string, url: string): Promise<boolean> {
  for (let i = 1; i <= RETRIES; i++) {
    if (await isReachable(url)) return true;
    console.log(`⏳ Waiting for ${name} (${url}) — attempt ${i}/${RETRIES}...`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }
  return false;
}

async function checkServices() {
  const failures: string[] = [];
  for (const { name, url } of SERVICES) {
    const ok = await waitForService(name, url);
    if (!ok) failures.push(`${name} (${url})`);
  }
  if (failures.length) {
    console.error('\n❌ Required services are not running:\n');
    failures.forEach(f => console.error(`  • ${f}`));
    console.error(
      '\nStart them first (e.g. pnpm dev:container, supabase start), then re-run tests.\n'
    );
    process.exit(1);
  }
  console.log('✅ All required services are reachable.');
}

checkServices();
