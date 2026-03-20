import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
  const supabaseURL = process.env.SUPABASE_URL ?? 'http://localhost:54321';

  // --- Fail fast: check required services are reachable ---
  for (const [name, url] of [['Dashboard', baseURL], ['Supabase', supabaseURL]] as const) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(`\n[globalSetup] ${name} is not reachable at ${url}`);
      console.error(`  Start it first, then re-run the tests.\n`);
      process.exit(1);
    }
  }

  // --- Fast data reset: truncate test-relevant tables then re-seed ---
  // Uses the Supabase CLI (must be installed and the local instance running).
  try {
    execSync('supabase db reset --local', { stdio: 'inherit' });
  } catch (err) {
    console.error('\n[globalSetup] supabase db reset failed — is the Supabase CLI installed?\n');
    process.exit(1);
  }
}

export default globalSetup;
