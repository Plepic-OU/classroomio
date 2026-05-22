#!/usr/bin/env node
// Probe: login as student, navigate to /lms/mylearning, record navigations
// for OBSERVE_MS to detect reload loops. Run from repo root: `node perf/probe-mylearning.mjs`.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch as launchChrome } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES_PATH = path.join(repoRoot, 'perf', 'routes.json');
const BASE_URL = (process.env.PERF_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TARGET = process.env.PROBE_PATH || '/lms/mylearning';
const OBSERVE_MS = Number(process.env.PROBE_OBSERVE_MS || 15000);

const CHROME_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

function resolveChromePath() {
  if (process.env.PERF_CHROME_PATH) return process.env.PERF_CHROME_PATH;
  // Fall back to playwright-core bundled chromium if installed.
  try {
    const { chromium } = require('playwright-core');
    const p = chromium.executablePath();
    if (p) return p;
  } catch {}
  return undefined;
}

async function main() {
  const routes = JSON.parse(readFileSync(ROUTES_PATH, 'utf-8'));
  const student = routes.users?.student;
  if (!student) {
    console.error('routes.json missing users.student');
    process.exit(2);
  }

  const chromePath = resolveChromePath();
  const chrome = await launchChrome({ chromePath, chromeFlags: CHROME_FLAGS });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
    defaultViewport: null,
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());

    // Capture browser console + page errors for context.
    const consoleEvents = [];
    page.on('console', (msg) => {
      consoleEvents.push({ t: Date.now(), type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleEvents.push({ t: Date.now(), type: 'pageerror', text: err.message });
    });

    console.log(`[probe] logging in as ${student.email}`);
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[placeholder="you@domain.com"]', {
      visible: true,
      timeout: 15000,
    });
    await page.type('input[placeholder="you@domain.com"]', student.email, { delay: 10 });
    await page.type('input[placeholder="************"]', student.password, { delay: 10 });
    await page.click('button[type=submit]');
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 });
    console.log(`[probe] logged in; landed at ${page.url()}`);

    // Reset capture before the navigation we care about.
    const navEvents = [];
    const requestDocs = [];
    const t0 = Date.now();
    const stamp = () => Date.now() - t0;

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navEvents.push({ ms: stamp(), kind: 'framenavigated', url: frame.url() });
      }
    });
    page.on('load', () => navEvents.push({ ms: stamp(), kind: 'load', url: page.url() }));
    page.on('domcontentloaded', () =>
      navEvents.push({ ms: stamp(), kind: 'DOMContentLoaded', url: page.url() }),
    );
    page.on('request', (req) => {
      if (req.resourceType() === 'document') {
        requestDocs.push({ ms: stamp(), url: req.url() });
      }
    });

    console.log(`[probe] navigating to ${TARGET}; observing for ${OBSERVE_MS}ms…`);
    page
      .goto(BASE_URL + TARGET, { waitUntil: 'load', timeout: OBSERVE_MS })
      .catch((err) => navEvents.push({ ms: stamp(), kind: 'goto-error', url: err.message }));

    await new Promise((r) => setTimeout(r, OBSERVE_MS));

    // Summarize.
    const mainFrameNavs = navEvents.filter((e) => e.kind === 'framenavigated');
    const loadEvents = navEvents.filter((e) => e.kind === 'load');
    const consoleErrors = consoleEvents.filter(
      (e) => e.type === 'error' || e.type === 'pageerror',
    );

    console.log('\n=== PROBE RESULT ===');
    console.log(`target:              ${TARGET}`);
    console.log(`observe window:      ${OBSERVE_MS}ms`);
    console.log(`document requests:   ${requestDocs.length}`);
    console.log(`main-frame navs:     ${mainFrameNavs.length}`);
    console.log(`load events:         ${loadEvents.length}`);
    console.log(`final URL:           ${page.url()}`);
    console.log(`console errors:      ${consoleErrors.length}`);

    console.log('\ntimeline (first 20 events):');
    for (const ev of navEvents.slice(0, 20)) {
      console.log(`  +${String(ev.ms).padStart(5)}ms  ${ev.kind.padEnd(18)}  ${ev.url}`);
    }
    if (navEvents.length > 20) console.log(`  … (${navEvents.length - 20} more)`);

    if (consoleErrors.length) {
      console.log('\nconsole errors (first 10):');
      for (const e of consoleErrors.slice(0, 10)) {
        console.log(`  [${e.type}] ${e.text}`);
      }
    }

    // A single SvelteKit nav produces ~1 document request. Reload loops produce many.
    const reloading = requestDocs.length >= 3;
    console.log(`\nverdict: ${reloading ? 'RELOAD LOOP DETECTED' : 'page settled'}`);
    process.exit(reloading ? 1 : 0);
  } finally {
    browser.disconnect();
    try {
      await chrome.kill();
    } catch {}
  }
}

main().catch((err) => {
  console.error('[probe] error:', err);
  process.exit(2);
});
