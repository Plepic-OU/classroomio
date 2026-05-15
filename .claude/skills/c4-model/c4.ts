#!/usr/bin/env node
/**
 * C4 model extractor for ClassroomIO.
 * Parses apps/dashboard and apps/api with ts-morph, groups files into components
 * by directory depth, maps cross-component relationships, outputs Mermaid C4 diagrams
 * to docs/c4/.
 *
 * Usage: npx tsx .claude/skills/c4-model/c4.ts [--depth-dashboard=N] [--depth-api=N]
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(REPO_ROOT, 'docs/c4');

interface AppConfig {
  name: string;
  root: string; // abs path to app root (tsconfig.json lives here)
  srcDir: string; // abs path to src/
  depth: number; // how many dir segments after src/ form a component key
}

const args = process.argv.slice(2);
const argDepth = (flag: string, def: number) => {
  const m = args.find(a => a.startsWith(`--depth-${flag}=`));
  return m ? parseInt(m.split('=')[1], 10) : def;
};

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    root: path.join(REPO_ROOT, 'apps/dashboard'),
    srcDir: path.join(REPO_ROOT, 'apps/dashboard/src'),
    depth: argDepth('dashboard', 3),
  },
  {
    name: 'api',
    root: path.join(REPO_ROOT, 'apps/api'),
    srcDir: path.join(REPO_ROOT, 'apps/api/src'),
    depth: argDepth('api', 1),
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Component {
  key: string;
  name: string;
  app: string;
  fileCount: number;
  svelteCount: number;
  description: string;
}

interface Relationship {
  from: string;
  to: string;
  count: number; // number of distinct import edges between the pair
}

interface AppData {
  name: string;
  components: Component[];
  relationships: Relationship[];
}

// ---------------------------------------------------------------------------
// Path alias resolution
// ---------------------------------------------------------------------------

function readAliases(tsconfigPath: string, appRoot: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    // Strip line comments so JSON.parse works
    const stripped = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const cfg = JSON.parse(stripped);
    const pathsObj: Record<string, string[]> = cfg.compilerOptions?.paths ?? {};
    const out: Record<string, string> = {};
    for (const [alias, targets] of Object.entries(pathsObj)) {
      const key = alias.replace(/\/\*$/, '');
      const val = (targets[0] ?? '').replace(/\/\*$/, '');
      out[key] = path.resolve(appRoot, val);
    }
    return out;
  } catch {
    return {};
  }
}

function resolveSpecifier(
  spec: string,
  fromFile: string,
  aliases: Record<string, string>,
  srcDir: string,
): string | null {
  // Alias match (longest prefix wins)
  const match = Object.keys(aliases)
    .filter(a => spec === a || spec.startsWith(a + '/'))
    .sort((a, b) => b.length - a.length)[0];

  if (match) {
    const rest = spec.slice(match.length); // '' or '/...'
    return path.join(aliases[match] + rest);
  }

  if (spec.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), spec);
  }

  return null; // external package
}

// ---------------------------------------------------------------------------
// Component key derivation
// ---------------------------------------------------------------------------

function componentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  // If last part looks like a file (has dot-extension), drop it
  const lastExt = path.extname(parts[parts.length - 1] ?? '');
  const dirParts = lastExt ? parts.slice(0, -1) : parts;
  return dirParts.slice(0, depth).join('/') || 'root';
}

function toComponentName(key: string): string {
  const last = key.split('/').pop() ?? key;
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function inferDescription(key: string): string {
  const p = key.toLowerCase();
  if (p.includes('route')) return 'Route handlers';
  if (p.includes('component')) return 'UI components (Svelte)';
  if (p.includes('service')) return 'Data access & business logic';
  if (p.includes('store')) return 'Reactive state stores';
  if (p.includes('util') || p.includes('function')) return 'Utility functions';
  if (p.includes('middleware')) return 'Request middleware';
  if (p.includes('type')) return 'Type definitions';
  if (p.includes('config')) return 'App configuration';
  if (p.includes('constant')) return 'Shared constants';
  if (p.includes('mail')) return 'Email handling';
  if (p.includes('mock')) return 'Test fixtures';
  if (p.includes('api')) return 'API client endpoints';
  return '';
}

// ---------------------------------------------------------------------------
// Svelte file counter — assigns each .svelte file to its component key
// (non-recursive per-component to avoid double-counting across depth levels)
// ---------------------------------------------------------------------------

function buildSvelteCounts(srcDir: string, depth: number): Map<string, number> {
  const counts = new Map<string, number>();
  function scan(dir: string) {
    try {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, ent.name);
        if (ent.isDirectory()) scan(fp);
        else if (ent.name.endsWith('.svelte')) {
          const key = componentKey(fp, srcDir, depth);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
  scan(srcDir);
  return counts;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function extractApp(cfg: AppConfig): AppData {
  const aliases = readAliases(path.join(cfg.root, 'tsconfig.json'), cfg.root);
  const svelteCounts = buildSvelteCounts(cfg.srcDir, cfg.depth);

  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });

  project.addSourceFilesAtPaths([
    `${cfg.srcDir}/**/*.ts`,
    `${cfg.srcDir}/**/*.js`,
    `!${cfg.srcDir}/**/*.d.ts`,
    `!${cfg.srcDir}/**/*.spec.*`,
    `!${cfg.srcDir}/**/*.test.*`,
    `!${cfg.srcDir}/**/__mocks__/**`,
    `!${cfg.srcDir}/**/mocks/**`,
  ]);

  // component key → file set
  const compFiles = new Map<string, Set<string>>();
  // "from|to" → edge count
  const edges = new Map<string, number>();

  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath() as string;
    const fromKey = componentKey(fp, cfg.srcDir, cfg.depth);

    if (!compFiles.has(fromKey)) compFiles.set(fromKey, new Set());
    compFiles.get(fromKey)!.add(fp);

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      const resolved = resolveSpecifier(spec, fp, aliases, cfg.srcDir);
      if (!resolved) continue;

      // Skip if resolved path escapes srcDir
      const rel = path.relative(cfg.srcDir, resolved);
      if (rel.startsWith('..')) continue;

      // Normalize: if resolved has no extension, try to find the actual .ts/.js file
      // so the key matches how the file is registered in compFiles.
      let normalizedResolved = resolved;
      if (!path.extname(resolved)) {
        for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolved + ext)) {
            normalizedResolved = resolved + ext;
            break;
          }
        }
      }

      const toKey = componentKey(normalizedResolved, cfg.srcDir, cfg.depth);
      if (toKey === fromKey) continue;

      const edgeKey = `${fromKey}|${toKey}`;
      edges.set(edgeKey, (edges.get(edgeKey) ?? 0) + 1);
    }
  }

  // Build component list
  const components: Component[] = [];
  for (const [key, files] of compFiles) {
    if (files.size > 50) {
      console.warn(`  WARN [${cfg.name}] "${key}" has ${files.size} files — consider increasing --depth-${cfg.name}`);
    }
    components.push({
      key,
      name: toComponentName(key),
      app: cfg.name,
      fileCount: files.size,
      svelteCount: svelteCounts.get(key) ?? 0,
      description: inferDescription(key),
    });
  }
  components.sort((a, b) => a.key.localeCompare(b.key));

  // Build relationship list — only include edges where both ends are known components
  const relationships: Relationship[] = [];
  for (const [edgeKey, count] of edges) {
    const [from, to] = edgeKey.split('|');
    if (compFiles.has(from) && compFiles.has(to)) {
      relationships.push({ from, to, count });
    }
  }

  return { name: cfg.name, components, relationships };
}

// ---------------------------------------------------------------------------
// Diagram generation
// ---------------------------------------------------------------------------

const safeId = (app: string, key: string) =>
  (app.slice(0, 3) + '_' + key).replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

function l1SystemContext(): string {
  return `# C4 L1 — System Context

ClassroomIO sits between two types of users — **Teachers/Admins** who create and manage content, and **Students** who consume it. All persistent state lives in **Supabase** (PostgreSQL + Auth). The remaining external systems handle specialised concerns: video streaming (Cloudflare), file storage (S3), transactional email, rate-limiting (Redis), subscription billing, and product analytics.

This diagram treats ClassroomIO as a single black box. See [L2 Containers](l2-containers.md) to zoom into its internal structure.

\`\`\`mermaid
C4Context
  title ClassroomIO — System Context

  Person(teacher, "Teacher / Admin", "Manages courses, exercises, students")
  Person(student, "Student", "Takes courses, submits exercises")

  System(cio, "ClassroomIO", "Open-source LMS for bootcamps and educators")

  System_Ext(supabase, "Supabase", "PostgreSQL database, auth, storage")
  System_Ext(cloudflare, "Cloudflare Stream", "Video upload and streaming")
  System_Ext(s3, "AWS S3", "File and asset storage")
  System_Ext(email, "ZeptoMail / SMTP", "Transactional email")
  System_Ext(redis, "Redis", "Rate limiting and caching")
  System_Ext(billing, "Polar.sh / Lemon Squeezy", "Subscription billing")
  System_Ext(posthog, "PostHog", "Product analytics")

  Rel(teacher, cio, "Manages courses", "HTTPS")
  Rel(student, cio, "Takes courses", "HTTPS")
  Rel(cio, supabase, "Reads/writes data", "SDK")
  Rel(cio, cloudflare, "Uploads/streams video", "HTTP API")
  Rel(cio, s3, "Stores files", "AWS SDK")
  Rel(cio, email, "Sends emails", "SMTP/API")
  Rel(cio, redis, "Rate-limits requests", "TCP")
  Rel(cio, billing, "Manages subscriptions", "API")
  Rel(cio, posthog, "Tracks events", "SDK")
\`\`\`
`;
}

function l2Containers(): string {
  return `# C4 L2 — Containers

ClassroomIO is composed of three deployable containers. The **Dashboard** (SvelteKit, port 5173) is the primary UI for both teachers and students; it reads and writes directly to Supabase via Row-Level Security and delegates long-running work to the API. The **API** (Hono/Node.js, port 3002) handles async operations — PDF certificate generation, video upload presigning, and email dispatch — and is the only container that talks to Cloudflare, S3, and the mail server. The **Course App** is a standalone embeddable Svelte 5 component published to npm, independent of the other two.

Key architectural decision: the API does **not** own the database. Both the Dashboard and the API use the Supabase SDK; the difference is that the Dashboard operates under user-scoped RLS policies while the API uses the service-role key for privileged operations.

See [L3 Dashboard](l3-dashboard.md) and [L3 API](l3-api.md) for the internal component structure.

\`\`\`mermaid
C4Container
  title ClassroomIO — Containers

  Person(teacher, "Teacher / Admin")
  Person(student, "Student")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit 2 / Svelte 4", "Main LMS UI. Teacher management and student learning. Port 5173.")
    Container(api, "API", "Hono / Node.js", "Async operations: PDF certs, video presigning, email dispatch. Port 3002.")
    Container(courseapp, "Course App", "Svelte 5", "Embeddable course viewer (npm-published)")
  }

  ContainerDb(db, "PostgreSQL", "Supabase Postgres", "All LMS data: orgs, courses, lessons, exercises, submissions, users")
  Container_Ext(auth, "Supabase Auth", "GoTrue", "JWT-based auth and session management")
  Container_Ext(redis, "Redis", "Redis 7", "Rate limiting")
  System_Ext(cloudflare, "Cloudflare Stream", "Video streaming")
  System_Ext(s3, "AWS S3", "File storage")
  System_Ext(email, "ZeptoMail / SMTP", "Email delivery")

  Rel(teacher, dashboard, "Uses", "HTTPS")
  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(dashboard, db, "Reads/writes via RLS", "Supabase SDK")
  Rel(dashboard, auth, "Authenticates users", "Supabase SDK")
  Rel(dashboard, api, "Delegates async tasks", "RPC/REST")
  Rel(api, db, "Service-level DB ops", "Supabase SDK")
  Rel(api, redis, "Rate limiting", "ioredis")
  Rel(api, cloudflare, "Presigns video uploads", "HTTP")
  Rel(api, s3, "Stores course assets", "AWS SDK")
  Rel(api, email, "Sends emails", "Nodemailer")
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Grouped component table — readable in plain text / context
// ---------------------------------------------------------------------------

interface Group { label: string; match: (key: string) => boolean }

const DASHBOARD_GROUPS: Group[] = [
  { label: 'UI Components (`lib/components/`)',  match: k => k.startsWith('lib/components/') },
  { label: 'Utilities (`lib/utils/`)',            match: k => k.startsWith('lib/utils/') },
  { label: 'Server Routes (`routes/api/`)',       match: k => k.startsWith('routes/api/') },
  { label: 'Page Routes (`routes/`)',             match: k => k.startsWith('routes/') && !k.startsWith('routes/api/') },
  { label: 'Other',                               match: () => true },
];

const API_GROUPS: Group[] = [
  { label: 'Route Handlers (`routes/`)',          match: k => k.startsWith('routes') },
  { label: 'Services',                            match: k => k.startsWith('services') },
  { label: 'Utils',                               match: k => k.startsWith('utils') },
  { label: 'Types',                               match: k => k.startsWith('types') },
  { label: 'Middleware',                          match: k => k.startsWith('middlewares') },
  { label: 'Other',                               match: () => true },
];

function buildComponentTable(app: AppData): string {
  const groups = app.name === 'dashboard' ? DASHBOARD_GROUPS : API_GROUPS;
  const assigned = new Set<string>();
  const sections: string[] = [];

  for (const group of groups) {
    const members = app.components.filter(c => !assigned.has(c.key) && group.match(c.key));
    if (members.length === 0) continue;
    members.forEach(c => assigned.add(c.key));

    const rows = members.map(c => {
      const files = c.svelteCount > 0 ? `${c.svelteCount} svelte + ${c.fileCount} ts` : `${c.fileCount} ts`;
      const desc = c.description || '—';
      return `| \`${c.key}\` | ${files} | ${desc} |`;
    });

    sections.push(
      `### ${group.label}\n\n| Path | Files | Description |\n|------|-------|-------------|\n${rows.join('\n')}`
    );
  }

  return `## Components\n\n${sections.join('\n\n')}`;
}

function l3Component(app: AppData): string {
  const titleMap: Record<string, string> = {
    dashboard: 'Dashboard (SvelteKit)',
    api: 'API (Hono)',
  };
  const techMap: Record<string, string> = {
    dashboard: 'SvelteKit 2 / Svelte 4',
    api: 'Hono / Node.js',
  };
  const title = titleMap[app.name] ?? app.name;
  const tech = techMap[app.name] ?? '';

  const id = (key: string) => safeId(app.name, key);

  const compLines = app.components
    .map(c => {
      const fileNote =
        c.svelteCount > 0
          ? `${c.svelteCount} svelte + ${c.fileCount} ts`
          : `${c.fileCount} files`;
      const descr = [c.description, fileNote].filter(Boolean).join('. ');
      return `    Component(${id(c.key)}, "${c.name}", "${tech}", "${descr}")`;
    })
    .join('\n');

  // Deduplicate bidirectional pairs and filter low-count noise
  const seen = new Set<string>();
  const relLines = app.relationships
    .filter(r => r.count >= 1)
    .sort((a, b) => b.count - a.count)
    .filter(r => {
      const fwd = `${r.from}|${r.to}`;
      const rev = `${r.to}|${r.from}`;
      if (seen.has(fwd) || seen.has(rev)) return false;
      seen.add(fwd);
      return true;
    })
    .map(r => `  Rel(${id(r.from)}, ${id(r.to)}, "imports (${r.count})")`)
    .join('\n');

  const externalSection =
    app.name === 'dashboard'
      ? `\n  System_Ext(supabase, "Supabase", "Database & Auth")\n  System_Ext(hono_api, "API Container", "Hono backend")`
      : `\n  System_Ext(supabase, "Supabase", "Database")\n  System_Ext(cloudflare, "Cloudflare", "Video")\n  System_Ext(s3, "AWS S3", "Files")\n  System_Ext(email, "ZeptoMail", "Email")\n  System_Ext(redis, "Redis", "Cache")`;

  const descriptionMap: Record<string, string> = {
    dashboard: `Components are grouped from the source tree at depth 2 (e.g. \`lib/components\`, \`lib/utils\`, \`routes/api\`). Relationship arrows show TypeScript import edges between groups; the number is the count of distinct imports.

**\`lib/utils\`** is the architectural hub — route handlers and UI components all funnel through it. It packages utility functions, Supabase data-access services, Svelte stores, shared types, and constants. **\`routes/api/*\`** are SvelteKit \`+server.ts\` endpoints (server-side API handlers). All other \`routes/*\` sub-directories map directly to browser URL paths.

Regenerate with \`/c4-model\` after adding routes or refactoring \`lib/\`.`,

    api: `Components are grouped at depth 1 (one level below \`src/\`). Relationship arrows show TypeScript import edges.

The API follows a standard layered structure: **routes** (Hono handlers), **services** (Supabase queries and business logic), **utils** (shared helpers, mail, certificate generation), **types** (Zod schemas and TypeScript types), **middlewares** (rate-limiter, auth validation), and **config** (environment setup). Low internal coupling is intentional — the only detected import edge is middlewares → utils.

Regenerate with \`/c4-model\` after adding new routes or services.`,
  };

  const description = descriptionMap[app.name] ?? '';
  const table = buildComponentTable(app);

  return `# C4 L3 — ${title} Components

${description}

${table}

## Diagram

\`\`\`mermaid
C4Component
  title ${title} — Components
${externalSection}

  Container_Boundary(${app.name}_bound, "${title}") {
${compLines}
  }

${relLines}
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allApps: AppData[] = [];
  for (const cfg of APPS) {
    console.log(`Extracting ${cfg.name} (depth=${cfg.depth})...`);
    const data = extractApp(cfg);
    allApps.push(data);
    console.log(`  → ${data.components.length} components, ${data.relationships.length} relationships`);
  }

  // Write JSON (gitignored — AI context only)
  fs.writeFileSync(path.join(OUT_DIR, 'components.json'), JSON.stringify(allApps, null, 2));

  // Write Mermaid diagrams
  fs.writeFileSync(path.join(OUT_DIR, 'l1-system-context.md'), l1SystemContext());
  fs.writeFileSync(path.join(OUT_DIR, 'l2-containers.md'), l2Containers());
  for (const app of allApps) {
    fs.writeFileSync(path.join(OUT_DIR, `l3-${app.name}.md`), l3Component(app));
  }

  console.log(`\nOutput written to docs/c4/:`);
  console.log('  l1-system-context.md');
  console.log('  l2-containers.md');
  for (const app of allApps) console.log(`  l3-${app.name}.md`);
  console.log('  components.json (gitignored)');
}

main();
