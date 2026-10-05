import http from 'node:http';
import net from 'node:net';
import { chromium } from '@playwright/test';
import { loginAs } from './login';
import { TEST_USERS } from './test-users';

const DASHBOARD_URL = 'http://localhost:5173';

type Service = { name: string; kind: 'http'; url: string } | { name: string; kind: 'tcp'; host: string; port: number };

const SERVICES: Service[] = [
  { name: 'Dashboard', kind: 'http', url: `${DASHBOARD_URL}/login` },
  { name: 'API', kind: 'http', url: 'http://localhost:3002' },
  { name: 'Postgres', kind: 'tcp', host: 'localhost', port: 5432 },
  { name: 'Redis', kind: 'tcp', host: 'localhost', port: 6379 }
];

/** Max time to wait for all services to become ready (ms) */
const WARMUP_TIMEOUT = 120_000;
/** Delay between retries (ms) */
const RETRY_INTERVAL = 3_000;

function describe(svc: Service): string {
  return svc.kind === 'http' ? svc.url : `${svc.host}:${svc.port}`;
}

/**
 * Make a real HTTP GET and check for a non-error response.
 * This triggers Vite/SvelteKit compilation on first hit (warmup).
 */
function checkHttp(url: string): Promise<boolean> {
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

/** Check that something accepts TCP connections on host:port. */
function checkTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 5_000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function check(svc: Service): Promise<boolean> {
  return svc.kind === 'http' ? checkHttp(svc.url) : checkTcp(svc.host, svc.port);
}

async function waitForService(svc: Service, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    if (await check(svc)) return;
    console.log(`  Waiting for ${svc.name} (${describe(svc)})...`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  throw new Error(`${svc.name} (${describe(svc)}) did not become ready within timeout`);
}

/**
 * Load the pages the scenarios use once in a real browser before the tests run. On a fresh
 * checkout the Vite dev server only compiles client modules on first request, and the first
 * client-side load also makes it discover and pre-bundle more dependencies and then force a full
 * page reload ("optimized dependencies changed. reloading") — which would otherwise land in the
 * middle of the first scenario. Later runs hit the warm caches and this takes a few seconds.
 */
async function warmUpBrowserRoutes() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: DASHBOARD_URL });
    page.setDefaultTimeout(WARMUP_TIMEOUT);
    for (let pass = 0; pass < 2; pass++) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
    }
    await loginAs(page, DASHBOARD_URL, TEST_USERS.admin.email);
    await page.waitForLoadState('networkidle');
    await page.getByTestId('org-nav-courses').click();
    await page.waitForURL(/\/courses/);
    await page.waitForLoadState('networkidle');
    // The course-creation scenario ends on a /courses/<id> page, which is also compiled on first
    // visit. Open a seeded course once so that compile does not land inside the scenario.
    await page.locator('a[href^="/courses/"]').first().click();
    await page.waitForURL(/\/courses\/[0-9a-f-]{36}/);
    await page.waitForLoadState('networkidle');
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  console.log('Pre-flight: waiting for services to be ready...');
  const deadline = Date.now() + WARMUP_TIMEOUT;

  // Quick check — if nothing is reachable at all, fail fast
  const initial = await Promise.all(SERVICES.map(async (svc) => ({ ...svc, ok: await check(svc) })));
  const missing = initial.filter((r) => !r.ok);

  if (missing.length === SERVICES.length) {
    const names = missing.map((m) => `  - ${m.name} (${describe(m)})`).join('\n');
    throw new Error(
      `E2E pre-flight failed. No services are reachable:\n${names}\n\n` +
        `Start them before running tests:\n` +
        `  bash .devcontainer/start-infra.sh   # Postgres + Redis\n` +
        `  pnpm dev:container                  # API + dashboard`
    );
  }

  // Wait for all services (including Vite compilation warmup)
  await Promise.all(SERVICES.map((svc) => waitForService(svc, deadline)));
  console.log('Pre-flight: all services ready. Warming up dashboard routes in the browser...');
  await warmUpBrowserRoutes();
  console.log('Pre-flight: warm-up done.');
}
