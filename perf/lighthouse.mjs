#!/usr/bin/env node
/**
 * perf/lighthouse.mjs — Lighthouse performance gate.
 *
 * Runs Lighthouse (desktop preset, SIMULATED throttling) against the routes in
 * routes.json under the production build, writes the full report per route,
 * aggregates a deterministic summary, compares to perf/baseline.json, and exits
 * non-zero on regression.
 *
 * Flags:  --save-baseline  (write baseline.json, exit 0)
 *         --no-gate        (measure + print, always exit 0)
 *
 * Exit:  0 pass / --save-baseline / --no-gate / no baseline
 *        1 gated regression
 *        2 harness error (server unreachable or wrong app, Chrome crash, login fail)
 *
 * Env:   PERF_BASE_URL    (default http://localhost:3000)
 *        PERF_CHROME_PATH (optional Chrome binary override)
 *
 * Design: docs/plans/2026-05-28-perf-harness-design.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = (process.env.PERF_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const RESULTS_DIR = path.join(__dirname, 'results');
const BASELINE_PATH = path.join(__dirname, 'baseline.json');
const ROUTES_PATH = path.join(__dirname, 'routes.json');

const SAVE_BASELINE = process.argv.includes('--save-baseline');
const NO_GATE = process.argv.includes('--no-gate');

// Gate thresholds (design §6).
const JS_BYTES_TOLERANCE = 0.01; // +1%
const LCP_ABS_MS = 100; // +100ms…
const LCP_PCT = 0.05; // …or +5%, whichever is larger

// Login landing patterns per persona (mirrors tests/e2e helpers).
const LANDING = { admin: /\/org\//, student: /\/lms(\/|$|\?)/ };
const LOGIN_PATH_RE = /^\/login\/?$/;

// Lighthouse error codes that mean "the page didn't stabilise" (Chrome alive) —
// recorded as runtimeError, not a harness crash.
const PAGE_RUNTIME_CODES = new Set([
  'PAGE_HUNG',
  'NO_FCP',
  'NO_DOCUMENT_REQUEST',
  'ERRORED_DOCUMENT_REQUEST',
  'FAILED_DOCUMENT_REQUEST',
  'INSECURE_DOCUMENT_REQUEST',
  'TARGET_MISSING'
]);

class HarnessError extends Error {}

// --- Lighthouse config: desktop + simulated throttling (design §§2–3) --------
const LH_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    onlyCategories: ['performance'],
    // Keep injected localStorage auth across the run; we clear the HTTP cache
    // ourselves via CDP (design §4) so loads are still cold.
    disableStorageReset: true
  }
};

// --- helpers -----------------------------------------------------------------
function loadRoutes() {
  const spec = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf-8'));
  return {
    users: spec.users || {},
    routes: spec.routes.map((r) =>
      typeof r === 'string' ? { path: r, as: null } : { path: r.path, as: r.as || null }
    )
  };
}

function sanitizePath(p) {
  const s = p
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'root';
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19);
}

function resolveChromePath() {
  const fromEnv = process.env.PERF_CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  try {
    const pw = chromium.executablePath();
    if (pw && fs.existsSync(pw)) return pw;
  } catch {
    /* fall through to chrome-launcher discovery */
  }
  return undefined; // chrome-launcher default discovery (system Chrome)
}

async function preflight() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/login`, { redirect: 'follow' });
  } catch (e) {
    throw new HarnessError(
      `Cannot reach ${BASE_URL} (${e.message}). Start the production build first — see perf/README.md.`
    );
  }
  if (res.status >= 500) {
    throw new HarnessError(
      `${BASE_URL}/login returned ${res.status}. Is the production build healthy?`
    );
  }
  const body = await res.text();
  // The login form is client-rendered, so we can't match on form markup. The SSR
  // shell, though, injects the dashboard's PUBLIC_SUPABASE_URL env and loads the
  // clsrio Carbon stylesheet — neither appears in the docs app (also :3000).
  const looksLikeDashboard =
    body.includes('PUBLIC_SUPABASE_URL') || body.includes('assets.cdn.clsrio.com');
  if (!looksLikeDashboard) {
    throw new HarnessError(
      `${BASE_URL} is reachable but does not look like the dashboard (no Supabase/Carbon shell marker). ` +
        `The docs app also defaults to :3000 — stop it and serve the dashboard build. See perf/README.md.`
    );
  }
}

// --- auth (design §4) --------------------------------------------------------
/**
 * Capture a persona's Supabase localStorage session by doing a fresh UI login in
 * a PRISTINE, throwaway Playwright browser — mirrors tests/e2e/fixtures/storage-state.ts.
 * A dedicated browser per persona avoids a prior session lingering and bouncing
 * /login → /logout in a reused instance. The captured token is portable to the
 * Lighthouse Chrome (same origin → same `sb-localhost-auth-token` key).
 */
async function captureToken(persona, user) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Hydration: inputs render as type=text until Svelte hydrates them.
    await page.locator('input[type="email"]').waitFor({ timeout: 30_000 });
    await page.getByPlaceholder('you@domain.com').fill(user.email);
    await page.getByPlaceholder('************').fill(user.password);
    await page
      .getByRole('button', { name: /log\s*in/i })
      .first()
      .click();
    await page.waitForURL(LANDING[persona] ?? /.*/, { timeout: 30_000 });
    const entries = await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^sb-.*-auth-token/.test(k)) out[k] = localStorage.getItem(k);
      }
      return out;
    });
    if (!Object.keys(entries).length) {
      throw new HarnessError(
        `Login as "${persona}" (${user.email}) captured no Supabase session token.`
      );
    }
    return entries;
  } catch (e) {
    if (e instanceof HarnessError) throw e;
    throw new HarnessError(`Login as "${persona}" (${user.email}) failed: ${e.message}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Reset browser storage + HTTP cache, then inject the persona token (or none). */
async function resetAndInject(context, tokenEntries) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.evaluate((entries) => {
      localStorage.clear();
      localStorage.setItem('umami.disabled', '1');
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    }, tokenEntries || {});
    // Clear HTTP cache LAST so the control-page load above doesn't leave warm
    // assets (design §4). Network.clearBrowserCache leaves localStorage intact.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.clearBrowserCache');
    await cdp.detach();
  } finally {
    await page.close();
  }
}

// --- measurement -------------------------------------------------------------
function emptyMetrics(runtimeError, finalUrl = null) {
  return {
    score: null,
    lcpMs: null,
    tbtMs: null,
    fcpMs: null,
    cls: null,
    jsBytes: null,
    totalBytes: null,
    runtimeError,
    finalUrl
  };
}

function extract(lhr) {
  const rt = lhr.runtimeError?.code ?? null;
  const finalUrl = lhr.finalDisplayedUrl || lhr.finalUrl || null;
  if (rt) return emptyMetrics(rt, finalUrl);

  const a = lhr.audits || {};
  const num = (k) => a[k]?.numericValue ?? null;
  const items = a['network-requests']?.details?.items ?? [];
  const jsBytes = items
    .filter((i) => i.resourceType === 'Script')
    .reduce((s, i) => s + (i.transferSize || 0), 0);
  const totalBytes = items.reduce((s, i) => s + (i.transferSize || 0), 0);
  const rawScore = lhr.categories?.performance?.score;
  return {
    score: rawScore != null ? Math.round(rawScore * 100) : null,
    lcpMs: num('largest-contentful-paint'),
    tbtMs: num('total-blocking-time'),
    fcpMs: num('first-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    jsBytes: items.length ? jsBytes : null,
    totalBytes: items.length ? totalBytes : null,
    runtimeError: null,
    finalUrl
  };
}

async function measureRoute(port, route) {
  const url = `${BASE_URL}${route.path}`;
  const flags = { port, logLevel: 'error', output: 'json' };
  let lhr;
  try {
    const result = await lighthouse(url, flags, LH_CONFIG);
    if (!result || !result.lhr) {
      throw new HarnessError(`Lighthouse returned no report for ${url} (Chrome may have crashed).`);
    }
    lhr = result.lhr;
  } catch (err) {
    if (err instanceof HarnessError) throw err;
    // Did Lighthouse hand back a page-level runtime error? Chrome is alive → record.
    const code = err?.code || err?.lhr?.runtimeError?.code;
    if (code && PAGE_RUNTIME_CODES.has(code)) {
      lhr = { runtimeError: { code }, finalDisplayedUrl: url, audits: {} };
    } else {
      // No usable report → treat as a harness/Chrome failure (exit 2).
      throw new HarnessError(`Lighthouse failed on ${url}: ${err?.message || err}`);
    }
  }

  // Persist the full report.
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${timestamp()}--${sanitizePath(route.path)}.json`);
  fs.writeFileSync(file, JSON.stringify(lhr));

  const metrics = extract(lhr);
  if (metrics.runtimeError)
    console.log(`    runtimeError ${metrics.runtimeError} (recorded, continuing)`);

  // Session-lost check (design §7): authed route landed on /login with no
  // runtimeError → the injected session didn't survive → harness error.
  if (route.as && !metrics.runtimeError && metrics.finalUrl) {
    let landedOnLogin = false;
    try {
      const p = new URL(metrics.finalUrl).pathname.replace(/\/+$/, '') || '/';
      landedOnLogin = LOGIN_PATH_RE.test(p);
    } catch {
      /* odd finalUrl — skip the check */
    }
    if (landedOnLogin) {
      throw new HarnessError(
        `Authed route ${route.path} (as ${route.as}) ended on /login — session was not preserved.`
      );
    }
  }

  return { path: route.path, as: route.as, ...metrics, resultFile: path.relative(__dirname, file) };
}

// --- gate (design §6) --------------------------------------------------------
function gate(cur, base) {
  if (!base) return [];
  const reasons = [];
  if (base.jsBytes != null && cur.jsBytes != null) {
    const d = (cur.jsBytes - base.jsBytes) / base.jsBytes;
    if (d > JS_BYTES_TOLERANCE) reasons.push(`JS bytes +${(d * 100).toFixed(2)}% (> +1%)`);
  }
  if (base.lcpMs != null && cur.lcpMs != null) {
    const delta = cur.lcpMs - base.lcpMs;
    const allowed = Math.max(LCP_ABS_MS, LCP_PCT * base.lcpMs);
    if (delta > allowed)
      reasons.push(`LCP +${delta.toFixed(0)}ms (> max(100ms, 5%) = ${allowed.toFixed(0)}ms)`);
  }
  if (base.lcpMs != null && cur.lcpMs == null) {
    reasons.push(`crash: LCP null but baseline had ${base.lcpMs.toFixed(0)}ms`);
  }
  return reasons;
}

// --- reporting ---------------------------------------------------------------
const fmtMs = (v) => (v == null ? '—' : `${v.toFixed(0)}ms`);
const fmtCls = (v) => (v == null ? '—' : v.toFixed(3));
const fmtKb = (v) => (v == null ? '—' : `${(v / 1024).toFixed(1)}kB`);
const fmtScore = (v) => (v == null ? '—' : String(v));

function delta(cur, base, fmt, kind = 'num') {
  if (base == null || cur == null) return '';
  if (kind === 'bytes' || kind === 'ms' || kind === 'num') {
    const d = cur - base;
    const sign = d > 0 ? '+' : '';
    if (kind === 'bytes') return ` (${sign}${((d / base) * 100).toFixed(1)}%)`;
    return ` (${sign}${fmt(d).replace('ms', 'ms')})`;
  }
  return '';
}

function printTable(rows, baseByKey, hasBaseline) {
  const key = (r) => `${r.path}|${r.as || ''}`;
  console.log('');
  for (const r of rows) {
    const b = hasBaseline ? baseByKey.get(key(r)) : null;
    const tag = r.runtimeError ? `  ⚠ ${r.runtimeError}` : '';
    const newTag = hasBaseline && !b ? '  (new)' : '';
    console.log(`▸ ${r.path}${r.as ? ` [${r.as}]` : ''}${tag}${newTag}`);
    const line = (label, cur, base, fmt, kind) =>
      `    ${label.padEnd(12)} ${String(fmt(cur)).padStart(9)}${b ? delta(cur, base, fmt, kind) : ''}`;
    console.log(line('score', r.score, b?.score, fmtScore, 'num'));
    console.log(line('LCP', r.lcpMs, b?.lcpMs, fmtMs, 'ms') + '   [gated]');
    console.log(line('TBT', r.tbtMs, b?.tbtMs, fmtMs, 'ms'));
    console.log(line('FCP', r.fcpMs, b?.fcpMs, fmtMs, 'ms'));
    console.log(line('CLS', r.cls, b?.cls, fmtCls, 'num'));
    console.log(line('JS bytes', r.jsBytes, b?.jsBytes, fmtKb, 'bytes') + '   [gated]');
    console.log(line('total bytes', r.totalBytes, b?.totalBytes, fmtKb, 'bytes'));
  }
  console.log('');
}

// --- main --------------------------------------------------------------------
async function run() {
  const { users, routes } = loadRoutes();
  console.log(`Perf harness → ${BASE_URL}  (${routes.length} routes)`);
  if (SAVE_BASELINE) console.log('Mode: --save-baseline');
  else if (NO_GATE) console.log('Mode: --no-gate');

  await preflight();

  const chromePath = resolveChromePath();
  console.log(`Chrome: ${chromePath || 'chrome-launcher default discovery'}`);
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${chrome.port}`);
    const context = browser.contexts()[0];

    // 1. Log in each persona referenced by an `as` route (fresh, on perf origin).
    const personas = [...new Set(routes.map((r) => r.as).filter(Boolean))];
    const tokens = {};
    for (const persona of personas) {
      const user = users[persona];
      if (!user)
        throw new HarnessError(`routes.json references persona "${persona}" with no users entry.`);
      console.log(`Logging in: ${persona} (${user.email})`);
      tokens[persona] = await captureToken(persona, user);
    }

    // 2. Measure each route serially (shared Chrome → must be serial).
    const rows = [];
    for (const route of routes) {
      console.log(`Measuring ${route.path}${route.as ? ` [${route.as}]` : ''}…`);
      await resetAndInject(context, route.as ? tokens[route.as] : null);
      rows.push(await measureRoute(chrome.port, route));
    }

    // 3. Baseline / gate.
    const summary = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, routes: rows };

    if (SAVE_BASELINE) {
      fs.writeFileSync(BASELINE_PATH, JSON.stringify(summary, null, 2));
      printTable(rows, new Map(), false);
      console.log(
        `✔ Baseline written to ${path.relative(process.cwd(), BASELINE_PATH)} (${rows.length} routes).`
      );
      return 0;
    }

    const hasBaseline = fs.existsSync(BASELINE_PATH);
    if (!hasBaseline) {
      printTable(rows, new Map(), false);
      console.log(
        'No perf/baseline.json — run `pnpm perf -- --save-baseline` to create one. Nothing to gate.'
      );
      return 0;
    }

    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
    const baseByKey = new Map(baseline.routes.map((r) => [`${r.path}|${r.as || ''}`, r]));
    printTable(rows, baseByKey, true);

    const regressions = [];
    for (const r of rows) {
      const reasons = gate(r, baseByKey.get(`${r.path}|${r.as || ''}`));
      for (const reason of reasons) regressions.push({ route: r.path, as: r.as, reason });
    }

    if (regressions.length) {
      console.log('✖ Regressions:');
      for (const x of regressions)
        console.log(`  - ${x.route}${x.as ? ` [${x.as}]` : ''}: ${x.reason}`);
    } else {
      console.log('✔ No regressions.');
    }

    if (NO_GATE) {
      if (regressions.length) console.log('(--no-gate: not failing despite regressions)');
      return 0;
    }
    return regressions.length ? 1 : 0;
  } finally {
    // Cleanup must never throw — a throw here would mask the real error and the
    // exit code. chrome.kill() may return void rather than a Promise.
    try {
      if (browser) await browser.close();
    } catch {
      /* ignore */
    }
    try {
      await Promise.resolve(chrome.kill());
    } catch {
      /* ignore */
    }
  }
}

run()
  .then((code) => process.exit(code))
  .catch((e) => {
    if (e instanceof HarnessError) {
      console.error(`\n✖ Harness error: ${e.message}\n`);
    } else {
      console.error(`\n✖ Unexpected harness failure:\n${e?.stack || e}\n`);
    }
    process.exit(2);
  });
