/**
 * C4 model extractor.
 *
 * Walks an app's TypeScript/JavaScript source with ts-morph, groups files into
 * "components" by directory at a configurable depth, and emits import-derived
 * relationships between components plus references to external systems.
 *
 * Svelte files are not parsed (ts-morph can't); they are counted per directory
 * so the component metadata reflects the real file footprint.
 *
 * Usage:
 *   tsx extract.ts --app dashboard --repo /workspaces/classroomio
 *   tsx extract.ts --app api       --repo /workspaces/classroomio
 *
 * Writes JSON to <repo>/<config.cacheDir>/<app>.json
 */

import { Project, ts, type SourceFile } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AppConfig = {
  displayName: string;
  rootDir: string;
  tsconfig: string;
  srcDir: string;
  componentGroups: Record<string, number>;
  defaultDepth: number;
  exclude: string[];
};

type ExternalSystemDef = { name: string; kind: 'db' | 'external' | 'container'; tech?: string };

type Config = {
  outputDir: string;
  cacheDir: string;
  fileLimitPerComponent: number;
  apps: Record<string, AppConfig>;
  externalSystems: Record<string, ExternalSystemDef>;
};

type Component = {
  key: string;
  name: string;
  group: string;
  tsFiles: number;
  jsFiles: number;
  svelteFiles: number;
  totalFiles: number;
};

type Relationship = {
  from: string;
  to: string;
  count: number;
  kind: 'internal';
};

type ExternalRel = {
  from: string;
  system: string;
  module: string;
  kind: ExternalSystemDef['kind'];
  tech?: string;
  count: number;
};

type AppOutput = {
  app: string;
  displayName: string;
  rootDir: string;
  aliases: Record<string, string>;
  components: Component[];
  relationships: Relationship[];
  externalRelationships: ExternalRel[];
  warnings: string[];
  stats: {
    totalSourceFiles: number;
    totalSvelteFiles: number;
    unresolvedImports: number;
  };
};

function parseArgs(): { app: string; repo: string; configPath: string } {
  const args = process.argv.slice(2);
  let app = '';
  let repo = process.cwd();
  let configPath = path.resolve(__dirname, '..', 'config.json');
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--app') app = args[++i];
    else if (a === '--repo') repo = args[++i];
    else if (a === '--config') configPath = args[++i];
  }
  if (!app) {
    console.error('Usage: extract.ts --app <name> [--repo <path>] [--config <path>]');
    process.exit(2);
  }
  return { app, repo, configPath };
}

function loadConfig(p: string): Config {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readTsconfigPaths(absTsconfig: string): { paths: Record<string, string[]>; baseUrl: string } {
  // tsconfig.json is JSONC (comments + trailing commas allowed). Use the
  // TypeScript compiler's own parser via ts-morph rather than rolling our own
  // — a naive comment strip will mangle alias values like "$src/*" because
  // they contain "/*".
  const raw = fs.readFileSync(absTsconfig, 'utf8');
  const parsed = ts.parseConfigFileTextToJson(absTsconfig, raw);
  if (parsed.error) {
    throw new Error(`tsconfig parse error in ${absTsconfig}: ${parsed.error.messageText}`);
  }
  const compilerOptions = parsed.config?.compilerOptions || {};
  const paths: Record<string, string[]> = compilerOptions.paths || {};
  const baseUrl: string = compilerOptions.baseUrl || '.';
  return { paths, baseUrl };
}

/**
 * Resolve a single tsconfig "paths" alias against a source file's project root.
 * Returns the absolute prefix that the alias maps to (without trailing slash).
 */
function aliasAbsRoot(appRoot: string, baseUrl: string, target: string): string {
  // Drop trailing /* on the target value
  const cleaned = target.replace(/\/\*$/, '');
  return path.resolve(appRoot, baseUrl, cleaned);
}

/**
 * For a given alias key like "$lib/*" or "$lib", produce its prefix
 * (without trailing /*). Both forms map to the same source root.
 */
function aliasKeyPrefix(key: string): string {
  return key.replace(/\/\*$/, '');
}

/**
 * Given a file path, walk the configured componentGroups (longest prefix wins)
 * and return the component key. Files outside any group fall back to the
 * directory at defaultDepth below the source root.
 */
function componentKeyFor(
  fileRelToApp: string,
  config: AppConfig
): { key: string; group: string } {
  const fileDir = path.posix.dirname(fileRelToApp.split(path.sep).join('/'));
  const fileBase = path.posix.basename(fileRelToApp).replace(/\.[^.]+$/, '');

  // Find longest matching componentGroups prefix
  const groups = Object.keys(config.componentGroups).sort((a, b) => b.length - a.length);

  for (const prefix of groups) {
    const normPrefix = prefix.replace(/\\/g, '/');
    if (fileDir === normPrefix || fileDir.startsWith(normPrefix + '/')) {
      const depth = config.componentGroups[prefix];
      const after = fileDir.slice(normPrefix.length).replace(/^\//, '');
      const afterSegments = after ? after.split('/') : [];
      if (depth === 0) {
        // Group is the component; if the file lives in a subdir of the group,
        // collapse to the group itself.
        return { key: normPrefix, group: normPrefix };
      }
      if (afterSegments.length === 0) {
        // File sits directly in the prefix dir — treat the file (sans ext) as the leaf
        return { key: `${normPrefix}/${fileBase}`, group: normPrefix };
      }
      const taken = afterSegments.slice(0, depth).join('/');
      return { key: `${normPrefix}/${taken}`, group: normPrefix };
    }
  }

  // Fallback: collapse anything at srcDir level into a single "src" component
  // (entry / wiring code), otherwise group by defaultDepth segments below src.
  let after = fileDir;
  if (after === 'src') after = '';
  else if (after.startsWith('src/')) after = after.slice(4);
  if (!after) {
    return { key: 'src', group: 'src' };
  }
  const segs = after.split('/').filter(Boolean);
  const taken = segs.slice(0, Math.max(1, config.defaultDepth)).join('/');
  return { key: `src/${taken}`, group: 'src' };
}

function prettifyName(key: string): string {
  const last = key.split('/').filter(Boolean).pop() || key;
  return last
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExcluded(file: string, patterns: string[]): boolean {
  return patterns.some((p) => micromatch(file, p));
}

/**
 * Tiny glob-to-regex (supports ** and *, no braces). Enough for our exclude
 * patterns; pulling in a real micromatch would be overkill.
 */
function micromatch(file: string, pattern: string): boolean {
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLESTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLESTAR__/g, '.*') +
      '$'
  );
  return re.test(file);
}

/**
 * Resolve an import specifier to an absolute file path on disk (best effort).
 * Returns null if the specifier is an external package or can't be resolved.
 */
function resolveImport(
  spec: string,
  fromFileAbs: string,
  appRoot: string,
  aliases: Record<string, string[]>,
  baseUrl: string
): string | null {
  // Relative import
  if (spec.startsWith('.')) {
    return path.resolve(path.dirname(fromFileAbs), spec);
  }

  // Path alias
  const aliasKeys = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const key of aliasKeys) {
    const keyPrefix = aliasKeyPrefix(key);
    if (spec === keyPrefix || spec.startsWith(keyPrefix + '/')) {
      const remainder = spec.slice(keyPrefix.length).replace(/^\//, '');
      const target = aliases[key][0];
      const absRoot = aliasAbsRoot(appRoot, baseUrl, target);
      return remainder ? path.resolve(absRoot, remainder) : absRoot;
    }
  }

  // SvelteKit virtual: $app/*, $env/*, $service-worker — treat as runtime
  if (/^\$(app|env|service-worker)\b/.test(spec)) return null;

  // External (package)
  return null;
}

/**
 * If an absolute path points at a file (with or without extension) or a
 * directory containing an index file, return the actual file path. Otherwise
 * null.
 */
function realiseFile(absPath: string): string | null {
  const candidates = [
    absPath,
    `${absPath}.ts`,
    `${absPath}.tsx`,
    `${absPath}.js`,
    `${absPath}.mjs`,
    `${absPath}.svelte`,
    path.join(absPath, 'index.ts'),
    path.join(absPath, 'index.js'),
    path.join(absPath, 'index.svelte')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  // Directory exists (no index) — return the dir itself so the caller can group it.
  if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) return absPath;
  return null;
}

/**
 * Find an external-system match for a bare module specifier. Supports both
 * exact and prefix-style keys (a trailing "/" in the key means "prefix").
 */
function matchExternal(
  spec: string,
  externals: Record<string, ExternalSystemDef>
): { key: string; def: ExternalSystemDef } | null {
  for (const key of Object.keys(externals)) {
    if (key.endsWith('/')) {
      if (spec.startsWith(key)) return { key, def: externals[key] };
    } else {
      if (spec === key) return { key, def: externals[key] };
    }
  }
  return null;
}

/**
 * Walk a directory tree manually to collect .svelte files (ts-morph won't see them).
 * Returns a count keyed by component.
 */
function countSvelteFiles(
  appCfg: AppConfig,
  appAbsRoot: string,
  componentsIndex: Map<string, Component>,
  appRelToRepo: (abs: string) => string
): { perComponent: Map<string, number>; total: number } {
  const perComponent = new Map<string, number>();
  let total = 0;
  const srcAbs = path.resolve(appAbsRoot, 'src');
  if (!fs.existsSync(srcAbs)) return { perComponent, total };

  const stack: string[] = [srcAbs];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = appRelToRepo(full);
      const relToApp = path.relative(appAbsRoot, full).split(path.sep).join('/');
      if (isExcluded(relToApp, appCfg.exclude)) continue;
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!e.name.endsWith('.svelte')) continue;
      total++;
      const { key, group } = componentKeyFor(relToApp, appCfg);
      perComponent.set(key, (perComponent.get(key) || 0) + 1);
      if (!componentsIndex.has(key)) {
        componentsIndex.set(key, {
          key,
          name: prettifyName(key),
          group,
          tsFiles: 0,
          jsFiles: 0,
          svelteFiles: 0,
          totalFiles: 0
        });
      }
      // (Files count and rel ref intentionally unused beyond the map; counts are merged later.)
      void rel;
    }
  }
  return { perComponent, total };
}

async function extractApp(appName: string, config: Config, repoRoot: string): Promise<AppOutput> {
  const appCfg = config.apps[appName];
  if (!appCfg) {
    throw new Error(`Unknown app: ${appName}. Configured: ${Object.keys(config.apps).join(', ')}`);
  }
  const appAbsRoot = path.resolve(repoRoot, appCfg.rootDir);
  const tsconfigAbs = path.resolve(repoRoot, appCfg.tsconfig);

  const { paths: tsPaths, baseUrl } = readTsconfigPaths(tsconfigAbs);

  // Initialise ts-morph against the app's tsconfig. We use tsconfigResolution
  // but skip the SvelteKit-generated .svelte-kit/tsconfig.json (which extends
  // the user tsconfig) — ts-morph will still pull in .ts/.js files.
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      target: 99 /* ESNext */,
      module: 99 /* ESNext */,
      moduleResolution: 100 /* Bundler */,
      baseUrl: path.resolve(appAbsRoot, baseUrl),
      paths: tsPaths
    }
  });

  // Add .ts / .js files under the configured srcDir.
  const srcAbs = path.resolve(repoRoot, appCfg.srcDir);
  project.addSourceFilesAtPaths([
    `${srcAbs}/**/*.ts`,
    `${srcAbs}/**/*.tsx`,
    `${srcAbs}/**/*.js`,
    `${srcAbs}/**/*.mjs`
  ]);

  const components = new Map<string, Component>();
  const relCounts = new Map<string, Relationship>(); // key = `${from}${to}`
  const externalCounts = new Map<string, ExternalRel>(); // key = `${from}${moduleKey}`
  let unresolvedImports = 0;

  const sourceFiles = project.getSourceFiles().filter((sf) => {
    const relToApp = path.relative(appAbsRoot, sf.getFilePath()).split(path.sep).join('/');
    return !isExcluded(relToApp, appCfg.exclude);
  });

  // First pass: register every component from the .ts/.js files we have.
  for (const sf of sourceFiles) {
    const relToApp = path.relative(appAbsRoot, sf.getFilePath()).split(path.sep).join('/');
    const { key, group } = componentKeyFor(relToApp, appCfg);
    if (!components.has(key)) {
      components.set(key, {
        key,
        name: prettifyName(key),
        group,
        tsFiles: 0,
        jsFiles: 0,
        svelteFiles: 0,
        totalFiles: 0
      });
    }
    const c = components.get(key)!;
    if (relToApp.endsWith('.js') || relToApp.endsWith('.mjs')) c.jsFiles++;
    else c.tsFiles++;
  }

  // Svelte counts merged in
  const { perComponent: svelteCounts, total: totalSvelte } = countSvelteFiles(
    appCfg,
    appAbsRoot,
    components,
    (abs) => path.relative(repoRoot, abs).split(path.sep).join('/')
  );
  for (const [k, v] of svelteCounts) {
    const c = components.get(k)!;
    c.svelteFiles = v;
  }
  for (const c of components.values()) {
    c.totalFiles = c.tsFiles + c.jsFiles + c.svelteFiles;
  }

  // Second pass: edges
  for (const sf of sourceFiles) {
    const fromAbs = sf.getFilePath();
    const fromRelApp = path.relative(appAbsRoot, fromAbs).split(path.sep).join('/');
    const { key: fromKey } = componentKeyFor(fromRelApp, appCfg);
    const imports = collectImportSpecifiers(sf);

    for (const spec of imports) {
      const resolved = resolveImport(spec, fromAbs, appAbsRoot, tsPaths, baseUrl);
      if (resolved === null) {
        // External or virtual
        const ext = matchExternal(spec, config.externalSystems);
        if (ext) {
          const k = `${fromKey}${ext.def.name}${ext.key}`;
          if (!externalCounts.has(k)) {
            externalCounts.set(k, {
              from: fromKey,
              system: ext.def.name,
              module: ext.key,
              kind: ext.def.kind,
              tech: ext.def.tech,
              count: 0
            });
          }
          externalCounts.get(k)!.count++;
        }
        continue;
      }

      const real = realiseFile(resolved);
      if (!real) {
        unresolvedImports++;
        continue;
      }
      // Map the resolved file back to a component
      const targetRelApp = path.relative(appAbsRoot, real).split(path.sep).join('/');
      if (!targetRelApp || targetRelApp.startsWith('..')) {
        // Imported from outside this app's tree (shouldn't happen often)
        unresolvedImports++;
        continue;
      }
      const { key: toKey } = componentKeyFor(targetRelApp, appCfg);
      if (toKey === fromKey) continue; // intra-component edge: skip
      const k = `${fromKey}${toKey}`;
      if (!relCounts.has(k)) {
        relCounts.set(k, { from: fromKey, to: toKey, count: 0, kind: 'internal' });
      }
      relCounts.get(k)!.count++;
    }
  }

  // Validate: any oversized components
  const warnings: string[] = [];
  for (const c of components.values()) {
    if (c.totalFiles > config.fileLimitPerComponent) {
      warnings.push(
        `Component "${c.key}" has ${c.totalFiles} files (limit ${config.fileLimitPerComponent}). ` +
          `Increase depth for group "${c.group}" in config.json apps.${appName}.componentGroups.`
      );
    }
  }

  // Build alias display map (key -> rel-to-repo path of the alias root)
  const aliases: Record<string, string> = {};
  for (const [k, v] of Object.entries(tsPaths)) {
    const absRoot = aliasAbsRoot(appAbsRoot, baseUrl, v[0]);
    aliases[aliasKeyPrefix(k)] = path.relative(repoRoot, absRoot).split(path.sep).join('/');
  }

  return {
    app: appName,
    displayName: appCfg.displayName,
    rootDir: appCfg.rootDir,
    aliases,
    components: [...components.values()].sort((a, b) => a.key.localeCompare(b.key)),
    relationships: [...relCounts.values()].sort(
      (a, b) => b.count - a.count || a.from.localeCompare(b.from)
    ),
    externalRelationships: [...externalCounts.values()].sort(
      (a, b) => b.count - a.count || a.from.localeCompare(b.from)
    ),
    warnings,
    stats: {
      totalSourceFiles: sourceFiles.length,
      totalSvelteFiles: totalSvelte,
      unresolvedImports
    }
  };
}

function collectImportSpecifiers(sf: SourceFile): string[] {
  const out: string[] = [];
  for (const imp of sf.getImportDeclarations()) {
    out.push(imp.getModuleSpecifierValue());
  }
  for (const exp of sf.getExportDeclarations()) {
    const v = exp.getModuleSpecifierValue();
    if (v) out.push(v);
  }
  // Dynamic imports: import('...')
  sf.forEachDescendant((node) => {
    if (node.getKindName() === 'CallExpression') {
      // Detect import('...')
      // @ts-expect-error  using runtime shape
      const expr = node.getExpression?.();
      if (expr && expr.getKindName?.() === 'ImportKeyword') {
        // @ts-expect-error  using runtime shape
        const args = node.getArguments?.() || [];
        const first = args[0];
        if (first && first.getKindName?.() === 'StringLiteral') {
          out.push(first.getLiteralText());
        }
      }
    }
  });
  return out;
}

async function main() {
  const { app, repo, configPath } = parseArgs();
  const config = loadConfig(configPath);
  const out = await extractApp(app, config, repo);

  const cacheDir = path.resolve(repo, config.cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const outPath = path.join(cacheDir, `${app}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  process.stderr.write(
    `[c4-model] ${app}: ${out.components.length} components, ` +
      `${out.relationships.length} edges, ${out.externalRelationships.length} external refs ` +
      `(${out.stats.totalSourceFiles} TS/JS + ${out.stats.totalSvelteFiles} svelte files scanned)\n`
  );
  if (out.warnings.length) {
    for (const w of out.warnings) process.stderr.write(`[c4-model] warn: ${w}\n`);
  }
  process.stdout.write(outPath + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
