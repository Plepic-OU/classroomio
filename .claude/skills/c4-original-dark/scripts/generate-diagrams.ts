#!/usr/bin/env node
/**
 * generate-diagrams.ts — Mermaid C4 diagram generator for ClassroomIO
 *
 * Reads docs/c4/components.json (from extract-components.ts) and writes
 * L1, L2, L3-dashboard, and L3-api Mermaid C4 diagrams to docs/c4/.
 * All diagrams use dark mode: %%{init: {'theme': 'dark'}}%%
 *
 * Usage (from repo root):
 *   node --import=tsx/esm .claude/skills/c4-original-dark/scripts/generate-diagrams.ts [flags]
 *
 * Flags:
 *   --in=PATH   input JSON (default: docs/c4/components.json)
 *   --out=DIR   output directory (default: docs/c4)
 *   --root=PATH repo root (default: process.cwd())
 */

import * as path from 'path';
import * as fs from 'fs';
import type { ComponentEntry, AppOutput, ExtractOutput } from './extract-components.js';

// ─── Mermaid helpers ──────────────────────────────────────────────────────────

const DARK = `%%{init: {'theme': 'dark'}}%%`;

/** Mermaid node aliases must be alphanumeric + underscore */
function alias(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '');
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Human-readable label for a component key.
 * Uses the last two path segments (parent · child) so "routes/course" and
 * "services/course" don't both appear as just "Course".
 */
function compLabel(key: string): string {
  const capitalize = (s: string) =>
    s
      .replace(/\[([^\]]+)\]/g, (_, p: string) => 'By' + p[0].toUpperCase() + p.slice(1))
      .replace(/^\(([^)]+)\)$/, (_, p: string) => p[0].toUpperCase() + p.slice(1))
      .replace(/[-_](.)/g, (_: string, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_: string, c: string) => c.toUpperCase());

  if (key === '_root') return 'Root (entry)';
  const parts = key.split('/');
  if (parts.length === 1) return capitalize(parts[0]);
  // e.g. routes/course → "Routes · Course", utils/redis → "Utils · Redis"
  const parent = capitalize(parts[parts.length - 2]);
  const child = capitalize(parts[parts.length - 1]);
  return `${parent} · ${child}`;
}

// ─── L1 — System Context ──────────────────────────────────────────────────────

function l1(): string {
  return `${DARK}
C4Context
  title System Context — ClassroomIO LMS

  Person(teacher, "Teacher / Admin", "Creates courses, manages cohorts and grading")
  Person(student, "Student", "Takes courses, submits assignments, earns certificates")

  System_Boundary(cio, "ClassroomIO") {
    System(dashboard, "Dashboard", "SvelteKit LMS — course management, grading, community")
    System(api, "API Service", "Hono backend — PDF, video, email, S3 presign")
    System(courseApp, "Course Player", "Embeddable Svelte 5 course viewer")
    System(marketing, "Marketing Site", "SvelteKit public landing page")
    System(docs, "Docs Site", "React/Fumadocs documentation portal")
  }

  System_Ext(supabase, "Supabase", "PostgreSQL · Auth · Storage")
  System_Ext(openai, "OpenAI", "AI-assisted course generation")
  System_Ext(payments, "Stripe / Polar / Lemon", "Payment processing & subscriptions")
  System_Ext(s3, "AWS S3", "File & video object storage")
  System_Ext(redis, "Redis", "Rate-limiting & caching")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error tracking")
  System_Ext(email, "Email Provider", "Zeptomail / Nodemailer transactional email")
  System_Ext(cloudflare, "Cloudflare", "Custom domain routing")

  Rel(teacher, dashboard, "Manages courses & students")
  Rel(student, dashboard, "Learns, submits work")
  Rel(student, courseApp, "Plays embedded courses")
  Rel(dashboard, api, "Calls for PDF / email / uploads", "HTTPS RPC")
  Rel(dashboard, supabase, "Auth, DB, file storage", "Supabase JS")
  Rel(api, supabase, "DB queries & storage", "Supabase JS")
  Rel(api, s3, "Stores files", "AWS SDK v3")
  Rel(api, redis, "Rate limiting", "ioredis")
  Rel(api, email, "Sends email")
  Rel(dashboard, openai, "AI completions", "Vercel AI SDK")
  Rel(dashboard, payments, "Billing")
  Rel(dashboard, posthog, "Analytics events")
  Rel(dashboard, sentry, "Error reports")
  Rel(dashboard, cloudflare, "Domain management", "REST")
`;
}

// ─── L2 — Containers ─────────────────────────────────────────────────────────

function l2(): string {
  return `${DARK}
C4Container
  title Container Diagram — ClassroomIO

  Person(teacher, "Teacher / Admin")
  Person(student, "Student")

  System_Ext(supabase, "Supabase", "PostgreSQL · Auth · Storage")
  System_Ext(openai, "OpenAI API")
  System_Ext(payments, "Stripe / Polar / Lemon")
  System_Ext(s3, "AWS S3")
  System_Ext(redis, "Redis")
  System_Ext(email, "Email Provider")
  System_Ext(posthog, "PostHog")
  System_Ext(sentry, "Sentry")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit 2 / Svelte 4 / TS", "Full LMS UI — SSR. :5173")
    Container(api, "API Service", "Hono 4 / Node.js / TS", "PDF, video, S3, email. :3002")
    Container(courseApp, "Course Player", "Svelte 5", "Embeddable course viewer widget")
    Container(marketing, "Marketing Site", "SvelteKit", "Landing page & pricing. :5174")
    Container(docsSite, "Docs Site", "React 19 / Fumadocs", "MDX docs portal. :3000")
  }

  Rel(teacher, dashboard, "HTTPS")
  Rel(student, dashboard, "HTTPS")
  Rel(student, courseApp, "Embedded widget")
  Rel(dashboard, api, "REST / RPC", "HTTPS")
  Rel(dashboard, supabase, "Auth, DB, storage", "Supabase JS")
  Rel(api, supabase, "DB queries & storage", "Supabase JS")
  Rel(api, s3, "Object storage", "AWS SDK v3")
  Rel(api, redis, "Rate limiting", "ioredis")
  Rel(api, email, "Transactional email", "SMTP/API")
  Rel(dashboard, openai, "AI completions", "Vercel AI SDK")
  Rel(dashboard, payments, "Billing API")
  Rel(dashboard, posthog, "Analytics events", "PostHog JS")
  Rel(dashboard, sentry, "Error reports", "Sentry SDK")
`;
}

// ─── L3 — App components (AST-derived) ────────────────────────────────────────

function l3(app: AppOutput): string {
  const entries = Object.values(app.components);
  if (entries.length === 0) {
    return `${DARK}\nC4Component\n  title Component Diagram — ${app.name} (no components found)\n`;
  }

  const containerLabel = app.name === 'dashboard' ? 'Dashboard' : 'API Service';
  const containerTech =
    app.name === 'dashboard'
      ? 'SvelteKit 2 · Svelte 4 · TypeScript'
      : 'Hono 4 · Node.js · TypeScript';
  const ctrAlias = app.name === 'dashboard' ? 'dashCtr' : 'apiCtr';

  // Pre-compute the set of keys that are visible (have files OR are referenced)
  const referencedKeys = new Set<string>();
  for (const c of entries) {
    for (const dep of c.relationships) referencedKeys.add(dep);
  }
  const visible = entries.filter(
    (c) => c.totalFileCount > 0 || referencedKeys.has(c.key),
  );
  const visibleKeys = new Set(visible.map((c) => c.key));

  const lines: string[] = [
    DARK,
    'C4Component',
    `  title Component Diagram — ${containerLabel}`,
    '',
    `  Container_Boundary(${ctrAlias}, "${containerLabel}", "${containerTech}") {`,
  ];

  for (const comp of visible) {
    const a = alias(comp.key);
    const label = trunc(compLabel(comp.key), 40);
    const tech =
      comp.svelteFileCount > 0 ? 'Svelte / TS' : 'TypeScript';
    const desc = trunc(
      `${comp.totalFileCount} file${comp.totalFileCount !== 1 ? 's' : ''}` +
        (comp.svelteFileCount > 0 ? ` (${comp.svelteFileCount} .svelte)` : ''),
      60,
    );
    lines.push(`    Component(${a}, "${label}", "${tech}", "${desc}")`);
  }

  lines.push('  }');
  lines.push('');

  // Relationships — only between visible components
  for (const comp of visible) {
    const from = alias(comp.key);
    for (const dep of comp.relationships) {
      if (visibleKeys.has(dep)) {
        lines.push(`  Rel(${from}, ${alias(dep)}, "uses")`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function writeMd(outDir: string, filename: string, diagram: string): void {
  const fullPath = path.join(outDir, filename);
  const content =
    `<!-- Generated by c4-original-dark skill — do not edit manually -->\n\n` +
    `\`\`\`mermaid\n${diagram}\`\`\`\n`;
  fs.writeFileSync(fullPath, content, 'utf-8');
  process.stderr.write(`[c4] wrote ${path.relative(process.cwd(), fullPath)}\n`);
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([a-z-]+)=(.+)$/);
    if (m) r[m[1]] = m[2];
  }
  return r;
}

function main(): void {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(args['root'] ?? process.cwd());
  const inPath = path.resolve(repoRoot, args['in'] ?? 'docs/c4/components.json');
  const outDir = path.resolve(repoRoot, args['out'] ?? 'docs/c4');

  if (!fs.existsSync(inPath)) {
    process.stderr.write(`[c4] ERROR: ${inPath} not found — run extract-components.ts first\n`);
    process.exit(1);
  }

  const data: ExtractOutput = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  fs.mkdirSync(outDir, { recursive: true });

  writeMd(outDir, 'l1-system-context.md', l1());
  writeMd(outDir, 'l2-containers.md', l2());

  for (const [appName, appData] of Object.entries(data.apps)) {
    writeMd(outDir, `l3-${appName}.md`, l3(appData));
  }

  process.stderr.write(`[c4] done — diagrams in docs/c4/\n`);
}

main();
