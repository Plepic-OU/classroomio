#!/usr/bin/env node
/**
 * C4 Model AST Extractor for ClassroomIO
 *
 * Extracts component structure from apps/dashboard and apps/api using ts-morph.
 * Groups files by directory into components, maps cross-directory imports as relationships.
 * Outputs to docs/c4/ast-output.json
 *
 * Usage:
 *   cd .claude/skills/c4-model && pnpm install
 *   npx tsx .claude/skills/c4-model/extract.ts   (from repo root)
 *   # or: cd .claude/skills/c4-model && npx tsx extract.ts
 *
 * Component depth controls granularity (how many directory levels below src/ = one component).
 * A warning is emitted when any component exceeds 50 files — depth may need increasing.
 */

import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Resolve repo root relative to this script's location
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/c4');

interface AppConfig {
  name: string;
  appRoot: string;
  srcDir: string;
  tsconfigPath: string;
  /** Number of path segments below srcDir that form a component key. */
  componentDepth: number;
}

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    appRoot: path.join(REPO_ROOT, 'apps/dashboard'),
    srcDir: path.join(REPO_ROOT, 'apps/dashboard/src'),
    tsconfigPath: path.join(REPO_ROOT, 'apps/dashboard/tsconfig.json'),
    componentDepth: 3,
  },
  {
    name: 'api',
    appRoot: path.join(REPO_ROOT, 'apps/api'),
    srcDir: path.join(REPO_ROOT, 'apps/api/src'),
    tsconfigPath: path.join(REPO_ROOT, 'apps/api/tsconfig.json'),
    componentDepth: 2,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read compilerOptions.paths from a tsconfig.json without following "extends".
 * Returns a map of alias prefix → absolute directory on disk.
 */
function readTsconfigAliases(
  tsconfigPath: string,
  appRoot: string,
): Record<string, string> {
  const aliases: Record<string, string> = {};
  if (!fs.existsSync(tsconfigPath)) return aliases;

  let raw: string;
  try {
    raw = fs.readFileSync(tsconfigPath, 'utf8');
  } catch {
    return aliases;
  }

  let tsconfig: Record<string, any>;
  try {
    // First attempt: direct JSON parse (works for valid JSON configs)
    tsconfig = JSON.parse(raw);
  } catch {
    // Second attempt: strip JSONC-style comments (tsconfig is technically JSONC)
    const stripped = raw
      // Block comments: /* ... */ (handles multi-line and inline variants)
      .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
      // Line comments: // to end of line
      .replace(/\/\/[^\n]*/g, '')
      // Trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1');
    try {
      tsconfig = JSON.parse(stripped);
    } catch (e) {
      console.warn(`  Could not parse ${tsconfigPath}: ${e}`);
      return aliases;
    }
  }

  const co = tsconfig?.compilerOptions ?? {};
  const paths: Record<string, string[]> = co.paths ?? {};
  const baseUrl: string | undefined = co.baseUrl;
  const resolvedBase = baseUrl ? path.resolve(appRoot, baseUrl) : appRoot;

  for (const [alias, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const cleanAlias = alias.replace(/\/\*$/, '');
    const cleanTarget = (targets[0] as string).replace(/\/\*$/, '');
    aliases[cleanAlias] = path.resolve(resolvedBase, cleanTarget);
  }

  return aliases;
}

/**
 * Resolve a module specifier to an absolute path within this project.
 * Returns null for external packages.
 */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  aliases: Record<string, string>,
): string | null {
  // Longest alias prefix wins
  const sorted = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const alias of sorted) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      const rest = specifier.slice(alias.length);
      return aliases[alias] + rest;
    }
  }

  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), specifier);
  }

  return null; // external package
}

/**
 * Convert a file path to a component key by taking the first `depth` segments
 * of its path relative to srcDir.
 */
function toComponentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  const key = parts.slice(0, depth).join('/');
  return key || parts[0] || '_root';
}

const EXCLUDED_DIRS = new Set(['mocks', '__mocks__', 'node_modules', '.svelte-kit']);

/** Walk srcDir and count .svelte files per component key (excludes mock dirs). */
function countSveltePerComponent(
  srcDir: string,
  depth: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
      } else if (entry.name.endsWith('.svelte')) {
        const key = toComponentKey(full, srcDir, depth);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  walk(srcDir);
  return counts;
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

interface ComponentData {
  tsFileCount: number;
  svelteCount: number;
  /** Up to 5 representative .ts file paths relative to srcDir */
  sampleFiles: string[];
  /** Component keys this component imports from */
  relationships: string[];
}

interface AppResult {
  components: Record<string, ComponentData>;
  /** Alias prefix → path relative to appRoot */
  aliases: Record<string, string>;
  warnings: string[];
}

function extractApp(config: AppConfig): AppResult {
  console.log(`  Reading path aliases...`);
  const aliases = readTsconfigAliases(config.tsconfigPath, config.appRoot);

  // Also try the SvelteKit-generated tsconfig for any extra aliases
  const svelteKitTsconfig = path.join(config.appRoot, '.svelte-kit/tsconfig.json');
  const svelteKitAliases = readTsconfigAliases(svelteKitTsconfig, config.appRoot);
  // Main tsconfig takes priority; fill in extras from svelte-kit
  for (const [k, v] of Object.entries(svelteKitAliases)) {
    if (!(k in aliases)) aliases[k] = v;
  }

  const aliasCount = Object.keys(aliases).length;
  console.log(`  Found ${aliasCount} path alias(es): ${Object.keys(aliases).join(', ')}`);

  console.log(`  Counting .svelte files...`);
  const svelteCounts = countSveltePerComponent(config.srcDir, config.componentDepth);

  console.log(`  Loading TypeScript source files via ts-morph...`);
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  project.addSourceFilesAtPaths([
    path.join(config.srcDir, '**/*.ts'),
    path.join(config.srcDir, '**/*.tsx'),
    `!${path.join(config.srcDir, '**/*.d.ts')}`,
    `!${path.join(config.srcDir, '**/__mocks__/**')}`,
    `!${path.join(config.srcDir, '**/mocks/**')}`,
    `!**/node_modules/**`,
  ]);

  const sourceFiles = project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    return (
      fp.startsWith(config.srcDir) &&
      !fp.includes('.svelte-kit') &&
      !fp.includes('node_modules')
    );
  });

  console.log(`  Processing ${sourceFiles.length} .ts source files...`);

  // component key → { ts files, imported component keys }
  const compMap = new Map<string, { tsFiles: string[]; deps: Set<string> }>();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const compKey = toComponentKey(filePath, config.srcDir, config.componentDepth);

    if (!compMap.has(compKey)) {
      compMap.set(compKey, { tsFiles: [], deps: new Set() });
    }
    const comp = compMap.get(compKey)!;
    comp.tsFiles.push(path.relative(config.srcDir, filePath));

    for (const importDecl of sf.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      const resolved = resolveSpecifier(specifier, filePath, aliases);

      if (resolved && resolved.startsWith(config.srcDir)) {
        const targetKey = toComponentKey(resolved, config.srcDir, config.componentDepth);
        if (targetKey !== compKey) {
          comp.deps.add(targetKey);
        }
      }
    }
  }

  // Also ensure components that only have .svelte files appear in the map
  for (const [key] of svelteCounts) {
    if (!compMap.has(key)) {
      compMap.set(key, { tsFiles: [], deps: new Set() });
    }
  }

  const warnings: string[] = [];
  const components: Record<string, ComponentData> = {};

  for (const [key, data] of compMap) {
    const svelteCount = svelteCounts.get(key) ?? 0;
    const total = data.tsFiles.length + svelteCount;

    if (total > 50) {
      warnings.push(
        `"${key}" has ${total} files (${data.tsFiles.length} .ts + ${svelteCount} .svelte) — consider increasing componentDepth`,
      );
    }

    components[key] = {
      tsFileCount: data.tsFiles.length,
      svelteCount,
      sampleFiles: data.tsFiles.slice(0, 5),
      relationships: Array.from(data.deps).sort(),
    };
  }

  return {
    components,
    aliases: Object.fromEntries(
      Object.entries(aliases).map(([k, v]) => [k, path.relative(config.appRoot, v)]),
    ),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const output: {
    extractedAt: string;
    repoRoot: string;
    apps: Record<string, AppResult>;
  } = {
    extractedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    apps: {},
  };

  for (const appConfig of APPS) {
    console.log(`\nExtracting ${appConfig.name} (componentDepth=${appConfig.componentDepth})...`);
    const result = extractApp(appConfig);
    output.apps[appConfig.name] = result;

    const compCount = Object.keys(result.components).length;
    console.log(`  → ${compCount} components extracted`);

    if (result.warnings.length > 0) {
      console.warn(`\n  ⚠ Depth warnings for ${appConfig.name}:`);
      result.warnings.forEach((w) => console.warn(`    ${w}`));
    }
  }

  const outPath = path.join(OUTPUT_DIR, 'ast-output.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Written: ${path.relative(process.cwd(), outPath)}`);
  console.log(`  Total components: dashboard=${Object.keys(output.apps.dashboard?.components ?? {}).length}, api=${Object.keys(output.apps.api?.components ?? {}).length}`);
}

main();
