#!/usr/bin/env node
/**
 * Compares SvelteKit routes against existing BDD step file URL references.
 * Outputs docs/bdd-gaps.json listing uncovered routes with persona and priority.
 *
 * Usage: node gap-analysis.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SKILL_DIR, '..', '..', '..');

const ROUTES_DIR  = join(ROOT, 'apps/dashboard/src/routes');
const STEPS_DIR   = join(ROOT, 'tests/e2e/steps');
const FEATURES_DIR = join(ROOT, 'tests/e2e/features');
const OUTPUT_FILE = join(ROOT, 'docs/bdd-gaps.json');

// Routes that have no interactive page to test
const SKIP_SEGMENTS = new Set(['api', 'csp-report', '404', 'logout', 'course']);

// Wave priority by route prefix
const PRIORITY = {
  'login': 1, 'onboarding': 1, 'signup': 1,
  'org': 1, 'courses': 1, 'lms': 2,
  'invite': 2, 'forgot': 3, 'profile': 3,
};

function walkSync(dir, ext, results = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walkSync(full, ext, results);
    else if (e.name.endsWith(ext)) results.push(full);
  }
  return results;
}

// ── 1. Collect SvelteKit routes ──────────────────────────────────────────────

function collectRoutes() {
  const pages = walkSync(ROUTES_DIR, '+page.svelte');
  return pages
    .map(p => relative(ROUTES_DIR, p)
        .replace(/([/\\]|^)\+page\.svelte$/, '') // handles root +page.svelte too
        .replace(/\\/g, '/')
        .replace(/\[\.\.\..*?\]/g, ':params')    // [...rest]
        .replace(/\[.*?\]/g, ':param')            // [id]
    )
    .filter(r => {
      if (!r) return false;
      const first = r.split('/')[0];
      return !SKIP_SEGMENTS.has(first);
    });
}

// ── 2. Collect URL references from step files ─────────────────────────────────

function collectCoveredSegments() {
  const covered = new Set();
  const stepFiles = walkSync(STEPS_DIR, '.ts');
  const featureFiles = walkSync(FEATURES_DIR, '.feature');

  for (const f of [...stepFiles, ...featureFiles]) {
    const src = readFileSync(f, 'utf8');

    // goto('/path') or goto("/path") or goto(`/path`)
    for (const m of src.matchAll(/goto\(['"`]([^'"`]+)['"`]/g)) {
      normaliseUrl(m[1]).forEach(s => covered.add(s));
    }

    // waitForURL(/pattern/) — extract the first non-meta segment
    for (const m of src.matchAll(/waitForURL\(\/\\?\/([a-z-]+)/g)) {
      covered.add(m[1]);
    }

    // waitForURL('/literal')
    for (const m of src.matchAll(/waitForURL\(['"`]([^'"`]+)['"`]/g)) {
      normaliseUrl(m[1]).forEach(s => covered.add(s));
    }
  }

  return covered;
}

function normaliseUrl(url) {
  return url
    .replace(/^https?:\/\/[^/]+/, '')  // strip host
    .split('/')
    .filter(s => s && !/^[:[]/.test(s)); // non-empty, non-param segments
}

// ── 3. Compute and output gaps ────────────────────────────────────────────────

const routes = collectRoutes();
const covered = collectCoveredSegments();

function isCovered(route) {
  const segments = route.split('/').filter(s => s && !/^:/.test(s));
  // A route is covered if every non-param segment appears in the covered set
  return segments.every(s => covered.has(s));
}

function inferPersona(route) {
  if (route.startsWith('lms') || route.startsWith('invite/s')) return 'student';
  if (route.startsWith('org') || route.startsWith('courses')) return 'admin';
  return 'any';
}

function inferPriority(route) {
  const first = route.split('/')[0];
  return PRIORITY[first] ?? 3;
}

function suggestFeatureFile(route) {
  const parts = route.split('/').filter(s => !s.startsWith(':'));
  // e.g. courses/:param/lessons → courses/lesson-management
  const domain = parts[0];
  const leaf = parts[parts.length - 1] === domain ? domain : parts[parts.length - 1];
  const name = leaf.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  return `${domain}/${name}.feature`;
}

const gaps = routes
  .filter(r => !isCovered(r))
  .map(r => ({
    route: r,
    persona: inferPersona(r),
    priority: inferPriority(r),
    suggestedFeatureFile: suggestFeatureFile(r),
  }))
  .sort((a, b) => a.priority - b.priority || a.route.localeCompare(b.route));

mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(OUTPUT_FILE, JSON.stringify(gaps, null, 2));

console.log(`\nGap analysis complete — ${gaps.length} uncovered route(s):\n`);
const byPriority = gaps.reduce((acc, g) => {
  const key = `Wave ${g.priority}`;
  (acc[key] ??= []).push(g);
  return acc;
}, {});
for (const [wave, items] of Object.entries(byPriority)) {
  console.log(`  ${wave}:`);
  for (const g of items) {
    console.log(`    ${g.route.padEnd(40)} [${g.persona}]  →  ${g.suggestedFeatureFile}`);
  }
}
console.log(`\nFull report: docs/bdd-gaps.json\n`);
