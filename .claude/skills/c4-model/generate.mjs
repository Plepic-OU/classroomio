/**
 * C4 diagram generator — reads extracted JSON and writes Mermaid C4 .md files to docs/c4/.
 *
 * Usage: node generate.mjs
 *
 * Outputs:
 *   docs/c4/c4-context.md
 *   docs/c4/c4-container.md
 *   docs/c4/c4-component-api.md
 *   docs/c4/c4-component-dashboard.md
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const OUTPUT_DIR = join(REPO_ROOT, 'docs/c4');

// ---------------------------------------------------------------------------
// External systems metadata (used in all layers)
// ---------------------------------------------------------------------------

const EXT_SYSTEMS = {
  supabase: { alias: 'ext_supabase', label: 'Supabase', tech: 'PostgreSQL + Auth', desc: 'Database, auth, row-level security, storage metadata' },
  redis: { alias: 'ext_redis', label: 'Redis', tech: 'In-memory store', desc: 'Rate-limiting state' },
  s3: { alias: 'ext_r2', label: 'Cloudflare R2', tech: 'S3-compatible object storage', desc: 'File/media uploads' },
  smtp: { alias: 'ext_smtp', label: 'ZeptoMail / SMTP', tech: 'Email', desc: 'Transactional email delivery' },
  sentry: { alias: 'ext_sentry', label: 'Sentry', tech: 'Error tracking SaaS', desc: 'Runtime error monitoring' },
  openai: { alias: 'ext_openai', label: 'OpenAI', tech: 'REST API', desc: 'AI completions for exercises and grading' },
  puppeteer: { alias: 'ext_puppet', label: 'Puppeteer / Cloudflare Browser', tech: 'Headless browser', desc: 'PDF rendering' },
  polar: { alias: 'ext_polar', label: 'Polar', tech: 'Billing SaaS', desc: 'Subscription and payment management' },
  unsplash: { alias: 'ext_unsplash', label: 'Unsplash', tech: 'REST API', desc: 'Stock image search' },
};

// ---------------------------------------------------------------------------
// Alias sanitiser — Mermaid C4 aliases must be [a-zA-Z0-9_] only
// ---------------------------------------------------------------------------

function toAlias(prefix, key) {
  return (prefix + '_' + key).replace(/[^a-zA-Z0-9_]/g, '_').replace(/__+/g, '_');
}

// ---------------------------------------------------------------------------
// Layer 1: System Context
// ---------------------------------------------------------------------------

function generateContext() {
  return `# C4 Level 1 — System Context

\`\`\`mermaid
C4Context
  title System Context — ClassroomIO LMS

  Person(p_teacher, "Teacher / Admin", "Creates and manages courses, tracks student progress")
  Person(p_student, "Student", "Enrols in courses, completes lessons and exercises")

  System_Boundary(sb, "ClassroomIO") {
    System(sys_dashboard, "ClassroomIO Platform", "SvelteKit + Hono LMS — course authoring, delivery, community, analytics")
  }

  System_Ext(${EXT_SYSTEMS.supabase.alias}, "${EXT_SYSTEMS.supabase.label}", "${EXT_SYSTEMS.supabase.desc}")
  System_Ext(${EXT_SYSTEMS.s3.alias}, "${EXT_SYSTEMS.s3.label}", "${EXT_SYSTEMS.s3.desc}")
  System_Ext(${EXT_SYSTEMS.smtp.alias}, "${EXT_SYSTEMS.smtp.label}", "${EXT_SYSTEMS.smtp.desc}")
  System_Ext(${EXT_SYSTEMS.openai.alias}, "${EXT_SYSTEMS.openai.label}", "${EXT_SYSTEMS.openai.desc}")
  System_Ext(${EXT_SYSTEMS.polar.alias}, "${EXT_SYSTEMS.polar.label}", "${EXT_SYSTEMS.polar.desc}")

  Rel(p_teacher, sys_dashboard, "Authors courses, manages org")
  Rel(p_student, sys_dashboard, "Learns, submits exercises")
  Rel(sys_dashboard, ${EXT_SYSTEMS.supabase.alias}, "Auth + all data persistence", "Supabase SDK / REST")
  Rel(sys_dashboard, ${EXT_SYSTEMS.s3.alias}, "Stores uploaded files", "S3 API / presigned URLs")
  Rel(sys_dashboard, ${EXT_SYSTEMS.smtp.alias}, "Sends invites, welcome emails", "SMTP / HTTP")
  Rel(sys_dashboard, ${EXT_SYSTEMS.openai.alias}, "AI-generated exercises and grading", "REST")
  Rel(sys_dashboard, ${EXT_SYSTEMS.polar.alias}, "Billing and subscriptions", "REST / webhooks")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Layer 2: Container diagram
// ---------------------------------------------------------------------------

function generateContainers() {
  return `# C4 Level 2 — Containers

\`\`\`mermaid
C4Container
  title Container diagram — ClassroomIO

  Person(p_teacher, "Teacher / Admin")
  Person(p_student, "Student")
  Person_Ext(p_anon, "Anonymous Visitor")

  System_Boundary(sb, "ClassroomIO") {
    Container(c_dashboard, "Dashboard", "SvelteKit / Vite", "Main LMS web app — course authoring, student portal, org management. Port 5173.")
    Container(c_api, "API", "Hono / Node.js", "REST API for PDF/cert generation, file presigning, email, KaTeX rendering. Port 3002.")
    Container(c_landing, "Landing Page", "SvelteKit", "Marketing site — pricing, blog, feature pages. Port 5174.")
    Container(c_courseapp, "Course App", "SvelteKit", "Embeddable standalone course viewer. Shared \`@cio/course-app\` package.")
  }

  System_Ext(${EXT_SYSTEMS.supabase.alias}, "${EXT_SYSTEMS.supabase.label}", "${EXT_SYSTEMS.supabase.desc}")
  System_Ext(${EXT_SYSTEMS.s3.alias}, "${EXT_SYSTEMS.s3.label}", "${EXT_SYSTEMS.s3.desc}")
  System_Ext(${EXT_SYSTEMS.smtp.alias}, "${EXT_SYSTEMS.smtp.label}", "${EXT_SYSTEMS.smtp.desc}")
  System_Ext(${EXT_SYSTEMS.redis.alias}, "${EXT_SYSTEMS.redis.label}", "${EXT_SYSTEMS.redis.desc}")
  System_Ext(${EXT_SYSTEMS.openai.alias}, "${EXT_SYSTEMS.openai.label}", "${EXT_SYSTEMS.openai.desc}")
  System_Ext(${EXT_SYSTEMS.sentry.alias}, "${EXT_SYSTEMS.sentry.label}", "${EXT_SYSTEMS.sentry.desc}")
  System_Ext(${EXT_SYSTEMS.polar.alias}, "${EXT_SYSTEMS.polar.label}", "${EXT_SYSTEMS.polar.desc}")

  Rel(p_teacher, c_dashboard, "Uses", "HTTPS")
  Rel(p_student, c_dashboard, "Learns via", "HTTPS")
  Rel(p_anon, c_landing, "Browses", "HTTPS")
  Rel(c_dashboard, c_api, "Calls for PDF, files, email", "HTTPS / Hono RPC")
  Rel(c_dashboard, ${EXT_SYSTEMS.supabase.alias}, "Auth + CRUD", "Supabase JS SDK")
  Rel(c_dashboard, ${EXT_SYSTEMS.openai.alias}, "AI completions", "REST (server-side route)")
  Rel(c_dashboard, ${EXT_SYSTEMS.polar.alias}, "Billing portal", "REST + webhooks")
  Rel(c_api, ${EXT_SYSTEMS.supabase.alias}, "Service-role data access", "Supabase JS SDK")
  Rel(c_api, ${EXT_SYSTEMS.s3.alias}, "Upload / presign URLs", "AWS S3 SDK")
  Rel(c_api, ${EXT_SYSTEMS.smtp.alias}, "Transactional email", "Nodemailer / ZeptoMail HTTP")
  Rel(c_api, ${EXT_SYSTEMS.redis.alias}, "Rate-limit counters", "Redis protocol")
  Rel(c_api, ${EXT_SYSTEMS.sentry.alias}, "Error events", "Sentry SDK")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="2")
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Layer 3: Component diagram (derived from extracted JSON)
// ---------------------------------------------------------------------------

// Descriptions for well-known component keys (augments what AST alone can say)
const COMPONENT_DESCRIPTIONS = {
  // API
  'api:config': 'Zod-validated environment variables',
  'api:constants': 'Shared constants — rate limits, upload limits',
  'api:middlewares': 'Hono middleware — JWT auth, Redis rate limiting',
  'api:routes/course': 'Hono handlers — PDF download, cert, lesson, clone, presign, KaTeX',
  'api:routes/mail': 'Hono handler — send email',
  'api:services/course': 'Course clone business logic',
  'api:types': 'Shared TypeScript type definitions',
  'api:utils': 'PDF gen, certificate, S3 upload, Supabase client, email, lesson utils',
  'api:utils/auth': 'JWT token validation',
  'api:utils/openapi': 'OpenAPI spec generation (Scalar)',
  'api:utils/redis': 'Redis client + rate-limit key generators',
  'api:_root': 'App entry point (index.ts) and Hono app factory (app.ts)',
  // Dashboard
  'dashboard:lib/utils/services': 'Supabase data-fetching service functions by domain',
  'dashboard:lib/utils/store': 'Svelte writable stores — user, org, app state, attendance',
  'dashboard:lib/utils/functions': 'Pure utility functions — routing, TinyMCE helpers',
  'dashboard:lib/utils/constants': 'App-wide constants',
  'dashboard:lib/utils/translations': 'i18n JSON bundles (en, fr, de, es, pt, hi, vi, ru, da, pl)',
  'dashboard:lib/utils/types': 'Shared TypeScript types for dashboard',
  'dashboard:lib/utils': 'Miscellaneous utilities',
  'dashboard:lib/components': 'Shared UI components (root)',
  'dashboard:routes/api': 'SvelteKit server endpoints — auth-protected API handlers',
  'dashboard:routes/org': 'Organisation admin pages — courses, community, quiz, settings',
  'dashboard:routes/courses': 'Course management pages — lessons, marks, analytics, attendance',
  'dashboard:routes/lms': 'Student portal — my learning, community, exercises, explore',
  'dashboard:routes/home': 'Post-login home / org selector',
  'dashboard:routes/onboarding': 'First-run org setup wizard',
  'dashboard:_root': 'SvelteKit root layout and top-level hooks',
};

function descFor(appName, key) {
  return COMPONENT_DESCRIPTIONS[`${appName}:${key}`] ?? keyToLabel(key);
}

function keyToLabel(key) {
  if (key === '_root') return 'Root';
  const segments = key.split('/');
  const last = segments[segments.length - 1];
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tech label by app. */
function techFor(appName, key) {
  if (appName === 'api') return 'TypeScript / Hono';
  if (key.startsWith('routes/')) return 'SvelteKit';
  if (key.startsWith('lib/components/')) return 'Svelte';
  if (key.startsWith('lib/utils/services')) return 'TypeScript / Supabase SDK';
  if (key.startsWith('lib/utils/store')) return 'Svelte Store';
  return 'TypeScript';
}

function generateComponentDiagram(data, containerAlias, containerLabel) {
  const { app: appName, components, relationships } = data;
  const compEntries = Object.values(components);

  // Collect which external systems are used by any component
  const usedExternals = new Set();
  for (const comp of compEntries) {
    for (const sys of Object.keys(comp.externalImports ?? {})) {
      if (EXT_SYSTEMS[sys]) usedExternals.add(sys);
    }
  }

  const lines = [];
  lines.push(`# C4 Level 3 — Components: ${containerLabel}`);
  lines.push('');
  lines.push('```mermaid');
  lines.push('C4Component');
  lines.push(`  title Component diagram — ${containerLabel}`);
  lines.push('');
  lines.push(`  Container_Boundary(${containerAlias}, "${containerLabel}") {`);

  for (const comp of compEntries.sort((a, b) => a.key.localeCompare(b.key))) {
    const alias = toAlias(appName, comp.key);
    const label = keyToLabel(comp.key);
    const tech = techFor(appName, comp.key);
    const desc = descFor(appName, comp.key);
    const fileInfo = comp.files.length > 0 || comp.svelteCount > 0
      ? ` [${comp.files.length} ts${comp.svelteCount ? ', ' + comp.svelteCount + ' svelte' : ''}]`
      : '';
    lines.push(`    Component(${alias}, "${label}${fileInfo}", "${tech}", "${desc}")`);
  }

  lines.push('  }');
  lines.push('');

  // External system nodes
  for (const sysId of [...usedExternals].sort()) {
    const sys = EXT_SYSTEMS[sysId];
    lines.push(`  System_Ext(${sys.alias}, "${sys.label}", "${sys.tech}")`);
  }

  if (usedExternals.size > 0) lines.push('');

  // Internal relationships (deduplicated by from→to pair)
  const seen = new Set();
  for (const rel of relationships.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))) {
    const fromAlias = toAlias(appName, rel.from);
    const toAlias_ = toAlias(appName, rel.to);
    const edgeId = `${fromAlias}→${toAlias_}`;
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);
    // only include rel if both components are in the extracted set
    if (!components[rel.from] || !components[rel.to]) continue;
    lines.push(`  Rel(${fromAlias}, ${toAlias_}, "uses")`);
  }

  // External system relationships (component → ext)
  if (usedExternals.size > 0) {
    lines.push('');
    for (const comp of compEntries.sort((a, b) => a.key.localeCompare(b.key))) {
      for (const [sysId, count] of Object.entries(comp.externalImports ?? {})) {
        const sys = EXT_SYSTEMS[sysId];
        if (!sys) continue;
        const alias = toAlias(appName, comp.key);
        lines.push(`  Rel(${alias}, ${sys.alias}, "uses")`);
      }
    }
  }

  lines.push('');
  lines.push('  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")');
  lines.push('```');
  lines.push('');

  // Stats table
  lines.push('## Component Summary');
  lines.push('');
  lines.push('| Component | TS files | Svelte | Key externals |');
  lines.push('|-----------|----------|--------|---------------|');
  for (const comp of compEntries.sort((a, b) => a.key.localeCompare(b.key))) {
    const exts = Object.keys(comp.externalImports ?? {})
      .filter((k) => EXT_SYSTEMS[k])
      .map((k) => EXT_SYSTEMS[k].label)
      .join(', ');
    lines.push(`| \`${comp.key}\` | ${comp.files.length} | ${comp.svelteCount} | ${exts || '—'} |`);
  }
  lines.push('');
  lines.push(`*Extracted ${data.extractedAt.slice(0, 10)} — depth ${data.config.depth}*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function loadJson(appName) {
  const path = join(OUTPUT_DIR, `extracted-${appName}.json`);
  if (!existsSync(path)) {
    console.warn(`Missing ${path} — run extract.mjs first`);
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Layer 1 & 2 are always generated (static + structural knowledge)
writeFileSync(join(OUTPUT_DIR, 'c4-context.md'), generateContext());
console.log('Wrote c4-context.md');

writeFileSync(join(OUTPUT_DIR, 'c4-container.md'), generateContainers());
console.log('Wrote c4-container.md');

// Layer 3 — API
const apiData = loadJson('api');
if (apiData) {
  writeFileSync(
    join(OUTPUT_DIR, 'c4-component-api.md'),
    generateComponentDiagram(apiData, 'c_api', 'API (Hono/Node.js)')
  );
  console.log('Wrote c4-component-api.md');
}

// Layer 3 — Dashboard
const dashData = loadJson('dashboard');
if (dashData) {
  writeFileSync(
    join(OUTPUT_DIR, 'c4-component-dashboard.md'),
    generateComponentDiagram(dashData, 'c_dashboard', 'Dashboard (SvelteKit)')
  );
  console.log('Wrote c4-component-dashboard.md');
}

console.log('\nGeneration complete.');
