#!/usr/bin/env node
/**
 * generate-c4.ts — Generates Mermaid C4 diagrams from extracted component JSON.
 *
 * Reads:  docs/c4/components-{api,dashboard}.json
 * Writes (only when content changes):
 *   docs/c4/c4-context.md              — L1 System Context (static/curated)
 *   docs/c4/c4-containers.md           — L2 Containers (static/curated)
 *   docs/c4/c4-components-api.md       — L3 API components (from AST)
 *   docs/c4/c4-components-dashboard.md — L3 Dashboard components (from AST)
 *
 * Usage (from workspace root):
 *   npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/generate-c4.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const DOCS_DIR = path.join(WORKSPACE_ROOT, 'docs/c4');

// Short descriptions for well-known component keys (aggregated display depth=2 keys)
const DESCRIPTIONS: Record<string, string> = {
  // Dashboard — depth-2 aggregated keys
  'routes': 'SvelteKit page routes',
  'routes/auth': 'Auth pages (login, signup, reset, email verify)',
  'routes/api': 'Server-side API endpoints',
  'routes/courses': 'Course editor hub (teacher side)',
  'routes/lms': 'Student-facing LMS pages',
  'routes/org': 'Organization management pages',
  'routes/course': 'Public course view (unauthenticated)',
  'routes/profile': 'User profile pages',
  'routes/onboarding': 'Onboarding wizard',
  'routes/invite': 'Invitation accept flow',
  'routes/upgrade': 'Plan upgrade page',
  'lib/components': 'Shared UI component library (Course, Org, LMS, Auth, Nav…)',
  'lib/utils': 'Services, stores, types, constants, i18n',
  'lib/mocks': 'Language syntax mocks (for code demos)',
  'lib/mail': 'Email template utilities',
  // API — depth-2 keys
  'services': 'Business logic services',
  'services/course': 'Course cloning service',
  'middlewares': 'Auth and rate-limiting middleware',
  'utils': 'Utility modules (S3, email, Redis, Supabase, certificates)',
  'utils/auth': 'User JWT validation',
  'utils/redis': 'Redis client and rate limiter',
  'utils/openapi': 'OpenAPI schema generation',
  'config': 'Environment configuration',
  'constants': 'Application constants',
  'types': 'TypeScript type definitions',
  'types/course': 'Course-related types',
};

interface ComponentData {
  key: string;
  label: string;
  description: string;
  tsFiles: number;
  svelteFiles: number;
  totalFiles: number;
  representativeFiles: string[];
  imports: string[];
}

interface ExtractResult {
  app: string;
  packageName: string;
  depth: number;
  components: ComponentData[];
  timestamp: string;
  warnings: string[];
}

interface ChangeResult {
  file: string;
  changed: boolean;
  summary: string[];
}

/** Stable Mermaid node ID — strip everything that isn't alphanumeric. */
function nodeId(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '_');
}

// ---------------------------------------------------------------------------
// Change detection helpers
// ---------------------------------------------------------------------------

/** Strip timestamps so a regeneration with no code changes never looks like a diff. */
function normalize(content: string): string {
  return content.replace(/Generated \d{4}-\d{2}-\d{2}T[\d:.Z]+\./g, 'Generated <timestamp>.');
}

function parseComponentLabels(content: string): string[] {
  return [...content.matchAll(/Component\(\w+,\s*"([^"]+)"/g)].map((m) => m[1]).sort();
}

function parseRelEdges(content: string): string[] {
  return [...content.matchAll(/Rel\((\w+),\s*(\w+)/g)].map((m) => `${m[1]}→${m[2]}`).sort();
}

function diffSets(
  oldList: string[],
  newList: string[],
): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldList);
  const newSet = new Set(newList);
  return {
    added: newList.filter((x) => !oldSet.has(x)),
    removed: oldList.filter((x) => !newSet.has(x)),
  };
}

function buildChangeSummary(oldContent: string, newContent: string, filename: string): string[] {
  const lines: string[] = [];

  if (filename.startsWith('c4-components-')) {
    const compDiff = diffSets(parseComponentLabels(oldContent), parseComponentLabels(newContent));
    const relDiff = diffSets(parseRelEdges(oldContent), parseRelEdges(newContent));

    if (compDiff.added.length) lines.push(`    + components: ${compDiff.added.join(', ')}`);
    if (compDiff.removed.length) lines.push(`    - components: ${compDiff.removed.join(', ')}`);
    if (relDiff.added.length) lines.push(`    + relationships: ${relDiff.added.join(', ')}`);
    if (relDiff.removed.length) lines.push(`    - relationships: ${relDiff.removed.join(', ')}`);
    if (lines.length === 0) lines.push('    (diagram content updated)');
  } else {
    lines.push('    (static content updated)');
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Layer 1 — System Context
// ---------------------------------------------------------------------------
function contextDiagram(): string {
  return [
    '```mermaid',
    'C4Context',
    '    title System Context — ClassroomIO LMS',
    '',
    '    Person(teacher, "Teacher / Admin", "Creates courses, manages students and content")',
    '    Person(student, "Student", "Learns through courses, submits exercises")',
    '',
    '    System(classroomio, "ClassroomIO", "Open-source Learning Management System")',
    '',
    '    System_Ext(supabase_auth, "Supabase Auth", "JWT-based authentication")',
    '    System_Ext(supabase_db, "Supabase PostgreSQL", "Primary relational data store")',
    '    System_Ext(cloudflare_r2, "Cloudflare R2", "Video and file storage (S3-compatible)")',
    '    System_Ext(redis, "Redis", "Rate limiting and caching")',
    '    System_Ext(openai, "OpenAI", "AI-powered grading and content completion")',
    '    System_Ext(email_svc, "ZeptoMail / SMTP", "Transactional email delivery")',
    '    System_Ext(payment, "Payment Providers", "Stripe, Polar, LemonSqueezy")',
    '    System_Ext(posthog, "PostHog", "Product analytics")',
    '    System_Ext(sentry, "Sentry", "Error monitoring")',
    '    System_Ext(unsplash, "Unsplash", "Stock image search proxy")',
    '',
    '    Rel(teacher, classroomio, "Manages courses via", "HTTPS")',
    '    Rel(student, classroomio, "Learns via", "HTTPS")',
    '    Rel(classroomio, supabase_auth, "Authenticates users")',
    '    Rel(classroomio, supabase_db, "Stores and reads data")',
    '    Rel(classroomio, cloudflare_r2, "Stores videos and files")',
    '    Rel(classroomio, redis, "Rate-limits API requests")',
    '    Rel(classroomio, openai, "Requests AI completions and grading")',
    '    Rel(classroomio, email_svc, "Sends transactional emails")',
    '    Rel(classroomio, payment, "Processes subscriptions and payments")',
    '    Rel(classroomio, posthog, "Tracks product analytics")',
    '    Rel(classroomio, sentry, "Reports errors")',
    '    Rel(classroomio, unsplash, "Searches stock images")',
    '```',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Layer 2 — Containers
// ---------------------------------------------------------------------------
function containerDiagram(): string {
  return [
    '```mermaid',
    'C4Container',
    '    title Container Diagram — ClassroomIO',
    '',
    '    Person(teacher, "Teacher / Admin")',
    '    Person(student, "Student")',
    '',
    '    System_Boundary(classroomio, "ClassroomIO") {',
    '        Container(dashboard, "Dashboard", "SvelteKit + Vite, :5173", "Web frontend. Auth, course editing, LMS views, org management, billing.")',
    '        Container(api, "API", "Hono + Node.js", "Long-running ops: PDF export, video presign URLs, email dispatch, course cloning.")',
    '        ContainerDb(db, "PostgreSQL", "Supabase (local or cloud)", "Primary data store. RLS-enforced. 37 migrations.")',
    '        ContainerDb(redis_db, "Redis", "ioredis", "Per-endpoint rate limiting for the API.")',
    '    }',
    '',
    '    System_Ext(cloudflare_r2, "Cloudflare R2", "Video and file storage")',
    '    System_Ext(openai, "OpenAI", "AI completions and grading")',
    '    System_Ext(email_svc, "ZeptoMail / SMTP", "Email delivery")',
    '    System_Ext(payment_svc, "Payment Providers", "Stripe, Polar, LemonSqueezy")',
    '    System_Ext(posthog, "PostHog", "Analytics")',
    '    System_Ext(supabase_auth, "Supabase Auth", "JWT auth")',
    '',
    '    Rel(teacher, dashboard, "Uses", "HTTPS")',
    '    Rel(student, dashboard, "Uses", "HTTPS")',
    '    Rel(dashboard, db, "Reads/writes via Supabase JS SDK")',
    '    Rel(dashboard, supabase_auth, "Authenticates via JWT")',
    '    Rel(dashboard, api, "Delegates heavy ops to", "HTTP + @cio/api RPC types")',
    '    Rel(dashboard, openai, "AI completions", "HTTP")',
    '    Rel(dashboard, payment_svc, "Initiates payments via SDK")',
    '    Rel(dashboard, posthog, "Tracks analytics events")',
    '    Rel(api, db, "Reads/writes via Supabase Admin SDK")',
    '    Rel(api, redis_db, "Rate-limits requests")',
    '    Rel(api, cloudflare_r2, "Uploads / presigns files", "S3 API")',
    '    Rel(api, email_svc, "Dispatches emails", "SMTP / ZeptoMail API")',
    '```',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Layer 3 — Component diagram (from AST extraction)
// ---------------------------------------------------------------------------

// Prefixes to exclude from diagrams — not architectural components
const DIAGRAM_EXCLUDE_PREFIXES = ['lib/mocks', '__root__', '__mocks__'];

// Min total files for a component to appear in the diagram
const DIAGRAM_MIN_FILES = 2;

/** Aggregate fine-grained component JSON to a shallower display depth.
 *
 * The extraction JSON may be at depth=5 for full AI-context detail.  For the
 * Mermaid diagram we collapse to displayDepth=2 so the diagram stays at 5–20
 * nodes, matching C4 conventions for a readable L3 view.
 */
function aggregateComponents(components: ComponentData[], displayDepth: number): ComponentData[] {
  const aggMap = new Map<string, ComponentData>();

  function aggKey(key: string): string {
    if (key === '__root__') return '__root__';
    return key.split('/').slice(0, displayDepth).join('/');
  }

  for (const comp of components) {
    const ak = aggKey(comp.key);
    if (!aggMap.has(ak)) {
      aggMap.set(ak, {
        key: ak,
        label: keyToLabel(ak),
        description: DESCRIPTIONS[ak] ?? `${ak.split('/').pop()} module`,
        tsFiles: 0,
        svelteFiles: 0,
        totalFiles: 0,
        representativeFiles: [],
        imports: [],
      });
    }
    const agg = aggMap.get(ak)!;
    agg.tsFiles += comp.tsFiles;
    agg.svelteFiles += comp.svelteFiles;
    agg.totalFiles += comp.totalFiles;

    for (const importedKey of comp.imports) {
      const importedAk = aggKey(importedKey);
      if (importedAk !== ak) {
        agg.imports.push(importedAk);
      }
    }
  }

  // Deduplicate import lists
  for (const comp of aggMap.values()) {
    comp.imports = [...new Set(comp.imports)].sort();
  }

  return [...aggMap.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Human-readable label — handles SvelteKit [dynamic] segments. */
function keyToLabel(key: string): string {
  if (key === '__root__') return 'Root';
  const parts = key.split('/');
  const staticParts = parts.filter((p) => !p.startsWith('['));
  const isDynamic = staticParts.length < parts.length;
  const lastName = staticParts.at(-1) ?? parts.at(-1)!;
  const base = lastName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return isDynamic ? `${base} (Detail)` : base;
}

function componentDiagram(data: ExtractResult): string {
  // Diagram display depth: 2 for dashboard (collapses routes/* and lib/*),
  // kept at extraction depth for api (already depth=2).
  const displayDepth = data.app === 'dashboard' ? 2 : data.depth;

  const aggregated = aggregateComponents(data.components, displayDepth);

  // Filter: drop excluded prefixes, leaf-only nodes, and empty aggregates
  const relevant = aggregated.filter(
    (c) =>
      !DIAGRAM_EXCLUDE_PREFIXES.some((pfx) => c.key === pfx || c.key.startsWith(pfx + '/')) &&
      c.totalFiles >= DIAGRAM_MIN_FILES,
  );

  if (relevant.length === 0) {
    return '_No components found. Run extract-components.ts first._';
  }

  const relevantKeys = new Set(relevant.map((c) => c.key));

  const containerLabel =
    data.app === 'dashboard' ? 'Dashboard (SvelteKit)' : 'API (Hono + Node.js)';

  const lines: string[] = [
    '```mermaid',
    'C4Component',
    `    title Component Diagram — ${containerLabel}`,
    '',
    `    Container_Boundary(${nodeId(data.app)}, "${containerLabel}") {`,
  ];

  for (const comp of relevant) {
    const id = nodeId(comp.key);
    const tech =
      data.app === 'dashboard'
        ? comp.svelteFiles > 0
          ? `Svelte+TS (${comp.svelteFiles}+${comp.tsFiles} files)`
          : `TypeScript (${comp.tsFiles} files)`
        : `TypeScript (${comp.tsFiles} files)`;
    const desc = comp.description.replace(/"/g, "'");
    lines.push(`        Component(${id}, "${comp.label}", "${tech}", "${desc}")`);
  }

  lines.push('    }', '');

  // Edges — deduplicated, only between relevant nodes
  const emitted = new Set<string>();
  for (const comp of relevant) {
    const fromId = nodeId(comp.key);
    for (const importKey of comp.imports) {
      if (!relevantKeys.has(importKey)) continue;
      const toId = nodeId(importKey);
      const edge = `${fromId}→${toId}`;
      if (emitted.has(edge)) continue;
      emitted.add(edge);
      lines.push(`    Rel(${fromId}, ${toId}, "uses")`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function md(title: string, description: string, diagram: string): string {
  return `# ${title}\n\n${description}\n\n${diagram}\n`;
}

function loadJson(appName: string): ExtractResult | null {
  const p = path.join(DOCS_DIR, `components-${appName}.json`);
  if (!fs.existsSync(p)) {
    process.stderr.write(`  ⚠  Missing ${p} — run extract-components.ts first\n`);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as ExtractResult;
}

function write(filename: string, content: string): ChangeResult {
  const out = path.join(DOCS_DIR, filename);
  const result: ChangeResult = { file: filename, changed: false, summary: [] };

  if (fs.existsSync(out)) {
    const existing = fs.readFileSync(out, 'utf-8');
    if (normalize(existing) === normalize(content)) {
      process.stdout.write(`  (unchanged) docs/c4/${filename}\n`);
      return result;
    }
    result.summary = buildChangeSummary(existing, content, filename);
  } else {
    result.summary = ['    (new file)'];
  }

  result.changed = true;
  fs.writeFileSync(out, content, 'utf-8');
  process.stdout.write(`✓ docs/c4/${filename}\n`);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const results: ChangeResult[] = [];

  results.push(
    write(
      'c4-context.md',
      md(
        'C4 Layer 1 — System Context',
        'External actors and systems ClassroomIO interacts with.',
        contextDiagram(),
      ),
    ),
  );

  results.push(
    write(
      'c4-containers.md',
      md(
        'C4 Layer 2 — Containers',
        'Runtime containers that make up ClassroomIO and how they communicate.',
        containerDiagram(),
      ),
    ),
  );

  const apiData = loadJson('api');
  if (apiData) {
    results.push(
      write(
        'c4-components-api.md',
        md(
          'C4 Layer 3 — API Components',
          `Extracted from \`apps/api/src\` at depth=${apiData.depth}. Generated ${apiData.timestamp}.`,
          componentDiagram(apiData),
        ),
      ),
    );
  }

  const dashData = loadJson('dashboard');
  if (dashData) {
    results.push(
      write(
        'c4-components-dashboard.md',
        md(
          'C4 Layer 3 — Dashboard Components',
          `Extracted from \`apps/dashboard/src\` at depth=${dashData.depth}. Generated ${dashData.timestamp}.`,
          componentDiagram(dashData),
        ),
      ),
    );
  }

  // Print change summary
  const changed = results.filter((r) => r.changed);
  process.stdout.write('\n');
  if (changed.length === 0) {
    process.stdout.write('No changes — docs/c4/ diagrams are already up to date.\n');
  } else {
    process.stdout.write(`${changed.length} file(s) updated:\n`);
    for (const r of changed) {
      process.stdout.write(`  docs/c4/${r.file}\n`);
      for (const line of r.summary) {
        process.stdout.write(`${line}\n`);
      }
    }
  }
}

main();
