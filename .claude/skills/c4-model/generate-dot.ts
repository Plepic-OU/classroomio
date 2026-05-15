#!/usr/bin/env node
/**
 * generate-dot.ts — Generates Graphviz DOT diagrams from C4 component JSON.
 *
 * Reads:  docs/c4/components-{api,dashboard}.json
 * Writes (only when content changes):
 *   docs/graphviz/context.dot               — L1 System Context (static)
 *   docs/graphviz/containers.dot            — L2 Containers (static)
 *   docs/graphviz/components-api.dot        — L3 API (from AST)
 *   docs/graphviz/components-dashboard.dot  — L3 Dashboard (from AST)
 *
 * Render: dot -Tsvg docs/graphviz/containers.dot -o containers.svg
 *
 * Usage (from workspace root):
 *   npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/generate-dot.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const JSON_DIR = path.join(WORKSPACE_ROOT, 'docs/c4');
const OUT_DIR = path.join(WORKSPACE_ROOT, 'docs/graphviz');

// C4-inspired color palette
const C = {
  person:    { fill: '#08427b', font: 'white' },
  system:    { fill: '#1168bd', font: 'white' },
  external:  { fill: '#999999', font: 'white' },
  db:        { fill: '#438dd5', font: 'white' },
  component: { fill: '#85bbf0', font: '#000000' },
  boundary:  '#666666',
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

const DIAGRAM_EXCLUDE_PREFIXES = ['lib/mocks', '__root__', '__mocks__'];
const DIAGRAM_MIN_FILES = 2;

const DESCRIPTIONS: Record<string, string> = {
  'routes': 'SvelteKit page routes',
  'routes/api': 'Server-side API endpoints',
  'routes/courses': 'Course editor hub (teacher side)',
  'routes/lms': 'Student-facing LMS pages',
  'routes/org': 'Organization management pages',
  'routes/course': 'Public course view (unauthenticated)',
  'routes/profile': 'User profile pages',
  'routes/invite': 'Invitation accept flow',
  'lib/components': 'Shared UI component library',
  'lib/utils': 'Services, stores, types, constants, i18n',
  'lib/mail': 'Email template utilities',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeId(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '_');
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Join non-empty lines with DOT's literal \n for multi-line labels. */
function lbl(...lines: string[]): string {
  return lines.filter(Boolean).join('\\n');
}

function normalize(content: string): string {
  return content.replace(/\/\/ Generated \d{4}-\d{2}-\d{2}T[\d:.Z]+/g, '// Generated <timestamp>');
}

function keyToLabel(key: string): string {
  if (key === '__root__') return 'Root';
  const parts = key.split('/');
  const staticParts = parts.filter((p) => !p.startsWith('['));
  const isDynamic = staticParts.length < parts.length;
  const lastName = staticParts.at(-1) ?? parts.at(-1)!;
  const base = lastName.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return isDynamic ? `${base} (Detail)` : base;
}

function aggregateComponents(components: ComponentData[], displayDepth: number): ComponentData[] {
  const aggMap = new Map<string, ComponentData>();
  const aggKey = (key: string) =>
    key === '__root__' ? '__root__' : key.split('/').slice(0, displayDepth).join('/');

  for (const comp of components) {
    const ak = aggKey(comp.key);
    if (!aggMap.has(ak)) {
      aggMap.set(ak, {
        key: ak,
        label: keyToLabel(ak),
        description: DESCRIPTIONS[ak] ?? `${ak.split('/').pop()} module`,
        tsFiles: 0, svelteFiles: 0, totalFiles: 0, representativeFiles: [], imports: [],
      });
    }
    const agg = aggMap.get(ak)!;
    agg.tsFiles += comp.tsFiles;
    agg.svelteFiles += comp.svelteFiles;
    agg.totalFiles += comp.totalFiles;
    for (const imp of comp.imports) {
      const iak = aggKey(imp);
      if (iak !== ak) agg.imports.push(iak);
    }
  }

  for (const comp of aggMap.values()) {
    comp.imports = [...new Set(comp.imports)].sort();
  }
  return [...aggMap.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Node / edge builders (no leading whitespace — caller provides indentation)
// ---------------------------------------------------------------------------

function personNode(id: string, name: string, desc: string): string {
  return `${id} [label="${lbl(esc(name), '[Person]', esc(desc))}" shape=box style="filled,rounded" fillcolor="${C.person.fill}" fontcolor="${C.person.font}" fontname="Arial" fontsize=11]`;
}

function containerNode(id: string, name: string, tech: string, desc: string): string {
  return `${id} [label="${lbl(esc(name), tech ? `[${esc(tech)}]` : '', esc(desc))}" shape=box style=filled fillcolor="${C.system.fill}" fontcolor="${C.system.font}" fontname="Arial" fontsize=11]`;
}

function externalNode(id: string, name: string, desc: string): string {
  return `${id} [label="${lbl(esc(name), '[External System]', esc(desc))}" shape=box style=filled fillcolor="${C.external.fill}" fontcolor="${C.external.font}" fontname="Arial" fontsize=11]`;
}

function dbNode(id: string, name: string, tech: string, desc: string): string {
  return `${id} [label="${lbl(esc(name), `[${esc(tech)}]`, esc(desc))}" shape=cylinder style=filled fillcolor="${C.db.fill}" fontcolor="${C.db.font}" fontname="Arial" fontsize=11]`;
}

function componentNode(id: string, name: string, tech: string, desc: string): string {
  return `${id} [label="${lbl(esc(name), `[${esc(tech)}]`, esc(desc))}" shape=box style=filled fillcolor="${C.component.fill}" fontcolor="${C.component.font}" fontname="Arial" fontsize=10]`;
}

function edgeLine(from: string, to: string, label?: string): string {
  if (label) return `${from} -> ${to} [label="${esc(label)}" fontsize=9 fontname="Arial"]`;
  return `${from} -> ${to}`;
}

// ---------------------------------------------------------------------------
// L1 — System Context
// ---------------------------------------------------------------------------
function contextDot(): string {
  const i = '  ';
  return [
    `// Generated ${new Date().toISOString()}`,
    'digraph context {',
    `${i}label="System Context — ClassroomIO LMS"`,
    `${i}labelloc=t`,
    `${i}fontname="Arial"`,
    `${i}fontsize=14`,
    `${i}rankdir=TB`,
    '',
    `${i}// Actors`,
    `${i}${personNode('teacher', 'Teacher / Admin', 'Creates courses, manages students')}`,
    `${i}${personNode('student', 'Student', 'Learns through courses, submits exercises')}`,
    '',
    `${i}// Core system`,
    `${i}${containerNode('classroomio', 'ClassroomIO', 'SvelteKit + Hono', 'Open-source Learning Management System')}`,
    '',
    `${i}// External systems`,
    `${i}${externalNode('supabase_auth', 'Supabase Auth', 'JWT-based authentication')}`,
    `${i}${externalNode('supabase_db', 'Supabase PostgreSQL', 'Primary relational data store')}`,
    `${i}${externalNode('cloudflare_r2', 'Cloudflare R2', 'Video and file storage (S3-compatible)')}`,
    `${i}${externalNode('redis', 'Redis', 'Rate limiting and caching')}`,
    `${i}${externalNode('openai', 'OpenAI', 'AI-powered grading and completions')}`,
    `${i}${externalNode('email_svc', 'ZeptoMail / SMTP', 'Transactional email delivery')}`,
    `${i}${externalNode('payment', 'Payment Providers', 'Stripe, Polar, LemonSqueezy')}`,
    `${i}${externalNode('posthog', 'PostHog', 'Product analytics')}`,
    `${i}${externalNode('sentry', 'Sentry', 'Error monitoring')}`,
    `${i}${externalNode('unsplash', 'Unsplash', 'Stock image search proxy')}`,
    '',
    `${i}// Relationships`,
    `${i}${edgeLine('teacher', 'classroomio', 'Manages courses via HTTPS')}`,
    `${i}${edgeLine('student', 'classroomio', 'Learns via HTTPS')}`,
    `${i}${edgeLine('classroomio', 'supabase_auth', 'Authenticates users')}`,
    `${i}${edgeLine('classroomio', 'supabase_db', 'Stores and reads data')}`,
    `${i}${edgeLine('classroomio', 'cloudflare_r2', 'Stores videos and files')}`,
    `${i}${edgeLine('classroomio', 'redis', 'Rate-limits API requests')}`,
    `${i}${edgeLine('classroomio', 'openai', 'AI completions and grading')}`,
    `${i}${edgeLine('classroomio', 'email_svc', 'Sends transactional emails')}`,
    `${i}${edgeLine('classroomio', 'payment', 'Processes payments')}`,
    `${i}${edgeLine('classroomio', 'posthog', 'Tracks analytics')}`,
    `${i}${edgeLine('classroomio', 'sentry', 'Reports errors')}`,
    `${i}${edgeLine('classroomio', 'unsplash', 'Searches stock images')}`,
    '}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// L2 — Containers
// ---------------------------------------------------------------------------
function containersDot(): string {
  const i = '  ';
  const ii = '    ';
  return [
    `// Generated ${new Date().toISOString()}`,
    'digraph containers {',
    `${i}label="Container Diagram — ClassroomIO"`,
    `${i}labelloc=t`,
    `${i}fontname="Arial"`,
    `${i}fontsize=14`,
    `${i}rankdir=LR`,
    `${i}compound=true`,
    '',
    `${i}// Actors`,
    `${i}${personNode('teacher', 'Teacher / Admin', '')}`,
    `${i}${personNode('student', 'Student', '')}`,
    '',
    `${i}subgraph cluster_classroomio {`,
    `${ii}label="ClassroomIO"`,
    `${ii}style=dashed`,
    `${ii}color="${C.boundary}"`,
    `${ii}fontname="Arial"`,
    '',
    `${ii}${containerNode('dashboard', 'Dashboard', 'SvelteKit + Vite :5173', 'Web frontend. Auth, course editing, LMS, billing.')}`,
    `${ii}${containerNode('api', 'API', 'Hono + Node.js', 'PDF export, video presign, email, course cloning.')}`,
    `${ii}${dbNode('db', 'PostgreSQL', 'Supabase', 'Primary data store. RLS-enforced.')}`,
    `${ii}${dbNode('redis_db', 'Redis', 'ioredis', 'Per-endpoint rate limiting.')}`,
    `${i}}`,
    '',
    `${i}// External systems`,
    `${i}${externalNode('cloudflare_r2', 'Cloudflare R2', 'Video and file storage')}`,
    `${i}${externalNode('openai', 'OpenAI', 'AI completions and grading')}`,
    `${i}${externalNode('email_svc', 'ZeptoMail / SMTP', 'Email delivery')}`,
    `${i}${externalNode('payment_svc', 'Payment Providers', 'Stripe, Polar, LemonSqueezy')}`,
    `${i}${externalNode('posthog', 'PostHog', 'Analytics')}`,
    `${i}${externalNode('supabase_auth', 'Supabase Auth', 'JWT auth')}`,
    '',
    `${i}// Relationships`,
    `${i}${edgeLine('teacher', 'dashboard', 'HTTPS')}`,
    `${i}${edgeLine('student', 'dashboard', 'HTTPS')}`,
    `${i}${edgeLine('dashboard', 'db', 'Supabase JS SDK')}`,
    `${i}${edgeLine('dashboard', 'supabase_auth', 'JWT')}`,
    `${i}${edgeLine('dashboard', 'api', 'HTTP + RPC types')}`,
    `${i}${edgeLine('dashboard', 'openai', 'AI completions')}`,
    `${i}${edgeLine('dashboard', 'payment_svc', 'SDK')}`,
    `${i}${edgeLine('dashboard', 'posthog', 'analytics events')}`,
    `${i}${edgeLine('api', 'db', 'Supabase Admin SDK')}`,
    `${i}${edgeLine('api', 'redis_db', 'rate limiting')}`,
    `${i}${edgeLine('api', 'cloudflare_r2', 'S3 API')}`,
    `${i}${edgeLine('api', 'email_svc', 'SMTP / ZeptoMail')}`,
    '}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// L3 — Components (from AST extraction JSON)
// ---------------------------------------------------------------------------
function componentsDot(data: ExtractResult): string {
  const displayDepth = data.app === 'dashboard' ? 2 : data.depth;
  const aggregated = aggregateComponents(data.components, displayDepth);
  const relevant = aggregated.filter(
    (c) =>
      !DIAGRAM_EXCLUDE_PREFIXES.some((pfx) => c.key === pfx || c.key.startsWith(pfx + '/')) &&
      c.totalFiles >= DIAGRAM_MIN_FILES,
  );

  if (relevant.length === 0) {
    return `// No components found. Run extract-components.ts first.\ndigraph components_${data.app} {}\n`;
  }

  const relevantKeys = new Set(relevant.map((c) => c.key));
  const containerLabel = data.app === 'dashboard' ? 'Dashboard (SvelteKit)' : 'API (Hono + Node.js)';
  const i = '  ';
  const ii = '    ';

  const lines: string[] = [
    `// Generated ${data.timestamp}`,
    `digraph components_${data.app} {`,
    `${i}label="${esc(containerLabel)} — Components"`,
    `${i}labelloc=t`,
    `${i}fontname="Arial"`,
    `${i}fontsize=14`,
    `${i}rankdir=TB`,
    '',
    `${i}subgraph cluster_${data.app} {`,
    `${ii}label="${esc(containerLabel)}"`,
    `${ii}style=dashed`,
    `${ii}color="${C.boundary}"`,
    `${ii}fontname="Arial"`,
    '',
  ];

  for (const comp of relevant) {
    const id = nodeId(comp.key);
    const tech = data.app === 'dashboard'
      ? comp.svelteFiles > 0
        ? `Svelte+TS (${comp.svelteFiles}+${comp.tsFiles} files)`
        : `TypeScript (${comp.tsFiles} files)`
      : `TypeScript (${comp.tsFiles} files)`;
    lines.push(`${ii}${componentNode(id, comp.label, tech, comp.description)}`);
  }

  lines.push(`${i}}`, '');

  const emitted = new Set<string>();
  for (const comp of relevant) {
    const fromId = nodeId(comp.key);
    for (const imp of comp.imports) {
      if (!relevantKeys.has(imp)) continue;
      const toId = nodeId(imp);
      const edgeKey = `${fromId}→${toId}`;
      if (emitted.has(edgeKey)) continue;
      emitted.add(edgeKey);
      lines.push(`${i}${edgeLine(fromId, toId)}`);
    }
  }

  lines.push('}', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------
function loadJson(appName: string): ExtractResult | null {
  const p = path.join(JSON_DIR, `components-${appName}.json`);
  if (!fs.existsSync(p)) {
    process.stderr.write(`  ⚠  Missing ${p} — run extract-components.ts first\n`);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as ExtractResult;
}

function write(filename: string, content: string): boolean {
  const out = path.join(OUT_DIR, filename);
  if (fs.existsSync(out)) {
    const existing = fs.readFileSync(out, 'utf-8');
    if (normalize(existing) === normalize(content)) {
      process.stdout.write(`  (unchanged) docs/graphviz/${filename}\n`);
      return false;
    }
  }
  fs.writeFileSync(out, content, 'utf-8');
  process.stdout.write(`✓ docs/graphviz/${filename}\n`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let changed = 0;
  if (write('context.dot', contextDot())) changed++;
  if (write('containers.dot', containersDot())) changed++;

  const apiData = loadJson('api');
  if (apiData && write('components-api.dot', componentsDot(apiData))) changed++;

  const dashData = loadJson('dashboard');
  if (dashData && write('components-dashboard.dot', componentsDot(dashData))) changed++;

  process.stdout.write('\n');
  if (changed === 0) {
    process.stdout.write('No changes — docs/graphviz/ diagrams are already up to date.\n');
  } else {
    process.stdout.write(`${changed} file(s) updated in docs/graphviz/\n`);
    process.stdout.write('Render: dot -Tsvg docs/graphviz/<file>.dot -o <file>.svg\n');
  }
}

main();
