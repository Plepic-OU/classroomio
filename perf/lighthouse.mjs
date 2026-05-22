#!/usr/bin/env node
// Performance harness: run Lighthouse against a list of routes, compare to a baseline.
// Run from repo root: `pnpm perf` or `pnpm perf -- --save-baseline`.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch as launchChrome } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERF_DIR = path.join(repoRoot, 'perf');
const RESULTS_DIR = path.join(PERF_DIR, 'results');
const BASELINE_PATH = path.join(PERF_DIR, 'baseline.json');
const ROUTES_PATH = path.join(PERF_DIR, 'routes.json');

const args = new Set(process.argv.slice(2));
const FLAG_SAVE_BASELINE = args.has('--save-baseline');
const FLAG_NO_GATE = args.has('--no-gate');

const BASE_URL = (process.env.PERF_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const LH_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    disableStorageReset: true,
  },
};

const CHROME_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const fail = (code, ...m) => {
  console.error('[harness]', ...m);
  process.exit(code);
};

function loadRoutes() {
  let raw;
  try {
    raw = readFileSync(ROUTES_PATH, 'utf-8');
  } catch (err) {
    fail(2, 'cannot read', ROUTES_PATH, '—', err.message);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(2, ROUTES_PATH, 'is not valid JSON:', err.message);
  }
  if (!parsed.routes || !Array.isArray(parsed.routes)) {
    fail(2, ROUTES_PATH, 'is missing "routes" array');
  }
  return parsed;
}

async function pingServer() {
  try {
    const res = await fetch(BASE_URL + '/', { redirect: 'manual' });
    if (res.status >= 500) fail(2, `server unreachable at ${BASE_URL} (HTTP ${res.status})`);
  } catch (err) {
    fail(2, `server unreachable at ${BASE_URL} — ${err.message}`);
  }
}

async function preflightSeedCheck(routes) {
  const hasAuthed = routes.some((r) => typeof r === 'object' && r.as);
  if (!hasAuthed) return;
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn(
      '[harness] PUBLIC_SUPABASE_URL/ANON not in env; skipping seed pre-flight check.',
    );
    return;
  }
  const url = `${SUPABASE_URL}/rest/v1/profile?email=eq.perf-student-1@workshop.local&select=id`;
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.warn(`[harness] seed pre-flight query returned ${res.status}; continuing.`);
      return;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      fail(2, 'perf seed not present; run `pnpm seed:perf` first');
    }
  } catch (err) {
    console.warn(`[harness] seed pre-flight query failed (${err.message}); continuing.`);
  }
}

async function pickChromePath() {
  if (process.env.PERF_CHROME_PATH) {
    if (existsSync(process.env.PERF_CHROME_PATH)) {
      console.log('[harness] chrome:', process.env.PERF_CHROME_PATH, '(from PERF_CHROME_PATH)');
      return process.env.PERF_CHROME_PATH;
    }
    console.warn(
      `[harness] PERF_CHROME_PATH=${process.env.PERF_CHROME_PATH} does not exist; falling through.`,
    );
  }
  try {
    const playwright = await import('playwright-core').catch(() => null);
    if (playwright?.chromium) {
      const p = playwright.chromium.executablePath();
      if (p && existsSync(p) && statSync(p).isFile()) {
        console.log('[harness] chrome:', p, '(from playwright-core)');
        return p;
      }
    }
  } catch {}
  console.log('[harness] chrome: (chrome-launcher default)');
  return undefined;
}

function sanitizePath(p) {
  const cleaned = p.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned.length ? cleaned : 'root';
}

function sumBytes(lhr, resourceType) {
  const audit = lhr?.audits?.['network-requests'];
  const items = audit?.details?.items;
  if (!Array.isArray(items)) return null;
  let total = 0;
  for (const it of items) {
    if (resourceType === '*' || it.resourceType === resourceType) {
      total += it.transferSize ?? 0;
    }
  }
  return total;
}

function summarizeLhr(lhr, path) {
  return {
    path,
    finalUrl: lhr.finalUrl || lhr.finalDisplayedUrl || null,
    runtimeError: lhr.runtimeError?.code ?? null,
    score: lhr.categories?.performance?.score ?? null,
    lcp: lhr.audits?.['largest-contentful-paint']?.numericValue ?? null,
    fcp: lhr.audits?.['first-contentful-paint']?.numericValue ?? null,
    tbt: lhr.audits?.['total-blocking-time']?.numericValue ?? null,
    cls: lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null,
    jsBytes: sumBytes(lhr, 'Script'),
    totalBytes: sumBytes(lhr, '*'),
  };
}

async function loginWithPuppeteer(chrome, user) {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
      defaultViewport: null,
    });
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[placeholder="you@domain.com"]', {
      visible: true,
      timeout: 15000,
    });
    await page.type('input[placeholder="you@domain.com"]', user.email, { delay: 10 });
    await page.type('input[placeholder="************"]', user.password, { delay: 10 });
    await page.click('button[type=submit]');
    await page.waitForFunction(
      () => !location.pathname.startsWith('/login'),
      { timeout: 15000 },
    );
    return page;
  } catch (err) {
    fail(2, `login failed for ${user.email}: ${err.message}`);
  } finally {
    if (browser) browser.disconnect();
  }
}

async function measureRoute(route, users, chromePath) {
  const routePath = typeof route === 'string' ? route : route.path;
  const asUser = typeof route === 'object' ? route.as : null;
  const userCreds = asUser ? users[asUser] : null;
  if (asUser && !userCreds)
    fail(2, `route ${routePath} references user "${asUser}" not in users config`);

  console.log(`[harness] measuring ${routePath}${asUser ? ` (as ${asUser})` : ''}…`);
  let chrome;
  try {
    chrome = await launchChrome({ chromePath, chromeFlags: CHROME_FLAGS });
    if (asUser) await loginWithPuppeteer(chrome, userCreds);

    const result = await lighthouse(
      BASE_URL + routePath,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      LH_CONFIG,
    );
    if (!result) fail(2, `lighthouse returned null for ${routePath}`);
    const lhr = result.lhr;

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fname = `${ts}--${sanitizePath(routePath)}.json`;
    writeFileSync(path.join(RESULTS_DIR, fname), JSON.stringify(lhr, null, 2));

    const summary = summarizeLhr(lhr, routePath);
    const finalPath = summary.finalUrl ? new URL(summary.finalUrl).pathname : null;
    if (asUser && finalPath === '/login' && !summary.runtimeError) {
      summary.sessionLost = true;
    }
    return summary;
  } catch (err) {
    fail(2, `lighthouse threw on ${routePath}: ${err.message}`);
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {}
    }
  }
}

function fmtMs(n) {
  if (n == null) return '—';
  return `${Math.round(n)}ms`;
}
function fmtScore(n) {
  if (n == null) return '—';
  return n.toFixed(2);
}
function fmtCls(n) {
  if (n == null) return '—';
  return n.toFixed(3);
}
function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}
function fmtDelta(cur, base, formatter) {
  if (cur == null || base == null) return '';
  const d = cur - base;
  if (Math.abs(d) < 1e-9) return '(±0)';
  const sign = d > 0 ? '+' : '';
  if (formatter === 'ms') return `(${sign}${Math.round(d)}ms)`;
  if (formatter === 'score') return `(${sign}${d.toFixed(2)})`;
  if (formatter === 'cls') return `(${sign}${d.toFixed(3)})`;
  if (formatter === 'bytes') {
    const pct = base !== 0 ? ((d / base) * 100).toFixed(1) : '?';
    return `(${sign}${pct}%)`;
  }
  return '';
}

function padRight(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function printTable(summaries, baselineByPath) {
  const cols = [
    { h: 'route', w: 30 },
    { h: 'score', w: 14 },
    { h: 'LCP', w: 18 },
    { h: 'TBT', w: 16 },
    { h: 'FCP', w: 16 },
    { h: 'CLS', w: 16 },
    { h: 'JS bytes', w: 18 },
    { h: 'total', w: 18 },
    { h: 'notes', w: 24 },
  ];
  const header = cols.map((c) => padRight(c.h, c.w)).join(' ');
  console.log('\n' + header);
  console.log('-'.repeat(header.length));
  for (const s of summaries) {
    const b = baselineByPath?.[s.path];
    const notes = [];
    if (s.runtimeError) notes.push(s.runtimeError);
    if (s.sessionLost) notes.push('sessionLost');
    if (b == null) notes.push('new');
    else if (b.lcp == null && s.lcp != null) notes.push('recovered — rebaseline');

    const cells = [
      s.path,
      `${fmtScore(s.score)} ${fmtDelta(s.score, b?.score, 'score')}`,
      `${fmtMs(s.lcp)} ${fmtDelta(s.lcp, b?.lcp, 'ms')}`,
      `${fmtMs(s.tbt)} ${fmtDelta(s.tbt, b?.tbt, 'ms')}`,
      `${fmtMs(s.fcp)} ${fmtDelta(s.fcp, b?.fcp, 'ms')}`,
      `${fmtCls(s.cls)} ${fmtDelta(s.cls, b?.cls, 'cls')}`,
      `${fmtBytes(s.jsBytes)} ${fmtDelta(s.jsBytes, b?.jsBytes, 'bytes')}`,
      `${fmtBytes(s.totalBytes)} ${fmtDelta(s.totalBytes, b?.totalBytes, 'bytes')}`,
      notes.join(', '),
    ];
    console.log(cols.map((c, i) => padRight(cells[i], c.w)).join(' '));
  }
  console.log('');
}

function computeVerdict(summaries, baselineByPath) {
  const regressions = [];
  for (const s of summaries) {
    const b = baselineByPath[s.path];
    if (!b) continue; // new route — not a regression

    // JS bytes gate
    if (b.jsBytes != null && s.jsBytes != null) {
      if (s.jsBytes > b.jsBytes * 1.01) {
        regressions.push(
          `${s.path}: JS bytes ${b.jsBytes} → ${s.jsBytes} (+${(((s.jsBytes - b.jsBytes) / b.jsBytes) * 100).toFixed(2)}%) > +1%`,
        );
      }
    }
    // LCP crash gate
    if (b.lcp != null && s.lcp == null) {
      regressions.push(`${s.path}: LCP went from ${Math.round(b.lcp)}ms to null (crash)`);
      continue;
    }
    // LCP delta gate
    if (b.lcp != null && s.lcp != null) {
      const allowed = Math.max(100, b.lcp * 0.05);
      const delta = s.lcp - b.lcp;
      if (delta > allowed) {
        regressions.push(
          `${s.path}: LCP ${Math.round(b.lcp)}ms → ${Math.round(s.lcp)}ms (+${Math.round(delta)}ms) > +${Math.round(allowed)}ms allowed`,
        );
      }
    }
    // null→real handled implicitly: no regression, "recovered" note printed in table.
  }
  return regressions;
}

async function main() {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const { users, routes } = loadRoutes();
  await pingServer();
  await preflightSeedCheck(routes);

  const chromePath = await pickChromePath();

  const summaries = [];
  for (const route of routes) {
    summaries.push(await measureRoute(route, users, chromePath));
  }

  // Drop sessionLost flag = early exit
  const lost = summaries.find((s) => s.sessionLost);
  if (lost) fail(2, `session lost on ${lost.path} (finalUrl=${lost.finalUrl})`);

  let baselineByPath = null;
  if (existsSync(BASELINE_PATH) && !FLAG_SAVE_BASELINE) {
    try {
      const baseArr = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
      baselineByPath = Object.fromEntries(baseArr.map((b) => [b.path, b]));
    } catch (err) {
      fail(2, `cannot read baseline: ${err.message}`);
    }
  }

  printTable(summaries, baselineByPath);

  if (FLAG_SAVE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify(summaries, null, 2));
    console.log(`[harness] baseline written to ${BASELINE_PATH}`);
    process.exit(0);
  }

  if (FLAG_NO_GATE || !baselineByPath) {
    process.exit(0);
  }

  const regressions = computeVerdict(summaries, baselineByPath);
  if (regressions.length) {
    console.error('[harness] regressions detected:');
    for (const r of regressions) console.error('  • ' + r);
    process.exit(1);
  }
  console.log('[harness] no regressions');
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  console.error('[harness] unhandled rejection:', err);
  process.exit(2);
});

main().catch((err) => {
  console.error('[harness] fatal:', err);
  process.exit(2);
});
