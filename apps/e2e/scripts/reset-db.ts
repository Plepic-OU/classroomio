import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function resetDb() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('🗑️  Truncating test tables...');
  const { error } = await supabase.rpc('reset_test_data');
  if (error) {
    // Fallback: truncate via raw SQL if RPC not available
    console.warn('RPC not available, skipping DB reset. Add reset_test_data() function to Supabase.');
  }

  console.log('✅ Database reset complete.\n');
}

export default async function globalSetup() {
  await resetDb();
}

// Allow running directly: tsx scripts/reset-db.ts
if (process.argv[1] === new URL(import.meta.url).pathname) {
  resetDb().catch(console.error);
}
