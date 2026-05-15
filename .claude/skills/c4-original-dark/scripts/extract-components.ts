#!/usr/bin/env node
/**
 * extract-components.ts — C4 Layer-3 AST extractor for ClassroomIO
 *
 * Parses .ts/.js source files in apps/dashboard and apps/api using ts-morph,
 * groups files by directory depth into C4 components, and maps cross-directory
 * imports as relationships. Outputs structured JSON for generate-diagrams.ts.
 *
 * .svelte files are not parsed — only counted per component directory for metadata.
 * Path aliases are resolved by reading each app's tsconfig.json paths field.
 *
 * Usage (from repo root):
 *   node --import=tsx/esm .claude/skills/c4-original-dark/scripts/extract-components.ts [flags]
 *
 * Flags:
 *   --depth-dashboard=N   component key depth for dashboard (default: 3)
 *   --depth-api=N         component key depth for api (default: 2)
 *   --out=PATH            output JSON path (default: docs/c4/components.json)
 *   --root=PATH           absolute repo root (default: process.cwd())
 */

import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

// ─── Output types ──────────────────────────────────────────────────────────────

export interface ComponentEntry {
  key: string;
  label: string;
  tsFiles: string[];        // paths relative to app srcDir
  svelteFileCount: number;
  totalFileCount: number;
  relationships: string[];  // keys of other components this one imports from
}

export interface AppOutput {
  name: string;
  srcDir: string;           // relative to repo root
  depth: number;
  aliases: Record<string, string>; // resolved internal aliases (for reference)
  components: Record<string, ComponentEntry>;
  warnings: string[];
}

export interface ExtractOutput {
  generatedAt: string;
  apps: Record<string, AppOutput>;
}

// ─── tsconfig helpers ──────────────────────────────────────────────────────────

/**
 * String-aware JSONC comment stripper.
 * Regex-only strippers incorrectly eat wildcard paths like "$src/*" when a
 * later token (e.g. "src/**\/*") provides the closing "* /" sequence.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      // Consume string literal verbatim (respecting escape sequences)
      out += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i++]; out += src[i++]; }
        else if (src[i] === '"') { out += src[i++]; break; }
        else { out += src[i++]; }
      }
    } else if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (src[i] === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else {
      out += src[i++];
    }
  }
  return out;
}

function readJsonc(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(stripComments(fs.readFileSync(filePath, 'utf-8')));
  } catch {
    return {};
  }
}

/**
 * Walk the tsconfig "extends" chain and collect path aliases that resolve to
 * paths inside appRootDir (filters out framework/node_modules aliases).
 */
function loadInternalAliases(
  tsconfigPath: string,
  appRootDir: string,
  seen = new Set<string>(),
): Record<string, string> {
  const abs = path.resolve(tsconfigPath);
  if (seen.has(abs) || !fs.existsSync(abs)) return {};
  seen.add(abs);

  const cfg = readJsonc(abs) as {
    extends?: string;
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  const dir = path.dirname(abs);
  const aliases: Record<string, string> = {};

  if (cfg.extends) {
    Object.assign(aliases, loadInternalAliases(path.resolve(dir, cfg.extends), appRootDir, seen));
  }

  const opts = cfg.compilerOptions ?? {};
  const baseUrl = opts.baseUrl ? path.resolve(dir, opts.baseUrl) : dir;

  for (const [alias, targets] of Object.entries(opts.paths ?? {})) {
    const first = targets?.[0];
    if (!first) continue;
    // Normalise wildcard forms: "$lib/*" → "$lib" / "./src/lib/*" → "./src/lib"
    const cleanAlias = alias.replace(/\/\*$/, '');
    const cleanTarget = first.replace(/\/\*$/, '');
    const resolved = path.resolve(baseUrl, cleanTarget);
    // Only keep aliases that point inside the app (exclude node_modules / SvelteKit runtime)
    if (resolved.startsWith(appRootDir + path.sep) || resolved === appRootDir) {
      aliases[cleanAlias] = resolved;
    }
  }

  return aliases;
}

// ─── Import resolution ─────────────────────────────────────────────────────────

/**
 * Resolve an import specifier to a path relative to srcDir, or null if external.
 * Tries longest alias prefix first to avoid false matches.
 */
function resolveSpecifier(
  specifier: string,
  sourceAbsPath: string,
  aliases: Record<string, string>,
  srcDir: string,
): string | null {
  let resolved: string | null = null;

  // Alias resolution — try longest match first
  const sorted = Object.entries(aliases).sort(([a], [b]) => b.length - a.length);
  for (const [alias, target] of sorted) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      resolved = target + specifier.slice(alias.length);
      break;
    }
  }

  // Relative imports
  if (!resolved && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    resolved = path.resolve(path.dirname(sourceAbsPath), specifier);
  }

  if (!resolved) return null; // external package — skip

  const rel = path.relative(srcDir, resolved).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null; // escapes srcDir — skip

  return rel;
}

// ─── Component key ─────────────────────────────────────────────────────────────

/**
 * Compute a component key from a srcDir-relative file path.
 * Takes the first `depth` directory segments (stopping before the filename).
 * Files directly in srcDir get key "_root".
 */
function componentKey(srcRelPath: string, depth: number): string {
  const parts = srcRelPath.replace(/\\/g, '/').split('/');
  const dirParts = parts.slice(0, parts.length - 1); // exclude filename
  if (dirParts.length === 0) return '_root';
  return dirParts.slice(0, depth).join('/');
}

// ─── Label derivation ──────────────────────────────────────────────────────────

function deriveLabel(key: string): string {
  if (key === '_root') return 'Root';
  const segment = key.split('/').pop() ?? key;
  return segment
    // SvelteKit dynamic segments: [id] → ById, [slug] → BySlug
    .replace(/\[([^\]]+)\]/g, (_, p: string) => 'By' + p[0].toUpperCase() + p.slice(1))
    // SvelteKit route groups: (auth) → Auth
    .replace(/^\(([^)]+)\)$/, (_, p: string) => p[0].toUpperCase() + p.slice(1))
    // kebab/snake to camel
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    // capitalise first letter
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

// ─── Svelte file counter ───────────────────────────────────────────────────────

/** Walk srcDir, count .svelte files, bucket them by component key. */
function countSvelteByComponent(srcDir: string, depth: number): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.svelte')) {
        const rel = path.relative(srcDir, full).replace(/\\/g, '/');
        const key = componentKey(rel, depth);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  walk(srcDir);
  return counts;
}

// ─── Per-app extraction ────────────────────────────────────────────────────────

interface AppConfig {
  name: string;
  rootDir: string;   // apps/dashboard  (absolute)
  srcDir: string;    // apps/dashboard/src  (absolute)
  tsconfigPath: string;
  depth: number;
}

function extractApp(config: AppConfig): AppOutput {
  const { name, rootDir, srcDir, tsconfigPath, depth } = config;
  const warnings: string[] = [];

  // 1. Resolve internal path aliases
  const aliases = loadInternalAliases(tsconfigPath, rootDir);

  // 2. Build ts-morph project — manual file loading, no tsconfig extends resolution
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
    },
  });

  project.addSourceFilesAtPaths([
    `${srcDir}/**/*.ts`,
    `${srcDir}/**/*.js`,
    `!${srcDir}/**/*.spec.ts`,
    `!${srcDir}/**/*.spec.js`,
    `!${srcDir}/**/*.test.ts`,
    `!${srcDir}/**/*.test.js`,
    `!${srcDir}/**/__mocks__/**`,
  ]);

  // 3. Aggregate files and cross-component relationships
  type CompData = { tsFiles: Set<string>; deps: Set<string> };
  const compMap = new Map<string, CompData>();

  const ensure = (key: string): CompData => {
    if (!compMap.has(key)) compMap.set(key, { tsFiles: new Set(), deps: new Set() });
    return compMap.get(key)!;
  };

  for (const sf of project.getSourceFiles()) {
    const abs = sf.getFilePath() as string;
    if (!abs.startsWith(srcDir)) continue;

    const rel = path.relative(srcDir, abs).replace(/\\/g, '/');
    const key = componentKey(rel, depth);
    ensure(key).tsFiles.add(rel);

    // Collect import specifiers (both static imports and re-exports)
    const specifiers: string[] = [
      ...sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue()),
      ...sf.getExportDeclarations()
        .map((d) => d.getModuleSpecifierValue())
        .filter((s): s is string => !!s),
    ];

    for (const spec of specifiers) {
      const resolved = resolveSpecifier(spec, abs, aliases, srcDir);
      if (!resolved) continue;
      const depKey = componentKey(resolved, depth);
      if (depKey !== key) ensure(key).deps.add(depKey);
    }
  }

  // 4. Count .svelte files bucketed by component key
  const svelteCounts = countSvelteByComponent(srcDir, depth);

  // Ensure components that only have .svelte files appear in the map too
  for (const [key, count] of svelteCounts) {
    if (count > 0) ensure(key); // creates entry if absent
  }

  // 5. Build output + validate depth
  const components: Record<string, ComponentEntry> = {};

  for (const [key, data] of compMap) {
    const tsFiles = [...data.tsFiles].sort();
    const svelteCount = svelteCounts.get(key) ?? 0;
    const total = tsFiles.length + svelteCount;

    if (total > 50) {
      warnings.push(
        `"${key}" has ${total} files — depth=${depth} may be too shallow; try --depth-${name}=${depth + 1}`,
      );
    }

    components[key] = {
      key,
      label: deriveLabel(key),
      tsFiles,
      svelteFileCount: svelteCount,
      totalFileCount: total,
      relationships: [...data.deps].sort(),
    };
  }

  return {
    name,
    srcDir: path.relative(process.cwd(), srcDir).replace(/\\/g, '/'),
    depth,
    aliases: Object.fromEntries(
      Object.entries(aliases).map(([k, v]) => [k, path.relative(process.cwd(), v).replace(/\\/g, '/')]),
    ),
    components,
    warnings,
  };
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(.+)$/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

function main(): void {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(args['root'] ?? process.cwd());
  const depthDashboard = parseInt(args['depth-dashboard'] ?? '4', 10);
  const depthApi = parseInt(args['depth-api'] ?? '2', 10);
  const outPath = path.resolve(repoRoot, args['out'] ?? 'docs/c4/components.json');

  const configs: AppConfig[] = [
    {
      name: 'dashboard',
      rootDir: path.join(repoRoot, 'apps/dashboard'),
      srcDir: path.join(repoRoot, 'apps/dashboard/src'),
      tsconfigPath: path.join(repoRoot, 'apps/dashboard/tsconfig.json'),
      depth: depthDashboard,
    },
    {
      name: 'api',
      rootDir: path.join(repoRoot, 'apps/api'),
      srcDir: path.join(repoRoot, 'apps/api/src'),
      tsconfigPath: path.join(repoRoot, 'apps/api/tsconfig.json'),
      depth: depthApi,
    },
  ];

  const output: ExtractOutput = {
    generatedAt: new Date().toISOString(),
    apps: {},
  };

  for (const cfg of configs) {
    process.stderr.write(`[c4] extracting ${cfg.name} (depth=${cfg.depth})...\n`);
    const app = extractApp(cfg);
    output.apps[cfg.name] = app;

    const n = Object.keys(app.components).length;
    process.stderr.write(`[c4]   → ${n} components, ${app.warnings.length} warnings\n`);
    for (const w of app.warnings) process.stderr.write(`[c4] WARN: ${w}\n`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  process.stderr.write(`[c4] wrote ${path.relative(repoRoot, outPath)}\n`);
}

main();
