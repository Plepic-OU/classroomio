/**
 * Per-persona storageState precompute + tag-driven load.
 *
 * Design refs:
 *   §2 — Storage-state precompute, atomic write, embedded _capturedAt
 *   §2 — Hardcoded 30-min TTL (half of Supabase jwt_expiry = 3600)
 *   §2 — Cache check reads embedded timestamp, not filesystem mtime
 *        (9p/gRPC-FUSE mounts can round or lag mtime).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type StorageState } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-users';
import { waitForHydration } from '../helpers/hydration';

const AUTH_DIR = path.resolve(__dirname, '..', '.auth');
const TTL_MS = 30 * 60 * 1000; // 30 min — see §2

type Persona = 'admin' | 'student';

type StoredState = StorageState & { _capturedAt?: number };

export function authFile(persona: Persona): string {
  return path.join(AUTH_DIR, `${persona}.json`);
}

export function isFresh(file: string, now: number = Date.now()): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredState;
    const ts = data._capturedAt;
    if (typeof ts !== 'number') return false;
    return now - ts < TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Atomic write: write to .tmp then rename. Per §2, a crashed precompute must
 * never leave a half-written file for a worker to consume.
 */
function writeAtomic(file: string, state: StoredState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

async function uiLogin(context: BrowserContext, persona: Persona, baseURL: string): Promise<void> {
  const user = TEST_USERS[persona];
  // Admin lands on /org/<slug>/...; student lands on /lms.
  const landingPattern = persona === 'admin' ? /\/org\// : /\/lms(\/|$)/;
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  await waitForHydration(page);
  await page.getByPlaceholder('you@domain.com').fill(user.email);
  await page.getByPlaceholder('************').fill(user.password);
  await page.getByRole('button', { name: /log\s*in/i }).first().click();
  await page.waitForURL(landingPattern, { timeout: 30_000 });
  await page.close();
}

/**
 * Precompute storage state for one persona if its file is stale or missing.
 * Returns the file path either way.
 */
export async function precomputePersona(persona: Persona, baseURL: string): Promise<string> {
  const file = authFile(persona);
  if (isFresh(file)) return file;

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  try {
    await uiLogin(context, persona, baseURL);
    const state = await context.storageState();
    writeAtomic(file, { ...state, _capturedAt: Date.now() });
  } finally {
    await context.close();
    await browser.close();
  }
  return file;
}

/**
 * Precompute all known personas in parallel. Called from globalSetup.
 */
export async function precomputeAll(baseURL: string): Promise<void> {
  const personas: Persona[] = ['admin', 'student'];
  await Promise.all(personas.map((p) => precomputePersona(p, baseURL)));
}

/**
 * Tag → persona resolution used by the storageState fixture in fixtures/test.ts.
 * @noauth (or no auth tag) → no storage state.
 * @auth:admin / @auth:student → the precomputed persona file.
 */
export function resolveStorageState(tags: string[]): string | undefined {
  if (tags.includes('@noauth')) return undefined;
  if (tags.includes('@auth:admin')) return authFile('admin');
  if (tags.includes('@auth:student')) return authFile('student');
  return undefined;
}
