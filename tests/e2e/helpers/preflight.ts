import http from 'node:http';

const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173/login' },
  { name: 'API', url: 'http://localhost:3002' },
  { name: 'Supabase API', url: 'http://localhost:54321' },
];

/** Max time to wait for all services to become ready (ms) */
const WARMUP_TIMEOUT = 120_000;
/** Delay between retries (ms) */
const RETRY_INTERVAL = 3_000;

function check(url: string): Promise<{ ok: boolean; body: string }> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 10_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode !== undefined && res.statusCode < 500, body });
      });
    });
    req.on('error', () => resolve({ ok: false, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, body: '' }); });
  });
}

async function waitForService(svc: { name: string; url: string }, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    const { ok } = await check(svc.url);
    if (ok) return;
    console.log(`  Waiting for ${svc.name} (${svc.url})...`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  throw new Error(`${svc.name} (${svc.url}) did not become ready within timeout`);
}

/** Poll the login page until Vite has compiled and the email input is in the SSR/hydrated HTML. */
async function warmupDashboard(deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    const { ok, body } = await check('http://localhost:5173/login');
    if (ok && body.includes('you@domain.com')) return;
    console.log('  Waiting for Dashboard to finish compiling...');
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  throw new Error('Dashboard login page did not finish compiling within timeout');
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

  // Wait for all services, then do a render-level warmup for the dashboard
  await Promise.all(SERVICES.map((svc) => waitForService(svc, deadline)));
  await warmupDashboard(deadline);
  console.log('Pre-flight: all services ready.');
}
