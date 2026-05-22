#!/usr/bin/env node
/**
 * Lighthouse performance harness for the ClassroomIO dashboard.
 * Measures against the production build (adapter-node) only.
 * See perf/README.md for the required build/serve sequence.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAVE_BASELINE = process.argv.includes('--save-baseline');
const NO_GATE       = process.argv.includes('--no-gate');
const BASE_URL      = (process.env.PERF_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const ROUTES_PATH  = resolve(__dirname, 'routes.json');
const BASELINE_PATH = resolve(__dirname, 'baseline.json');
const RESULTS_DIR  = resolve(__dirname, 'results');

// Gate thresholds — both conditions must hold to be a regression.
const JS_FACTOR   = 1.05;   // +5 %
const JS_ABS      = 50_000; // +50 kB
const LCP_MS      = 100;    // +100 ms
const LCP_FACTOR  = 1.05;   // +5 %

// Lighthouse throttling: simulated desktop with modest network.
const THROTTLE = {
  rttMs: 40,
  throughputKbps: 10240,
  cpuSlowdownMultiplier: 1,
  requestLatencyMs: 0,
  downloadThroughputKbps: 0,
  uploadThroughputKbps: 0,
};

// ── Harness error (exit 2) ────────────────────────────────────────────────

class HarnessError extends Error {}

// ── Chrome path resolution ────────────────────────────────────────────────

async function resolveChromePath() {
  if (process.env.PERF_CHROME_PATH) return process.env.PERF_CHROME_PATH;
  try {
    const { chromium } = await import('playwright-core');
    const p = chromium.executablePath();
    if (existsSync(p)) return p;
    console.warn('Warning: playwright-core Chromium not at expected path; falling back to system Chrome.');
  } catch {
    console.warn('Warning: playwright-core not importable; falling back to system Chrome.');
  }
  return undefined; // chrome-launcher will detect system Chrome
}

// ── Lighthouse runner ─────────────────────────────────────────────────────

async function runLighthouse(url, port) {
  const { default: lighthouse } = await import('lighthouse');
  return lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    // Always true: we clear HTTP cache via CDP ourselves; this preserves
    // the Supabase localStorage session for authenticated routes.
    disableStorageReset: true,
  }, {
    extends: 'lighthouse:default',
    settings: {
      preset: 'desktop',
      throttlingMethod: 'simulate',
      throttling: THROTTLE,
    },
  });
}

// ── Metric extraction ─────────────────────────────────────────────────────

function extractMetrics(lhr) {
  if (!lhr) return nullMetrics('HARNESS_ERROR');

  const runtimeError = lhr.runtimeError?.code ?? null;
  const lcpRaw = lhr.audits?.['largest-contentful-paint']?.numericValue;
  const lcp = lcpRaw != null && lcpRaw > 0 ? Math.round(lcpRaw) : null;

  if (runtimeError || lcp == null) return nullMetrics(runtimeError ?? 'NULL_LCP');

  const items = lhr.audits?.['network-requests']?.details?.items ?? [];
  const jsBytes    = items.filter(i => i.resourceType === 'Script').reduce((s, i) => s + (i.transferSize ?? 0), 0);
  const totalBytes = items.reduce((s, i) => s + (i.transferSize ?? 0), 0);

  return {
    score:      lhr.categories?.performance?.score != null ? Math.round(lhr.categories.performance.score * 100) : null,
    lcp,
    tbt:        Math.round(lhr.audits?.['total-blocking-time']?.numericValue ?? 0),
    fcp:        Math.round(lhr.audits?.['first-contentful-paint']?.numericValue ?? 0),
    cls:        +(lhr.audits?.['cumulative-layout-shift']?.numericValue ?? 0).toFixed(4),
    jsBytes,
    totalBytes,
    runtimeError: null,
  };
}

function nullMetrics(error) {
  return { score: null, lcp: null, tbt: null, fcp: null, cls: null, jsBytes: null, totalBytes: null, runtimeError: error };
}

// ── Output table ──────────────────────────────────────────────────────────

function printTable(results, baseline) {
  const COLS = ['Route', 'Score', 'ΔScore', 'LCP(ms)', 'ΔLCP', 'JS(MB)', 'ΔJS(MB)', 'TBT', 'FCP', 'CLS', 'Error'];

  const rows = Object.entries(results).map(([path, m]) => {
    const b = baseline?.routes?.[path];
    const jsMB  = m.jsBytes    != null ? (m.jsBytes    / 1e6).toFixed(2) : '-';
    const djsMB = m.jsBytes != null && b?.jsBytes != null ? signN((m.jsBytes - b.jsBytes) / 1e6, 2) : '-';
    return {
      Route:   path,
      Score:   fmt(m.score),
      ΔScore:  delta(m.score, b?.score),
      'LCP(ms)': fmt(m.lcp),
      ΔLCP:    delta(m.lcp, b?.lcp, 'ms'),
      'JS(MB)': jsMB,
      'ΔJS(MB)': djsMB,
      TBT:     fmt(m.tbt),
      FCP:     fmt(m.fcp),
      CLS:     m.cls != null ? m.cls.toFixed(3) : '-',
      Error:   m.runtimeError ?? '-',
    };
  });

  const w = Object.fromEntries(COLS.map(c => [c, c.length]));
  for (const row of rows) for (const c of COLS) w[c] = Math.max(w[c], String(row[c]).length);

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n' + COLS.map(c => pad(c, w[c])).join('  '));
  console.log(COLS.map(c => '-'.repeat(w[c])).join('  '));
  for (const row of rows) console.log(COLS.map(c => pad(row[c], w[c])).join('  '));
  console.log('');
}

const fmt = v => v ?? '-';
const signN = (n, d = 0) => (n >= 0 ? '+' : '') + n.toFixed(d);
function delta(cur, base, unit = '') {
  if (cur == null || base == null) return '-';
  return signN(cur - base, 0) + unit;
}

// ── Gate ──────────────────────────────────────────────────────────────────

function gateCheck(results, baseline) {
  const fails = [];
  for (const [path, m] of Object.entries(results)) {
    const b = baseline.routes[path];
    if (!b) continue; // new route — no comparison yet

    // Crash regression: had LCP before, now null
    if (b.lcp != null && m.lcp == null) {
      fails.push(`${path}: crash regression (baseline LCP=${b.lcp}ms, now null)`);
      continue;
    }
    if (m.lcp == null || b.lcp == null) continue; // null-vs-null: OK

    // LCP: both absolute and relative must exceed threshold
    if (m.lcp > b.lcp + LCP_MS && m.lcp > b.lcp * LCP_FACTOR) {
      const pct = ((m.lcp / b.lcp - 1) * 100).toFixed(1);
      fails.push(`${path}: LCP ${b.lcp}→${m.lcp}ms (+${m.lcp - b.lcp}ms, +${pct}%)`);
    }

    // JS bytes: both conditions
    if (m.jsBytes != null && b.jsBytes != null &&
        m.jsBytes > b.jsBytes * JS_FACTOR &&
        m.jsBytes > b.jsBytes + JS_ABS) {
      const kb  = ((m.jsBytes - b.jsBytes) / 1000).toFixed(0);
      const pct = ((m.jsBytes / b.jsBytes - 1) * 100).toFixed(1);
      fails.push(`${path}: JS bytes +${kb}kB (+${pct}%) — ${(b.jsBytes/1e6).toFixed(2)}→${(m.jsBytes/1e6).toFixed(2)}MB`);
    }
  }
  return fails;
}

// ── Login via Playwright CDP ──────────────────────────────────────────────

async function doLogin(ctx, baseUrl, email, password) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait for the login form to be interactive (SPA renders asynchronously).
    await page.getByPlaceholder('you@domain.com').waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('you@domain.com').fill(email);
    await page.getByPlaceholder('************').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30_000 });
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Per-group runner ──────────────────────────────────────────────────────

async function runGroup(userKey, routeList, users, chromePath, timestamp) {
  const { launch }   = await import('chrome-launcher');
  const { chromium } = await import('playwright-core');

  const isPublic = userKey === '__public__';
  console.log(`\n── ${isPublic ? 'Public routes' : `Routes as ${userKey}`} ──`);

  let chrome;
  try {
    chrome = await launch({
      chromePath,
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
      port: 0,
      logLevel: 'silent',
    });
  } catch (err) {
    throw new HarnessError(`Failed to launch Chrome: ${err.message}`);
  }

  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${chrome.port}`);
  } catch (err) {
    await chrome.kill().catch(() => {});
    throw new HarnessError(`Failed to connect to Chrome on port ${chrome.port}: ${err.message}`);
  }

  // Use the default browser context so localStorage is shared with Lighthouse tabs.
  const ctx = browser.contexts()[0] ?? await browser.newContext();

  // Keep one page open for CDP cache-clearing between runs.
  const cachePage = await ctx.newPage();
  const cdp = await ctx.newCDPSession(cachePage);

  const groupResults = {};

  try {
    if (!isPublic) {
      const creds = users[userKey];
      if (!creds) throw new HarnessError(`No credentials for user "${userKey}" in routes.json`);
      console.log(`  Logging in as ${creds.email}...`);
      await doLogin(ctx, BASE_URL, creds.email, creds.password);
      console.log('  Login OK.');
    }

    for (const { path } of routeList) {
      const url = `${BASE_URL}${path}`;
      console.log(`  ${path}...`);

      // Clear HTTP cache (not localStorage — that holds the auth session).
      await cdp.send('Network.clearBrowserCache').catch(() => {});

      let lhResult;
      try {
        lhResult = await runLighthouse(url, chrome.port);
      } catch (err) {
        console.error(`  ✗ Lighthouse error: ${err.message}`);
        groupResults[path] = nullMetrics('LIGHTHOUSE_ERROR');
        continue;
      }

      const lhr = lhResult?.lhr;

      // Auth redirect means the session was lost — that's a harness error.
      if (!isPublic && lhr?.finalUrl?.includes('/login')) {
        throw new HarnessError(`Session lost for ${path} — redirected to /login`);
      }

      const metrics = extractMetrics(lhr);
      groupResults[path] = metrics;

      // Save full Lighthouse JSON.
      const slug = path.replace(/\//g, '-').replace(/^-/, '');
      writeFileSync(resolve(RESULTS_DIR, `${timestamp}--${slug}.json`), JSON.stringify(lhr ?? {}, null, 2));

      if (metrics.runtimeError) {
        console.log(`  ${path}: ${metrics.runtimeError} (null metrics)`);
      } else {
        console.log(`  ${path}: score=${metrics.score} LCP=${metrics.lcp}ms JS=${(metrics.jsBytes / 1e6).toFixed(2)}MB`);
      }
    }
  } finally {
    await cachePage.close().catch(() => {});
    await browser.close().catch(() => {});
    try { await chrome.kill(); } catch { /* ignore — chrome already gone */ }
  }

  return groupResults;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RESULTS_DIR, { recursive: true });

  // Pre-flight: verify server is reachable.
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`\nERROR: Server unreachable at ${BASE_URL}`);
    console.error(`  ${err.message}`);
    console.error('  Start the production server first — see perf/README.md.');
    process.exit(2);
  }

  const { users, routes } = JSON.parse(readFileSync(ROUTES_PATH, 'utf8'));
  const chromePath = await resolveChromePath();
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];

  // Group routes by user key, preserving declaration order.
  const groups = new Map();
  for (const entry of routes) {
    const path = typeof entry === 'string' ? entry : entry.path;
    const key  = typeof entry === 'string' ? '__public__' : (entry.as ?? '__public__');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ path });
  }

  const allResults = {};
  for (const [userKey, routeList] of groups) {
    const partial = await runGroup(userKey, routeList, users, chromePath, timestamp);
    Object.assign(allResults, partial);
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null;

  printTable(allResults, baseline);

  if (SAVE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({ timestamp: new Date().toISOString(), routes: allResults }, null, 2));
    console.log(`Baseline saved → ${BASELINE_PATH}`);
    process.exit(0);
  }

  if (NO_GATE || !baseline) {
    if (!baseline) console.log('No baseline found. Run with --save-baseline to establish one.');
    process.exit(0);
  }

  const regressions = gateCheck(allResults, baseline);
  if (regressions.length) {
    console.error('REGRESSIONS DETECTED:');
    regressions.forEach(r => console.error(`  ✗ ${r}`));
    process.exit(1);
  }

  console.log('Gate: PASS — no regressions detected.');
  process.exit(0);
}

main().catch(err => {
  if (err instanceof HarnessError) {
    console.error(`\nHARNESS ERROR: ${err.message}`);
  } else {
    console.error(`\nUNHANDLED ERROR: ${err.message}`);
    console.error(err.stack);
  }
  process.exit(2);
});
