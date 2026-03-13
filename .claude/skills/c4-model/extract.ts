#!/usr/bin/env tsx
/**
 * C4 Component Extractor for ClassroomIO
 *
 * Uses ts-morph to parse TS/JS source files and extract component-level
 * structure and cross-component relationships for C4 Layer 3 diagrams.
 *
 * Run from .claude/skills/c4-model/:
 *   node_modules/.bin/tsx extract.ts
 *
 * Output: docs/c4/components.json  (also emitted to stdout)
 */

import ts from 'typescript';
import { Project, ScriptTarget } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathAlias {
  pattern: string; // e.g. "$lib/*"
  resolvedTarget: string; // e.g. "/abs/path/to/src/lib/*"
}

interface AppConfig {
  name: string;
  appDir: string;
  srcRelative: string;
  /** How many directory segments (from srcDir) form a component key.
   *  depth=2 → routes/course, depth=3 → lib/utils/services */
  depth: number;
  tsConfigPath: string;
  /** Glob segments to exclude (relative to srcDir), e.g. "__mocks__" */
  excludeDirs?: string[];
}

interface Component {
  key: string;
  label: string;
  tsFiles: number;
  svelteFiles: number;
}

interface Relationship {
  from: string;
  to: string;
  weight: number;
}

interface AppExtraction {
  name: string;
  components: Component[];
  relationships: Relationship[];
  warnings: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    appDir: path.join(REPO_ROOT, 'apps/dashboard'),
    srcRelative: 'src',
    depth: 3,
    tsConfigPath: 'tsconfig.json',
    // Exclude test mocks and code-snippet mock files (not real components)
    excludeDirs: ['__mocks__', 'lib/mocks'],
  },
  {
    name: 'api',
    appDir: path.join(REPO_ROOT, 'apps/api'),
    srcRelative: 'src',
    depth: 2,
    tsConfigPath: 'tsconfig.json',
  },
];

// ─── Path alias resolution ─────────────────────────────────────────────────────

/**
 * Use TypeScript's own config reader so it handles JSONC (comments) correctly.
 */
function loadAliases(appDir: string, tsConfigPath: string): PathAlias[] {
  const fullPath = path.join(appDir, tsConfigPath);
  if (!fs.existsSync(fullPath)) return [];

  try {
    const { config, error } = ts.readConfigFile(fullPath, ts.sys.readFile);
    if (error) {
      log(`  Warning: tsconfig read error — ${error.messageText}`);
      return [];
    }

    const paths: Record<string, string[]> =
      config?.compilerOptions?.paths ?? {};
    const baseUrl: string = config?.compilerOptions?.baseUrl ?? './';

    return Object.entries(paths).map(([pattern, targets]) => ({
      pattern,
      resolvedTarget: path.resolve(appDir, baseUrl, (targets as string[])[0]),
    }));
  } catch (e) {
    log(`  Warning: failed to load aliases — ${e}`);
    return [];
  }
}

function resolveAlias(
  specifier: string,
  aliases: PathAlias[]
): string | null {
  for (const { pattern, resolvedTarget } of aliases) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (specifier === prefix || specifier.startsWith(prefix + '/')) {
        const rest = specifier.slice(prefix.length).replace(/^\//, '');
        return resolvedTarget.replace('*', rest);
      }
    } else if (specifier === pattern) {
      return resolvedTarget;
    }
  }
  return null;
}

const TS_EXTS = ['.ts', '.js', '.tsx', '.jsx', '.mts', '.mjs'];

function tryResolve(base: string): string | null {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of TS_EXTS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of TS_EXTS) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function resolveImport(
  specifier: string,
  importingFile: string,
  aliases: PathAlias[]
): string | null {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return tryResolve(path.resolve(path.dirname(importingFile), specifier));
  }
  const aliasBase = resolveAlias(specifier, aliases);
  if (aliasBase) return tryResolve(aliasBase);
  return null; // external npm package — skip
}

// ─── Svelte file counting ──────────────────────────────────────────────────────

function countSvelteByDir(srcDir: string): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.svelte')) {
        const rel = path.dirname(path.relative(srcDir, full));
        counts.set(rel, (counts.get(rel) ?? 0) + 1);
      }
    }
  }
  walk(srcDir);
  return counts;
}

// ─── Component key ─────────────────────────────────────────────────────────────

function componentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length <= depth) return parts.slice(0, -1).join('/') || parts[0];
  return parts.slice(0, depth).join('/');
}

function isExcluded(key: string, excludeDirs: string[]): boolean {
  return excludeDirs.some(
    (ex) => key === ex || key.startsWith(ex + '/') || key.startsWith(ex.replace(/\//g, path.sep))
  );
}

// ─── Extraction ────────────────────────────────────────────────────────────────

function extractApp(config: AppConfig): AppExtraction {
  const { name, appDir, srcRelative, depth, tsConfigPath, excludeDirs = [] } = config;
  const srcDir = path.join(appDir, srcRelative);
  const warnings: string[] = [];

  log(`[${name}] Scanning ${srcDir} (depth=${depth})`);

  const aliases = loadAliases(appDir, tsConfigPath);
  log(`[${name}] Loaded ${aliases.length} path aliases: ${aliases.map((a) => a.pattern).join(', ')}`);

  const project = new Project({
    compilerOptions: { allowJs: true, target: ScriptTarget.ESNext },
    skipAddingFilesFromTsConfig: true,
  });

  const excludeGlobs = excludeDirs.flatMap((d) => [
    `!${srcDir}/${d}/**`,
    `!${srcDir}/**/${d}/**`,
  ]);

  project.addSourceFilesAtPaths([
    `${srcDir}/**/*.ts`,
    `${srcDir}/**/*.js`,
    `!${srcDir}/**/*.d.ts`,
    `!${srcDir}/**/*.spec.ts`,
    `!${srcDir}/**/*.spec.js`,
    `!${srcDir}/**/*.test.ts`,
    `!${srcDir}/**/*.test.js`,
    ...excludeGlobs,
  ]);

  const sourceFiles = project.getSourceFiles();
  log(`[${name}] Parsed ${sourceFiles.length} source files`);

  // Build file → component key map (excluding configured dirs)
  const fileToKey = new Map<string, string>();
  const keyToFiles = new Map<string, Set<string>>();

  for (const sf of sourceFiles) {
    const fp = sf.getFilePath() as string;
    if (!fp.startsWith(srcDir)) continue;
    const key = componentKey(fp, srcDir, depth);
    if (isExcluded(key, excludeDirs)) continue;
    fileToKey.set(fp, key);
    if (!keyToFiles.has(key)) keyToFiles.set(key, new Set());
    keyToFiles.get(key)!.add(fp);
  }

  // Validate depth
  for (const [key, files] of keyToFiles) {
    if (files.size > 50) {
      warnings.push(
        `Component '${key}' has ${files.size} files — depth=${depth} may be too shallow`
      );
    }
  }

  // Svelte counts aggregated to component key
  const svelteDirCounts = countSvelteByDir(srcDir);
  const svelteKeyCount = new Map<string, number>();
  for (const [relDir, count] of svelteDirCounts) {
    const fakeFile = path.join(srcDir, relDir, '_placeholder');
    const key = componentKey(fakeFile, srcDir, depth);
    if (!isExcluded(key, excludeDirs)) {
      svelteKeyCount.set(key, (svelteKeyCount.get(key) ?? 0) + count);
    }
  }

  // Extract cross-component import relationships
  const edgeCounts = new Map<string, number>();

  for (const sf of sourceFiles) {
    const fromPath = sf.getFilePath() as string;
    if (!fromPath.startsWith(srcDir)) continue;
    const fromKey = fileToKey.get(fromPath);
    if (!fromKey) continue;

    for (const imp of sf.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      const resolved = resolveImport(specifier, fromPath, aliases);
      if (!resolved || !resolved.startsWith(srcDir)) continue;

      const toKey = fileToKey.get(resolved);
      if (!toKey || toKey === fromKey) continue;

      const edge = `${fromKey}→${toKey}`;
      edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
    }
  }

  // Build output arrays
  const components: Component[] = [...keyToFiles.entries()].map(([key, files]) => {
    const segment = key.split('/').pop()!;
    const label = segment
      .replace(/[-_](\w)/g, (_, c: string) => ' ' + c.toUpperCase())
      .replace(/^\w/, (c: string) => c.toUpperCase());
    return {
      key,
      label,
      tsFiles: files.size,
      svelteFiles: svelteKeyCount.get(key) ?? 0,
    };
  });
  components.sort((a, b) => a.key.localeCompare(b.key));

  const relationships: Relationship[] = [...edgeCounts.entries()].map(([edge, weight]) => {
    const [from, to] = edge.split('→');
    return { from, to, weight };
  });
  relationships.sort((a, b) => b.weight - a.weight);

  log(`[${name}] ${components.length} components, ${relationships.length} relationships`);
  for (const w of warnings) log(`⚠  ${w}`);

  return { name, components, relationships, warnings };
}

// ─── Entry point ───────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stderr.write(msg + '\n');
}

const results: Record<string, AppExtraction> = {};
for (const app of APPS) {
  results[app.name] = extractApp(app);
}

const outDir = path.join(REPO_ROOT, 'docs/c4');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'components.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
log(`\nWritten: ${outPath}`);

process.stdout.write(JSON.stringify(results, null, 2) + '\n');
