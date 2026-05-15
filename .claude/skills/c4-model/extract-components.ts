#!/usr/bin/env node
/**
 * extract-components.ts — AST-based C4 Layer 3 component extractor
 *
 * Parses TS/JS source files with ts-morph, groups files by directory depth
 * into "components", resolves path aliases from tsconfig.json, and maps
 * cross-component imports as relationships. Counts .svelte files per component
 * as metadata without attempting to parse them.
 *
 * Usage (from workspace root):
 *   npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/extract-components.ts
 *   npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/extract-components.ts --app=dashboard --depth=4
 *   npx --prefix .claude/skills/c4-model tsx .claude/skills/c4-model/extract-components.ts --app=api --depth=2
 *
 * Output: docs/c4/components-{app}.json  (gitignored intermediates)
 */

import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Always run from workspace root per SKILL.md
const WORKSPACE_ROOT = process.cwd();

type AppName = 'dashboard' | 'api';

interface AppConfig {
  root: string;
  srcDir: string;
  defaultDepth: number;
  packageName: string;
}

const APP_CONFIGS: Record<AppName, AppConfig> = {
  dashboard: {
    root: path.join(WORKSPACE_ROOT, 'apps/dashboard'),
    srcDir: path.join(WORKSPACE_ROOT, 'apps/dashboard/src'),
    defaultDepth: 3,
    packageName: '@cio/dashboard',
  },
  api: {
    root: path.join(WORKSPACE_ROOT, 'apps/api'),
    srcDir: path.join(WORKSPACE_ROOT, 'apps/api/src'),
    defaultDepth: 2,
    packageName: '@cio/api',
  },
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
  app: AppName;
  packageName: string;
  depth: number;
  components: ComponentData[];
  timestamp: string;
  warnings: string[];
}

/** Read path aliases by scanning tsconfig.json files in the app root. */
function readPathAliases(appRoot: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const candidates = [
    path.join(appRoot, 'tsconfig.json'),
    path.join(appRoot, '.svelte-kit', 'tsconfig.json'),
  ];

  for (const tsconfigPath of candidates) {
    if (!fs.existsSync(tsconfigPath)) continue;
    try {
      const raw = fs.readFileSync(tsconfigPath, 'utf-8');
      // Try plain JSON.parse first; only strip `//` line-comments as a fallback.
      // Do NOT strip block comments with a regex — it incorrectly eats content
      // inside JSON strings that contain glob patterns like `src/**/*`.
      let tsconfig: Record<string, unknown>;
      try {
        tsconfig = JSON.parse(raw);
      } catch {
        // Strip only `//`-prefixed lines (safe — tsconfig comment style)
        const stripped = raw.replace(/^\s*\/\/[^\n]*/gm, '');
        tsconfig = JSON.parse(stripped);
      }
      const opts = (tsconfig as Record<string, Record<string, unknown>>).compilerOptions ?? {};
      const compilerPaths: Record<string, string[]> = (opts.paths as Record<string, string[]>) ?? {};
      const baseUrl: string = (opts.baseUrl as string) ?? '.';
      const resolvedBase = path.resolve(path.dirname(tsconfigPath), baseUrl);

      for (const [aliasPattern, targets] of Object.entries(compilerPaths)) {
        if (!Array.isArray(targets) || targets.length === 0) continue;
        // Strip trailing /* — we match prefix, not glob
        const aliasKey = aliasPattern.replace(/\/\*$/, '');
        const targetRel = (targets[0] as string).replace(/\/\*$/, '');
        aliases[aliasKey] = path.resolve(resolvedBase, targetRel);
      }
    } catch {
      // Silently skip unreadable / invalid tsconfigs
    }
  }

  return aliases;
}

/**
 * Resolve an import specifier to an absolute file-system path, or null if it
 * lives outside srcDir (e.g. node_modules).
 */
function resolveImport(
  importSpec: string,
  fromFile: string,
  aliases: Record<string, string>,
  srcDir: string,
): string | null {
  // Skip bare npm package imports that don't match any alias
  const isRelative = importSpec.startsWith('./') || importSpec.startsWith('../');
  const matchesAlias = Object.keys(aliases).some(
    (a) => importSpec === a || importSpec.startsWith(a + '/'),
  );
  if (!isRelative && !matchesAlias) return null;

  let resolved: string | null = null;

  // Alias match — prefer longest alias to avoid partial collision
  if (matchesAlias) {
    const sorted = Object.keys(aliases).sort((a, b) => b.length - a.length);
    for (const alias of sorted) {
      if (importSpec === alias || importSpec.startsWith(alias + '/')) {
        const remainder = importSpec.slice(alias.length);
        resolved = path.join(aliases[alias], remainder);
        break;
      }
    }
  }

  // Relative import
  if (!resolved && isRelative) {
    resolved = path.resolve(path.dirname(fromFile), importSpec);
  }

  if (!resolved) return null;

  // Must be within srcDir (don't map external workspace packages)
  if (resolved !== srcDir && !resolved.startsWith(srcDir + path.sep)) return null;

  return resolved;
}

/**
 * Derive a component key (e.g. "lib/utils/services") from a file path.
 *
 * For actual files (have an extension): drop the filename, take `depth` dir parts.
 * For resolved import paths (no extension): treat the last segment as "filename-like"
 * and take `depth` parts of what remains.
 */
function getComponentKey(filePath: string, srcDir: string, depth: number): string {
  const relative = path.relative(srcDir, filePath);
  const parts = relative.split(path.sep);
  const lastPart = parts[parts.length - 1];
  const lastHasExt = path.extname(lastPart) !== '';
  const dirParts = lastHasExt ? parts.slice(0, -1) : parts;
  const keyParts = dirParts.slice(0, depth);
  return keyParts.length > 0 ? keyParts.join('/') : '__root__';
}

/** Human-readable label from a component key. Handles SvelteKit [dynamic] segments. */
function keyToLabel(key: string): string {
  if (key === '__root__') return 'Root';
  const parts = key.split('/');
  const staticParts = parts.filter((p) => !p.startsWith('['));
  const isDynamic = staticParts.length < parts.length;
  const lastName = staticParts[staticParts.length - 1] ?? parts[parts.length - 1];
  const base = lastName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return isDynamic ? `${base} (Detail)` : base;
}

/** Short description table — fills gaps with a sensible fallback. */
const DESCRIPTIONS: Record<string, string> = {
  // Dashboard routes
  'routes': 'SvelteKit route handlers',
  'routes/auth': 'Login, signup, password reset, email verify',
  'routes/courses': 'Course list and overview (teacher)',
  'routes/courses/[id]': 'Course editor hub (teacher)',
  'routes/courses/[id]/lessons': 'Lesson editor',
  'routes/courses/[id]/analytics': 'Course analytics view',
  'routes/courses/[id]/attendance': 'Attendance tracking',
  'routes/courses/[id]/certificates': 'Certificate management',
  'routes/courses/[id]/marks': 'Grades and marks',
  'routes/courses/[id]/people': 'Student roster',
  'routes/courses/[id]/settings': 'Course settings',
  'routes/courses/[id]/submissions': 'Exercise submissions',
  'routes/lms': 'Student-facing LMS root',
  'routes/lms/mylearning': 'My learning page',
  'routes/lms/explore': 'Course discovery',
  'routes/lms/exercises': 'Exercise list (student)',
  'routes/lms/community': 'Community (student)',
  'routes/lms/settings': 'LMS settings (student)',
  'routes/org': 'Organization root',
  'routes/org/[slug]': 'Organization management (admin)',
  'routes/api': 'SvelteKit server-side API endpoints',
  'routes/api/courses': 'Course API endpoints',
  'routes/api/org': 'Org API endpoints',
  'routes/api/completion': 'AI completion endpoints',
  'routes/api/email': 'Email dispatch endpoints',
  'routes/api/analytics': 'Analytics endpoints',
  'routes/api/polar': 'Polar payment endpoints',
  'routes/api/unsplash': 'Unsplash image proxy',
  'routes/api/admin': 'Admin endpoints',
  'routes/profile': 'User profile pages',
  'routes/onboarding': 'Onboarding wizard',
  'routes/invite': 'Invitation flow',
  'routes/course': 'Public course view (unauthenticated)',
  // Dashboard lib
  'lib/components': 'Shared UI component library',
  'lib/components/Course': 'Course management UI components',
  'lib/components/Org': 'Organization management UI',
  'lib/components/LMS': 'Student-facing LMS components',
  'lib/components/Navigation': 'Top and side navigation bars',
  'lib/components/AuthUI': 'Authentication UI widgets',
  'lib/components/Apps': 'Feature apps (Notes, Poll, Q&A)',
  'lib/components/TextEditor': 'Rich text editor wrapper',
  'lib/components/Analytics': 'Analytics charts',
  'lib/components/Courses': 'Course cards and lists',
  'lib/utils/services': 'Business logic services (Supabase wrappers)',
  'lib/utils/store': 'Svelte stores for global state',
  'lib/utils/functions': 'Pure utility functions',
  'lib/utils/types': 'TypeScript type definitions',
  'lib/utils/translations': 'i18n translation strings',
  'lib/utils/constants': 'Application constants',
  // API
  'routes/course': 'Course CRUD, lesson, clone, presign routes',
  'services': 'Business logic services',
  'services/course': 'Course cloning service',
  'middlewares': 'Auth and rate-limiting middleware',
  'utils': 'Utility modules',
  'utils/auth': 'User JWT validation',
  'utils/redis': 'Redis client and rate limiter',
  'utils/openapi': 'OpenAPI schema generation',
  'config': 'Environment configuration',
  'constants': 'Application constants',
  'types': 'TypeScript type definitions',
  'types/course': 'Course-related types',
};

function describeComponent(key: string): string {
  return DESCRIPTIONS[key] ?? `${key.split('/').pop()} module`;
}

const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', 'build', '.git', '.turbo']);

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

async function extractApp(appName: AppName, depthOverride?: number): Promise<ExtractResult> {
  const config = APP_CONFIGS[appName];
  const depth = depthOverride ?? config.defaultDepth;
  const { srcDir, root } = config;
  const warnings: string[] = [];

  process.stderr.write(`\n[${appName}] depth=${depth}, srcDir=${path.relative(WORKSPACE_ROOT, srcDir)}\n`);

  const aliases = readPathAliases(root);
  const aliasReport = Object.entries(aliases)
    .map(([k, v]) => `${k} → ${path.relative(root, v)}`)
    .join(', ');
  process.stderr.write(`[${appName}] aliases: ${aliasReport || '(none)'}\n`);

  const allFiles = findFiles(srcDir, ['.ts', '.js', '.tsx', '.jsx', '.svelte']);
  const tsFiles = allFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith('.d.ts'));
  const svelteFiles = allFiles.filter((f) => f.endsWith('.svelte'));

  process.stderr.write(`[${appName}] TS/JS: ${tsFiles.length}, Svelte: ${svelteFiles.length}\n`);

  // Count svelte files per component key (metadata only — not parsed)
  const svelteByComp = new Map<string, number>();
  for (const sf of svelteFiles) {
    const key = getComponentKey(sf, srcDir, depth);
    svelteByComp.set(key, (svelteByComp.get(key) ?? 0) + 1);
  }

  // ts-morph project — we don't load tsconfig to avoid issues with SvelteKit's
  // generated .svelte-kit/tsconfig.json and other extends chains; aliases are
  // handled by our own readPathAliases() instead.
  const project = new Project({
    compilerOptions: { allowJs: true, skipLibCheck: true },
    skipFileDependencyResolution: true,
    skipAddingFilesFromTsConfig: true,
  });

  for (const f of tsFiles) {
    try {
      project.addSourceFileAtPath(f);
    } catch {
      warnings.push(`parse-error: ${path.relative(root, f)}`);
    }
  }

  type CompEntry = { tsFileSet: Set<string>; importedKeys: Set<string> };
  const compMap = new Map<string, CompEntry>();
  const getOrCreate = (key: string): CompEntry => {
    if (!compMap.has(key)) compMap.set(key, { tsFileSet: new Set(), importedKeys: new Set() });
    return compMap.get(key)!;
  };

  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    const myKey = getComponentKey(filePath, srcDir, depth);
    getOrCreate(myKey).tsFileSet.add(path.relative(srcDir, filePath));

    for (const importDecl of sf.getImportDeclarations()) {
      const spec = importDecl.getModuleSpecifierValue();
      const resolved = resolveImport(spec, filePath, aliases, srcDir);
      if (!resolved) continue;
      const importedKey = getComponentKey(resolved, srcDir, depth);
      if (importedKey !== myKey) {
        getOrCreate(myKey).importedKeys.add(importedKey);
      }
    }

    // Also pick up re-export specifiers
    for (const exportDecl of sf.getExportDeclarations()) {
      const spec = exportDecl.getModuleSpecifier()?.getLiteralValue();
      if (!spec) continue;
      const resolved = resolveImport(spec, filePath, aliases, srcDir);
      if (!resolved) continue;
      const importedKey = getComponentKey(resolved, srcDir, depth);
      if (importedKey !== myKey) {
        getOrCreate(myKey).importedKeys.add(importedKey);
      }
    }
  }

  // Register svelte-only components so they appear in the output
  for (const [key] of svelteByComp) getOrCreate(key);

  // Build final output
  const components: ComponentData[] = [];
  for (const [key, entry] of compMap) {
    if (key === '__root__') continue; // skip files at src/ root that don't form a component

    const svelteCount = svelteByComp.get(key) ?? 0;
    const tsCount = entry.tsFileSet.size;
    const total = tsCount + svelteCount;

    if (total > 50) {
      warnings.push(`"${key}" has ${total} files — depth=${depth} may be too shallow, try --depth=${depth + 1}`);
    }

    // Only keep import edges that point to known components (filter dangling refs)
    const imports = [...entry.importedKeys]
      .filter((k) => k !== '__root__' && compMap.has(k))
      .sort();

    components.push({
      key,
      label: keyToLabel(key),
      description: describeComponent(key),
      tsFiles: tsCount,
      svelteFiles: svelteCount,
      totalFiles: total,
      representativeFiles: [...entry.tsFileSet].sort().slice(0, 5),
      imports,
    });
  }

  components.sort((a, b) => a.key.localeCompare(b.key));

  return { app: appName, packageName: config.packageName, depth, components, timestamp: new Date().toISOString(), warnings };
}

async function main() {
  const args = process.argv.slice(2);
  const appArg = args.find((a) => a.startsWith('--app='))?.slice(6) as AppName | undefined;
  const depthStr = args.find((a) => a.startsWith('--depth='))?.slice(8);
  const depthOverride = depthStr ? parseInt(depthStr, 10) : undefined;

  const apps: AppName[] = appArg ? [appArg] : ['dashboard', 'api'];

  const outputDir = path.join(WORKSPACE_ROOT, 'docs/c4');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const appName of apps) {
    const result = await extractApp(appName, depthOverride);
    const outPath = path.join(outputDir, `components-${appName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
    process.stdout.write(`\n✓ docs/c4/components-${appName}.json  (${result.components.length} components)\n`);
    for (const w of result.warnings) process.stdout.write(`  ⚠  ${w}\n`);
  }
}

main().catch((e) => {
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
