#!/usr/bin/env node
/**
 * C4 Component Extractor
 *
 * Uses ts-morph to parse apps/dashboard and apps/api, groups files into components
 * by directory depth, maps cross-component imports as relationships, and writes
 * structured JSON consumed by generate-diagrams.ts.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/c4-model/extract-components.ts
 *   pnpm exec tsx .claude/skills/c4-model/extract-components.ts --depth-dashboard 4 --depth-api 3
 *
 * Options:
 *   --depth-dashboard N   directory levels forming a component key, dashboard (default: 3)
 *   --depth-api N         directory levels forming a component key, api       (default: 2)
 *   --output PATH         output JSON path (default: .claude/skills/c4-model/extracted.json)
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const HASH_FILE = path.join(__dirname, '.component-hash');

// ── CLI args ─────────────────────────────────────────────────────────────────

function readStoredHash(): { hash: string; depthDashboard: number; depthApi: number } | null {
  if (!fs.existsSync(HASH_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const stored = readStoredHash();
  // Default to last-used depth so re-runs with no flag still hit the cache.
  let depthDashboard = stored?.depthDashboard ?? 3;
  let depthApi = stored?.depthApi ?? 2;
  let outputPath = path.join(__dirname, 'extracted.json');
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--depth-dashboard' && argv[i + 1]) depthDashboard = parseInt(argv[++i], 10);
    else if (argv[i] === '--depth-api' && argv[i + 1]) depthApi = parseInt(argv[++i], 10);
    else if (argv[i] === '--output' && argv[i + 1]) outputPath = argv[++i];
    else if (argv[i] === '--force') force = true;
  }
  return { depthDashboard, depthApi, outputPath, force };
}

// ── JSONC comment stripping ───────────────────────────────────────────────────

// State-machine parser: skips // and /* */ comments only outside JSON strings.
// Handles tsconfigs that use inline block comments like:
//   "target": "ESNext" /* description */,
// without accidentally treating path aliases like "$src/*" as comment openers.
function stripJsonComments(src: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < src.length) {
    const ch = src[i];

    if (escaped) {
      escaped = false;
      out += ch;
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      out += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '/' && i + 1 < src.length) {
      if (src[i + 1] === '/') {
        // Line comment — skip to EOL
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (src[i + 1] === '*') {
        // Block comment — skip to */
        i += 2;
        while (i + 1 < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

// ── Path alias loading ────────────────────────────────────────────────────────

type AliasMap = Record<string, string>; // stripped alias prefix → absolute target dir

function loadAliases(tsconfigPath: string): AliasMap {
  const aliases: AliasMap = {};
  const tsconfigDir = path.dirname(tsconfigPath);

  let raw: string;
  try {
    raw = fs.readFileSync(tsconfigPath, 'utf-8');
  } catch {
    console.warn(`[warn] Cannot read ${tsconfigPath}`);
    return aliases;
  }

  const cleaned = stripJsonComments(raw);
  let tsconfig: Record<string, unknown>;
  try {
    tsconfig = JSON.parse(cleaned);
  } catch {
    console.warn(`[warn] Cannot parse ${tsconfigPath}`);
    return aliases;
  }

  const compilerOptions = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
  const rawBaseUrl = compilerOptions.baseUrl as string | undefined;
  const baseUrl = rawBaseUrl ? path.resolve(tsconfigDir, rawBaseUrl) : tsconfigDir;
  const paths = (compilerOptions.paths ?? {}) as Record<string, string[]>;

  for (const [aliasPattern, targets] of Object.entries(paths)) {
    if (!targets[0]) continue;
    // Strip trailing /* from both key and target so we do prefix matching uniformly
    const aliasKey = aliasPattern.replace(/\/\*$/, '');
    const targetDir = path.resolve(baseUrl, targets[0].replace(/\/\*$/, ''));
    aliases[aliasKey] = targetDir;
  }

  return aliases;
}

// ── Import resolution ─────────────────────────────────────────────────────────

function resolveImport(
  importStr: string,
  importingFile: string,
  aliases: AliasMap,
): string | null {
  if (importStr.startsWith('.')) {
    const base = path.resolve(path.dirname(importingFile), importStr);
    for (const ext of ['.ts', '.tsx', '.js', '.svelte', '/index.ts', '/index.js']) {
      if (fs.existsSync(base + ext)) return base + ext;
    }
    if (fs.existsSync(base)) return base;
    return base; // Return even if not found — let caller filter by srcDir
  }

  // Sort longest alias first so more-specific aliases win
  const sorted = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, targetDir] of sorted) {
    if (importStr === alias || importStr.startsWith(alias + '/')) {
      const suffix = importStr.slice(alias.length).replace(/^\//, '');
      const resolved = suffix ? path.join(targetDir, suffix) : targetDir;
      for (const ext of ['.ts', '.tsx', '.js', '.svelte', '/index.ts', '/index.js', '']) {
        if (fs.existsSync(resolved + ext)) return resolved + ext;
      }
      return resolved;
    }
  }

  return null; // External package — skip
}

// ── Component key ─────────────────────────────────────────────────────────────

/**
 * Returns the first `depth` directory segments of a file path relative to srcDir.
 * Files at the root of srcDir return "root".
 *
 * Example (depth 3):
 *   apps/dashboard/src/lib/utils/services/courses/index.ts → "lib/utils/services"
 *   apps/dashboard/src/lib/utils/store/app.ts              → "lib/utils/store"
 *   apps/dashboard/src/routes/home/+page.ts                → "routes/home"
 */
function componentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);
  const dirParts = parts.slice(0, -1); // drop filename
  const keyParts = dirParts.slice(0, depth);
  return keyParts.length > 0 ? keyParts.join('/') : 'root';
}

// ── Svelte file counting ──────────────────────────────────────────────────────

function countSvelteByDir(srcDir: string, excludeDirs: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!excludeDirs.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.name.endsWith('.svelte')) {
        const rel = path.relative(srcDir, dir);
        counts.set(rel, (counts.get(rel) ?? 0) + 1);
      }
    }
  }
  walk(srcDir);
  return counts;
}

// ── Collect TS/JS source files ────────────────────────────────────────────────

function collectTsFiles(dir: string, excludeDirs: Set<string>): string[] {
  const files: string[] = [];
  function walk(d: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!excludeDirs.has(e.name)) walk(path.join(d, e.name));
      } else if (/\.(ts|tsx|js)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        files.push(path.join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

// ── Per-app extraction ────────────────────────────────────────────────────────

interface ComponentInfo {
  tsFileCount: number;
  svelteFileCount: number;
  fileCount: number;
  samplePaths: string[]; // up to 5 relative paths
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppResult {
  componentDepth: number;
  totalTsFiles: number;
  totalSvelteFiles: number;
  components: Record<string, ComponentInfo>;
  relationships: Relationship[];
  warnings: string[];
}

function extractApp(config: {
  name: string;
  srcDir: string;
  tsconfigPath: string;
  componentDepth: number;
  excludeDirs: string[];
}): AppResult {
  const { name, srcDir, tsconfigPath, componentDepth, excludeDirs } = config;
  const excludeSet = new Set(excludeDirs);
  console.log(`\n[${name}] srcDir=${srcDir}  depth=${componentDepth}`);

  const aliases = loadAliases(tsconfigPath);
  console.log(`[${name}] aliases: ${Object.keys(aliases).join(', ') || '(none)'}`);

  const svelteCounts = countSvelteByDir(srcDir, excludeSet);
  const totalSvelteFiles = [...svelteCounts.values()].reduce((a, b) => a + b, 0);

  const tsFiles = collectTsFiles(srcDir, excludeSet);
  console.log(`[${name}] TS/JS files: ${tsFiles.length}  Svelte files: ${totalSvelteFiles}`);

  const project = new Project({
    compilerOptions: { allowJs: true, skipLibCheck: true },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  project.addSourceFilesAtPaths(tsFiles);
  const sourceFiles = project.getSourceFiles();

  // First pass — build component → file list
  const compTsFiles: Record<string, string[]> = {};
  for (const sf of sourceFiles) {
    const fp = sf.getFilePath();
    if (!fp.startsWith(srcDir)) continue;
    const key = componentKey(fp, srcDir, componentDepth);
    (compTsFiles[key] ??= []).push(path.relative(srcDir, fp));
  }

  // Attribute svelte files to component keys
  const compSvelteCount: Record<string, number> = {};
  for (const [relDir, count] of svelteCounts.entries()) {
    const dummyPath = path.join(srcDir, relDir, '_dummy.ts');
    const key = componentKey(dummyPath, srcDir, componentDepth);
    compSvelteCount[key] = (compSvelteCount[key] ?? 0) + count;
    // Ensure the component exists even if no TS files live there
    compTsFiles[key] ??= [];
  }

  // Second pass — build relationship map
  const relMap = new Map<string, Map<string, number>>();
  for (const sf of sourceFiles) {
    const fp = sf.getFilePath();
    if (!fp.startsWith(srcDir)) continue;
    const fromKey = componentKey(fp, srcDir, componentDepth);

    for (const decl of sf.getImportDeclarations()) {
      const importStr = decl.getModuleSpecifierValue();
      const resolved = resolveImport(importStr, fp, aliases);
      if (!resolved || !resolved.startsWith(srcDir)) continue;
      const toKey = componentKey(resolved, srcDir, componentDepth);
      if (toKey === fromKey) continue;

      const inner = relMap.get(fromKey) ?? new Map<string, number>();
      inner.set(toKey, (inner.get(toKey) ?? 0) + 1);
      relMap.set(fromKey, inner);
    }
  }

  // Validate — warn if any component has >50 files
  const warnings: string[] = [];
  const allKeys = new Set([...Object.keys(compTsFiles), ...Object.keys(compSvelteCount)]);
  for (const key of allKeys) {
    const total = (compTsFiles[key]?.length ?? 0) + (compSvelteCount[key] ?? 0);
    if (total > 50) {
      const msg = `[${name}] component "${key}" has ${total} files — consider increasing --depth-${name}`;
      console.warn(`⚠  ${msg}`);
      warnings.push(msg);
    }
  }

  // Assemble output
  const components: Record<string, ComponentInfo> = {};
  for (const key of allKeys) {
    const tsCount = compTsFiles[key]?.length ?? 0;
    const svCount = compSvelteCount[key] ?? 0;
    components[key] = {
      tsFileCount: tsCount,
      svelteFileCount: svCount,
      fileCount: tsCount + svCount,
      samplePaths: (compTsFiles[key] ?? []).slice(0, 5),
    };
  }

  const relationships: Relationship[] = [];
  for (const [from, toMap] of relMap.entries()) {
    for (const [to, importCount] of toMap.entries()) {
      relationships.push({ from, to, importCount });
    }
  }
  relationships.sort((a, b) => b.importCount - a.importCount);

  console.log(
    `[${name}] components: ${Object.keys(components).length}  relationships: ${relationships.length}`,
  );

  return {
    componentDepth,
    totalTsFiles: tsFiles.length,
    totalSvelteFiles,
    components,
    relationships,
    warnings,
  };
}

// ── Source hash ───────────────────────────────────────────────────────────────

function hashSources(srcDirs: string[], depthDashboard: number, depthApi: number): string {
  const h = createHash('sha256');
  const EXCLUDE = new Set(['node_modules', '.svelte-kit', 'dist', '.git', 'mocks', '__mocks__']);

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (EXCLUDE.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|svelte)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        h.update(full);
        h.update(fs.readFileSync(full));
      }
    }
  }

  for (const dir of srcDirs) walk(dir);
  h.update(`depth-dashboard:${depthDashboard}|depth-api:${depthApi}`);
  try { h.update(fs.readFileSync(__filename)); } catch { /* ignore */ }
  return h.digest('hex');
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main() {
  const { depthDashboard, depthApi, outputPath, force } = parseArgs();

  const dashSrc = path.join(REPO_ROOT, 'apps/dashboard/src');
  const apiSrc  = path.join(REPO_ROOT, 'apps/api/src');
  const currentHash = hashSources([dashSrc, apiSrc], depthDashboard, depthApi);

  if (!force) {
    const stored = readStoredHash();
    if (stored?.hash === currentHash && fs.existsSync(outputPath)) {
      console.log('✓ No source changes detected — skipping extraction. Use --force to override.');
      process.exit(0);
    }
  }

  const result = {
    extractedAt: new Date().toISOString(),
    apps: {
      dashboard: extractApp({
        name: 'dashboard',
        srcDir: path.join(REPO_ROOT, 'apps/dashboard/src'),
        tsconfigPath: path.join(REPO_ROOT, 'apps/dashboard/tsconfig.json'),
        componentDepth: depthDashboard,
        excludeDirs: ['node_modules', '.svelte-kit', 'mocks', '__mocks__', 'dist', '.git'],
      }),
      api: extractApp({
        name: 'api',
        srcDir: path.join(REPO_ROOT, 'apps/api/src'),
        tsconfigPath: path.join(REPO_ROOT, 'apps/api/tsconfig.json'),
        componentDepth: depthApi,
        excludeDirs: ['node_modules', 'dist', '.git'],
      }),
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(HASH_FILE, JSON.stringify({ hash: currentHash, depthDashboard, depthApi }));
  console.log(`\n✓ Wrote ${outputPath}`);

  const allWarnings = [...result.apps.dashboard.warnings, ...result.apps.api.warnings];
  if (allWarnings.length) {
    console.log('\nValidation warnings:');
    allWarnings.forEach((w) => console.log(' ', w));
  }
}

main();
