#!/usr/bin/env tsx
/**
 * C4 Model — Component Extractor for ClassroomIO
 *
 * Uses ts-morph to statically analyse apps/dashboard and apps/api.
 * Aggregates .ts/.js files by directory depth into "components", maps
 * cross-component imports as relationships, and outputs structured JSON.
 *
 * Usage (from repo root):
 *   cd .claude/skills/c4-model && npm install
 *   node_modules/.bin/tsx extract.ts
 *   # or, with tsx on PATH:
 *   tsx .claude/skills/c4-model/extract.ts
 *
 * Options:
 *   --app <dashboard|api>   Process only one app (default: both)
 *   --depth <n>             Override component depth for all apps
 */

import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppConfig {
  name: string;
  srcDir: string;
  /** Primary tsconfig (may extend SvelteKit-generated one) */
  tsConfigPath: string;
  /** Optional SvelteKit-generated tsconfig — loaded first so primary can override */
  svelteKitTsConfigPath?: string;
  /** How many path segments (below srcDir) form a component key */
  componentDepth: number;
}

interface ComponentInfo {
  key: string;
  label: string;
  tsFileCount: number;
  svelteFileCount: number;
  /** All .ts/.js files relative to srcDir */
  files: string[];
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppExtraction {
  name: string;
  componentDepth: number;
  components: Record<string, ComponentInfo>;
  relationships: Relationship[];
  warnings: string[];
}

interface ExtractionOutput {
  generatedAt: string;
  apps: Record<string, AppExtraction>;
}

// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------

const APP_CONFIGS: AppConfig[] = [
  {
    name: 'dashboard',
    srcDir: path.join(REPO_ROOT, 'apps/dashboard/src'),
    tsConfigPath: path.join(REPO_ROOT, 'apps/dashboard/tsconfig.json'),
    svelteKitTsConfigPath: path.join(REPO_ROOT, 'apps/dashboard/.svelte-kit/tsconfig.json'),
    // depth=3 → e.g. "lib/components/Course", "lib/utils/services", "routes/courses"
    componentDepth: 3,
  },
  {
    name: 'api',
    srcDir: path.join(REPO_ROOT, 'apps/api/src'),
    tsConfigPath: path.join(REPO_ROOT, 'apps/api/tsconfig.json'),
    // depth=2 → e.g. "routes/course", "utils", "services/course", "middlewares"
    componentDepth: 2,
  },
];

// ---------------------------------------------------------------------------
// JSONC parser (tsconfig files use JSON with comments + trailing commas)
// ---------------------------------------------------------------------------

function parseJsonc(content: string): any {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < content.length) {
    if (inString) {
      if (content[i] === '\\') {
        result += content[i] + (content[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (content[i] === '"') inString = false;
      result += content[i++];
    } else {
      if (content[i] === '"') {
        inString = true;
        result += content[i++];
      } else if (content[i] === '/' && content[i + 1] === '/') {
        while (i < content.length && content[i] !== '\n') i++;
      } else if (content[i] === '/' && content[i + 1] === '*') {
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
        i += 2;
      } else {
        result += content[i++];
      }
    }
  }

  return JSON.parse(result.replace(/,(\s*[}\]])/g, '$1'));
}

// ---------------------------------------------------------------------------
// File discovery (recursive, skips node_modules and hidden dirs)
// ---------------------------------------------------------------------------

function findFiles(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        extensions.includes(path.extname(entry.name)) &&
        !entry.name.endsWith('.d.ts')
      ) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Path alias loading (handles "extends" chains in tsconfig)
// ---------------------------------------------------------------------------

function loadAliases(tsconfigPath: string, visited = new Set<string>()): Record<string, string[]> {
  if (!fs.existsSync(tsconfigPath) || visited.has(tsconfigPath)) return {};
  visited.add(tsconfigPath);

  let raw: any;
  try {
    raw = parseJsonc(fs.readFileSync(tsconfigPath, 'utf-8'));
  } catch {
    return {};
  }

  const configDir = path.dirname(tsconfigPath);
  let aliases: Record<string, string[]> = {};

  if (raw.extends) {
    const extPath = path.resolve(configDir, raw.extends);
    aliases = { ...loadAliases(extPath, visited) };
  }

  if (raw.compilerOptions?.paths) {
    for (const [pattern, targets] of Object.entries(
      raw.compilerOptions.paths as Record<string, string[]>,
    )) {
      aliases[pattern] = targets.map((t: string) => path.resolve(configDir, t));
    }
  }

  return aliases;
}

// ---------------------------------------------------------------------------
// Import specifier → absolute file path resolution
// ---------------------------------------------------------------------------

const RESOLVE_EXTENSIONS = ['.ts', '.js', '/index.ts', '/index.js'];

/** Try to resolve `base` to an existing file inside srcDir. */
function tryResolve(base: string, srcDir: string): string | null {
  // Already has a known extension
  if (RESOLVE_EXTENSIONS.some((e) => base.endsWith(e)) && fs.existsSync(base)) {
    return base.startsWith(srcDir) ? base : null;
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) {
      return candidate.startsWith(srcDir) ? candidate : null;
    }
  }
  return null;
}

/**
 * Resolve an import specifier to an absolute path within srcDir.
 * Returns null for external packages, SvelteKit virtual modules, or unresolvable paths.
 */
function resolveSpecifier(
  specifier: string,
  aliases: Record<string, string[]>,
  importerDir: string,
  srcDir: string,
): string | null {
  // SvelteKit virtual modules — not resolvable statically
  if (
    specifier.startsWith('$app/') ||
    specifier.startsWith('$env/') ||
    specifier.startsWith('$service-worker')
  ) {
    return null;
  }

  // External package — skip
  if (!specifier.startsWith('.') && !Object.keys(aliases).some((a) => specifier.startsWith(a.replace('/*', '')))) {
    return null;
  }

  // Relative import
  if (specifier.startsWith('.')) {
    return tryResolve(path.resolve(importerDir, specifier), srcDir);
  }

  // Alias import — find longest matching prefix
  let bestMatch: { prefix: string; isWildcard: boolean; targets: string[] } | null = null;
  for (const [pattern, targets] of Object.entries(aliases)) {
    const isWildcard = pattern.endsWith('/*');
    const prefix = isWildcard ? pattern.slice(0, -2) : pattern;
    if (specifier === prefix || (isWildcard && specifier.startsWith(prefix + '/'))) {
      if (!bestMatch || prefix.length > bestMatch.prefix.length) {
        bestMatch = { prefix, isWildcard, targets };
      }
    }
  }

  if (!bestMatch) return null;

  const { prefix, isWildcard, targets } = bestMatch;
  const suffix = isWildcard ? specifier.slice(prefix.length + 1) : '';

  for (const target of targets) {
    const base = isWildcard ? path.join(target.replace('*', suffix)) : target;
    const resolved = tryResolve(base, srcDir);
    if (resolved) return resolved;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component key: first `depth` segments of path relative to srcDir (no filename)
// ---------------------------------------------------------------------------

function getComponentKey(filePath: string, srcDir: string, depth: number): string {
  const parts = path.relative(srcDir, filePath).split(path.sep).filter(Boolean);
  const keyParts = parts.slice(0, Math.min(depth, parts.length - 1));
  return keyParts.length > 0 ? keyParts.join('/') : '_root';
}

// ---------------------------------------------------------------------------
// Per-app extraction
// ---------------------------------------------------------------------------

function extractApp(config: AppConfig, depthOverride?: number): AppExtraction {
  const depth = depthOverride ?? config.componentDepth;
  const warnings: string[] = [];

  // Merge aliases: SvelteKit-generated tsconfig first, then primary tsconfig
  let aliases: Record<string, string[]> = {};
  if (config.svelteKitTsConfigPath) {
    aliases = { ...aliases, ...loadAliases(config.svelteKitTsConfigPath) };
  }
  aliases = { ...aliases, ...loadAliases(config.tsConfigPath) };

  const tsFiles = findFiles(config.srcDir, ['.ts', '.js']);
  const svelteFiles = findFiles(config.srcDir, ['.svelte']);

  // Pre-compute svelte file count per component key
  const svelteCountByKey: Record<string, number> = {};
  for (const f of svelteFiles) {
    const key = getComponentKey(f, config.srcDir, depth);
    svelteCountByKey[key] = (svelteCountByKey[key] ?? 0) + 1;
  }

  // ts-morph project — no tsconfig needed since we resolve imports ourselves
  const project = new Project({
    compilerOptions: { allowJs: true, skipLibCheck: true, noEmit: true },
    addFilesFromTsConfig: false,
    skipFileDependencyResolution: true,
  });
  project.addSourceFilesAtPaths(tsFiles);

  const components: Record<string, ComponentInfo> = {};
  const relMap = new Map<string, Relationship>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath() as string;
    const key = getComponentKey(filePath, config.srcDir, depth);

    if (!components[key]) {
      components[key] = {
        key,
        label: key.split('/').pop() ?? key,
        tsFileCount: 0,
        svelteFileCount: svelteCountByKey[key] ?? 0,
        files: [],
      };
    }
    components[key].tsFileCount++;
    components[key].files.push(path.relative(config.srcDir, filePath));

    // Map imports to cross-component relationships
    const importerDir = path.dirname(filePath);
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      const resolved = resolveSpecifier(specifier, aliases, importerDir, config.srcDir);
      if (!resolved) continue;

      const targetKey = getComponentKey(resolved, config.srcDir, depth);
      if (targetKey === key) continue; // intra-component — skip

      const relId = `${key}→${targetKey}`;
      const existing = relMap.get(relId);
      if (existing) {
        existing.importCount++;
      } else {
        relMap.set(relId, { from: key, to: targetKey, importCount: 1 });
      }
    }
  }

  // Backfill svelteFileCount for svelte-only directories (no .ts files)
  for (const [key, count] of Object.entries(svelteCountByKey)) {
    if (!components[key]) {
      components[key] = {
        key,
        label: key.split('/').pop() ?? key,
        tsFileCount: 0,
        svelteFileCount: count,
        files: [],
      };
    }
  }

  // Depth validation: warn if any component is suspiciously large
  for (const comp of Object.values(components)) {
    const total = comp.tsFileCount + comp.svelteFileCount;
    if (total > 50) {
      warnings.push(
        `"${comp.key}" contains ${total} files — componentDepth=${depth} may be too shallow; consider --depth ${depth + 1}`,
      );
    }
  }

  return {
    name: config.name,
    componentDepth: depth,
    components,
    relationships: Array.from(relMap.values()),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  let appFilter: string | undefined;
  let depthOverride: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app') appFilter = args[i + 1];
    if (args[i] === '--depth') depthOverride = parseInt(args[i + 1], 10);
  }

  const configs = appFilter ? APP_CONFIGS.filter((c) => c.name === appFilter) : APP_CONFIGS;

  if (configs.length === 0) {
    console.error(`Unknown app "${appFilter}". Valid: ${APP_CONFIGS.map((c) => c.name).join(', ')}`);
    process.exit(1);
  }

  const output: ExtractionOutput = { generatedAt: new Date().toISOString(), apps: {} };

  for (const config of configs) {
    const d = depthOverride ?? config.componentDepth;
    console.log(`Extracting ${config.name} (depth=${d})...`);
    const extraction = extractApp(config, depthOverride);
    output.apps[config.name] = extraction;

    const compCount = Object.keys(extraction.components).length;
    const relCount = extraction.relationships.length;
    console.log(`  ✓ ${compCount} components, ${relCount} relationships`);
    for (const w of extraction.warnings) console.warn(`  ⚠  ${w}`);
  }

  const outPath = path.join(REPO_ROOT, 'docs/c4/_extracted.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten → docs/c4/_extracted.json`);
}

main();
