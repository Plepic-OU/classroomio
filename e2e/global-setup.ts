import { healthCheck } from './helpers/health-check';
import { resetDatabase } from './helpers/db-reset';

export default async function globalSetup(): Promise<void> {
  console.log('[e2e] Running health checks...');
  await healthCheck();
  console.log('[e2e] All services are up.');

  console.log('[e2e] Resetting database...');
  await resetDatabase();
  console.log('[e2e] Database reset complete.');
}
