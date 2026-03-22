import http from 'node:http';
import { resetAndReseed } from './reset-db';

const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173/login' },
  { name: 'API', url: 'http://localhost:3002' },
  { name: 'Supabase API', url: 'http://localhost:54321' },
];

/** Max time to wait for all services to become ready (ms) */
const WARMUP_TIMEOUT = 120_000;
/** Delay between retries (ms) */
const RETRY_INTERVAL = 3_000;

/**
 * Make a real HTTP GET and check for a non-error response.
 * This triggers Vite/SvelteKit compilation on first hit (warmup).
 */
function check(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 10_000 }, (res) => {
      // Consume the response body so the socket is freed
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForService(svc: { name: string; url: string }, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    if (await check(svc.url)) return;
    console.log(`  Waiting for ${svc.name} (${svc.url})...`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  throw new Error(`${svc.name} (${svc.url}) did not become ready within timeout`);
}

export default async function globalSetup() {
  console.log('Pre-flight: waiting for services to be ready...');
  const deadline = Date.now() + WARMUP_TIMEOUT;

  // Quick check — if nothing is reachable at all, fail fast
  const initial = await Promise.all(
    SERVICES.map(async (svc) => ({ ...svc, ok: await check(svc.url) }))
  );
  const missing = initial.filter((r) => !r.ok);

  if (missing.length === SERVICES.length) {
    const names = missing.map((m) => `  - ${m.name} (${m.url})`).join('\n');
    throw new Error(
      `E2E pre-flight failed. No services are reachable:\n${names}\n\n` +
        `Start them before running tests:\n` +
        `  supabase start\n` +
        `  pnpm dev:container`
    );
  }

  // Wait for all services (including Vite compilation warmup)
  await Promise.all(SERVICES.map((svc) => waitForService(svc, deadline)));
  console.log('Pre-flight: all services ready.');

  // Reset DB to clean state and re-seed before running tests
  resetAndReseed();
}
