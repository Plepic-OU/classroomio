#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, 'results');
const BASELINE_PATH = resolve(__dirname, 'baseline.json');
const ROUTES_PATH = resolve(__dirname, 'routes.json');
const BASE_URL = (process.env.PERF_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const args = process.argv.slice(2);
const SAVE_BASELINE = args.includes('--save-baseline');
const NO_GATE = args.includes('--no-gate');

async function resolveChromePath() {
  if (process.env.PERF_CHROME_PATH) return process.env.PERF_CHROME_PATH;
  try {
    const pw = await import('playwright-core');
    // playwright-core may export chromium as a named export or on the default object
    const chromium = pw.chromium ?? pw.default?.chromium;
    if (chromium?.executablePath) return chromium.executablePath();
  } catch (_) {
    // fall through to chrome-launcher defaults
  }
  return undefined;
}

function sanitizePath(urlPath) {
  return urlPath.replace(/^\//, '').replace(/\//g, '--').replace(/[^a-z0-9-]/gi, '_') || 'root';
}

function extractMetrics(lhr) {
  if (!lhr) {
    return {
      score: null, lcp: null, tbt: null, fcp: null,
      cls: null, jsBytes: null, totalBytes: null, runtimeError: 'NO_LHR',
    };
  }

  const score = lhr.categories?.performance?.score != null
    ? Math.round(lhr.categories.performance.score * 100)
    : null;

  const lcp = lhr.audits?.['largest-contentful-paint']?.numericValue ?? null;
  const tbt = lhr.audits?.['total-blocking-time']?.numericValue ?? null;
  const fcp = lhr.audits?.['first-contentful-paint']?.numericValue ?? null;
  const cls = lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null;

  const networkItems = lhr.audits?.['network-requests']?.details?.items ?? [];
  let jsBytes = null;
  let totalBytes = null;

  if (networkItems.length > 0) {
    jsBytes = networkItems
      .filter(item => item.resourceType === 'Script')
      .reduce((sum, item) => sum + (item.transferSize ?? item.resourceSize ?? 0), 0);
    totalBytes = networkItems
      .reduce((sum, item) => sum + (item.transferSize ?? item.resourceSize ?? 0), 0);
  }

  return {
    score,
    lcp,
    tbt,
    fcp,
    cls,
    jsBytes,
    totalBytes,
    runtimeError: lhr.runtimeError?.code ?? null,
  };
}

function buildLighthouseConfig(disableStorageReset) {
  return {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'desktop',
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
      disableStorageReset,
    },
  };
}

async function runLighthouse(url, chromePort, disableStorageReset) {
  try {
    const result = await lighthouse(
      url,
      { port: chromePort, logLevel: 'error' },
      buildLighthouseConfig(disableStorageReset),
    );
    return result?.lhr ?? null;
  } catch (err) {
    console.error(`\n    Lighthouse threw: ${err.message}`);
    return null;
  }
}

async function loginWithPuppeteer(chromePort, user) {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${chromePort}`,
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Clear all storage before navigating to /login.
    // Using Storage.clearDataForOrigin + cookies/cache CDP commands so that
    // SvelteKit's client-side code starts from a blank slate — if we only
    // cleared localStorage after navigation, the client script would read the
    // stale session from a previous Lighthouse run and redirect away before we
    // could fill the form.
    const cdp = await page.createCDPSession();
    await cdp.send('Network.clearBrowserCache');
    await cdp.send('Network.clearBrowserCookies');
    await cdp.send('Storage.clearDataForOrigin', {
      origin: BASE_URL,
      storageTypes: 'all',
    });

    // Navigate to login — storage is clean so no client-side redirect risk
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for form
    await page.waitForSelector('input[placeholder="you@domain.com"]', { timeout: 10000 });

    // Fill credentials
    await page.type('input[placeholder="you@domain.com"]', user.email, { delay: 0 });
    await page.type('input[placeholder="************"]', user.password, { delay: 0 });

    // Click login button (Carbon renders text "Log in")
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => /log\s*in/i.test(b.textContent || ''));
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!clicked) {
      // Fallback: submit via Enter
      await page.keyboard.press('Enter');
    }

    // Wait for navigation away from /login
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      { timeout: 30000 },
    );

    const finalUrl = page.url();

    // Login navigation warmed the HTTP cache. Clear it now so Lighthouse sees a
    // cold network, while keeping the auth session in localStorage/cookies.
    await cdp.send('Network.clearBrowserCache');

    await page.close();

    return { success: true, finalUrl };
  } catch (err) {
    return { success: false, finalUrl: null, error: err.message };
  } finally {
    // Disconnect only — never call browser.close() which would kill Chrome
    try { browser?.disconnect(); } catch (_) {}
  }
}

async function measureRoute(route, chrome, routesConfig, timestamp) {
  const routePath = typeof route === 'string' ? route : route.path;
  const userName = typeof route === 'object' ? route.as : null;
  const user = userName ? routesConfig.users[userName] : null;
  const url = `${BASE_URL}${routePath}`;

  process.stdout.write(`  ${routePath}${user ? ` (as ${userName})` : ''} ... `);

  let lhr = null;
  let sessionNote = null;

  if (user) {
    const login = await loginWithPuppeteer(chrome.port, user);
    if (!login.success) {
      process.stdout.write(`login failed: ${login.error}\n`);
      sessionNote = 'LOGIN_FAILED';
    } else {
      // disableStorageReset: true — keep the session Puppeteer just established
      lhr = await runLighthouse(url, chrome.port, true);

      if (lhr?.finalUrl?.includes('/login')) {
        sessionNote = 'SESSION_LOST';
        process.stdout.write(`session lost (finalUrl=${lhr.finalUrl})\n`);
      } else {
        process.stdout.write('done\n');
      }
    }
  } else {
    // disableStorageReset: false — cold start, Lighthouse clears cache
    lhr = await runLighthouse(url, chrome.port, false);
    process.stdout.write('done\n');
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const sanitized = sanitizePath(routePath);
  const reportPath = resolve(RESULTS_DIR, `${timestamp}--${sanitized}.json`);
  writeFileSync(reportPath, JSON.stringify(lhr, null, 2));

  const metrics = extractMetrics(lhr);
  if (sessionNote && !metrics.runtimeError) metrics.runtimeError = sessionNote;

  return { path: routePath, metrics, reportPath };
}

// ── Table ─────────────────────────────────────────────────────────────────────

function n(val, decimals = 0) {
  return val == null ? '—' : Number(val).toFixed(decimals);
}

function delta(curr, base, scale = 1, decimals = 0) {
  if (curr == null || base == null) return '';
  const d = (curr - base) * scale;
  return `${d > 0 ? '+' : ''}${d.toFixed(decimals)}`;
}

function pad(s, w) {
  return String(s).padEnd(w);
}

function printTable(measurements, baseline) {
  const headers = [
    'route', 'score', 'LCP ms', 'ΔLCP', 'TBT ms', 'ΔTBT',
    'FCP ms', 'CLS', 'JS kB', 'ΔJS kB', 'tot kB', 'Δtot kB', 'notes',
  ];

  const rows = measurements.map(({ path, metrics }) => {
    const b = baseline?.[path];
    const notes = [];

    if (metrics.runtimeError) notes.push(metrics.runtimeError);

    if (b) {
      if (metrics.jsBytes != null && b.jsBytes != null && metrics.jsBytes > b.jsBytes * 1.01) {
        notes.push('⚠ JS↑');
      }
      if (metrics.lcp != null && b.lcp != null) {
        if (metrics.lcp > Math.max(b.lcp + 100, b.lcp * 1.05)) notes.push('⚠ LCP↑');
      }
      if (b.lcp != null && metrics.lcp == null) notes.push('⚠ CRASHED');
    }

    const jskb = metrics.jsBytes != null ? metrics.jsBytes / 1024 : null;
    const totkb = metrics.totalBytes != null ? metrics.totalBytes / 1024 : null;
    const bjskb = b?.jsBytes != null ? b.jsBytes / 1024 : null;
    const btotkb = b?.totalBytes != null ? b.totalBytes / 1024 : null;

    return [
      path,
      n(metrics.score),
      n(metrics.lcp),
      b ? delta(metrics.lcp, b.lcp) : '',
      n(metrics.tbt),
      b ? delta(metrics.tbt, b.tbt) : '',
      n(metrics.fcp),
      metrics.cls != null ? Number(metrics.cls).toFixed(3) : '—',
      n(jskb),
      b ? delta(jskb, bjskb) : '',
      n(totkb),
      b ? delta(totkb, btotkb) : '',
      notes.join(' '),
    ];
  });

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length)),
  );

  const sep = widths.map(w => '─'.repeat(w)).join('─┼─');
  console.log('\n' + headers.map((h, i) => pad(h, widths[i])).join(' │ '));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell, widths[i])).join(' │ '));
  }
  console.log();
}

// ── Gate ──────────────────────────────────────────────────────────────────────

function checkRegressions(measurements, baseline) {
  const regressions = [];

  for (const { path, metrics } of measurements) {
    const b = baseline[path];
    if (!b) continue;

    // JS bytes > +1%
    if (metrics.jsBytes != null && b.jsBytes != null && metrics.jsBytes > b.jsBytes * 1.01) {
      const pct = (((metrics.jsBytes - b.jsBytes) / b.jsBytes) * 100).toFixed(1);
      regressions.push(
        `${path}: JS bytes +${pct}% (${(metrics.jsBytes / 1024).toFixed(0)} kB vs baseline ${(b.jsBytes / 1024).toFixed(0)} kB)`,
      );
    }

    // LCP > max(+100 ms, +5%)
    if (metrics.lcp != null && b.lcp != null) {
      const threshold = Math.max(b.lcp + 100, b.lcp * 1.05);
      if (metrics.lcp > threshold) {
        regressions.push(
          `${path}: LCP ${metrics.lcp.toFixed(0)} ms > threshold ${threshold.toFixed(0)} ms (baseline ${b.lcp.toFixed(0)} ms)`,
        );
      }
    }

    // Crash: had LCP in baseline, now null
    if (b.lcp != null && metrics.lcp == null) {
      regressions.push(
        `${path}: page crashed — null LCP vs baseline ${b.lcp.toFixed(0)} ms`,
      );
    }
  }

  return regressions;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 0;
  let chrome = null;

  try {
    if (!existsSync(ROUTES_PATH)) {
      console.error(`routes.json not found at ${ROUTES_PATH}`);
      process.exit(2);
    }

    const routesConfig = JSON.parse(readFileSync(ROUTES_PATH, 'utf8'));
    const chromePath = await resolveChromePath();

    const launchOpts = {
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    };
    if (chromePath) launchOpts.chromePath = chromePath;

    console.log('Launching Chrome...');
    chrome = await chromeLauncher.launch(launchOpts);
    console.log(`Chrome on port ${chrome.port}\n`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    console.log(`Measuring ${routesConfig.routes.length} routes against ${BASE_URL}\n`);

    const measurements = [];
    for (const route of routesConfig.routes) {
      try {
        measurements.push(await measureRoute(route, chrome, routesConfig, timestamp));
      } catch (err) {
        const routePath = typeof route === 'string' ? route : route.path;
        console.error(`  ERROR on ${routePath}: ${err.message}`);
        measurements.push({
          path: routePath,
          metrics: { ...extractMetrics(null), runtimeError: 'HARNESS_ERROR' },
        });
      }
    }

    const baseline = existsSync(BASELINE_PATH)
      ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
      : null;

    printTable(measurements, baseline);

    if (SAVE_BASELINE) {
      const data = {};
      for (const { path, metrics } of measurements) data[path] = metrics;
      writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2));
      console.log(`✓ Baseline saved → ${BASELINE_PATH}`);
      exitCode = 0;
    } else if (!baseline) {
      console.log('No baseline found. Run with --save-baseline to create one.');
      exitCode = 0;
    } else if (NO_GATE) {
      console.log('--no-gate: skipping regression check.');
      exitCode = 0;
    } else {
      const regressions = checkRegressions(measurements, baseline);
      if (regressions.length > 0) {
        console.error('Regressions detected:');
        for (const r of regressions) console.error(`  ✗ ${r}`);
        exitCode = 1;
      } else {
        console.log('✓ No regressions.');
        exitCode = 0;
      }
    }
  } catch (err) {
    console.error(`\nHarness error: ${err.message}`);
    console.error(err.stack);
    exitCode = 2;
  } finally {
    try { await chrome?.kill(); } catch (_) {}
  }

  process.exit(exitCode);
}

main();
