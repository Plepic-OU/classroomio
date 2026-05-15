#!/usr/bin/env node
/**
 * C4 DOT (Graphviz) Diagram Generator
 *
 * Reads .claude/skills/c4-model/extracted.json and writes Graphviz .dot files to docs/c4/:
 *   l1-context.dot     — Layer 1: System Context
 *   l2-containers.dot  — Layer 2: Containers
 *   l3-dashboard.dot   — Layer 3: Dashboard components (AST-derived)
 *   l3-api.dot         — Layer 3: API components (AST-derived)
 *
 * Usage: pnpm exec tsx .claude/skills/c4-model/generate-dot-diagrams.ts
 * Render: dot -Tsvg docs/c4/l1-context.dot -o docs/c4/l1-context.svg
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const EXTRACTED_JSON = path.join(__dirname, 'extracted.json');
const OUT_DIR = path.join(REPO_ROOT, 'docs/c4');

interface ComponentInfo {
  tsFileCount: number;
  svelteFileCount: number;
  fileCount: number;
  samplePaths: string[];
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppResult {
  componentDepth: number;
  totalTsFiles: number;
  totalSvelteFiles: number;
  components: Record<string, ComponentInfo>;
  relationships: Relationship[];
  warnings: string[];
}

interface Extracted {
  extractedAt: string;
  apps: {
    dashboard: AppResult;
    api: AppResult;
  };
}

// C4 colour palette
const COLOR = {
  person:    { fill: '#08427B', font: 'white' },
  system:    { fill: '#1168BD', font: 'white' },
  ext:       { fill: '#999999', font: 'white' },
  container: { fill: '#438DD5', font: 'white' },
  component: { fill: '#85BBF0', font: '#1D3649' },
};

// Escape a value for embedding inside a DOT double-quoted string
function e(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Build a C4-style multi-line DOT label (returns the full quoted "..." value).
// desc is split on | to produce separate visual lines without going through e() twice.
function lbl(stereotype: string, name: string, tech: string, desc: string): string {
  const lines: string[] = [`«${stereotype}»`, name];
  if (tech) lines.push(`[${tech}]`);
  if (desc) lines.push('', ...desc.split('|'));
  return `"${lines.map(e).join('\\n')}"`;
}

// Produce the attribute string for a node
function na(
  label: string,
  fill: string,
  font: string,
  style = 'filled',
): string {
  return `label=${label} fillcolor="${fill}" fontcolor="${font}" style="${style}"`;
}

// Sanitise a component key to a valid DOT identifier
function nodeId(key: string): string {
  const id = key.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
  return /^\d/.test(id) ? `n_${id}` : id || 'node_x';
}

// Convert a component key to a display name
function toLabel(key: string): string {
  const last = key.split('/').pop()!;
  return (
    last
      .replace(/[-_+]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || key
  );
}

function inferTech(key: string, appName: string): string {
  if (appName === 'api') {
    if (key.startsWith('routes')) return 'Hono';
    if (key.startsWith('services')) return 'TypeScript';
    if (key.startsWith('middlewares')) return 'Hono Middleware';
    if (key.includes('redis')) return 'ioredis';
    if (key.includes('s3')) return 'AWS SDK';
    return 'TypeScript';
  }
  if (key.startsWith('routes/api')) return 'SvelteKit API Route';
  if (key.startsWith('routes')) return 'SvelteKit';
  if (key.startsWith('lib/components')) return 'Svelte';
  if (key.includes('services')) return 'TypeScript Service';
  if (key.includes('store')) return 'Svelte Store';
  if (key.includes('functions')) return 'TypeScript';
  if (key.includes('translations')) return 'i18n JSON';
  return 'SvelteKit';
}

// ── Layer 1 — System Context ──────────────────────────────────────────────────

function generateL1(date: string): string {
  const { person: P, system: S, ext: X } = COLOR;
  return [
    `// ClassroomIO — Layer 1: System Context | Generated ${date}`,
    `// Render: dot -Tsvg l1-context.dot -o l1-context.svg`,
    `digraph L1_Context {`,
    `    graph [label="ClassroomIO — System Context|Generated ${date}" labelloc=t fontsize=18 rankdir=TB fontname=Arial pad=0.5 nodesep=0.8 ranksep=1.2]`,
    `    node  [fontname=Arial fontsize=11 shape=box margin="0.3,0.15"]`,
    `    edge  [fontname=Arial fontsize=10]`,
    ``,
    `    teacher     [${na(lbl('Person', 'Teacher / Admin', '', 'Creates courses, manages org members,|views analytics, configures billing'), P.fill, P.font, 'rounded,filled')}]`,
    `    student     [${na(lbl('Person', 'Student', '', 'Enrols in courses, completes lessons|and exercises, earns certificates'), P.fill, P.font, 'rounded,filled')}]`,
    ``,
    `    classroomio [${na(lbl('System', 'ClassroomIO', '', 'Open-source LMS: course authoring,|student progress tracking, subscription billing'), S.fill, S.font)}]`,
    ``,
    `    supabase    [${na(lbl('External System', 'Supabase', '', 'PostgreSQL + Auth + Object Storage|— primary data store'), X.fill, X.font)}]`,
    `    polar       [${na(lbl('External System', 'Polar', '', 'Org-level subscription billing'), X.fill, X.font)}]`,
    `    s3          [${na(lbl('External System', 'AWS S3 / Cloudflare R2', '', 'File and asset storage|for uploads and exports'), X.fill, X.font)}]`,
    `    email_svc   [${na(lbl('External System', 'Email Provider', '', 'Transactional email|— Nodemailer / ZeptoMail'), X.fill, X.font)}]`,
    `    posthog     [${na(lbl('External System', 'PostHog', '', 'Product analytics and event tracking'), X.fill, X.font)}]`,
    `    sentry      [${na(lbl('External System', 'Sentry', '', 'Error monitoring and performance tracing'), X.fill, X.font)}]`,
    ``,
    `    teacher     -> classroomio [label="Manages courses and org [HTTPS]"]`,
    `    student     -> classroomio [label="Takes courses and quizzes [HTTPS]"]`,
    `    classroomio -> supabase    [label="Persists data, auth, files [HTTPS]"]`,
    `    classroomio -> polar       [label="Manages org subscriptions [HTTPS]"]`,
    `    classroomio -> s3          [label="Stores and retrieves files [HTTPS]"]`,
    `    classroomio -> email_svc   [label="Sends transactional emails [SMTP/HTTPS]"]`,
    `    classroomio -> posthog     [label="Tracks product analytics [HTTPS]"]`,
    `    classroomio -> sentry      [label="Reports errors [HTTPS]"]`,
    `}`,
    ``,
  ].join('\n');
}

// ── Layer 2 — Containers ──────────────────────────────────────────────────────

function generateL2(date: string): string {
  const { person: P, ext: X, container: C } = COLOR;
  return [
    `// ClassroomIO — Layer 2: Containers | Generated ${date}`,
    `// Render: dot -Tsvg l2-containers.dot -o l2-containers.svg`,
    `digraph L2_Containers {`,
    `    graph [label="ClassroomIO — Containers|Generated ${date}" labelloc=t fontsize=18 rankdir=TB fontname=Arial pad=0.5 nodesep=0.8 ranksep=1.2]`,
    `    node  [fontname=Arial fontsize=11 shape=box margin="0.3,0.15"]`,
    `    edge  [fontname=Arial fontsize=10]`,
    ``,
    `    teacher [${na(lbl('Person', 'Teacher / Admin', '', 'Manages org, courses, and members'), P.fill, P.font, 'rounded,filled')}]`,
    `    student [${na(lbl('Person', 'Student', '', 'Learns via courses and exercises'), P.fill, P.font, 'rounded,filled')}]`,
    ``,
    `    subgraph cluster_classroomio {`,
    `        label="ClassroomIO"`,
    `        style=dashed`,
    `        color="#444444"`,
    `        fontname=Arial`,
    `        fontsize=14`,
    ``,
    `        dashboard  [${na(lbl('Container', 'Dashboard', 'SvelteKit v1 / Svelte 4', 'Teacher/admin UI (port 5173).|Course CRUD, org management, analytics, billing.'), C.fill, C.font)}]`,
    `        course_app [${na(lbl('Container', 'Course App', 'SvelteKit v2 / Svelte 5', 'Student-facing LMS (port 5174).|Lessons, quizzes, certificates.'), C.fill, C.font)}]`,
    `        api        [${na(lbl('Container', 'API', 'Hono 4 / Node.js', 'Long-running jobs (port 3002):|PDF export, course clone, S3 presign, email dispatch.'), C.fill, C.font)}]`,
    `        website    [${na(lbl('Container', 'Website', 'SvelteKit v2 / mdsvex', 'Marketing and landing pages.'), C.fill, C.font)}]`,
    `        docs       [${na(lbl('Container', 'Docs', 'React 19 / TanStack Start / Fumadocs', 'Developer and user documentation.'), C.fill, C.font)}]`,
    `    }`,
    ``,
    `    supabase  [${na(lbl('External System DB', 'Supabase', '', 'PostgreSQL + Auth + Storage.|Primary data store — all apps connect directly via SDK.'), X.fill, X.font)}]`,
    `    s3        [${na(lbl('External System', 'AWS S3 / R2', '', 'File storage for uploads and generated exports.'), X.fill, X.font)}]`,
    `    redis     [${na(lbl('External System', 'Redis', '', 'Rate-limiting cache for API routes.'), X.fill, X.font)}]`,
    `    polar     [${na(lbl('External System', 'Polar', '', 'Org subscription billing.'), X.fill, X.font)}]`,
    `    email_svc [${na(lbl('External System', 'Email Provider', '', 'Nodemailer / ZeptoMail for transactional mail.'), X.fill, X.font)}]`,
    ``,
    `    teacher    -> dashboard  [label="Uses [HTTPS]"]`,
    `    student    -> course_app [label="Takes courses [HTTPS]"]`,
    `    dashboard  -> api        [label="PDF generation, course clone, S3 presign [HTTP :3002]"]`,
    `    dashboard  -> supabase   [label="Reads/writes all data and files [HTTPS]"]`,
    `    course_app -> supabase   [label="Reads course content and progress [HTTPS]"]`,
    `    api        -> supabase   [label="Reads/writes course and user data [HTTPS]"]`,
    `    api        -> s3         [label="Stores files, generates presigned URLs [HTTPS]"]`,
    `    api        -> redis      [label="Rate-limiting [TCP]"]`,
    `    api        -> email_svc  [label="Sends emails [SMTP/HTTPS]"]`,
    `    dashboard  -> polar      [label="Org subscription management [HTTPS]"]`,
    `}`,
    ``,
  ].join('\n');
}

// ── Layer 3 — Components (AST-derived) ───────────────────────────────────────

function generateL3(appName: string, app: AppResult, date: string): string {
  const { ext: X, component: K } = COLOR;
  const containerLabel =
    appName === 'dashboard'
      ? 'Dashboard (SvelteKit v1 / Svelte 4)'
      : 'API (Hono 4 / Node.js)';
  const title = `ClassroomIO — ${appName === 'dashboard' ? 'Dashboard' : 'API'} Components`;
  const sortedKeys = Object.keys(app.components).sort();

  // Build unique DOT ID map
  const idOf: Record<string, string> = {};
  const usedIds = new Set<string>();
  for (const key of sortedKeys) {
    let id = nodeId(key);
    let n = 0;
    while (usedIds.has(id)) id = `${nodeId(key)}_${++n}`;
    usedIds.add(id);
    idOf[key] = id;
  }

  const relLines: string[] = [];
  for (const rel of app.relationships) {
    if (!(rel.from in idOf) || !(rel.to in idOf)) continue;
    relLines.push(`    ${idOf[rel.from]} -> ${idOf[rel.to]} [label="${rel.importCount} imports"]`);
  }

  const dotFile = appName === 'dashboard' ? 'l3-dashboard' : 'l3-api';

  const lines: string[] = [
    `// ClassroomIO — Layer 3: ${appName === 'dashboard' ? 'Dashboard' : 'API'} Components | Generated ${date}`,
    `// ${sortedKeys.length} components, ${relLines.length} relationships (depth ${app.componentDepth})`,
    `// Render: dot -Tsvg ${dotFile}.dot -o ${dotFile}.svg`,
    `digraph L3_${appName === 'dashboard' ? 'Dashboard' : 'API'} {`,
    `    graph [label="${e(title)}|Generated ${date}" labelloc=t fontsize=18 rankdir=LR fontname=Arial pad=0.5 nodesep=0.4 ranksep=1.0]`,
    `    node  [fontname=Arial fontsize=10 shape=box margin="0.2,0.1"]`,
    `    edge  [fontname=Arial fontsize=9]`,
    ``,
    `    subgraph cluster_${appName} {`,
    `        label="${e(containerLabel)}"`,
    `        style=dashed`,
    `        color="#444444"`,
    `        fontname=Arial`,
    `        fontsize=13`,
    ``,
  ];

  for (const key of sortedKeys) {
    const comp = app.components[key];
    const tech = inferTech(key, appName);
    const desc =
      comp.svelteFileCount > 0
        ? `${comp.tsFileCount} TS + ${comp.svelteFileCount} Svelte`
        : `${comp.tsFileCount} TS files`;
    lines.push(
      `        ${idOf[key]} [${na(lbl('Component', toLabel(key), tech, desc), K.fill, K.font)}]`,
    );
  }

  lines.push(`    }`, ``);
  lines.push(`    supabase_ext [${na(lbl('External System DB', 'Supabase', '', 'PostgreSQL + Auth + Storage'), X.fill, X.font)}]`);
  lines.push(``);
  lines.push(...relLines);
  lines.push(`}`, ``);

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(EXTRACTED_JSON)) {
    console.error(
      `extracted.json not found at ${EXTRACTED_JSON}\n` +
        `Run extraction first:\n  pnpm exec tsx .claude/skills/c4-model/extract-components.ts`,
    );
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const OUTPUT_NAMES = ['l1-context.dot', 'l2-containers.dot', 'l3-dashboard.dot', 'l3-api.dot'];

  if (!force) {
    const extractedMtime = fs.statSync(EXTRACTED_JSON).mtimeMs;
    const upToDate = OUTPUT_NAMES.every((n) => {
      const p = path.join(OUT_DIR, n);
      return fs.existsSync(p) && fs.statSync(p).mtimeMs >= extractedMtime;
    });
    if (upToDate) {
      console.log('✓ DOT diagrams are up to date — skipping. Use --force to override.');
      process.exit(0);
    }
  }

  const extracted: Extracted = JSON.parse(fs.readFileSync(EXTRACTED_JSON, 'utf-8'));
  const date = extracted.extractedAt.split('T')[0];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files: [string, string][] = [
    ['l1-context.dot', generateL1(date)],
    ['l2-containers.dot', generateL2(date)],
    ['l3-dashboard.dot', generateL3('dashboard', extracted.apps.dashboard, date)],
    ['l3-api.dot', generateL3('api', extracted.apps.api, date)],
  ];

  for (const [name, content] of files) {
    const outPath = path.join(OUT_DIR, name);
    fs.writeFileSync(outPath, content);
    console.log(`✓ ${outPath}`);
  }

  const d = extracted.apps.dashboard;
  const a = extracted.apps.api;
  console.log(
    `\nSummary:\n` +
      `  dashboard — ${Object.keys(d.components).length} components, ${d.relationships.length} relationships (depth ${d.componentDepth})\n` +
      `  api       — ${Object.keys(a.components).length} components, ${a.relationships.length} relationships (depth ${a.componentDepth})`,
  );
}

main();
