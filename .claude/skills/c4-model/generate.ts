#!/usr/bin/env npx tsx
/**
 * C4 Mermaid diagram generator for ClassroomIO.
 *
 * Reads extraction JSON produced by extract.ts and writes Mermaid C4 diagrams:
 *   docs/c4/system-context.md      — L1 (hardcoded architecture knowledge)
 *   docs/c4/containers.md          — L2 (hardcoded architecture knowledge)
 *   docs/c4/dashboard-components.md — L3 (AST-derived)
 *   docs/c4/api-components.md       — L3 (AST-derived)
 *
 * Usage:
 *   cd .claude/skills/c4-model && ./node_modules/.bin/tsx generate.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const C4_DIR = path.join(REPO_ROOT, 'docs', 'c4');

interface ComponentInfo {
  key: string;
  label: string;
  tsFiles: number;
  svelteFiles: number;
  description: string;
}

interface Relationship { from: string; to: string; count: number; }

interface ExtractionResult {
  app: string;
  depth: number;
  extractedAt: string;
  components: ComponentInfo[];
  relationships: Relationship[];
  warnings: string[];
}

/** Make a valid Mermaid/C4 identifier from an arbitrary string. */
function id(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, 'c_');
}

// ─── L1: System Context ────────────────────────────────────────────────────

function generateL1(): string {
  return `# C4 Level 1 — System Context

\`\`\`mermaid
C4Context
  title System Context for ClassroomIO

  Person(educator, "Educator", "Creates courses, tracks students, manages org")
  Person(student, "Student", "Enrols in courses, submits exercises")
  Person(admin, "Platform Admin", "Self-hosts or manages cloud instance")

  System(classroomio, "ClassroomIO", "Open-source LMS for bootcamps, educators, and companies")

  System_Ext(supabase, "Supabase", "Auth, PostgreSQL, Realtime subscriptions")
  System_Ext(openai, "OpenAI", "AI-assisted content generation")
  System_Ext(r2, "Cloudflare R2", "Video file storage (S3-compatible)")
  System_Ext(muse_ai, "Muse.ai", "Video transcription")
  System_Ext(stripe, "Stripe / Polar", "Payment processing")
  System_Ext(email_svc, "Email Provider", "Nodemailer / ZeptoMail")

  Rel(educator, classroomio, "Creates courses, manages students")
  Rel(student, classroomio, "Takes courses, submits exercises")
  Rel(admin, classroomio, "Configures and self-hosts")
  Rel(classroomio, supabase, "Stores all data, authenticates users")
  Rel(classroomio, openai, "AI content generation")
  Rel(classroomio, r2, "Stores and streams video")
  Rel(classroomio, muse_ai, "Transcribes video")
  Rel(classroomio, stripe, "Processes payments")
  Rel(classroomio, email_svc, "Sends notifications and invites")
\`\`\`
`;
}

// ─── L2: Containers ────────────────────────────────────────────────────────

function generateL2(): string {
  return `# C4 Level 2 — Containers

\`\`\`mermaid
C4Container
  title Container Diagram for ClassroomIO

  Person(educator, "Educator")
  Person(student, "Student")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / TypeScript", "Main LMS UI: course authoring, student tracking, org management, analytics", "port 5173")
    Container(api, "API", "Hono.js / Node.js", "Video and PDF processing, email dispatch, course cloning, signed upload URLs", "port 3002")
    ContainerDb(db, "Supabase DB", "PostgreSQL 15", "Courses, lessons, orgs, users, grades, attendance, billing")
    Container(redis, "Redis", "Redis 7", "Job queues and response caching")
    Container(marketing, "classroomio.com", "SvelteKit", "Public marketing site", "port 5174")
    Container(docs, "Docs", "React + TanStack Start", "Product documentation", "port 3000")
  }

  System_Ext(supabase_auth, "Supabase Auth", "JWT auth, magic link, OAuth")
  System_Ext(openai, "OpenAI", "AI generation")
  System_Ext(r2, "Cloudflare R2", "Video storage")
  System_Ext(stripe, "Stripe / Polar", "Payments")
  System_Ext(email_svc, "Email Provider", "Nodemailer / ZeptoMail")

  Rel(educator, dashboard, "Uses", "HTTPS")
  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(dashboard, db, "Reads/writes", "Supabase REST + Realtime")
  Rel(dashboard, supabase_auth, "Authenticates users", "HTTPS")
  Rel(dashboard, api, "Triggers processing", "HTTP")
  Rel(api, db, "Reads/writes", "Supabase REST")
  Rel(api, redis, "Enqueues jobs", "Redis protocol")
  Rel(api, openai, "AI requests", "HTTPS")
  Rel(api, r2, "Uploads and presigns URLs", "S3 API")
  Rel(api, email_svc, "Dispatches emails", "SMTP / REST")
  Rel(dashboard, stripe, "Checkout and billing", "HTTPS")
\`\`\`
`;
}

// ─── L3: Component diagram (AST-derived) ───────────────────────────────────

const MAX_NODES = 25;
const MAX_RELS  = 40;

function selectVisible(
  components: ComponentInfo[],
  relationships: Relationship[],
): { components: ComponentInfo[]; relationships: Relationship[] } {
  // Score each component: files + relationship edges
  const edgeWeight: Record<string, number> = {};
  for (const r of relationships) {
    edgeWeight[r.from] = (edgeWeight[r.from] ?? 0) + r.count;
    edgeWeight[r.to]   = (edgeWeight[r.to]   ?? 0) + r.count;
  }

  // Always include components that participate in relationships; then fill by file count
  const withRels = components.filter(c => edgeWeight[c.key]);
  const noRels   = components.filter(c => !edgeWeight[c.key] && c.tsFiles + c.svelteFiles >= 3);
  const sorted = [
    ...withRels.sort((a, b) => (edgeWeight[b.key] ?? 0) - (edgeWeight[a.key] ?? 0)),
    ...noRels.sort((a, b) => (b.tsFiles + b.svelteFiles) - (a.tsFiles + a.svelteFiles)),
  ].slice(0, MAX_NODES);

  const keys = new Set(sorted.map(c => c.key));
  return {
    components: sorted,
    relationships: relationships
      .filter(r => keys.has(r.from) && keys.has(r.to))
      .slice(0, MAX_RELS),
  };
}

function generateL3(data: ExtractionResult): string {
  const appTitle   = data.app === 'dashboard' ? 'Dashboard (SvelteKit)' : 'API (Hono.js)';
  const boundaryId = data.app === 'dashboard' ? 'dash_boundary' : 'api_boundary';

  const { components, relationships } = selectVisible(data.components, data.relationships);

  const lines: string[] = [
    `# C4 Level 3 — Components: ${appTitle}`,
    '',
    `_Extracted ${data.extractedAt.slice(0, 10)} · depth=${data.depth}_`,
    '',
    '```mermaid',
    'C4Component',
    `  title Component Diagram for ${appTitle}`,
    '',
    `  Container_Boundary(${boundaryId}, "${appTitle}") {`,
  ];

  for (const c of components) {
    const tech = c.svelteFiles > 0
      ? `${c.svelteFiles} Svelte, ${c.tsFiles} TS`
      : `${c.tsFiles} TS`;
    lines.push(`    Component(${id(c.key)}, "${c.label}", "${tech}", "${c.key}")`);
  }

  lines.push('  }', '');

  for (const r of relationships) {
    const label = r.count > 5 ? `${r.count} imports` : 'imports';
    lines.push(`  Rel(${id(r.from)}, ${id(r.to)}, "${label}")`);
  }

  lines.push('```', '');

  if (data.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const w of data.warnings) lines.push(`- ⚠️ ${w}`);
    lines.push('');
  }

  // Full component inventory table for AI context
  lines.push('## Component Inventory', '');
  lines.push('| Component | TS | Svelte | Path |');
  lines.push('|-----------|----:|-------:|------|');
  for (const c of data.components) {
    lines.push(`| ${c.label} | ${c.tsFiles} | ${c.svelteFiles} | \`${c.key}\` |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─── main ──────────────────────────────────────────────────────────────────

function main(): void {
  fs.mkdirSync(C4_DIR, { recursive: true });

  fs.writeFileSync(path.join(C4_DIR, 'system-context.md'), generateL1());
  console.log('✓ docs/c4/system-context.md');

  fs.writeFileSync(path.join(C4_DIR, 'containers.md'), generateL2());
  console.log('✓ docs/c4/containers.md');

  for (const appName of ['dashboard', 'api'] as const) {
    const jsonPath = path.join(C4_DIR, `${appName}-components.json`);
    if (!fs.existsSync(jsonPath)) {
      console.warn(`  ⚠  Missing ${jsonPath} — run extract.ts first`);
      continue;
    }
    const data: ExtractionResult = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const outPath = path.join(C4_DIR, `${appName}-components.md`);
    fs.writeFileSync(outPath, generateL3(data));
    console.log(`✓ ${outPath}`);
  }
}

main();
