import { execSync } from 'child_process';

export default async function resetDb() {
  try {
    console.log('🗑️  Resetting database...');
    console.log('   Running supabase db reset (migrations + seed)...');
    execSync('npx supabase db reset', { stdio: 'inherit' });
    console.log('   ✅ Database reset complete (migrations applied, seed data loaded).\n');
  } catch (err) {
    // Non-fatal — tests can still run with existing data
    console.log(`⚠️  DB reset failed (non-fatal): ${err}\n`);
  }
}
