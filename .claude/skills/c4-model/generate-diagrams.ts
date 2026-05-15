#!/usr/bin/env node
/**
 * C4 Diagram Generator
 *
 * Reads .claude/skills/c4-model/extracted.json and writes Mermaid C4 diagrams to docs/c4/:
 *   l1-context.md     — Layer 1: System Context (static)
 *   l2-containers.md  — Layer 2: Containers (static)
 *   l3-dashboard.md   — Layer 3: Dashboard components (AST-derived)
 *   l3-api.md         — Layer 3: API components (AST-derived)
 *
 * Usage: pnpm exec tsx .claude/skills/c4-model/generate-diagrams.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const EXTRACTED_JSON = path.join(__dirname, 'extracted.json');
const OUT_DIR = path.join(REPO_ROOT, 'docs/c4');

// ── Types (mirror extract-components output) ──────────────────────────────────

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

// ── Mermaid alias helpers ─────────────────────────────────────────────────────

const _usedAliases = new Set<string>();

function toAlias(key: string): string {
  // Replace non-identifier chars with underscores, then ensure uniqueness
  let base = key.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/, '');
  if (!base || /^\d/.test(base)) base = 'c_' + base;
  let alias = base;
  let n = 0;
  while (_usedAliases.has(alias)) alias = `${base}_${++n}`;
  _usedAliases.add(alias);
  return alias;
}

function resetAliases() { _usedAliases.clear(); }

function toLabel(key: string): string {
  const last = key.split('/').pop()!;
  return last
    .replace(/[-_+]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || key;
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
  // dashboard
  if (key.startsWith('routes/api')) return 'SvelteKit API Route';
  if (key.startsWith('routes')) return 'SvelteKit';
  if (key.startsWith('lib/components')) return 'Svelte';
  if (key.includes('services')) return 'TypeScript Service';
  if (key.includes('store')) return 'Svelte Store';
  if (key.includes('functions')) return 'TypeScript';
  if (key.includes('translations')) return 'i18n JSON';
  return 'SvelteKit';
}

// ── Layer 1 — System Context (static) ────────────────────────────────────────

function generateL1(date: string): string {
  return `# Layer 1 — System Context

> Generated ${date}. Describes ClassroomIO's place in the world.

\`\`\`mermaid
C4Context
    title ClassroomIO — System Context

    Person(teacher, "Teacher / Admin", "Creates courses, manages org members, views analytics, configures billing")
    Person(student, "Student", "Enrols in courses, completes lessons and exercises, earns certificates")

    System(classroomio, "ClassroomIO", "Open-source LMS: course authoring, student progress tracking, subscription billing")

    System_Ext(supabase, "Supabase", "PostgreSQL + Auth + Object Storage — primary data store")
    System_Ext(polar, "Polar", "Org-level subscription billing")
    System_Ext(s3, "AWS S3 / Cloudflare R2", "File and asset storage for uploads and exports")
    System_Ext(email, "Email Provider", "Transactional email — Nodemailer / ZeptoMail")
    System_Ext(posthog, "PostHog", "Product analytics and event tracking")
    System_Ext(sentry, "Sentry", "Error monitoring and performance tracing")

    Rel(teacher, classroomio, "Manages courses and org", "HTTPS")
    Rel(student, classroomio, "Takes courses and quizzes", "HTTPS")
    Rel(classroomio, supabase, "Persists data, auth, files", "HTTPS")
    Rel(classroomio, polar, "Manages org subscriptions", "HTTPS")
    Rel(classroomio, s3, "Stores and retrieves files", "HTTPS")
    Rel(classroomio, email, "Sends transactional emails", "SMTP/HTTPS")
    Rel(classroomio, posthog, "Tracks product analytics", "HTTPS")
    Rel(classroomio, sentry, "Reports errors", "HTTPS")
\`\`\`
`;
}

// ── Layer 2 — Containers (static) ────────────────────────────────────────────

function generateL2(date: string): string {
  return `# Layer 2 — Containers

> Generated ${date}. Shows deployable units inside ClassroomIO.

\`\`\`mermaid
C4Container
    title ClassroomIO — Containers

    Person(teacher, "Teacher / Admin", "Manages org, courses, and members")
    Person(student, "Student", "Learns via courses and exercises")

    System_Boundary(classroomio, "ClassroomIO") {
        Container(dashboard, "Dashboard", "SvelteKit v1 / Svelte 4", "Teacher/admin UI (port 5173). Course CRUD, org management, analytics, billing.")
        Container(courseApp, "Course App", "SvelteKit v2 / Svelte 5", "Student-facing LMS (port 5174). Lessons, quizzes, certificates.")
        Container(api, "API", "Hono 4 / Node.js", "Long-running jobs (port 3002): PDF export, course clone, S3 presign, email dispatch.")
        Container(website, "Website", "SvelteKit v2 / mdsvex", "Marketing and landing pages.")
        Container(docs, "Docs", "React 19 / TanStack Start / Fumadocs", "Developer and user documentation.")
    }

    SystemDb_Ext(supabase, "Supabase", "PostgreSQL + Auth + Storage. Primary data store — all apps connect directly via SDK.")
    System_Ext(s3, "AWS S3 / R2", "File storage for uploads and generated exports.")
    System_Ext(redis, "Redis", "Rate-limiting cache for API routes.")
    System_Ext(polar, "Polar", "Org subscription billing.")
    System_Ext(emailSvc, "Email Provider", "Nodemailer / ZeptoMail for transactional mail.")

    Rel(teacher, dashboard, "Uses", "HTTPS")
    Rel(student, courseApp, "Takes courses", "HTTPS")
    Rel(dashboard, api, "PDF generation, course clone, S3 presign", "HTTP :3002")
    Rel(dashboard, supabase, "Reads/writes all data and files", "HTTPS")
    Rel(courseApp, supabase, "Reads course content and progress", "HTTPS")
    Rel(api, supabase, "Reads/writes course and user data", "HTTPS")
    Rel(api, s3, "Stores files, generates presigned URLs", "HTTPS")
    Rel(api, redis, "Rate-limiting", "TCP")
    Rel(api, emailSvc, "Sends emails", "SMTP/HTTPS")
    Rel(dashboard, polar, "Org subscription management", "HTTPS")
\`\`\`
`;
}

// ── Layer 3 — Component diagram (AST-derived) ─────────────────────────────────

function generateL3(appName: string, app: AppResult, date: string): string {
  resetAliases();

  const containerLabel =
    appName === 'dashboard'
      ? 'Dashboard (SvelteKit v1 / Svelte 4)'
      : 'API (Hono 4 / Node.js)';

  const sortedKeys = Object.keys(app.components).sort();

  // Build stable alias map before generating lines (so Rel() references are consistent)
  const aliasOf: Record<string, string> = {};
  for (const key of sortedKeys) aliasOf[key] = toAlias(key);

  const componentLines = sortedKeys.map((key) => {
    const comp = app.components[key];
    const label = toLabel(key);
    const tech = inferTech(key, appName);
    const desc =
      comp.svelteFileCount > 0
        ? `${comp.tsFileCount} TS + ${comp.svelteFileCount} Svelte`
        : `${comp.tsFileCount} TS files`;
    return `        Component(${aliasOf[key]}, "${label}", "${tech}", "${desc}")`;
  });

  const relLines: string[] = [];
  for (const rel of app.relationships) {
    if (!(rel.from in aliasOf) || !(rel.to in aliasOf)) continue;
    relLines.push(
      `    Rel(${aliasOf[rel.from]}, ${aliasOf[rel.to]}, "uses", "${rel.importCount} imports")`,
    );
  }

  const header = [
    `# Layer 3 — ${appName === 'dashboard' ? 'Dashboard' : 'API'} Components`,
    '',
    `> Generated ${date} from AST. ` +
      `${sortedKeys.length} components, ${relLines.length} relationships. ` +
      `Component depth: ${app.componentDepth}. ` +
      `Total source files: ${app.totalTsFiles} TS + ${app.totalSvelteFiles} Svelte.`,
    '',
  ];

  if (app.warnings.length) {
    header.push('> ⚠ Depth warnings — consider re-running with a higher depth:');
    app.warnings.forEach((w) => header.push(`> - ${w}`));
    header.push('');
  }

  const diagram = [
    '```mermaid',
    'C4Component',
    `    title ${containerLabel} — Components`,
    '',
    `    Container_Boundary(${appName}_boundary, "${containerLabel}") {`,
    ...componentLines,
    '    }',
    '',
    '    SystemDb_Ext(supabase_ext, "Supabase", "PostgreSQL + Auth + Storage")',
    '',
    ...relLines,
    '```',
  ];

  return [...header, ...diagram, ''].join('\n');
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

  const extracted: Extracted = JSON.parse(fs.readFileSync(EXTRACTED_JSON, 'utf-8'));
  const date = extracted.extractedAt.split('T')[0];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files: [string, string][] = [
    ['l1-context.md', generateL1(date)],
    ['l2-containers.md', generateL2(date)],
    ['l3-dashboard.md', generateL3('dashboard', extracted.apps.dashboard, date)],
    ['l3-api.md', generateL3('api', extracted.apps.api, date)],
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
