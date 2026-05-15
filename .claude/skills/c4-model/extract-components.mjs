#!/usr/bin/env node
/**
 * extract-components.mjs — deterministic Layer-3 extractor.
 *
 * For one app (dashboard | api), this script:
 *   1. Reads compilerOptions.paths / baseUrl from the app's tsconfig.json
 *      so path aliases ($lib, $src, …) resolve dynamically.
 *   2. Walks src/**\/*.{ts,tsx,js,jsx,mjs,cjs,svelte}, excluding tests,
 *      d.ts, build output, and node_modules.
 *   3. Buckets every source file into a "component" keyed by the first
 *      `depth` directory segments below src/.
 *   4. Extracts import edges:
 *        - .ts/.js files: parsed via ts-morph (covers static, dynamic,
 *          and re-export specifiers).
 *        - .svelte files: <script> blocks scanned with regex (ts-morph
 *          cannot parse Svelte syntax).
 *   5. Resolves each specifier to an absolute file path (aliases +
 *      relative). External (npm) specifiers are dropped.
 *   6. Aggregates cross-component imports as relationships with a count.
 *   7. Writes docs/c4/.extraction/<app>.json.
 *   8. Warns loudly if any component contains > 50 files — usually a
 *      sign `--depth` is too shallow.
 *
 * Output schema:
 *   {
 *     app, root, src, depth, generatedAt,
 *     components: [{ key, files, ts, js, svelte, sampleFiles: string[] }],
 *     relationships: [{ from, to, count }],
 *     warnings: string[],
 *   }
 */

import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'c4', '.extraction');

const APPS = {
  dashboard: {
    root: 'apps/dashboard',
    src: 'src',
    depth: 3,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte'],
    ignore: [
      /(^|\/)\.svelte-kit(\/|$)/,
      /(^|\/)build(\/|$)/,
      /(^|\/)__mocks__(\/|$)/,
      /(^|\/)__tests__(\/|$)/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.d\.ts$/
    ]
  },
  api: {
    root: 'apps/api',
    src: 'src',
    depth: 2,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    ignore: [
      /(^|\/)dist(\/|$)/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.d\.ts$/
    ]
  }
};

const args = process.argv.slice(2);
const appName = args[0];
if (!appName || !APPS[appName]) {
  console.error(`Usage: node extract-components.mjs <${Object.keys(APPS).join('|')}> [--depth N]`);
  process.exit(2);
}
const depthFlag = args.indexOf('--depth');
const depthOverride = depthFlag >= 0 ? parseInt(args[depthFlag + 1], 10) : null;
const cfg = { ...APPS[appName], depth: depthOverride ?? APPS[appName].depth };
if (!Number.isInteger(cfg.depth) || cfg.depth < 1) {
  console.error(`--depth must be a positive integer, got ${cfg.depth}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// tsconfig.json paths

function stripJsonc(text) {
  // String-aware comment stripper. Without it, "$src/*" matches /* … */.
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    // String literal
    if (c === '"') {
      out += c;
      i++;
      while (i < n) {
        const k = text[i];
        out += k;
        i++;
        if (k === '\\' && i < n) {
          out += text[i];
          i++;
          continue;
        }
        if (k === '"') break;
      }
      continue;
    }
    // Line comment
    if (c === '/' && c2 === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // Trailing commas
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function aliasPatternToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)');
  return new RegExp('^' + escaped + '$');
}

function loadTsConfigPaths(appRoot) {
  const tsconfigPath = path.join(appRoot, 'tsconfig.json');
  const text = fs.readFileSync(tsconfigPath, 'utf8');
  const parsed = JSON.parse(stripJsonc(text));
  const co = parsed.compilerOptions ?? {};
  const baseUrl = path.resolve(appRoot, co.baseUrl ?? '.');
  const paths = co.paths ?? {};
  const aliases = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    aliases.push({
      pattern,
      regex: aliasPatternToRegex(pattern),
      hasWildcard: pattern.includes('*'),
      targets: targets.map((t) => path.resolve(baseUrl, t))
    });
  }
  // More-specific patterns first so "$lib/utils/foo" doesn't get eaten by "$lib/*"
  aliases.sort((a, b) => b.pattern.length - a.pattern.length);
  return { baseUrl, aliases };
}

// ---------------------------------------------------------------------------
// Module resolution

const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte'];

function resolveToFile(p) {
  try {
    const st = fs.statSync(p);
    if (st.isFile()) return p;
    if (st.isDirectory()) {
      for (const ext of RESOLVE_EXTS) {
        const idx = path.join(p, 'index' + ext);
        if (fs.existsSync(idx)) return idx;
      }
    }
  } catch {
    /* ENOENT — fall through */
  }
  for (const ext of RESOLVE_EXTS) {
    if (fs.existsSync(p + ext)) return p + ext;
  }
  return null;
}

function resolveAlias(spec, aliases) {
  for (const a of aliases) {
    const m = spec.match(a.regex);
    if (!m) continue;
    const wildcard = m[1] ?? '';
    for (const target of a.targets) {
      const resolved = a.hasWildcard ? target.replace(/\*/g, wildcard) : target;
      const f = resolveToFile(resolved);
      if (f) return f;
    }
    return null;
  }
  return null;
}

function resolveSpec(spec, fromFile, aliases) {
  if (spec.startsWith('.')) {
    const base = path.resolve(path.dirname(fromFile), spec);
    return resolveToFile(base);
  }
  if (spec.startsWith('/')) return null;
  return resolveAlias(spec, aliases);
}

// ---------------------------------------------------------------------------
// File walking

function walk(dir, results = []) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(full, results);
    } else if (ent.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function isIgnored(file, ignore) {
  const normalized = file.split(path.sep).join('/');
  return ignore.some((re) => re.test(normalized));
}

function componentKey(absFile, srcAbs, depth) {
  const rel = path.relative(srcAbs, absFile);
  const segs = rel.split(path.sep);
  const dirSegs = segs.slice(0, -1);
  if (dirSegs.length === 0) return '(root)';
  return dirSegs.slice(0, depth).join('/');
}

// ---------------------------------------------------------------------------
// Import extraction

function extractTsImports(project, file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = project.createSourceFile(file, text, { overwrite: true });
  const specs = [];
  for (const id of sf.getImportDeclarations()) specs.push(id.getModuleSpecifierValue());
  for (const ed of sf.getExportDeclarations()) {
    const ms = ed.getModuleSpecifierValue();
    if (ms) specs.push(ms);
  }
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const expr = node.getExpression();
    if (expr.getKind() !== SyntaxKind.ImportKeyword) return;
    const arg = node.getArguments()[0];
    if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
      specs.push(arg.getLiteralValue());
    }
  });
  project.removeSourceFile(sf);
  return specs;
}

const SVELTE_SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const BARE_IMPORT_RE = /\bimport\s+['"]([^'"]+)['"]/g;
const DYN_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractSvelteImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  let block;
  while ((block = SVELTE_SCRIPT_RE.exec(text)) !== null) {
    const body = block[1];
    let m;
    while ((m = FROM_RE.exec(body)) !== null) out.push(m[1]);
    while ((m = BARE_IMPORT_RE.exec(body)) !== null) out.push(m[1]);
    while ((m = DYN_IMPORT_RE.exec(body)) !== null) out.push(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main

const appRoot = path.resolve(REPO_ROOT, cfg.root);
const srcAbs = path.resolve(appRoot, cfg.src);
if (!fs.existsSync(srcAbs)) {
  console.error(`src directory not found: ${srcAbs}`);
  process.exit(2);
}

const { aliases } = loadTsConfigPaths(appRoot);
console.error(`[${appName}] depth=${cfg.depth}, aliases:`, aliases.map((a) => a.pattern).join(', ') || '(none)');

const allFiles = walk(srcAbs)
  .filter((f) => cfg.extensions.includes(path.extname(f)))
  .filter((f) => !isIgnored(f, cfg.ignore))
  .sort();

const components = new Map();
function compEntry(key) {
  let e = components.get(key);
  if (!e) {
    e = { key, files: 0, ts: 0, js: 0, svelte: 0, paths: [] };
    components.set(key, e);
  }
  return e;
}
for (const f of allFiles) {
  const key = componentKey(f, srcAbs, cfg.depth);
  const e = compEntry(key);
  e.files++;
  const ext = path.extname(f);
  if (ext === '.svelte') e.svelte++;
  else if (ext === '.ts' || ext === '.tsx') e.ts++;
  else e.js++;
  e.paths.push(path.relative(srcAbs, f));
}

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  compilerOptions: { allowJs: true, noEmit: true, target: 99, module: 99, jsx: 1 }
});

const edges = new Map();
function addEdge(from, to) {
  if (from === to) return;
  const k = `${from}\t${to}`;
  edges.set(k, (edges.get(k) ?? 0) + 1);
}

let parseFailures = 0;
for (const f of allFiles) {
  const fromKey = componentKey(f, srcAbs, cfg.depth);
  const ext = path.extname(f);
  let specs;
  try {
    specs = ext === '.svelte' ? extractSvelteImports(f) : extractTsImports(project, f);
  } catch (e) {
    parseFailures++;
    if (parseFailures <= 5) console.warn(`[warn] parse failed: ${path.relative(REPO_ROOT, f)} — ${e.message}`);
    continue;
  }
  for (const spec of specs) {
    const resolved = resolveSpec(spec, f, aliases);
    if (!resolved) continue;
    if (!resolved.startsWith(srcAbs + path.sep)) continue;
    const toKey = componentKey(resolved, srcAbs, cfg.depth);
    addEdge(fromKey, toKey);
  }
}
if (parseFailures > 5) console.warn(`[warn] … and ${parseFailures - 5} more parse failures`);

const out = {
  app: appName,
  root: cfg.root,
  src: cfg.src,
  depth: cfg.depth,
  generatedAt: new Date().toISOString(),
  components: [...components.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ paths, ...rest }) => ({ ...rest, sampleFiles: paths.slice(0, 5) })),
  relationships: [...edges.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split('\t');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
  warnings: []
};

const fat = out.components.filter((c) => c.files > 50);
for (const c of fat) {
  out.warnings.push(`component "${c.key}" has ${c.files} files — depth=${cfg.depth} may be too shallow`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `${appName}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`Wrote ${path.relative(REPO_ROOT, outPath)}`);
console.log(`  files: ${allFiles.length}`);
console.log(`  components: ${out.components.length}`);
console.log(`  relationships: ${out.relationships.length}`);
if (out.warnings.length) {
  console.warn(`  warnings (${out.warnings.length}):`);
  for (const w of out.warnings) console.warn(`    - ${w}`);
}
