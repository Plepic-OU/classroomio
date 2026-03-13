#!/usr/bin/env tsx
/**
 * C4 Diagram Generator for ClassroomIO
 *
 * Reads the component JSON produced by extract.ts and writes Mermaid C4 diagrams
 * to docs/c4/.
 *
 * Usage:
 *   npx tsx .claude/skills/c4-model/generate-diagrams.ts
 *
 * Input:  .claude/skills/c4-model/output/components.json
 * Output: docs/c4/context.md, containers.md, dashboard.md, api.md
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const INPUT_PATH = path.join(__dirname, 'output/components.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/c4');

// ---------------------------------------------------------------------------
// Types (mirror of extract.ts output)
// ---------------------------------------------------------------------------

interface ComponentInfo {
  key: string;
  label: string;
  tsFiles: number;
  svelteFiles: number;
  description: string;
}

interface Relationship {
  from: string;
  to: string;
  weight: number;
}

interface AppOutput {
  name: string;
  depth: number;
  components: ComponentInfo[];
  relationships: Relationship[];
  externalDeps: Record<string, number>;
  warnings: string[];
}

interface ExtractOutput {
  generatedAt: string;
  apps: Record<string, AppOutput>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitise a path key into a valid Mermaid alias */
function alias(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '_');
}

function warn(msg: string) {
  console.warn(`  ! ${msg}`);
}

// ---------------------------------------------------------------------------
// Layer 1 — System Context (static, derived from known architecture)
// ---------------------------------------------------------------------------

function generateContext(): string {
  return `# Layer 1 — System Context

\`\`\`mermaid
C4Context
  title ClassroomIO — System Context

  Person(teacher, "Teacher / Admin", "Creates courses, manages org, reviews submissions")
  Person(student, "Student", "Takes courses, submits exercises, joins community")

  System(cio, "ClassroomIO", "Open-source LMS for bootcamps and companies")

  System_Ext(supabase, "Supabase", "Managed PostgreSQL, Auth, Realtime, File Storage")
  System_Ext(redis, "Redis", "Rate limiting and caching")
  System_Ext(s3, "Object Storage", "S3-compatible asset and upload storage")
  System_Ext(email, "ZeptoMail", "Transactional email delivery")
  System_Ext(payments, "Stripe / LemonSqueezy", "Subscription billing")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error monitoring")

  Rel(teacher, cio, "Manages courses and org")
  Rel(student, cio, "Learns and submits work")
  Rel(cio, supabase, "Auth, data persistence, realtime")
  Rel(cio, redis, "Rate limiting")
  Rel(cio, s3, "Asset storage")
  Rel(cio, email, "Sends notifications")
  Rel(cio, payments, "Billing and plan upgrades")
  Rel(cio, posthog, "Usage analytics")
  Rel(cio, sentry, "Error reporting")
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Layer 2 — Container (static, derived from known architecture)
// ---------------------------------------------------------------------------

function generateContainers(): string {
  return `# Layer 2 — Containers

\`\`\`mermaid
C4Container
  title ClassroomIO — Container Diagram

  Person(teacher, "Teacher / Admin")
  Person(student, "Student")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit + TailwindCSS", "Course management UI and student learning portal")
    Container(api, "API", "Hono.js + Node.js", "Long-running ops: PDF generation, email dispatch, S3 presigning, course cloning")
    Container(edge, "Edge Functions", "Deno / Supabase", "Webhook handlers and lightweight async tasks")
    ContainerDb(db, "Database", "PostgreSQL (Supabase)", "All application data — RLS policies enforced at DB level")
    Container(auth, "Auth", "Supabase Auth", "JWT-based session management and OAuth")
    Container(storage, "File Storage", "Supabase Storage + S3", "Course assets and user-uploaded files")
  }

  System_Ext(redis, "Redis", "Rate limiting")
  System_Ext(email, "ZeptoMail", "Transactional email")
  System_Ext(payments, "Stripe / LemonSqueezy", "Billing")
  System_Ext(posthog, "PostHog", "Analytics")

  Rel(teacher, dashboard, "HTTPS")
  Rel(student, dashboard, "HTTPS")
  Rel(dashboard, auth, "Login / refresh token")
  Rel(dashboard, db, "CRUD via Supabase JS client", "HTTPS")
  Rel(dashboard, api, "Hono RPC typed client", "HTTPS")
  Rel(dashboard, storage, "Upload / download files")
  Rel(dashboard, posthog, "Track events")
  Rel(api, db, "Data queries", "HTTPS")
  Rel(api, redis, "Rate limiting", "TCP")
  Rel(api, email, "Send emails", "HTTPS")
  Rel(api, storage, "S3 presign", "HTTPS")
  Rel(api, payments, "Webhook verification", "HTTPS")
  Rel(edge, db, "Triggered operations", "Internal")
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Layer 3 — Component (derived from AST extraction)
// ---------------------------------------------------------------------------

/**
 * Groups components into Container_Boundary sections.
 * File-level components (key ends with an extension) group under their parent dir.
 * Directory components group by their second path segment (src/<top>).
 */
function groupComponents(components: ComponentInfo[]): Map<string, ComponentInfo[]> {
  const groups = new Map<string, ComponentInfo[]>();
  for (const comp of components) {
    const parts = comp.key.split('/');
    const lastName = parts[parts.length - 1];
    const isFile = lastName.includes('.'); // e.g. "hooks.server.ts", "+layout.ts"
    // File: group under parent directory; Directory: group by src/<top>
    const groupKey = isFile
      ? parts.slice(0, parts.length - 1).join('/') || parts[0]
      : parts.slice(0, 2).join('/');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(comp);
  }
  return groups;
}

function generateComponentDiagram(app: AppOutput, appLabel: string, technology: string): string {
  const { components, relationships } = app;

  if (components.length === 0) {
    return `# Layer 3 — ${appLabel} Components\n\n_No component data available. Run extract.ts first._\n`;
  }

  // Filter to components that appear in at least one relationship, then fall back to all
  const referencedKeys = new Set([
    ...relationships.map((r) => r.from),
    ...relationships.map((r) => r.to),
  ]);
  const visible =
    referencedKeys.size > 0
      ? components.filter((c) => referencedKeys.has(c.key))
      : components;

  const visibleKeys = new Set(visible.map((c) => c.key));

  // Significant relationships (both endpoints in visible set)
  const visibleRels = relationships.filter(
    (r) => visibleKeys.has(r.from) && visibleKeys.has(r.to) && r.weight > 0
  );

  const groups = groupComponents(visible);
  const lines: string[] = [];

  lines.push(`# Layer 3 — ${appLabel} Components`);
  lines.push('');
  if (app.warnings.length > 0) {
    lines.push('> **Extraction warnings:**');
    app.warnings.forEach((w) => lines.push(`> - ${w}`));
    lines.push('');
  }
  lines.push('```mermaid');
  lines.push('C4Component');
  lines.push(`  title ${appLabel} — Component Diagram (depth=${app.depth})`);
  lines.push('');

  for (const [groupKey, groupComps] of Array.from(groups.entries()).sort()) {
    const groupLabel = groupKey.split('/').slice(1).join('/') || groupKey;
    lines.push(`  Container_Boundary(${alias(groupKey)}, "${groupLabel}") {`);
    for (const comp of groupComps.sort((a, b) => a.key.localeCompare(b.key))) {
      const tech =
        comp.svelteFiles > 0
          ? `${comp.tsFiles} TS, ${comp.svelteFiles} Svelte`
          : `${comp.tsFiles} TS`;
      // Escape quotes in description
      const desc = comp.description.replace(/"/g, "'");
      lines.push(`    Component(${alias(comp.key)}, "${comp.label}", "${tech}", "${desc}")`);
    }
    lines.push('  }');
    lines.push('');
  }

  // Relationships
  const MAX_RELS = 60;
  const topRels = visibleRels.slice(0, MAX_RELS);
  for (const rel of topRels) {
    lines.push(
      `  Rel(${alias(rel.from)}, ${alias(rel.to)}, "uses", "${rel.weight} imports")`
    );
  }
  if (visibleRels.length > MAX_RELS) {
    lines.push(`  %% ... and ${visibleRels.length - MAX_RELS} more relationships omitted`);
  }

  lines.push('```');
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString().slice(0, 10)} from AST extraction. Re-run \`extract.ts\` + \`generate-diagrams.ts\` to update._`);
  lines.push('');

  // Summary table
  lines.push('## Components');
  lines.push('');
  lines.push('| Key | TS files | Svelte files | Description |');
  lines.push('|-----|----------|--------------|-------------|');
  for (const comp of components.sort((a, b) => a.key.localeCompare(b.key))) {
    lines.push(`| \`${comp.key}\` | ${comp.tsFiles} | ${comp.svelteFiles} | ${comp.description} |`);
  }
  lines.push('');

  // Top external deps
  const extEntries = Object.entries(app.externalDeps).slice(0, 10);
  if (extEntries.length > 0) {
    lines.push('## Top External Dependencies');
    lines.push('');
    lines.push('| Package | Import count |');
    lines.push('|---------|-------------|');
    for (const [pkg, count] of extEntries) {
      lines.push(`| \`${pkg}\` | ${count} |`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input not found: ${INPUT_PATH}`);
    console.error('Run extract.ts first.');
    process.exit(1);
  }

  const data: ExtractOutput = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files: Array<{ name: string; content: string }> = [
    { name: 'context.md', content: generateContext() },
    { name: 'containers.md', content: generateContainers() },
    {
      name: 'dashboard.md',
      content: generateComponentDiagram(
        data.apps.dashboard ?? { name: 'dashboard', depth: 3, components: [], relationships: [], externalDeps: {}, warnings: ['No data'] },
        'Dashboard',
        'SvelteKit'
      ),
    },
    {
      name: 'api.md',
      content: generateComponentDiagram(
        data.apps.api ?? { name: 'api', depth: 2, components: [], relationships: [], externalDeps: {}, warnings: ['No data'] },
        'API',
        'Hono.js'
      ),
    },
  ];

  for (const file of files) {
    const outPath = path.join(OUTPUT_DIR, file.name);
    fs.writeFileSync(outPath, file.content);
    console.log(`  Written: docs/c4/${file.name}`);
  }

  console.log(`\nDiagrams generated from extraction at: ${data.generatedAt}`);
}

main();
