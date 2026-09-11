#!/usr/bin/env tsx
/**
 * Deterministic AST-based C4 Layer 3 (Component) extraction.
 *
 * For a given app (dashboard | api), this script:
 *   1. Reads the app's tsconfig.json `compilerOptions.paths` to discover path aliases.
 *   2. Walks the app's `src` tree collecting .ts/.js files (ts-morph parseable) and
 *      .svelte files (not parseable by ts-morph, counted only).
 *   3. Buckets files into "components" by clipping their directory path (relative to
 *      `src`) to `depth` segments.
 *   4. Parses every .ts/.js file with ts-morph, resolves each import specifier
 *      (relative or aliased) to a file on disk, and records a relationship between
 *      the importing component and the imported component when they differ.
 *   5. Writes a structured JSON report to `docs/c4/.data/<app>-components.json`.
 *
 * Usage:
 *   tsx extract-components.ts <dashboard|api> [--depth=N] [--out=path]
 *
 * Depth is the number of directory segments below `src` used to form a component
 * key, e.g. with depth=3 the file `src/lib/components/Course/index.ts` belongs to
 * component `lib/components/Course`. Tune per app: too shallow collapses distinct
 * modules into one mega-component (the script warns when a component has >50 files).
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { Project, SyntaxKind, type SourceFile } from 'ts-morph';

interface AppConfig {
  name: string;
  root: string; // relative to repo root
  defaultDepth: number;
}

const APPS: Record<string, AppConfig> = {
  dashboard: { name: 'dashboard', root: 'apps/dashboard', defaultDepth: 4 },
  api: { name: 'api', root: 'apps/api', defaultDepth: 2 }
};

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MAX_FILES_PER_COMPONENT_WARNING = 50;
const CODE_EXTENSIONS = new Set(['.ts', '.js']);
const RESOLVE_CANDIDATES = ['', '.ts', '.tsx', '.js', '.svelte', '/index.ts', '/index.js'];

interface Alias {
  /** literal prefix, wildcard stripped, e.g. "$lib" for "$lib/*" */
  prefix: string;
  /** absolute directory the prefix maps to */
  target: string;
  /** whether this alias was declared with a trailing "/*" */
  wildcard: boolean;
}

interface ComponentEntry {
  key: string;
  dir: string; // path relative to repo root
  tsFileCount: number;
  svelteFileCount: number;
  fileCount: number;
  sampleFiles: string[];
  warning?: string;
}

interface RelationshipEntry {
  source: string;
  target: string;
  weight: number;
}

function parseArgs(argv: string[]) {
  const app = argv[0];
  if (!app || !APPS[app]) {
    console.error(`Usage: extract-components.ts <${Object.keys(APPS).join('|')}> [--depth=N] [--out=path]`);
    process.exit(1);
  }
  let depth = APPS[app].defaultDepth;
  let out: string | undefined;
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('--depth=')) depth = Number(arg.slice('--depth='.length));
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
  }
  return { app, depth, out };
}

/** Reads compilerOptions.paths/baseUrl straight off the app's own tsconfig.json (no `extends` resolution needed — both apps declare their aliases directly). */
function readAliases(appRoot: string): Alias[] {
  const tsconfigPath = path.join(appRoot, 'tsconfig.json');
  const raw = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (raw.error) {
    throw new Error(`Failed to parse ${tsconfigPath}: ${raw.error.messageText}`);
  }
  const compilerOptions = raw.config?.compilerOptions ?? {};
  const baseUrl = path.resolve(appRoot, compilerOptions.baseUrl ?? '.');
  const paths: Record<string, string[]> = compilerOptions.paths ?? {};

  const aliases: Alias[] = [];
  for (const [key, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (!target) continue;
    const wildcard = key.endsWith('/*');
    const prefix = wildcard ? key.slice(0, -2) : key;
    const targetPath = wildcard ? target.slice(0, -2) : target;
    aliases.push({ prefix, target: path.resolve(baseUrl, targetPath), wildcard });
  }
  // Longest prefix first so more specific aliases win.
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length);
}

function resolveAlias(specifier: string, aliases: Alias[]): string | null {
  for (const alias of aliases) {
    if (alias.wildcard) {
      if (specifier === alias.prefix) return alias.target;
      if (specifier.startsWith(alias.prefix + '/')) {
        return path.join(alias.target, specifier.slice(alias.prefix.length + 1));
      }
    } else if (specifier === alias.prefix) {
      return alias.target;
    }
  }
  return null;
}

/** Resolves an import specifier (relative or aliased) to an absolute file path on disk, probing common extensions/index files. Returns null for bare/external/virtual specifiers or anything that doesn't resolve to a real file. */
function resolveSpecifier(specifier: string, fromDir: string, aliases: Alias[]): string | null {
  let candidateBase: string | null = null;
  if (specifier.startsWith('.')) {
    candidateBase = path.resolve(fromDir, specifier);
  } else {
    candidateBase = resolveAlias(specifier, aliases);
  }
  if (!candidateBase) return null; // bare package, $app/*, $env/*, node builtin, etc.

  for (const suffix of RESOLVE_CANDIDATES) {
    const candidate = candidateBase + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function componentKeyForDir(absDir: string, srcRoot: string, depth: number): string {
  const rel = path.relative(srcRoot, absDir);
  if (!rel || rel.startsWith('..')) return '(src root)';
  const parts = rel.split(path.sep).filter(Boolean);
  return parts.slice(0, Math.max(1, depth)).join('/');
}

function walkFiles(dir: string, onFile: (absPath: string) => void) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, onFile);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}

function getImportSpecifiers(sourceFile: SourceFile): string[] {
  const specifiers: string[] = [];
  for (const imp of sourceFile.getImportDeclarations()) {
    specifiers.push(imp.getModuleSpecifierValue());
  }
  for (const exp of sourceFile.getExportDeclarations()) {
    const spec = exp.getModuleSpecifierValue();
    if (spec) specifiers.push(spec);
  }
  // Dynamic import("...") calls.
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() === SyntaxKind.ImportKeyword) {
      const arg = call.getArguments()[0];
      if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
        specifiers.push(arg.getText().slice(1, -1));
      }
    }
  }
  return specifiers;
}

function main() {
  const { app, depth, out } = parseArgs(process.argv.slice(2));
  const config = APPS[app];
  const appRoot = path.join(REPO_ROOT, config.root);
  const srcRoot = path.join(appRoot, 'src');

  if (!fs.existsSync(srcRoot)) {
    console.error(`src root not found: ${srcRoot}`);
    process.exit(1);
  }

  const aliases = readAliases(appRoot);

  const codeFiles: string[] = [];
  const svelteFiles: string[] = [];
  walkFiles(srcRoot, (file) => {
    const ext = path.extname(file);
    if (ext === '.svelte') svelteFiles.push(file);
    else if (CODE_EXTENSIONS.has(ext) && !file.endsWith('.d.ts')) codeFiles.push(file);
  });

  const components = new Map<string, ComponentEntry>();
  const getOrCreate = (key: string, dirAbs: string): ComponentEntry => {
    let entry = components.get(key);
    if (!entry) {
      entry = {
        key,
        dir: path.relative(REPO_ROOT, dirAbs === srcRoot ? srcRoot : path.join(srcRoot, key)),
        tsFileCount: 0,
        svelteFileCount: 0,
        fileCount: 0,
        sampleFiles: []
      };
      components.set(key, entry);
    }
    return entry;
  };

  for (const file of codeFiles) {
    const key = componentKeyForDir(path.dirname(file), srcRoot, depth);
    const entry = getOrCreate(key, path.dirname(file));
    entry.tsFileCount += 1;
    if (entry.sampleFiles.length < 5) entry.sampleFiles.push(path.relative(REPO_ROOT, file));
  }
  for (const file of svelteFiles) {
    const key = componentKeyForDir(path.dirname(file), srcRoot, depth);
    const entry = getOrCreate(key, path.dirname(file));
    entry.svelteFileCount += 1;
  }
  for (const entry of components.values()) {
    entry.fileCount = entry.tsFileCount + entry.svelteFileCount;
    if (entry.fileCount > MAX_FILES_PER_COMPONENT_WARNING) {
      entry.warning = `${entry.fileCount} files exceeds ${MAX_FILES_PER_COMPONENT_WARNING} — depth (${depth}) is probably too shallow for this component; consider re-running with a higher --depth`;
    }
  }

  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(codeFiles.map((f) => f.replace(/\\/g, '/')));

  const relWeights = new Map<string, number>();
  let externalImportsSkipped = 0;
  const unresolved: string[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const fromDir = path.dirname(filePath);
    const sourceKey = componentKeyForDir(fromDir, srcRoot, depth);

    for (const specifier of getImportSpecifiers(sourceFile)) {
      const resolved = resolveSpecifier(specifier, fromDir, aliases);
      if (!resolved) {
        externalImportsSkipped += 1;
        continue;
      }
      if (!resolved.startsWith(srcRoot)) continue; // resolves outside src (e.g. root configs) — not a component
      const targetKey = componentKeyForDir(path.dirname(resolved), srcRoot, depth);
      if (targetKey === sourceKey) continue; // intra-component, not a Layer 3 relationship

      // Ensure the target component exists even if it only contains files this
      // pass didn't otherwise visit (shouldn't normally happen, but keeps the graph consistent).
      if (!components.has(targetKey)) getOrCreate(targetKey, path.dirname(resolved));

      const relKey = `${sourceKey}=>${targetKey}`;
      relWeights.set(relKey, (relWeights.get(relKey) ?? 0) + 1);
    }
  }

  if (unresolved.length) {
    console.warn(`${unresolved.length} import(s) looked internal but did not resolve to a file (showing first 10):`);
    unresolved.slice(0, 10).forEach((u) => console.warn(`  ${u}`));
  }

  const relationships: RelationshipEntry[] = Array.from(relWeights.entries())
    .map(([key, weight]) => {
      const [source, target] = key.split('=>');
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  const componentList = Array.from(components.values()).sort((a, b) => a.key.localeCompare(b.key));
  const overLimit = componentList.filter((c) => c.warning);

  const report = {
    app: config.name,
    generatedAt: new Date().toISOString(),
    depth,
    srcRoot: path.relative(REPO_ROOT, srcRoot),
    aliases: Object.fromEntries(
      aliases.map((a) => [a.wildcard ? `${a.prefix}/*` : a.prefix, path.relative(REPO_ROOT, a.target)])
    ),
    components: componentList,
    relationships,
    stats: {
      codeFileCount: codeFiles.length,
      svelteFileCount: svelteFiles.length,
      componentCount: componentList.length,
      relationshipCount: relationships.length,
      externalImportsSkipped,
      componentsOverWarningThreshold: overLimit.map((c) => c.key)
    }
  };

  const outPath = out
    ? path.resolve(REPO_ROOT, out)
    : path.join(REPO_ROOT, 'docs/c4/.data', `${config.name}-components.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`[${config.name}] depth=${depth} components=${componentList.length} relationships=${relationships.length}`);
  if (overLimit.length) {
    console.warn(`[${config.name}] ${overLimit.length} component(s) exceed ${MAX_FILES_PER_COMPONENT_WARNING} files — consider a higher --depth:`);
    overLimit.forEach((c) => console.warn(`  ${c.key} (${c.fileCount} files)`));
  }
  console.log(`[${config.name}] wrote ${path.relative(REPO_ROOT, outPath)}`);
}

main();
