#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const EXIT_OK = 0;
const EXIT_REGRESSION = 1;
const EXIT_HARNESS = 2;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERF_DIR = __dirname;
const RESULTS_DIR = join(PERF_DIR, 'results');
const ROUTES_PATH = join(PERF_DIR, 'routes.json');
const BASELINE_PATH = join(PERF_DIR, 'baseline.json');

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:3000';

const GATE_JS_BYTES_PCT = 0.01;
const GATE_LCP_MS = 100;
const GATE_LCP_PCT = 0.05;

function parseArgs(argv) {
  const args = { saveBaseline: false, noGate: false };
  for (const a of argv) {
    if (a === '--save-baseline') args.saveBaseline = true;
    else if (a === '--no-gate') args.noGate = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node perf/lighthouse.mjs [--save-baseline] [--no-gate]
PERF_BASE_URL  base URL of the running prod build (default http://localhost:3000)
PERF_CHROME_PATH override Chrome binary used for measurement`);
      process.exit(EXIT_OK);
    }
  }
  return args;
}

async function probeBaseUrl(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(t);
    if (res.status >= 500) throw new Error(`base URL responded ${res.status}`);
  } catch (err) {
    throw new Error(
      `cannot reach ${url}: ${err.message}\n` +
        `is the prod build running? see perf/README.md for the build/serve sequence.`
    );
  }
}

async function resolveChromePath() {
  if (process.env.PERF_CHROME_PATH) return process.env.PERF_CHROME_PATH;
  try {
    const { chromium } = await import('playwright-core');
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    /* fall through */
  }
  return undefined;
}

function sanitizePath(p) {
  const cleaned = p.replace(/^\/+/, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return cleaned || 'root';
}

function normalizeRoute(entry) {
  if (typeof entry === 'string') return { path: entry, as: null };
  return { path: entry.path, as: entry.as ?? null };
}

async function login(page, user, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  const emailSel = 'input[type="email"], input[name="email"], input[autocomplete="email"]';
  const passSel = 'input[type="password"], input[name="password"]';
  await page.waitForSelector(emailSel, { timeout: 10000 });
  await page.type(emailSel, user.email);
  await page.type(passSel, user.password);
  await page.click('button[type="submit"]');

  // wait for the supabase auth token to land in localStorage (post-redirect URL is unreliable
  // — the dashboard debounces its redirect, and for some users redirects off-origin via
  // window.location.replace). the token presence is the canonical signal that signInWithPassword
  // resolved successfully.
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const tokenFound = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) {
          const v = localStorage.getItem(k);
          if (v && v !== 'null') return true;
        }
      }
      return false;
    });
    if (tokenFound) return;
    await sleep(250);
  }
  throw new Error(`supabase auth token did not appear in localStorage within 30s`);
}

function extractSummary(lhr, route) {
  const runtimeError = lhr.runtimeError?.code ?? null;
  const cat = lhr.categories?.performance;
  const score = typeof cat?.score === 'number' ? Math.round(cat.score * 100) : null;
  const audit = (id) => lhr.audits?.[id];
  const num = (id) => {
    const a = audit(id);
    return a && typeof a.numericValue === 'number' ? a.numericValue : null;
  };
  const items = audit('network-requests')?.details?.items ?? [];
  let jsBytes = 0;
  let totalBytes = 0;
  let sawAny = false;
  for (const it of items) {
    sawAny = true;
    const size = typeof it.transferSize === 'number' ? it.transferSize : 0;
    totalBytes += size;
    if (it.resourceType === 'Script') jsBytes += size;
  }
  return {
    path: route.path,
    as: route.as,
    score,
    lcp: num('largest-contentful-paint'),
    tbt: num('total-blocking-time'),
    fcp: num('first-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    jsBytes: sawAny ? jsBytes : null,
    totalBytes: sawAny ? totalBytes : null,
    finalUrl: lhr.finalUrl ?? null,
    runtimeError
  };
}

async function measureRoute(route, users, chromePath, baseUrl) {
  const chromeLauncher = await import('chrome-launcher');
  const puppeteer = await import('puppeteer-core');
  const lighthouseMod = await import('lighthouse');
  const lighthouse = lighthouseMod.default ?? lighthouseMod;

  const launchOpts = {
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
  if (chromePath) launchOpts.chromePath = chromePath;

  const chrome = await chromeLauncher.launch(launchOpts);
  let summary;
  let lhr;
  try {
    let loginFailed = null;
    if (route.as) {
      const user = users[route.as];
      if (!user) throw new Error(`route ${route.path} references unknown user "${route.as}"`);
      const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${chrome.port}`,
        defaultViewport: null
      });
      try {
        const pages = await browser.pages();
        const page = pages[0] ?? (await browser.newPage());
        await login(page, user, baseUrl);
      } catch (err) {
        loginFailed = err.message;
      } finally {
        browser.disconnect();
      }
    }

    if (loginFailed) {
      summary = {
        path: route.path,
        as: route.as,
        score: null,
        lcp: null,
        tbt: null,
        fcp: null,
        cls: null,
        jsBytes: null,
        totalBytes: null,
        finalUrl: null,
        runtimeError: 'LOGIN_FAILED'
      };
      lhr = { loginError: loginFailed };
    } else {
      const result = await lighthouse(
        `${baseUrl}${route.path}`,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance']
        },
        {
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
              cpuSlowdownMultiplier: 1
            },
            disableStorageReset: Boolean(route.as)
          }
        }
      );
      lhr = result.lhr;
      summary = extractSummary(lhr, route);
      if (
        route.as &&
        !summary.runtimeError &&
        summary.finalUrl &&
        new URL(summary.finalUrl).pathname.startsWith('/login')
      ) {
        summary.runtimeError = 'SESSION_LOST';
        summary.score = null;
        summary.lcp = null;
        summary.tbt = null;
        summary.fcp = null;
        summary.cls = null;
        summary.jsBytes = null;
        summary.totalBytes = null;
      }
    }
  } finally {
    await chrome.kill();
  }
  return { summary, lhr };
}

function pad(s, w, right = false) {
  s = String(s);
  if (s.length >= w) return s;
  return right ? s.padStart(w) : s.padEnd(w);
}

function fmtNum(n, digits = 0) {
  if (n == null) return '-';
  return Number(n).toFixed(digits);
}
function fmtKB(bytes) {
  if (bytes == null) return '-';
  return (bytes / 1024).toFixed(0);
}
function fmtPct(curr, base) {
  if (curr == null || base == null || base === 0) return '-';
  const d = curr / base - 1;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${(d * 100).toFixed(1)}%`;
}
function fmtMsDelta(curr, base) {
  if (curr == null || base == null) return '-';
  const d = curr - base;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${d.toFixed(0)}`;
}

function buildTable(current, baseline) {
  const baseByPath = new Map();
  if (baseline) for (const r of baseline.routes) baseByPath.set(r.path, r);

  const cols = [
    { name: 'PATH', w: 28 },
    { name: 'AS', w: 8 },
    { name: 'SCORE', w: 6 },
    { name: 'LCP(ms)', w: 9 },
    { name: 'ΔLCP', w: 8 },
    { name: 'TBT(ms)', w: 9 },
    { name: 'FCP(ms)', w: 9 },
    { name: 'CLS', w: 6 },
    { name: 'JS(KB)', w: 8 },
    { name: 'ΔJS%', w: 7 },
    { name: 'TOT(KB)', w: 8 },
    { name: 'NOTE', w: 14 }
  ];

  const header = cols.map((c) => pad(c.name, c.w)).join(' ');
  const sep = cols.map((c) => '-'.repeat(c.w)).join(' ');
  const lines = [header, sep];

  for (const r of current.routes) {
    const b = baseByPath.get(r.path);
    const noteParts = [];
    if (r.runtimeError) noteParts.push(r.runtimeError);
    if (baseline && !b) noteParts.push('NEW');
    const row = [
      pad(r.path, cols[0].w),
      pad(r.as ?? '-', cols[1].w),
      pad(fmtNum(r.score), cols[2].w),
      pad(fmtNum(r.lcp), cols[3].w),
      pad(fmtMsDelta(r.lcp, b?.lcp), cols[4].w),
      pad(fmtNum(r.tbt), cols[5].w),
      pad(fmtNum(r.fcp), cols[6].w),
      pad(fmtNum(r.cls, 3), cols[7].w),
      pad(fmtKB(r.jsBytes), cols[8].w),
      pad(fmtPct(r.jsBytes, b?.jsBytes), cols[9].w),
      pad(fmtKB(r.totalBytes), cols[10].w),
      pad(noteParts.join(',') || '-', cols[11].w)
    ];
    lines.push(row.join(' '));
  }
  return lines.join('\n');
}

function evaluateGate(current, baseline) {
  const regressions = [];
  if (!baseline) return regressions;
  const baseByPath = new Map(baseline.routes.map((r) => [r.path, r]));
  for (const r of current.routes) {
    const b = baseByPath.get(r.path);
    if (!b) continue;
    if (r.jsBytes != null && b.jsBytes != null && b.jsBytes > 0) {
      const delta = r.jsBytes / b.jsBytes - 1;
      if (delta > GATE_JS_BYTES_PCT) {
        regressions.push({
          path: r.path,
          kind: 'JS_BYTES',
          detail: `+${(delta * 100).toFixed(2)}% (${(b.jsBytes / 1024).toFixed(0)}KB → ${(r.jsBytes / 1024).toFixed(0)}KB)`
        });
      }
    }
    if (r.lcp != null && b.lcp != null) {
      const dMs = r.lcp - b.lcp;
      const dPct = b.lcp > 0 ? dMs / b.lcp : 0;
      if (dMs > GATE_LCP_MS && dPct > GATE_LCP_PCT) {
        regressions.push({
          path: r.path,
          kind: 'LCP',
          detail: `+${dMs.toFixed(0)}ms (+${(dPct * 100).toFixed(1)}%, ${b.lcp.toFixed(0)} → ${r.lcp.toFixed(0)})`
        });
      }
    }
    if (b.lcp != null && r.lcp == null) {
      regressions.push({
        path: r.path,
        kind: 'CRASH',
        detail: `baseline LCP=${b.lcp.toFixed(0)}ms, this run produced no LCP${r.runtimeError ? ` (${r.runtimeError})` : ''}`
      });
    }
  }
  return regressions;
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function loadBaseline() {
  try {
    await access(BASELINE_PATH);
  } catch {
    return null;
  }
  const text = await readFile(BASELINE_PATH, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let routesFile;
  try {
    routesFile = JSON.parse(await readFile(ROUTES_PATH, 'utf8'));
  } catch (err) {
    console.error(`harness error: cannot read ${ROUTES_PATH}: ${err.message}`);
    process.exit(EXIT_HARNESS);
  }
  const users = routesFile.users ?? {};
  const routes = (routesFile.routes ?? []).map(normalizeRoute);
  if (routes.length === 0) {
    console.error('harness error: routes.json has no routes');
    process.exit(EXIT_HARNESS);
  }

  await probeBaseUrl(BASE_URL);
  const chromePath = await resolveChromePath();
  await ensureDir(RESULTS_DIR);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaries = [];

  for (const route of routes) {
    process.stdout.write(`measuring ${route.path}${route.as ? ` (as ${route.as})` : ''} ... `);
    try {
      const { summary, lhr } = await measureRoute(route, users, chromePath, BASE_URL);
      const outPath = join(RESULTS_DIR, `${timestamp}--${sanitizePath(route.path)}.json`);
      await writeFile(outPath, JSON.stringify(lhr, null, 2));
      summaries.push(summary);
      const tag = summary.runtimeError
        ? summary.runtimeError
        : `LCP=${summary.lcp?.toFixed(0) ?? '-'}ms JS=${summary.jsBytes != null ? (summary.jsBytes / 1024).toFixed(0) : '-'}KB`;
      console.log(tag);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      summaries.push({
        path: route.path,
        as: route.as,
        score: null,
        lcp: null,
        tbt: null,
        fcp: null,
        cls: null,
        jsBytes: null,
        totalBytes: null,
        finalUrl: null,
        runtimeError: 'HARNESS_ERROR'
      });
    }
  }

  const allErrored = summaries.every((s) => s.runtimeError === 'HARNESS_ERROR');
  if (allErrored) {
    console.error('\nharness error: every route errored out — aborting.');
    process.exit(EXIT_HARNESS);
  }

  const current = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: summaries
  };

  if (args.saveBaseline) {
    await writeFile(BASELINE_PATH, JSON.stringify(current, null, 2));
    console.log(`\nbaseline written → ${BASELINE_PATH}`);
    console.log(buildTable(current, null));
    process.exit(EXIT_OK);
  }

  const baseline = await loadBaseline();
  console.log('');
  console.log(buildTable(current, baseline));

  if (!baseline) {
    console.log('\nno baseline found — run with --save-baseline to create one.');
    process.exit(EXIT_OK);
  }

  const regressions = evaluateGate(current, baseline);
  if (regressions.length === 0) {
    console.log('\nPASS — no regressions.');
    process.exit(EXIT_OK);
  }

  console.log(`\nFAIL: ${regressions.length} regression(s):`);
  for (const r of regressions) console.log(`  • ${r.path}  ${r.kind}: ${r.detail}`);

  if (args.noGate) {
    console.log('\n--no-gate set; exiting 0 anyway.');
    process.exit(EXIT_OK);
  }
  process.exit(EXIT_REGRESSION);
}

main().catch((err) => {
  console.error(`harness error: ${err.stack ?? err.message ?? err}`);
  process.exit(EXIT_HARNESS);
});
