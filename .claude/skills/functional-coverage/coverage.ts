#!/usr/bin/env node
/**
 * Functional test coverage extractor for ClassroomIO.
 * Maps user-facing behaviours (pages, server routes, API endpoints) to test coverage.
 * Output: docs/coverage/functional.md
 *
 * Usage: npx tsx .claude/skills/functional-coverage/coverage.ts
 */

import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT        = path.resolve(__dirname, '../../..');
const DASHBOARD_SRC    = path.join(REPO_ROOT, 'apps/dashboard/src');
const DASHBOARD_ROUTES = path.join(DASHBOARD_SRC, 'routes');
const API_SRC          = path.join(REPO_ROOT, 'apps/api/src');
const CYPRESS_DIR      = path.join(REPO_ROOT, 'cypress');
const OUT_DIR          = path.join(REPO_ROOT, 'docs/coverage');
const OUT_FILE         = path.join(OUT_DIR, 'functional.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walk(dir: string, fn: (fp: string) => void) {
  try {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(fp, fn);
      else fn(fp);
    }
  } catch { /* skip unreadable */ }
}

// ---------------------------------------------------------------------------
// Cypress: extract visited routes from cy.visit() and url assertions
// ---------------------------------------------------------------------------

function extractCypressRoutes(): Set<string> {
  const routes = new Set<string>();
  walk(CYPRESS_DIR, fp => {
    if (!fp.endsWith('.cy.ts') && !fp.endsWith('.cy.js')) return;
    const content = fs.readFileSync(fp, 'utf-8');
    for (const m of content.matchAll(/cy\.visit\(['"`]([^'"`]+)['"`]\)/g)) {
      try { routes.add(new URL(m[1]).pathname); } catch { routes.add(m[1]); }
    }
    for (const m of content.matchAll(/cy\.url\(\)\.should\(['"`]contain['"`],\s*['"`]([^'"`]+)['"`]\)/g)) {
      routes.add(m[1]);
    }
  });
  return routes;
}

// ---------------------------------------------------------------------------
// SvelteKit routes
// ---------------------------------------------------------------------------

type RouteType = 'page' | 'server';

interface SvelteRoute {
  urlPattern: string;
  type: RouteType;
  dir: string;
  unitTested: boolean;
  e2eTested: boolean;
}

function toUrlPattern(dir: string): string {
  const rel = path.relative(DASHBOARD_ROUTES, dir);
  if (!rel) return '/';
  const segments = rel.split(path.sep).filter(seg => !(seg.startsWith('(') && seg.endsWith(')')));
  return '/' + segments.join('/');
}

function matchesCypress(pattern: string, cypressRoutes: Set<string>): boolean {
  const regexStr = '^' + pattern
    .replace(/\[\.\.\..*?\]/g, '.+')
    .replace(/\[.*?\]/g, '[^/]+') + '(/.*)?$';
  const re = new RegExp(regexStr);
  return [...cypressRoutes].some(r => re.test(r));
}

function extractSvelteKitRoutes(cypressRoutes: Set<string>): SvelteRoute[] {
  const pageDirs   = new Set<string>();
  const serverDirs = new Set<string>();
  const testDirs   = new Set<string>();

  walk(DASHBOARD_ROUTES, fp => {
    const name = path.basename(fp);
    if (name === '+page.svelte' || name.startsWith('+page.')) pageDirs.add(path.dirname(fp));
    if (name === '+server.ts')                                  serverDirs.add(path.dirname(fp));
  });

  walk(DASHBOARD_SRC, fp => {
    if (fp.includes('.test.') || fp.includes('.spec.')) testDirs.add(path.dirname(fp));
  });

  const routes: SvelteRoute[] = [];

  for (const dir of pageDirs) {
    const urlPattern = toUrlPattern(dir);
    routes.push({ urlPattern, type: 'page', dir, unitTested: testDirs.has(dir), e2eTested: matchesCypress(urlPattern, cypressRoutes) });
  }
  for (const dir of serverDirs) {
    const urlPattern = toUrlPattern(dir);
    routes.push({ urlPattern, type: 'server', dir, unitTested: testDirs.has(dir), e2eTested: matchesCypress(urlPattern, cypressRoutes) });
  }

  return routes.sort((a, b) => a.urlPattern.localeCompare(b.urlPattern));
}

// ---------------------------------------------------------------------------
// Hono endpoints
// ---------------------------------------------------------------------------

interface HonoEndpoint {
  method: string;
  path: string;
  file: string;
  unitTested: boolean;
}

function buildMountPrefixes(project: Project): Map<string, string> {
  // varName → mount path — built from .route('/prefix', varName) calls
  const prefixes = new Map<string, string>();
  const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'route']);
  for (const sf of project.getSourceFiles()) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) continue;
      if (expr.getName() !== 'route') continue;
      const args = call.getArguments();
      if (args.length < 2 || !args[0].isKind(SyntaxKind.StringLiteral)) continue;
      const mountPath = args[0].getText().slice(1, -1);
      const varArg = args[1];
      if (varArg.isKind(SyntaxKind.Identifier)) {
        prefixes.set(varArg.getText(), mountPath);
      }
    }
  }
  return prefixes;
}

function extractHonoEndpoints(): HonoEndpoint[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    `${API_SRC}/**/*.ts`,
    `!${API_SRC}/**/*.d.ts`,
    `!${API_SRC}/**/*.test.*`,
    `!${API_SRC}/**/*.spec.*`,
  ]);

  const testDirs = new Set<string>();
  walk(API_SRC, fp => {
    if (fp.includes('.test.') || fp.includes('.spec.')) testDirs.add(path.dirname(fp));
  });

  // Build a simple varName → mountPrefix map for one level of nesting
  const mountPrefixes = buildMountPrefixes(project);

  // Resolve export name for a source file (the const name that holds the router)
  function exportedRouterName(sf: ReturnType<typeof project.getSourceFiles>[0]): string | null {
    for (const decl of sf.getVariableDeclarations()) {
      if (decl.isExported()) return decl.getName();
    }
    return null;
  }

  const HTTP_VERBS = new Set(['get', 'post', 'put', 'delete', 'patch']);
  const endpoints: HonoEndpoint[] = [];
  const seen = new Set<string>();

  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath() as string;
    const relFile = path.relative(API_SRC, fp);
    const routerName = exportedRouterName(sf);
    const mountPrefix = routerName ? (mountPrefixes.get(routerName) ?? '') : '';

    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!expr.isKind(SyntaxKind.PropertyAccessExpression)) continue;
      const methodName = expr.getName();
      if (!HTTP_VERBS.has(methodName)) continue;
      const args = call.getArguments();
      if (!args[0]?.isKind(SyntaxKind.StringLiteral)) continue;
      const routePath = args[0].getText().slice(1, -1);
      if (!routePath.startsWith('/')) continue;

      const fullPath = mountPrefix + routePath;
      const key = `${methodName.toUpperCase()}|${fullPath}`;
      if (seen.has(key)) continue;
      seen.add(key);

      endpoints.push({
        method: methodName.toUpperCase(),
        path: fullPath,
        file: relFile,
        unitTested: testDirs.has(path.dirname(fp)),
      });
    }
  }

  return endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function icon(unit: boolean, e2e = false): string {
  if (unit && e2e) return '✅ unit + e2e';
  if (unit)        return '🧪 unit only';
  if (e2e)         return '🌐 e2e only';
  return '❌ none';
}

function summaryCoverage(items: { unitTested: boolean; e2eTested?: boolean }[]): string {
  const n = items.filter(i => i.unitTested || (i.e2eTested ?? false)).length;
  const pct = items.length ? Math.round((n / items.length) * 100) : 0;
  return `${n} / ${items.length} (${pct}%)`;
}

function generateReport(routes: SvelteRoute[], endpoints: HonoEndpoint[]): string {
  const pages        = routes.filter(r => r.type === 'page');
  const serverRoutes = routes.filter(r => r.type === 'server');
  const date         = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push('# Functional Test Coverage', '');
  lines.push(`_Generated ${date}. Covers user-facing behaviour — pages, server routes, API endpoints — not line coverage._`, '');

  lines.push('## Summary', '');
  lines.push('| Layer | Covered |');
  lines.push('|-------|---------|');
  lines.push(`| Dashboard pages | ${summaryCoverage(pages)} |`);
  lines.push(`| Dashboard server routes (\`+server.ts\`) | ${summaryCoverage(serverRoutes)} |`);
  lines.push(`| Hono API endpoints | ${summaryCoverage(endpoints)} |`);
  lines.push('');
  lines.push('**Legend:** ✅ unit + e2e &nbsp;&nbsp; 🧪 unit only &nbsp;&nbsp; 🌐 e2e only &nbsp;&nbsp; ❌ none', '');

  lines.push('## Dashboard Pages', '');
  lines.push('| Route | Tests |');
  lines.push('|-------|-------|');
  for (const r of pages) lines.push(`| \`${r.urlPattern}\` | ${icon(r.unitTested, r.e2eTested)} |`);
  lines.push('');

  lines.push('## Dashboard Server Routes', '');
  lines.push('| Route | Tests |');
  lines.push('|-------|-------|');
  for (const r of serverRoutes) lines.push(`| \`${r.urlPattern}\` | ${icon(r.unitTested, r.e2eTested)} |`);
  lines.push('');

  lines.push('## Hono API Endpoints', '');
  lines.push('| Method | Path | File | Tests |');
  lines.push('|--------|------|------|-------|');
  for (const e of endpoints) lines.push(`| \`${e.method}\` | \`${e.path}\` | \`${e.file}\` | ${icon(e.unitTested)} |`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Scanning Cypress tests...');
  const cypressRoutes = extractCypressRoutes();
  console.log(`  → ${cypressRoutes.size} routes covered by Cypress`);

  console.log('Extracting SvelteKit routes...');
  const routes = extractSvelteKitRoutes(cypressRoutes);
  const pages = routes.filter(r => r.type === 'page');
  const servers = routes.filter(r => r.type === 'server');
  console.log(`  → ${pages.length} pages, ${servers.length} server routes`);

  console.log('Extracting Hono endpoints...');
  const endpoints = extractHonoEndpoints();
  console.log(`  → ${endpoints.length} endpoints`);

  fs.writeFileSync(OUT_FILE, generateReport(routes, endpoints));
  console.log(`\nWritten: docs/coverage/functional.md`);
}

main();
