/**
 * Extract Layer-3 component structure for the C4 model.
 *
 * Walks each configured app's source root, groups files into components by
 * truncating each file's directory path to the configured depth, parses TS/JS
 * with ts-morph, parses .svelte <script> blocks with a regex, resolves path
 * aliases from each app's tsconfig (following extends), and writes a JSON
 * report of components and the directed import graph between them.
 *
 * Run from the repo root:
 *   pnpm --dir .claude/skills/c4-model exec tsx scripts/extract-components.ts
 */

import { Project, ScriptKind } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');

type AppConfig = {
  srcRoot: string;
  tsconfig: string;
  depth: number;
  label: string;
};

type Config = {
  apps: Record<string, AppConfig>;
  externalPackagesOfInterest: string[];
  outputPath: string;
};

type ComponentInfo = {
  key: string;
  files: string[];
  svelteCount: number;
  scriptCount: number;
};

type Edge = { from: string; to: string; count: number };

type ExternalDep = { package: string; count: number; usedBy: string[] };

type AppExtraction = {
  label: string;
  srcRoot: string;
  depth: number;
  components: ComponentInfo[];
  relationships: Edge[];
  crossAppDeps: ExternalDep[];
  externalDeps: ExternalDep[];
  warnings: string[];
};

const SCRIPT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SVELTE_EXT = '.svelte';
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.svelte', '.mjs', '.cjs', '/index.ts', '/index.js'];
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', 'build', '.turbo', '__mocks__', 'mocks']);

function stripJsonComments(src: string): string {
  // Strip // line comments and /* */ block comments while keeping string content intact.
  let out = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (inString) {
      out += c;
      if (c === '\\' && i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // Trailing commas: tsconfig allows them in some toolchains; JSON.parse does not.
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function readJsonc<T = unknown>(absPath: string): T {
  const src = fs.readFileSync(absPath, 'utf8');
  return JSON.parse(stripJsonComments(src)) as T;
}

type TsconfigPaths = Record<string, string[]>;

function loadTsconfigPaths(tsconfigPath: string): { baseUrl: string; paths: TsconfigPaths } {
  // Follow extends chain; merge paths, child wins. baseUrl is resolved against
  // the tsconfig that DECLARED it (TypeScript's rule).
  const seen = new Set<string>();
  let resolvedBaseUrl = path.dirname(tsconfigPath);
  let baseUrlOwner = path.dirname(tsconfigPath);
  let mergedPaths: TsconfigPaths = {};

  function visit(cfgPath: string) {
    if (seen.has(cfgPath)) return;
    seen.add(cfgPath);
    let cfg: any;
    try {
      cfg = readJsonc<any>(cfgPath);
    } catch {
      return;
    }
    if (cfg.extends) {
      const parent = path.resolve(path.dirname(cfgPath), cfg.extends);
      // tsc resolves bare extends as node modules; we only handle relative ones.
      if (fs.existsSync(parent)) visit(parent);
    }
    const co = cfg.compilerOptions ?? {};
    if (co.baseUrl) {
      resolvedBaseUrl = path.resolve(path.dirname(cfgPath), co.baseUrl);
      baseUrlOwner = path.dirname(cfgPath);
    } else {
      baseUrlOwner = path.dirname(cfgPath);
    }
    if (co.paths) {
      // paths are resolved against the tsconfig that declared them.
      const owner = path.dirname(cfgPath);
      for (const [alias, targets] of Object.entries(co.paths)) {
        mergedPaths[alias] = (targets as string[]).map((t) => path.resolve(owner, t));
      }
    }
  }

  visit(tsconfigPath);
  return { baseUrl: resolvedBaseUrl, paths: mergedPaths };
}

function* walk(dir: string): Generator<string> {
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
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function componentKeyFor(absFile: string, srcRoot: string, depth: number): string {
  const rel = path.relative(srcRoot, absFile);
  const dir = path.dirname(rel);
  if (dir === '' || dir === '.') return '<root>';
  const segs = dir.split(path.sep);
  return segs.slice(0, depth).join('/');
}

function tryResolveFsPath(target: string): string | null {
  // target may or may not have an extension. Try direct, then with common
  // extensions, then as directory/index.
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  for (const ext of RESOLVE_EXTS) {
    const candidate = target + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const idx of ['index.ts', 'index.tsx', 'index.js', 'index.svelte']) {
      const candidate = path.join(target, idx);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function resolveAliasPattern(spec: string, pattern: string, targets: string[]): string | null {
  // Pattern matching for tsconfig paths: "$lib/*": ["./src/lib/*"].
  const wildcard = pattern.indexOf('*');
  if (wildcard === -1) {
    if (spec !== pattern) return null;
    for (const t of targets) {
      const resolved = tryResolveFsPath(t);
      if (resolved) return resolved;
    }
    return null;
  }
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) return null;
  const captured = spec.slice(prefix.length, spec.length - suffix.length);
  for (const t of targets) {
    const tWild = t.indexOf('*');
    if (tWild === -1) {
      const resolved = tryResolveFsPath(t);
      if (resolved) return resolved;
      continue;
    }
    const substituted = t.slice(0, tWild) + captured + t.slice(tWild + 1);
    const resolved = tryResolveFsPath(substituted);
    if (resolved) return resolved;
  }
  return null;
}

type Resolved =
  | { kind: 'internal'; absPath: string }
  | { kind: 'cross-app'; pkg: string }
  | { kind: 'external'; pkg: string }
  | { kind: 'unresolved' };

function packageNameFromSpec(spec: string): string {
  // "@scope/pkg/sub" -> "@scope/pkg"; "pkg/sub" -> "pkg".
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.slice(0, 2).join('/');
  }
  return spec.split('/')[0];
}

function resolveImport(
  spec: string,
  fromFile: string,
  tsPaths: TsconfigPaths,
  appSrcRoot: string,
): Resolved {
  // Virtual / framework-internal modules
  if (spec.startsWith('$app/') || spec.startsWith('$env/') || spec === '$app' || spec === '$env') {
    return { kind: 'external', pkg: spec.startsWith('$app') ? '$app' : '$env' };
  }
  // Relative
  if (spec.startsWith('.')) {
    const abs = path.resolve(path.dirname(fromFile), spec);
    const resolved = tryResolveFsPath(abs);
    if (resolved && isInside(resolved, appSrcRoot)) return { kind: 'internal', absPath: resolved };
    if (resolved) return { kind: 'external', pkg: 'sibling-app' };
    return { kind: 'unresolved' };
  }
  // tsconfig alias
  for (const [pattern, targets] of Object.entries(tsPaths)) {
    const resolved = resolveAliasPattern(spec, pattern, targets);
    if (resolved) {
      if (isInside(resolved, appSrcRoot)) return { kind: 'internal', absPath: resolved };
      return { kind: 'external', pkg: pattern };
    }
  }
  // Workspace / npm
  const pkg = packageNameFromSpec(spec);
  if (pkg.startsWith('@cio/')) return { kind: 'cross-app', pkg };
  return { kind: 'external', pkg };
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const IMPORT_REGEX =
  /\bimport\s+(?:[\s\S]*?\bfrom\s+)?["']([^"']+)["']|\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g;

function extractSvelteImports(absFile: string): string[] {
  let src: string;
  try {
    src = fs.readFileSync(absFile, 'utf8');
  } catch {
    return [];
  }
  const specs: string[] = [];
  // Iterate over each <script ...> ... </script> block.
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(src)) !== null) {
    const body = m[1];
    let im: RegExpExecArray | null;
    IMPORT_REGEX.lastIndex = 0;
    while ((im = IMPORT_REGEX.exec(body)) !== null) {
      const spec = im[1] ?? im[2];
      if (spec) specs.push(spec);
    }
  }
  return specs;
}

function extractApp(name: string, app: AppConfig, externalsOfInterest: Set<string>): AppExtraction {
  const srcRoot = path.resolve(REPO_ROOT, app.srcRoot);
  const tsconfig = path.resolve(REPO_ROOT, app.tsconfig);
  if (!fs.existsSync(srcRoot)) throw new Error(`srcRoot not found: ${srcRoot}`);
  if (!fs.existsSync(tsconfig)) throw new Error(`tsconfig not found: ${tsconfig}`);
  const { paths: tsPaths } = loadTsconfigPaths(tsconfig);

  // Discover files.
  const files: string[] = [];
  for (const f of walk(srcRoot)) {
    const ext = path.extname(f);
    if (ext === SVELTE_EXT || SCRIPT_EXTS.has(ext)) files.push(f);
  }

  // Build components.
  const components = new Map<string, ComponentInfo>();
  const fileToComponent = new Map<string, string>();
  for (const f of files) {
    const key = componentKeyFor(f, srcRoot, app.depth);
    let comp = components.get(key);
    if (!comp) {
      comp = { key, files: [], svelteCount: 0, scriptCount: 0 };
      components.set(key, comp);
    }
    comp.files.push(path.relative(REPO_ROOT, f));
    if (f.endsWith(SVELTE_EXT)) comp.svelteCount++;
    else comp.scriptCount++;
    fileToComponent.set(f, key);
  }

  // Parse TS/JS with ts-morph for accurate import extraction.
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });

  const edges = new Map<string, number>(); // "from\x00to" -> count
  const crossApp = new Map<string, { count: number; usedBy: Set<string> }>();
  const external = new Map<string, { count: number; usedBy: Set<string> }>();

  function recordEdge(from: string, to: string) {
    if (from === to) return;
    const k = `${from}\x00${to}`;
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }

  function recordExternal(map: typeof crossApp, pkg: string, from: string) {
    let entry = map.get(pkg);
    if (!entry) {
      entry = { count: 0, usedBy: new Set() };
      map.set(pkg, entry);
    }
    entry.count++;
    entry.usedBy.add(from);
  }

  for (const file of files) {
    const fromKey = fileToComponent.get(file)!;
    let specs: string[];
    if (file.endsWith(SVELTE_EXT)) {
      specs = extractSvelteImports(file);
    } else {
      let src;
      try {
        src = project.addSourceFileAtPath(file);
      } catch {
        continue;
      }
      specs = [];
      for (const imp of src.getImportDeclarations()) specs.push(imp.getModuleSpecifierValue());
      for (const exp of src.getExportDeclarations()) {
        const ms = exp.getModuleSpecifierValue();
        if (ms) specs.push(ms);
      }
      // Free the AST — large monorepos blow memory if we keep every source file.
      project.removeSourceFile(src);
    }
    for (const spec of specs) {
      const resolved = resolveImport(spec, file, tsPaths, srcRoot);
      if (resolved.kind === 'internal') {
        const toKey = fileToComponent.get(resolved.absPath);
        if (toKey) recordEdge(fromKey, toKey);
      } else if (resolved.kind === 'cross-app') {
        recordExternal(crossApp, resolved.pkg, fromKey);
      } else if (resolved.kind === 'external') {
        recordExternal(external, resolved.pkg, fromKey);
      }
    }
  }

  // Validation.
  const warnings: string[] = [];
  for (const comp of components.values()) {
    if (comp.files.length > 50) {
      warnings.push(
        `Component "${comp.key}" has ${comp.files.length} files (>50). ` +
          `Depth ${app.depth} is probably too shallow for this subtree — consider increasing it.`,
      );
    }
  }

  const componentsArr = [...components.values()].sort((a, b) => a.key.localeCompare(b.key));
  const relationshipsArr: Edge[] = [...edges.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split('\x00');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const filterExt = (m: typeof external): ExternalDep[] =>
    [...m.entries()]
      .map(([pkg, v]) => ({ pkg, count: v.count, usedBy: [...v.usedBy].sort() }))
      .sort((a, b) => b.count - a.count)
      .map(({ pkg, count, usedBy }) => ({ package: pkg, count, usedBy }));

  const externalAll = filterExt(external);
  const externalNotable = externalAll.filter(
    (d) => externalsOfInterest.has(d.package) || externalsOfInterest.has(packageNameFromSpec(d.package)),
  );

  return {
    label: app.label,
    srcRoot: app.srcRoot,
    depth: app.depth,
    components: componentsArr,
    relationships: relationshipsArr,
    crossAppDeps: filterExt(crossApp),
    externalDeps: externalNotable,
    warnings,
  };
}

function main() {
  const configPath = path.join(SKILL_DIR, 'config.json');
  const config = readJsonc<Config>(configPath);
  const externalsOfInterest = new Set(config.externalPackagesOfInterest);

  const result: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    apps: {} as Record<string, AppExtraction>,
  };

  let totalWarnings = 0;
  for (const [name, app] of Object.entries(config.apps)) {
    process.stderr.write(`Extracting ${name}…\n`);
    const extraction = extractApp(name, app, externalsOfInterest);
    (result.apps as Record<string, AppExtraction>)[name] = extraction;
    for (const w of extraction.warnings) {
      process.stderr.write(`  warning: ${w}\n`);
      totalWarnings++;
    }
    process.stderr.write(
      `  ${extraction.components.length} components, ${extraction.relationships.length} edges, ` +
        `${extraction.crossAppDeps.length} cross-app deps, ${extraction.externalDeps.length} notable external deps\n`,
    );
  }

  const outPath = path.resolve(REPO_ROOT, config.outputPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  process.stderr.write(`\nWrote ${path.relative(REPO_ROOT, outPath)}\n`);
  if (totalWarnings > 0) {
    process.stderr.write(`\n${totalWarnings} warning(s). Consider adjusting depth in config.json.\n`);
  }
}

main();
