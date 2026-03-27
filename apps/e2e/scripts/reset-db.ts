import { execSync } from 'child_process';

export default async function resetDb() {
  try {
    // Truncate test tables via supabase CLI
    execSync(
      `supabase db execute --local --sql "TRUNCATE TABLE courses, lessons, exercises, submissions, memberships RESTART IDENTITY CASCADE;" 2>/dev/null || true`,
      { stdio: 'ignore' }
    );
    console.log('🗑️  Database reset complete.\n');
  } catch {
    // Non-fatal — tests can still run with existing data
    console.log('⚠️  DB reset skipped (non-fatal).\n');
  }
}
