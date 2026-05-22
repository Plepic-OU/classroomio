#!/usr/bin/env node
/**
 * Lighthouse performance harness.
 *
 * Usage:
 *   PERF_BASE_URL=http://localhost:3000 node perf/lighthouse.mjs
 *   PERF_BASE_URL=http://localhost:3000 node perf/lighthouse.mjs --save-baseline
 *   PERF_BASE_URL=http://localhost:3000 node perf/lighthouse.mjs --no-gate
 *
 * Exit codes:
 *   0 — pass (or --no-gate / --save-baseline)
 *   1 — performance regression detected
 *   2 — harness error (server unreachable, Chrome crash before any measurement)
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SAVE_BASELINE = args.includes('--save-baseline');
const NO_GATE = args.includes('--no-gate');
const BASE_URL = (process.env.PERF_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ── Imports (ESM) ─────────────────────────────────────────────────────────────
const { default: lighthouse } = await import('lighthouse');
const { launch: launchChrome } = await import('chrome-launcher');
const { connect: puppeteerConnect } = await import('puppeteer-core');
const { chromium } = await import('playwright-core');

// ── Config ────────────────────────────────────────────────────────────────────
const ROUTES_PATH = join(__dirname, 'routes.json');
const BASELINE_PATH = join(__dirname, 'baseline.json');
const RESULTS_DIR = join(__dirname, 'results');

const LH_FLAGS = {
  formFactor: 'desktop',
  throttlingMethod: 'simulate',
  throttling: {
    rttMs: 40,
    throughputKbps: 10240,
    cpuSlowdownMultiplier: 1,
  },
  screenEmulation: { disabled: true },
  disableStorageReset: true, // must be true — false clears localStorage before audit, destroying Supabase auth session
};

// Gate thresholds (per spec — see perf/README.md for rationale)
const JS_BYTES_REGRESSION_PCT = 0.01;   // > 1%
const LCP_REGRESSION_ABS_MS  = 100;    // > 100ms absolute
const LCP_REGRESSION_REL_PCT = 0.05;   // > 5% relative

// Run each route N times and take the median LCP run (filters GC pauses and load spikes)
const RUNS_PER_ROUTE = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveChromeExecutable() {
  if (process.env.PERF_CHROME_PATH) return process.env.PERF_CHROME_PATH;

  // Try playwright-core's reported path first
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {}

  // Fall back: scan the playwright cache for any installed chromium binary
  // (handles version mismatch between playwright-core dep and installed browser)
  try {
    const cacheDir = join(process.env.HOME ?? '/root', '.cache', 'ms-playwright');
    if (existsSync(cacheDir)) {
      const dirs = readdirSync(cacheDir).filter(d => d.startsWith('chromium-'));
      for (const dir of dirs.reverse()) { // newest first
        const candidate = join(cacheDir, dir, 'chrome-linux', 'chrome');
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {}

  return undefined; // chrome-launcher will find system Chrome
}

function sanitizePath(p) {
  return p.replace(/[^a-zA-Z0-9-]/g, '_').replace(/^_+|_+$/g, '');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '--').replace('Z', '');
}

function extractMetrics(lhr) {
  if (!lhr) return { score: null, lcp: null, tbt: null, fcp: null, cls: null, jsBytes: null, totalBytes: null, runtimeError: 'NO_LHR' };

  const runtimeError = lhr.runtimeError?.code ?? null;

  if (runtimeError) {
    return { score: null, lcp: null, tbt: null, fcp: null, cls: null, jsBytes: null, totalBytes: null, runtimeError };
  }

  const score = lhr.categories?.performance?.score != null
    ? Math.round(lhr.categories.performance.score * 100)
    : null;

  const lcp  = lhr.audits?.['largest-contentful-paint']?.numericValue ?? null;
  const tbt  = lhr.audits?.['total-blocking-time']?.numericValue ?? null;
  const fcp  = lhr.audits?.['first-contentful-paint']?.numericValue ?? null;
  const cls  = lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null;

  // resource-summary is more reliable than summing network-requests (which can miss lazy-loaded scripts)
  const resourceItems = lhr.audits?.['resource-summary']?.details?.items ?? [];
  const jsEntry    = resourceItems.find(i => i.resourceType === 'script');
  const totalEntry = resourceItems.find(i => i.resourceType === 'total');
  const jsBytes    = jsEntry?.transferSize ?? null;
  const totalBytes = totalEntry?.transferSize ?? null;

  return { score, lcp, tbt, fcp, cls, jsBytes, totalBytes, runtimeError };
}

async function clearBrowserState(browser, cdpSession, baseUrl) {
  // Clear localStorage via CDP Storage domain — no page navigation needed,
  // so the HTTP cache is not re-warmed before the Lighthouse measurement.
  const origin = new URL(baseUrl).origin;
  try {
    await cdpSession.send('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'local_storage,session_storage,indexeddb',
    });
  } catch {
    // CDP Storage domain not always available — fall back to page evaluate
    try {
      const pages = await browser.pages();
      const page = pages.find(p => p.url().startsWith(origin)) ?? await browser.newPage();
      const opened = page.url() !== 'about:blank';
      if (!opened) await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.evaluate(() => localStorage.clear());
      if (!opened) await page.close();
    } catch {}
  }
  // Clear HTTP cache + cookies AFTER localStorage clear so the navigate-to-clear
  // fallback above doesn't re-warm the cache that we're about to wipe.
  try {
    await cdpSession.send('Network.clearBrowserCache');
    await cdpSession.send('Network.clearBrowserCookies');
  } catch {}
}

async function loginAs(browser, baseUrl, user) {
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for Svelte to hydrate — the submit button being visible is a reliable signal
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Fill inputs via evaluate to trigger Svelte's bind:value (needs input event dispatch)
    await page.evaluate((email, password) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInput = inputs.find(i => i.placeholder === 'you@domain.com' || i.type === 'email');
      const pwInput = inputs.find(i => i.type === 'password');
      if (!emailInput) throw new Error('email input not found');
      if (!pwInput)    throw new Error('password input not found');
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.value = password;
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    }, user.email, user.password);

    // Submit — SvelteKit uses client-side routing (history.pushState) after login,
    // so waitForNavigation won't fire. Poll until the URL leaves /login instead.
    await page.click('button[type="submit"]');
    try {
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 30000, polling: 300 }
      );
    } catch {
      const errText = await page.$eval('p.text-red-500', el => el.textContent.trim()).catch(() => null);
      throw new Error(`Login failed for ${user.email} — still on /login after 30s${errText ? `: "${errText}"` : ''}`);
    }
  } finally {
    await page.close();
  }
}

// ── Preflight ─────────────────────────────────────────────────────────────────

async function checkServerReachable(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/login`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ── Table rendering ───────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n == null) return 'null';
  return n.toFixed(decimals);
}

function fmtDelta(cur, base, decimals = 0) {
  if (cur == null || base == null) return '—';
  const d = cur - base;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(decimals)}`;
}

function fmtKb(bytes) {
  if (bytes == null) return 'null';
  return (bytes / 1024).toFixed(1);
}

function fmtKbDelta(cur, base) {
  if (cur == null || base == null) return '—';
  const d = (cur - base) / 1024;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}`;
}

function printTable(results, baseline) {
  const COL = {
    route:    { w: 28, label: 'Route' },
    score:    { w: 6,  label: 'Score' },
    lcp:      { w: 8,  label: 'LCP' },
    dlcp:     { w: 8,  label: 'ΔLCP' },
    tbt:      { w: 7,  label: 'TBT' },
    dtbt:     { w: 7,  label: 'ΔTBT' },
    fcp:      { w: 7,  label: 'FCP' },
    dfcp:     { w: 7,  label: 'ΔFCP' },
    cls:      { w: 6,  label: 'CLS' },
    dcls:     { w: 6,  label: 'ΔCLS' },
    js:       { w: 9,  label: 'JS kB' },
    djs:      { w: 9,  label: 'ΔJS kB' },
    total:    { w: 10, label: 'Total kB' },
    error:    { w: 12, label: 'Error' },
  };

  const pad = (s, w) => String(s).slice(0, w).padEnd(w);
  const header = Object.values(COL).map(c => pad(c.label, c.w)).join(' │ ');
  const sep    = Object.values(COL).map(c => '─'.repeat(c.w)).join('─┼─');

  console.log('\n' + header);
  console.log(sep);

  for (const r of results) {
    const b = baseline?.[r.path] ?? null;
    const m = r.metrics;

    const row = [
      pad(r.path, COL.route.w),
      pad(fmt(m.score), COL.score.w),
      pad(fmt(m.lcp), COL.lcp.w),
      pad(fmtDelta(m.lcp, b?.lcp), COL.dlcp.w),
      pad(fmt(m.tbt), COL.tbt.w),
      pad(fmtDelta(m.tbt, b?.tbt), COL.dtbt.w),
      pad(fmt(m.fcp), COL.fcp.w),
      pad(fmtDelta(m.fcp, b?.fcp), COL.dfcp.w),
      pad(fmt(m.cls, 3), COL.cls.w),
      pad(fmtDelta(m.cls, b?.cls, 3), COL.dcls.w),
      pad(fmtKb(m.jsBytes), COL.js.w),
      pad(fmtKbDelta(m.jsBytes, b?.jsBytes), COL.djs.w),
      pad(fmtKb(m.totalBytes), COL.total.w),
      pad(m.runtimeError ?? '', COL.error.w),
    ].join(' │ ');

    console.log(row);
  }
  console.log();
}

// ── Gate ──────────────────────────────────────────────────────────────────────

function checkRegressions(results, baseline) {
  const regressions = [];

  for (const r of results) {
    const m = r.metrics;
    const b = baseline?.[r.path];
    if (!b) continue;

    // Null LCP this run but non-null in baseline → crash regression
    if (b.lcp != null && m.lcp == null) {
      regressions.push(`${r.path}: page crashed (null LCP) — baseline was ${fmt(b.lcp)}ms`);
      continue;
    }

    // LCP regression: > max(100ms, 5% of baseline)
    if (m.lcp != null && b.lcp != null) {
      const absThreshold = LCP_REGRESSION_ABS_MS;
      const relThreshold = b.lcp * LCP_REGRESSION_REL_PCT;
      const threshold = Math.max(absThreshold, relThreshold);
      const delta = m.lcp - b.lcp;
      if (delta > threshold) {
        regressions.push(
          `${r.path}: LCP regression +${delta.toFixed(0)}ms (threshold ${threshold.toFixed(0)}ms)`
        );
      }
    }

    // JS bytes regression: > 1%
    if (m.jsBytes != null && b.jsBytes != null) {
      const delta = m.jsBytes - b.jsBytes;
      if (delta / b.jsBytes > JS_BYTES_REGRESSION_PCT) {
        const pct = ((delta / b.jsBytes) * 100).toFixed(1);
        regressions.push(
          `${r.path}: JS bytes regression +${(delta / 1024).toFixed(1)} kB (+${pct}%)`
        );
      }
    }
  }

  return regressions;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Load routes config
  const config = JSON.parse(readFileSync(ROUTES_PATH, 'utf8'));
  const routes = config.routes.map(r => typeof r === 'string' ? { path: r } : r);
  const users = config.users ?? {};

  // Preflight: check server is up
  const reachable = await checkServerReachable(BASE_URL);
  if (!reachable) {
    console.error(`[error] Server not reachable at ${BASE_URL} — run the production build first`);
    console.error('  See perf/README.md for the build/serve sequence.');
    process.exit(2);
  }

  // Resolve Chrome
  const chromePath = resolveChromeExecutable();
  console.log(`[info]  Chrome: ${chromePath ?? 'chrome-launcher default'}`);
  console.log(`[info]  Base URL: ${BASE_URL}`);
  console.log(`[info]  Routes: ${routes.length}`);
  console.log();

  mkdirSync(RESULTS_DIR, { recursive: true });

  // Launch Chrome
  let chrome;
  try {
    chrome = await launchChrome({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
      chromePath,
    });
  } catch (err) {
    console.error(`[error] Chrome failed to launch: ${err.message}`);
    process.exit(2);
  }

  const results = [];
  let browser;

  try {
    // Connect Puppeteer to the same Chrome instance
    const { webSocketDebuggerUrl } = await fetch(`http://localhost:${chrome.port}/json/version`)
      .then(r => r.json());

    browser = await puppeteerConnect({ browserWSEndpoint: webSocketDebuggerUrl });

    for (const route of routes) {
      const url = `${BASE_URL}${route.path}`;
      console.log(`[run]   ${route.path}${route.as ? ` (as ${route.as})` : ''}`);

      // Open a CDP session on the browser target to clear cache/cookies/localStorage
      const pages = await browser.pages();
      const activePage = pages[0] ?? await browser.newPage();
      const cdpSession = await activePage.createCDPSession();

      // 1. Clear cache + cookies + localStorage before each measurement
      await clearBrowserState(browser, cdpSession, BASE_URL);
      await cdpSession.detach();

      // 2. Login if authed route
      if (route.as) {
        const user = users[route.as];
        if (!user) {
          console.error(`[error] No credentials found for user "${route.as}" in routes.json`);
          process.exit(2);
        }
        try {
          await loginAs(browser, BASE_URL, user);
          console.log(`        logged in as ${user.email}`);
        } catch (err) {
          console.error(`[error] Login failed for ${route.as}: ${err.message}`);
          process.exit(2);
        }
        // Re-clear HTTP cache after login navigation to prevent cache pollution
        // from login page resources warming run 1 (runs 2+ would start cold — inconsistent).
        const postLoginPages = await browser.pages();
        const postLoginPage = postLoginPages[0] ?? await browser.newPage();
        const postLoginCdp = await postLoginPage.createCDPSession();
        try { await postLoginCdp.send('Network.clearBrowserCache'); } catch {}
        try { await postLoginCdp.send('Network.clearBrowserCookies'); } catch {}
        await postLoginCdp.detach();
      }

      // 3. Run Lighthouse (RUNS_PER_ROUTE times, take median by LCP to filter system noise)
      // disableStorageReset: true only for authed routes — preserve the session Puppeteer wrote.
      // For public routes: false, letting Lighthouse manage its own storage reset each pass.
      const lhFlags = { ...LH_FLAGS, disableStorageReset: !!route.as };

      const lhrs = [];
      for (let run = 0; run < RUNS_PER_ROUTE; run++) {
        if (run > 0) {
          // Between runs: clear cache. For public routes also wipe localStorage.
          // For authed routes: keep localStorage (session) — only clear HTTP cache.
          const interPages = await browser.pages();
          const interPage = interPages[0] ?? await browser.newPage();
          const interCdp = await interPage.createCDPSession();
          if (!route.as) {
            await clearBrowserState(browser, interCdp, BASE_URL);
          } else {
            try { await interCdp.send('Network.clearBrowserCache'); } catch {}
            try { await interCdp.send('Network.clearBrowserCookies'); } catch {}
          }
          await interCdp.detach();
        }

        let lhr = null;
        try {
          const runnerResult = await lighthouse(url, { port: chrome.port }, {
            extends: 'lighthouse:default',
            settings: lhFlags,
          });
          lhr = runnerResult?.lhr ?? null;
        } catch (err) {
          console.warn(`        run ${run + 1}: lighthouse threw: ${err.message}`);
        }

        lhrs.push(lhr);
        const rm = extractMetrics(lhr);
        if (rm.runtimeError) {
          console.log(`        run ${run + 1}/${RUNS_PER_ROUTE}: ${rm.runtimeError}`);
        } else {
          console.log(`        run ${run + 1}/${RUNS_PER_ROUTE}: LCP=${fmt(rm.lcp)}ms JS=${fmtKb(rm.jsBytes)}kB`);
        }
      }

      // Pick median run by LCP value (nulls/errors sort to the end)
      const sortedLhrs = [...lhrs].sort((a, b) => {
        const la = a?.audits?.['largest-contentful-paint']?.numericValue ?? Infinity;
        const lb = b?.audits?.['largest-contentful-paint']?.numericValue ?? Infinity;
        return la - lb;
      });
      const lhr = sortedLhrs[Math.floor(sortedLhrs.length / 2)];

      const metrics = extractMetrics(lhr);

      // 4. Verify session survived for authed routes (skip if PAGE_HUNG — page never fully loaded)
      if (route.as && lhr?.finalUrl && !metrics.runtimeError) {
        const finalPath = new URL(lhr.finalUrl).pathname;
        if (finalPath === '/login') {
          console.warn(`        [warn] finalUrl is /login — session did not survive for ${route.path}`);
        }
      }

      // 5. Save full Lighthouse JSON
      if (lhr) {
        const fname = `${timestamp()}--${sanitizePath(route.path)}.json`;
        writeFileSync(join(RESULTS_DIR, fname), JSON.stringify(lhr, null, 2));
      }

      results.push({ path: route.path, metrics });

      if (metrics.runtimeError) {
        console.log(`        runtimeError: ${metrics.runtimeError} (null metrics recorded)`);
      } else {
        console.log(`        score=${metrics.score} LCP=${fmt(metrics.lcp)}ms JS=${fmtKb(metrics.jsBytes)}kB`);
      }
    }
  } finally {
    if (browser) await browser.disconnect();
    await chrome.kill();
  }

  // Load baseline
  let baseline = null;
  if (existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  }

  // Print table
  printTable(results, baseline);

  // Save baseline mode
  if (SAVE_BASELINE) {
    const data = {};
    for (const r of results) {
      data[r.path] = r.metrics;
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2));
    console.log(`[info]  Baseline saved to perf/baseline.json`);
    process.exit(0);
  }

  // Gate
  if (!NO_GATE && baseline) {
    const regressions = checkRegressions(results, baseline);
    if (regressions.length > 0) {
      console.error('[FAIL] Performance regressions detected:');
      for (const r of regressions) console.error(`  • ${r}`);
      process.exit(1);
    }
    console.log('[PASS] No regressions detected.');
  } else if (!baseline) {
    console.log('[info]  No baseline found — run with --save-baseline to create one.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`[error] Harness crashed: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
