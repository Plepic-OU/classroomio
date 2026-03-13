#!/usr/bin/env tsx
/**
 * C4 Component Extractor for ClassroomIO
 *
 * Extracts component structure and relationships from TypeScript/JavaScript source
 * files using ts-morph. Handles path aliases, .svelte file counting, and configurable
 * per-app component grouping depth.
 *
 * Usage:
 *   cd .claude/skills/c4-model && pnpm install
 *   npx tsx .claude/skills/c4-model/extract.ts
 *   npx tsx .claude/skills/c4-model/extract.ts --dashboard-depth=4 --api-depth=3
 *
 * Output: .claude/skills/c4-model/output/components.json
 */

import { Project, ts } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(__dirname, 'output');

interface AppConfig {
  root: string;
  srcDir: string;
  depth: number;
  tsconfig: string;
}

function parseArgs(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(\d+)$/);
    if (m) result[m[1]] = parseInt(m[2], 10);
  }
  return result;
}

const args = parseArgs();

const APP_CONFIGS: Record<string, AppConfig> = {
  dashboard: {
    root: path.join(REPO_ROOT, 'apps/dashboard'),
    srcDir: 'src',
    depth: args['dashboard-depth'] ?? 3,
    tsconfig: 'tsconfig.json',
  },
  api: {
    root: path.join(REPO_ROOT, 'apps/api'),
    srcDir: 'src',
    depth: args['api-depth'] ?? 2,
    tsconfig: 'tsconfig.json',
  },
};

// ---------------------------------------------------------------------------
// Types
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
// Path alias resolution
// ---------------------------------------------------------------------------

/**
 * Reads a tsconfig.json (JSONC, may have comments and "extends") and returns
 * resolved absolute path aliases using TypeScript's own config parser.
 * TypeScript is bundled with ts-morph, so no extra dep is needed.
 */
function readPathAliases(tsconfigPath: string): Record<string, string[]> {
  if (!fs.existsSync(tsconfigPath)) return {};

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) return {};

  // parseJsonConfigFileContent resolves "extends" and normalises all paths
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );

  // baseUrl may be undefined; paths are relative to baseUrl, which itself
  // defaults to the tsconfig directory when unset.
  const baseDir = parsed.options.baseUrl ?? path.dirname(tsconfigPath);
  const aliases: Record<string, string[]> = {};
  if (parsed.options.paths) {
    for (const [pattern, targets] of Object.entries(parsed.options.paths)) {
      aliases[pattern] = (targets as string[]).map((t) =>
        path.isAbsolute(t) ? t : path.resolve(baseDir, t)
      );
    }
  }
  return aliases;
}

// ---------------------------------------------------------------------------
// Component key
// ---------------------------------------------------------------------------

/**
 * Returns the component key for an absolute file path.
 * Key = first `depth` path segments relative to appRoot.
 * e.g. appRoot=/app, depth=3, file=/app/src/lib/components/Course/index.ts -> "src/lib/components"
 */
function getComponentKey(
  absolutePath: string,
  appRoot: string,
  depth: number
): string {
  const rel = path.relative(appRoot, absolutePath).replace(/\\/g, '/');
  return rel.split('/').slice(0, depth).join('/');
}

// ---------------------------------------------------------------------------
// Module specifier resolver
// ---------------------------------------------------------------------------

/**
 * Resolves an import specifier to an absolute path within appRoot.
 * Returns null for external packages or paths outside appRoot.
 */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  appRoot: string,
  aliases: Record<string, string[]>
): string | null {
  // Relative imports
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(fromFile), specifier);
    return resolved.startsWith(appRoot) ? resolved : null;
  }

  // Absolute but not aliased (e.g. /some/path)
  if (specifier.startsWith('/')) {
    return specifier.startsWith(appRoot) ? specifier : null;
  }

  // Try path aliases (e.g. $lib/utils, $src/routes)
  for (const [pattern, targets] of Object.entries(aliases)) {
    const prefix = pattern.replace(/\/?\*$/, '');
    if (specifier === prefix || specifier.startsWith(prefix + '/')) {
      const suffix = specifier.slice(prefix.length).replace(/^\//, '');
      const targetBase = targets[0].replace(/\/?\*$/, '');
      const resolved = suffix ? path.join(targetBase, suffix) : targetBase;
      if (resolved.startsWith(appRoot)) return resolved;
      return null; // alias resolves outside appRoot (e.g. virtual modules)
    }
  }

  // External npm package
  return null;
}

/**
 * Extracts the package name from an import specifier (for external dep counting).
 */
function packageName(specifier: string): string {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

// ---------------------------------------------------------------------------
// File system walker (counts ts/js/svelte files per component key)
// ---------------------------------------------------------------------------

interface FileCounts {
  ts: number;
  js: number;
  svelte: number;
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.svelte-kit',
  'dist',
  '.git',
  '__mocks__',
  '.turbo',
]);

function walkDir(
  dir: string,
  appRoot: string,
  depth: number,
  counts: Map<string, FileCounts>
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(full, appRoot, depth, counts);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!['.ts', '.js', '.svelte'].includes(ext)) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      if (/\.(test|spec)\.[tj]s$/.test(entry.name)) continue;

      const key = getComponentKey(full, appRoot, depth);
      if (!counts.has(key)) counts.set(key, { ts: 0, js: 0, svelte: 0 });
      const c = counts.get(key)!;
      if (ext === '.ts') c.ts++;
      else if (ext === '.js') c.js++;
      else if (ext === '.svelte') c.svelte++;
    }
  }
}

// ---------------------------------------------------------------------------
// Human-readable descriptions
// ---------------------------------------------------------------------------

const DESCRIPTIONS: Record<string, string> = {
  components: 'UI Components',
  routes: 'Page Routes',
  services: 'Data Services',
  store: 'State Management',
  utils: 'Utility Functions',
  constants: 'Constants & Config',
  types: 'TypeScript Types',
  middlewares: 'Middleware',
  config: 'Configuration',
  api: 'API Client',
  lib: 'Shared Library',
  mail: 'Email Templates',
  mocks: 'Test Mocks',
  lms: 'Student LMS',
  org: 'Org Admin',
  course: 'Course Management',
  courses: 'Courses',
  auth: 'Authentication',
  functions: 'Helper Functions',
  translations: 'i18n Translations',
  newsfeed: 'Newsfeed',
  marks: 'Grades & Marks',
  attendance: 'Attendance',
  submissions: 'Submissions',
  notification: 'Notifications',
  redis: 'Redis Client',
  openapi: 'OpenAPI Spec',
  dashboard: 'Dashboard',
  home: 'Home',
  login: 'Login',
  signup: 'Sign Up',
  onboarding: 'Onboarding',
  profile: 'Profile',
  upgrade: 'Upgrade / Billing',
  invite: 'Invitations',
};

function inferDescription(key: string): string {
  const last = key.split('/').pop() ?? key;
  return DESCRIPTIONS[last] ?? last;
}

// ---------------------------------------------------------------------------
// Main extraction per app
// ---------------------------------------------------------------------------

function extractApp(appName: string, config: AppConfig): AppOutput {
  const warnings: string[] = [];
  const tsconfigPath = path.join(config.root, config.tsconfig);
  const srcRoot = path.join(config.root, config.srcDir);

  // 1. Resolve path aliases
  const aliases = readPathAliases(tsconfigPath);
  console.log(
    `  Aliases: ${Object.keys(aliases).length > 0 ? Object.keys(aliases).join(', ') : 'none'}`
  );

  // 2. Walk filesystem for file counts (includes .svelte)
  const fileCounts = new Map<string, FileCounts>();
  walkDir(srcRoot, config.root, config.depth, fileCounts);
  console.log(`  Component dirs found: ${fileCounts.size}`);

  // 3. Validate depth — warn if any component exceeds 50 files
  for (const [key, counts] of fileCounts) {
    const total = counts.ts + counts.js + counts.svelte;
    if (total > 50) {
      warnings.push(
        `"${key}" has ${total} files (ts:${counts.ts} svelte:${counts.svelte}) — consider --${appName}-depth=${config.depth + 1}`
      );
    }
  }

  // 4. Set up ts-morph project
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      skipLibCheck: true,
      noEmit: true,
      paths: Object.fromEntries(
        Object.entries(aliases).map(([k, v]) => [k, v])
      ),
      baseUrl: config.root,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const toGlob = (p: string) => p.replace(/\\/g, '/');
  project.addSourceFilesAtPaths([
    toGlob(path.join(srcRoot, '**/*.ts')),
    toGlob(path.join(srcRoot, '**/*.js')),
    '!' + toGlob(path.join(config.root, '**/*.d.ts')),
    '!' + toGlob(path.join(config.root, '**/*.test.*')),
    '!' + toGlob(path.join(config.root, '**/*.spec.*')),
    '!' + toGlob(path.join(config.root, '**/__mocks__/**')),
    '!' + toGlob(path.join(config.root, '**/.svelte-kit/**')),
    '!' + toGlob(path.join(config.root, '**/node_modules/**')),
    '!' + toGlob(path.join(config.root, '**/dist/**')),
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`  Parsed ${sourceFiles.length} TS/JS source files`);

  // 5. Extract relationships
  const relMap = new Map<string, number>(); // "from->to" => import count
  const extDeps = new Map<string, number>(); // package => import count

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (!filePath.startsWith(config.root)) continue;

    const fromKey = getComponentKey(filePath, config.root, config.depth);

    for (const imp of sf.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      const resolved = resolveSpecifier(specifier, filePath, config.root, aliases);

      if (resolved === null) {
        // External / virtual — count as external dep
        if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
          const pkg = packageName(specifier);
          extDeps.set(pkg, (extDeps.get(pkg) ?? 0) + 1);
        }
        continue;
      }

      const toKey = getComponentKey(resolved, config.root, config.depth);
      if (fromKey === toKey) continue; // self-reference

      const relKey = `${fromKey}|||${toKey}`;
      relMap.set(relKey, (relMap.get(relKey) ?? 0) + 1);
    }
  }

  // 6. Build output
  const srcPrefix = config.srcDir + '/';
  const components: ComponentInfo[] = Array.from(fileCounts.entries())
    .filter(([key]) => key.startsWith(srcPrefix) || key === config.srcDir)
    .map(([key, counts]) => ({
      key,
      label: key.split('/').slice(1).join('/') || key,
      tsFiles: counts.ts + counts.js,
      svelteFiles: counts.svelte,
      description: inferDescription(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const relationships: Relationship[] = Array.from(relMap.entries())
    .map(([rel, weight]) => {
      const [from, to] = rel.split('|||');
      return { from, to, weight };
    })
    .sort((a, b) => b.weight - a.weight);

  const externalDeps = Object.fromEntries(
    Array.from(extDeps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  );

  return { name: appName, depth: config.depth, components, relationships, externalDeps, warnings };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log('C4 Component Extractor\n');

  const output: ExtractOutput = {
    generatedAt: new Date().toISOString(),
    apps: {},
  };

  for (const [appName, config] of Object.entries(APP_CONFIGS)) {
    console.log(`Extracting: ${appName} (depth=${config.depth})`);
    try {
      output.apps[appName] = extractApp(appName, config);
      const app = output.apps[appName];
      console.log(`  Components : ${app.components.length}`);
      console.log(`  Relationships: ${app.relationships.length}`);
      if (app.warnings.length > 0) {
        console.warn('  Warnings:');
        app.warnings.forEach((w) => console.warn(`    ! ${w}`));
      }
    } catch (err) {
      console.error(`  Error: ${err}`);
      output.apps[appName] = {
        name: appName,
        depth: config.depth,
        components: [],
        relationships: [],
        externalDeps: {},
        warnings: [`Extraction failed: ${err}`],
      };
    }
    console.log('');
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, 'components.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${path.relative(REPO_ROOT, outPath)}`);
}

main().catch(console.error);
