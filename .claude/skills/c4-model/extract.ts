#!/usr/bin/env npx tsx
/**
 * C4 model AST extractor for ClassroomIO.
 *
 * Parses TypeScript/JS files via ts-morph to extract component structure and
 * cross-component import relationships. .svelte files are counted per component
 * but not parsed (ts-morph can't handle them).
 *
 * Usage:
 *   cd .claude/skills/c4-model && ./node_modules/.bin/tsx extract.ts
 *   cd .claude/skills/c4-model && ./node_modules/.bin/tsx extract.ts --depth-dashboard=4 --depth-api=2
 *
 * Output: docs/c4/dashboard-components.json, docs/c4/api-components.json
 */

import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs', 'c4');

interface AppConfig {
  name: string;
  srcDir: string;
  depth: number;
  tsConfigPath: string;
}

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
  count: number;
}

interface ExtractionResult {
  app: string;
  depth: number;
  extractedAt: string;
  components: ComponentInfo[];
  relationships: Relationship[];
  warnings: string[];
}

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=?(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

/** Read path aliases from a tsconfig.json, merging `extends` chain. */
function readAliases(tsConfigPath: string, visited = new Set<string>()): Record<string, string> {
  const aliases: Record<string, string> = {};
  if (!fs.existsSync(tsConfigPath) || visited.has(tsConfigPath)) return aliases;
  visited.add(tsConfigPath);

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(stripComments(fs.readFileSync(tsConfigPath, 'utf-8')));
  } catch {
    return aliases;
  }

  const baseDir = path.dirname(tsConfigPath);
  const baseUrl = (json.compilerOptions as Record<string, string>)?.baseUrl ?? '.';
  const base = path.resolve(baseDir, baseUrl);
  const paths = ((json.compilerOptions as Record<string, unknown>)?.paths ?? {}) as Record<string, string[]>;

  // Merge parent first, then override with child
  const ext = (json as Record<string, string>).extends;
  if (ext) {
    const parentPath = path.resolve(baseDir, ext);
    Object.assign(aliases, readAliases(parentPath, visited));
  }

  for (const [pattern, [target]] of Object.entries(paths)) {
    if (pattern.endsWith('/*')) {
      // "$lib/*" => maps prefix "$lib/" → resolved dir + "/"
      const prefix = pattern.slice(0, -1);  // "$lib/"
      const dir = target.replace(/\/\*$/, '');
      aliases[prefix] = path.resolve(base, dir) + '/';
    } else {
      aliases[pattern] = path.resolve(base, target);
    }
  }

  return aliases;
}

/** Convert a file's srcDir-relative path to its component key. */
function componentKey(relFilePath: string, depth: number): string {
  const fwd = relFilePath.replace(/\\/g, '/');
  const dirParts = fwd.split('/').slice(0, -1);  // drop filename
  if (dirParts.length === 0) return '_root';
  return dirParts.slice(0, depth).join('/');
}

/** Resolve an import specifier to a path relative to srcDir, or null if external. */
function resolveImport(
  importPath: string,
  fromRelPath: string,
  srcDir: string,
  aliases: Record<string, string>,
): string | null {
  let abs: string | null = null;

  if (importPath.startsWith('.')) {
    const fromDir = path.join(srcDir, path.dirname(fromRelPath));
    abs = path.resolve(fromDir, importPath);
  } else {
    // Try alias prefixes (longest first for specificity)
    const sortedAliases = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, target] of sortedAliases) {
      if (prefix.endsWith('/') && importPath.startsWith(prefix)) {
        abs = target + importPath.slice(prefix.length);
        break;
      } else if (!prefix.endsWith('/') && importPath === prefix) {
        abs = target;
        break;
      }
    }
  }

  if (!abs) return null;
  const rel = path.relative(srcDir, abs).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null;  // outside srcDir
  return rel;
}

const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', '__mocks__', '.turbo', '.git']);

interface WalkResult {
  tsFiles: string[];                          // absolute paths
  svelteByKey: Record<string, number>;        // svelte file count per component key
}

function walk(dir: string, srcDir: string, depth: number): WalkResult {
  const tsFiles: string[] = [];
  const svelteByKey: Record<string, number> = {};

  function recurse(cur: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        recurse(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if ((ext === '.ts' || ext === '.js') && !e.name.endsWith('.d.ts')) {
          tsFiles.push(full);
        } else if (ext === '.svelte') {
          const rel = path.relative(srcDir, full).replace(/\\/g, '/');
          const key = componentKey(rel, depth);
          svelteByKey[key] = (svelteByKey[key] ?? 0) + 1;
        }
      }
    }
  }

  recurse(dir);
  return { tsFiles, svelteByKey };
}

function labelFromKey(key: string): string {
  if (key === '_root') return 'Root';
  const last = key.split('/').at(-1) ?? key;
  // Insert space before runs of capitals or before a capital following lowercase
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

async function extractApp(config: AppConfig): Promise<ExtractionResult> {
  const warnings: string[] = [];
  console.log(`\nExtracting ${config.name} (src=${config.srcDir}, depth=${config.depth})...`);

  const aliases = readAliases(config.tsConfigPath);
  const aliasKeys = Object.keys(aliases);
  console.log(`  Aliases: ${aliasKeys.length > 0 ? aliasKeys.join(', ') : '(none)'}`);

  const { tsFiles, svelteByKey } = walk(config.srcDir, config.srcDir, config.depth);
  console.log(`  Found ${tsFiles.length} .ts/.js files`);

  // Assign each file to a component
  const filesByKey: Record<string, string[]> = {};
  for (const abs of tsFiles) {
    const rel = path.relative(config.srcDir, abs).replace(/\\/g, '/');
    const key = componentKey(rel, config.depth);
    (filesByKey[key] ??= []).push(rel);
  }

  // Validate component sizes
  for (const [key, files] of Object.entries(filesByKey)) {
    if (files.length > 50) {
      warnings.push(
        `Component "${key}" has ${files.length} files — try --depth-${config.name}=${config.depth + 1}`,
      );
    }
  }

  // ts-morph project (no tsconfig dependency; we resolve imports manually)
  const project = new Project({
    compilerOptions: {
      strict: false,
      noImplicitAny: false,
      skipLibCheck: true,
      allowJs: true,
      noResolve: true,
    },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  for (const abs of tsFiles) {
    try { project.addSourceFileAtPath(abs); }
    catch { /* skip unparseable files */ }
  }

  // Extract cross-component relationships from imports + re-exports
  const relCounts: Record<string, Record<string, number>> = {};

  for (const sf of project.getSourceFiles()) {
    const rel = path.relative(config.srcDir, sf.getFilePath()).replace(/\\/g, '/');
    const fromKey = componentKey(rel, config.depth);

    const specs: string[] = [
      ...sf.getImportDeclarations().map(d => d.getModuleSpecifierValue()),
      ...sf.getExportDeclarations()
        .map(d => d.getModuleSpecifierValue())
        .filter((s): s is string => s != null),
    ];

    for (const spec of specs) {
      const resolved = resolveImport(spec, rel, config.srcDir, aliases);
      if (!resolved) continue;

      const toKey = componentKey(resolved, config.depth);
      if (toKey === fromKey) continue;
      if (!filesByKey[toKey]) continue;  // skip if target isn't a known component

      (relCounts[fromKey] ??= {})[toKey] = ((relCounts[fromKey]?.[toKey]) ?? 0) + 1;
    }
  }

  const components: ComponentInfo[] = Object.entries(filesByKey)
    .map(([key, files]) => {
      const svelte = svelteByKey[key] ?? 0;
      return {
        key,
        label: labelFromKey(key),
        tsFiles: files.length,
        svelteFiles: svelte,
        description: `${files.length} ts/js${svelte > 0 ? `, ${svelte} svelte` : ''}`,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const relationships: Relationship[] = Object.entries(relCounts)
    .flatMap(([from, tos]) => Object.entries(tos).map(([to, count]) => ({ from, to, count })))
    .sort((a, b) => b.count - a.count);

  return { app: config.name, depth: config.depth, extractedAt: new Date().toISOString(), components, relationships, warnings };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dashDepth = parseInt(args['depth-dashboard'] ?? '3');
  const apiDepth  = parseInt(args['depth-api']       ?? '2');

  const configs: AppConfig[] = [
    {
      name: 'dashboard',
      srcDir: path.join(REPO_ROOT, 'apps', 'dashboard', 'src'),
      depth: dashDepth,
      tsConfigPath: path.join(REPO_ROOT, 'apps', 'dashboard', 'tsconfig.json'),
    },
    {
      name: 'api',
      srcDir: path.join(REPO_ROOT, 'apps', 'api', 'src'),
      depth: apiDepth,
      tsConfigPath: path.join(REPO_ROOT, 'apps', 'api', 'tsconfig.json'),
    },
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const cfg of configs) {
    const result = await extractApp(cfg);

    if (result.warnings.length > 0) {
      console.warn('\n  Warnings:');
      result.warnings.forEach(w => console.warn(`    ⚠  ${w}`));
    }

    const out = path.join(OUTPUT_DIR, `${cfg.name}-components.json`);
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(`\n✓ ${cfg.name}: ${result.components.length} components, ${result.relationships.length} relationships`);
    console.log(`  → ${out}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
