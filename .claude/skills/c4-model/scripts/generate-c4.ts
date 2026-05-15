#!/usr/bin/env npx tsx
/**
 * ClassroomIO C4 Model Generator — Layers 1–3
 *
 * Extracts component structure from apps/dashboard and apps/api via ts-morph
 * AST analysis, then writes Mermaid C4 diagrams to docs/c4/.
 *
 * Run from anywhere in the repo:
 *   npx tsx .claude/skills/c4-model/scripts/generate-c4.ts
 *
 * Depth configuration (lines ~30-43): increase for finer granularity,
 * decrease for coarser. Warns when any component exceeds 50 files.
 */

import { Project, ts } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// ── repo root detection ───────────────────────────────────────────────────────

function findRoot(): string {
  let d = process.cwd();
  while (d !== path.parse(d).root) {
    if (fs.existsSync(path.join(d, 'pnpm-workspace.yaml'))) return d;
    d = path.dirname(d);
  }
  throw new Error('Cannot find repo root (no pnpm-workspace.yaml found)');
}
const ROOT = findRoot();
const DOCS = path.join(ROOT, 'docs/c4');

// ── app configuration ─────────────────────────────────────────────────────────

interface AppCfg {
  name: string;
  label: string;
  rootDir: string;
  srcDir: string;
  depth: number;    // directory depth for component grouping from srcDir
  tech: string;
  descr: string;
}

const APPS: AppCfg[] = [
  {
    name:    'dashboard',
    label:   'Dashboard',
    rootDir: path.join(ROOT, 'apps/dashboard'),
    srcDir:  path.join(ROOT, 'apps/dashboard/src'),
    depth:   4,
    tech:    'SvelteKit · TypeScript',
    descr:   'Main LMS web application',
  },
  {
    name:    'api',
    label:   'API',
    rootDir: path.join(ROOT, 'apps/api'),
    srcDir:  path.join(ROOT, 'apps/api/src'),
    depth:   2,
    tech:    'Hono · Node.js',
    descr:   'Backend for PDF, email, and file operations',
  },
];

// ── types ─────────────────────────────────────────────────────────────────────

interface Comp { key: string; tsCount: number; svelteCount: number; }
interface Rel  { from: string; to: string; }
interface Extracted { cfg: AppCfg; comps: Map<string, Comp>; rels: Rel[]; }

// ── helpers ───────────────────────────────────────────────────────────────────

const toId    = (app: string, key: string) => (app + '_' + key).replace(/\W/g, '_');
const toLabel = (key: string): string => key === '__root__' ? 'Root' :
  key.split('/').pop()!.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Load path aliases by following tsconfig.json extends chains
function loadAliases(rootDir: string): Map<string, string> {
  const out     = new Map<string, string>();
  const visited = new Set<string>();

  function load(p: string): void {
    const fp = p.endsWith('.json') ? p : p + '.json';
    if (visited.has(fp) || !fs.existsSync(fp)) return;
    visited.add(fp);
    let raw: string;
    try   { raw = fs.readFileSync(fp, 'utf-8'); }
    catch { return; }
    // Use TypeScript's own JSONC parser so // and /* */ comments are stripped
    // correctly without misidentifying path-alias wildcards (e.g. "$lib/*") as
    // comment starts.
    const { config: cfg, error } = ts.parseConfigFileTextToJson(fp, raw);
    if (error || !cfg) return;
    // Load parent first so child overrides parent
    if (cfg.extends) load(path.resolve(path.dirname(fp), cfg.extends as string));
    const dir = path.dirname(fp);
    for (const [alias, targets] of Object.entries<string[]>(cfg.compilerOptions?.paths ?? {})) {
      if (Array.isArray(targets) && targets[0]) {
        out.set(
          alias.replace(/\/\*$/, ''),
          path.resolve(dir, (targets[0] as string).replace(/\/\*$/, ''))
        );
      }
    }
  }
  load(path.join(rootDir, 'tsconfig.json'));
  return out;
}

function resolveImport(imp: string, from: string, aliases: Map<string, string>): string | null {
  if (imp.startsWith('.'))
    return path.resolve(path.dirname(from), imp);
  for (const [base, target] of aliases)
    if (imp === base || imp.startsWith(base + '/'))
      return path.join(target, imp.slice(base.length).replace(/^\//, ''));
  return null; // external package, skip
}

function compKey(file: string, srcDir: string, depth: number): string {
  const parts = path.relative(srcDir, file).split(path.sep).slice(0, -1).slice(0, depth);
  return parts.length > 0 ? parts.join('/') : '__root__';
}

// ── extraction ────────────────────────────────────────────────────────────────

function extract(cfg: AppCfg): Extracted {
  const aliases  = loadAliases(cfg.rootDir);
  const comps    = new Map<string, Comp>();
  const tsFiles: string[] = [];
  const relSet   = new Set<string>();
  const rels:    Rel[] = [];

  // Walk source tree, collect files by component key
  (function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && !ent.name.startsWith('.')) walk(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (!['.ts', '.js', '.svelte'].includes(ext)) continue;
        const key = compKey(full, cfg.srcDir, cfg.depth);
        if (!comps.has(key)) comps.set(key, { key, tsCount: 0, svelteCount: 0 });
        if (ext === '.svelte') comps.get(key)!.svelteCount++;
        else { comps.get(key)!.tsCount++; tsFiles.push(full); }
      }
    }
  })(cfg.srcDir);

  // Validate depth — too shallow if a component contains too many files
  for (const [key, c] of comps) {
    const total = c.tsCount + c.svelteCount;
    if (total > 50)
      console.warn(`[WARN] ${cfg.name}/${key}: ${total} files — depth=${cfg.depth} may be too shallow`);
  }

  // Parse imports with ts-morph to build cross-component relationships
  const proj = new Project({
    compilerOptions: { allowJs: true, noEmit: true },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  proj.addSourceFilesAtPaths(tsFiles);

  for (const sf of proj.getSourceFiles()) {
    const file    = sf.getFilePath();
    const fromKey = compKey(file, cfg.srcDir, cfg.depth);
    for (const decl of sf.getImportDeclarations()) {
      const resolved = resolveImport(decl.getModuleSpecifierValue(), file, aliases);
      if (!resolved) continue;
      // Only track imports within this app's source tree
      const srcWithSep = cfg.srcDir + path.sep;
      if (!resolved.startsWith(srcWithSep) && resolved !== cfg.srcDir) continue;
      const toKey = compKey(resolved, cfg.srcDir, cfg.depth);
      if (fromKey === toKey) continue;
      // Skip if the resolved path is a directory — compKey strips the last segment
      // as if it were a filename, producing a key that has no component bucket.
      if (!comps.has(toKey)) continue;
      const rk = `${fromKey}→${toKey}`;
      if (!relSet.has(rk)) { relSet.add(rk); rels.push({ from: fromKey, to: toKey }); }
    }
  }

  return { cfg, comps, rels };
}

// ── diagram generators ────────────────────────────────────────────────────────

function l1SystemContext(): string {
  return `\`\`\`mermaid
C4Context
title System Context — ClassroomIO LMS

Person(student, "Student", "Enrolled learner taking courses and submitting work")
Person(teacher, "Teacher / Tutor", "Creates content, manages courses, grades submissions")
Person(admin, "Org Admin", "Manages organization, members, and settings")

System(classroomio, "ClassroomIO", "Open-source LMS for companies and bootcamps. Course management, assessments, grading, community forums.")

System_Ext(supabase, "Supabase", "Managed PostgreSQL + Auth with row-level security and realtime subscriptions")
System_Ext(storage, "Object Storage", "Cloudflare R2 / S3-compatible for file uploads and course media")
System_Ext(email, "Email Service", "ZeptoMail / SMTP for transactional email")
System_Ext(posthog, "PostHog", "Product analytics and feature flags")
System_Ext(sentry, "Sentry", "Error monitoring and performance tracking")

Rel(student, classroomio, "Takes courses, submits work, joins community")
Rel(teacher, classroomio, "Creates content, grades submissions")
Rel(admin, classroomio, "Manages org, invites members, configures settings")
Rel(classroomio, supabase, "Stores all data, authenticates users", "Supabase SDK")
Rel(classroomio, storage, "Stores uploads and media", "S3 API")
Rel(classroomio, email, "Sends invitations and notifications", "SMTP / API")
Rel(classroomio, posthog, "Tracks usage", "JS SDK")
Rel(classroomio, sentry, "Reports errors and performance", "JS SDK")
\`\`\``;
}

function l2Containers(): string {
  return `\`\`\`mermaid
C4Container
title Container Diagram — ClassroomIO LMS

Person(student, "Student")
Person(teacher, "Teacher / Tutor")
Person(admin, "Org Admin")

System_Boundary(cio, "ClassroomIO") {
  Container(dashboard, "Dashboard", "SvelteKit · TypeScript", "Main LMS web app — org admin, course delivery, student portal, community. Port 5173")
  Container(api, "API", "Hono · Node.js", "Backend — PDF generation, email dispatch, file presigning, KaTeX rendering. Port 3002")
  Container(website, "classroomio.com", "SvelteKit", "Marketing and landing site. Port 5174")
}

System_Ext(supabase, "Supabase", "PostgreSQL + Auth + Realtime. Port 54321")
System_Ext(storage, "Object Storage", "Cloudflare R2 / S3-compatible")
System_Ext(email_svc, "Email Service", "ZeptoMail / SMTP")

Rel(student, dashboard, "Uses", "HTTPS")
Rel(teacher, dashboard, "Uses", "HTTPS")
Rel(admin, dashboard, "Uses", "HTTPS")
Rel(dashboard, api, "PDF / email / media ops", "HTTP RPC (typed via @cio/api)")
Rel(dashboard, supabase, "Read/write data, realtime subscriptions", "Supabase JS SDK")
Rel(api, supabase, "Read/write via service role key", "Supabase Admin SDK")
Rel(api, storage, "Pre-sign upload URLs, store files", "S3 API")
Rel(api, email_svc, "Send transactional email", "SMTP / ZeptoMail API")
Rel(student, website, "Discovers the product", "HTTPS")
\`\`\``;
}

function l3Components(ex: Extracted): string {
  const { cfg, comps, rels } = ex;
  const lines: string[] = [
    '```mermaid',
    'C4Component',
    `title Component Diagram — ${cfg.label} (${cfg.tech})`,
    '',
    `Container_Boundary(${cfg.name}_b, "${cfg.label}") {`,
  ];
  for (const [, c] of [...comps.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const id    = toId(cfg.name, c.key);
    const label = toLabel(c.key);
    const tech  = c.svelteCount > 0 ? 'SvelteKit' : 'TypeScript';
    const descr = `${c.key} · ${c.tsCount}ts${c.svelteCount ? `/${c.svelteCount}svelte` : ''}`;
    lines.push(`  Component(${id}, "${label}", "${tech}", "${descr}")`);
  }
  lines.push('}', '');
  for (const r of [...rels].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)))
    lines.push(`Rel(${toId(cfg.name, r.from)}, ${toId(cfg.name, r.to)}, "imports")`);
  lines.push('```');
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────────

fs.mkdirSync(DOCS, { recursive: true });

fs.writeFileSync(path.join(DOCS, 'system-context.md'),
  `# C4 Layer 1 — System Context\n\n${l1SystemContext()}\n`);
console.log('✓ docs/c4/system-context.md');

fs.writeFileSync(path.join(DOCS, 'containers.md'),
  `# C4 Layer 2 — Containers\n\n${l2Containers()}\n`);
console.log('✓ docs/c4/containers.md');

for (const cfg of APPS) {
  console.log(`\nExtracting ${cfg.name} (depth=${cfg.depth})…`);
  const ex     = extract(cfg);
  const diagram = l3Components(ex);
  const md =
    `# C4 Layer 3 — ${cfg.label} Components\n\n` +
    `> AST-extracted. Re-run \`generate-c4.ts\` after structural changes.\n\n` +
    `**Depth:** ${cfg.depth} · **Components:** ${ex.comps.size} · **Relationships:** ${ex.rels.length}\n\n` +
    diagram + '\n';
  fs.writeFileSync(path.join(DOCS, `${cfg.name}-components.md`), md);
  // Intermediate JSON — gitignored, useful for debugging
  fs.writeFileSync(
    path.join(DOCS, `extracted-${cfg.name}.json`),
    JSON.stringify({ app: cfg.name, depth: cfg.depth,
      components: [...ex.comps.values()], relationships: ex.rels }, null, 2)
  );
  console.log(`✓ docs/c4/${cfg.name}-components.md (${ex.comps.size} components, ${ex.rels.length} rels)`);
}

console.log('\nOptional: run extract-database.ts for the database schema (requires supabase start).');
