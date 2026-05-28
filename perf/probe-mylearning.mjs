#!/usr/bin/env node
/**
 * Minimal probe for /lms/mylearning reload-loop diagnosis.
 *
 * Logs in as perf-student-1, navigates to /lms/mylearning, and counts
 * navigation events over a 6-second observation window.
 *
 * Usage:
 *   node perf/probe-mylearning.mjs              # default http://localhost:4000
 *   PERF_BASE_URL=http://localhost:3000 node perf/probe-mylearning.mjs
 */

import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.PERF_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const STUDENT  = { email: 'perf-student-1@workshop.local', password: '123456' };
const OBSERVE_MS = 6000;

function resolveChromeExecutable() {
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {}
  try {
    const cacheDir = join(process.env.HOME ?? '/root', '.cache', 'ms-playwright');
    if (existsSync(cacheDir)) {
      for (const dir of readdirSync(cacheDir).filter(d => d.startsWith('chromium-')).reverse()) {
        const candidate = join(cacheDir, dir, 'chrome-linux', 'chrome');
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {}
  return undefined;
}

async function main() {
  const executablePath = resolveChromeExecutable();
  console.log(`[probe] Base URL  : ${BASE_URL}`);
  console.log(`[probe] Chrome    : ${executablePath ?? 'system default'}`);
  console.log(`[probe] Student   : ${STUDENT.email}`);
  console.log();

  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── Step 1: Login ────────────────────────────────────────────────────────────
  console.log('[probe] Logging in…');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

  await page.evaluate(({ email, password }) => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const emailInput = inputs.find(i => i.placeholder === 'you@domain.com' || i.type === 'email');
    const pwInput = inputs.find(i => i.type === 'password');
    if (!emailInput) throw new Error('email input not found');
    if (!pwInput)    throw new Error('password input not found');
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = password;
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, { email: STUDENT.email, password: STUDENT.password });

  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 30000, polling: 300 }
  );
  console.log(`[probe] After login → ${page.url()}`);

  // ── Step 2: Navigate to /lms/mylearning ──────────────────────────────────────
  console.log('[probe] Navigating to /lms/mylearning…');

  const navLog = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navLog.push({ t: Date.now(), url: frame.url() });
    }
  });

  const t0 = Date.now();
  await page.goto(`${BASE_URL}/lms/mylearning`, { waitUntil: 'commit', timeout: 15000 });

  // Observe for OBSERVE_MS ms, counting navigations
  await page.waitForTimeout(OBSERVE_MS);

  const elapsed = Date.now() - t0;
  console.log();
  console.log(`[probe] Observation window: ${elapsed}ms`);
  console.log(`[probe] Navigations detected: ${navLog.length}`);
  for (const n of navLog) {
    console.log(`        +${n.t - t0}ms → ${n.url}`);
  }

  const finalUrl = page.url();
  const finalPath = new URL(finalUrl).pathname;
  console.log();
  if (navLog.length > 3) {
    console.log(`[probe] FAIL — reload loop detected (${navLog.length} navigations in ${elapsed}ms)`);
    console.log(`        Final URL: ${finalUrl}`);
  } else if (finalPath.startsWith('/lms')) {
    console.log(`[probe] PASS — page settled at ${finalPath} (${navLog.length} navigations)`);
  } else {
    console.log(`[probe] WARN — page ended at unexpected path: ${finalPath}`);
  }

  await browser.close();
  process.exit(navLog.length > 3 ? 1 : 0);
}

main().catch(err => {
  console.error('[probe] Error:', err.message);
  process.exit(2);
});
