#!/usr/bin/env node
/**
 * AST-driven C4 Layer-3 component extraction for ClassroomIO.
 *
 * Walks `apps/dashboard` and `apps/api`, groups files into components by
 * directory at a configurable depth, and maps cross-component imports as
 * weighted relationships. Output: docs/c4/components.json.
 *
 * Usage:
 *   node .claude/skills/c4-model/scripts/extract-components.mjs
 *   node .claude/skills/c4-model/scripts/extract-components.mjs --depth-dashboard=4 --depth-api=2
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync
} from 'node:fs';
import { join, dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');
const REPO_ROOT = resolve(SKILL_DIR, '..', '..', '..');

// ---------------- ts-morph self-install ----------------

async function loadTsMorph() {
  try {
    return await import('ts-morph');
  } catch {}
  const localNm = join(SKILL_DIR, 'node_modules', 'ts-morph');
  if (!existsSync(localNm)) {
    console.error('[c4-model] Installing ts-morph into skill directory (one-time)…');
    execSync('npm install --silent --no-save --prefix . ts-morph@^24', {
      cwd: SKILL_DIR,
      stdio: 'inherit'
    });
  }
  return await import(pathToFileURL(join(localNm, 'dist', 'ts-morph.js')).href).catch(
    async () => await import(pathToFileURL(join(localNm, 'dist-esm', 'ts-morph.js')).href)
  );
}

// ---------------- args ----------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const APPS = [
  {
    name: 'dashboard',
    root: join(REPO_ROOT, 'apps', 'dashboard'),
    sourceRoot: 'src',
    depth: Number(args['depth-dashboard']) || 5,
    tsconfig: 'tsconfig.json'
  },
  {
    name: 'api',
    root: join(REPO_ROOT, 'apps', 'api'),
    sourceRoot: 'src',
    depth: Number(args['depth-api']) || 2,
    tsconfig: 'tsconfig.json'
  }
];

// ---------------- tsconfig + alias parsing ----------------

function stripJsonc(raw) {
  // String-aware comment stripper: must not touch `/*` or `//` inside strings
  // (e.g. tsconfig path values like "$src/*").
  let out = '';
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < raw.length) {
    const c = raw[i];
    if (inString) {
      out += c;
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && raw[i + 1] === '*') {
      i += 2;
      while (i < raw.length - 1 && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function readTsConfig(path) {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(stripJsonc(raw));
}

function buildAliases(tsconfigPath) {
  const cfg = readTsConfig(tsconfigPath);
  const co = cfg.compilerOptions || {};
  const baseUrl = resolve(dirname(tsconfigPath), co.baseUrl || '.');
  const paths = co.paths || {};
  const out = [];
  for (const [k, vs] of Object.entries(paths)) {
    if (!Array.isArray(vs) || vs.length === 0) continue;
    const key = k.replace(/\/\*$/, '');
    const val = vs[0].replace(/\/\*$/, '');
    out.push({ prefix: key, target: resolve(baseUrl, val) });
  }
  out.sort((a, b) => b.prefix.length - a.prefix.length);
  return out;
}

// ---------------- file walking ----------------

const SKIP_DIRS = new Set([
  'node_modules',
  '.svelte-kit',
  '.turbo',
  'dist',
  'build',
  '.next',
  'coverage',
  '__tests__',
  '__mocks__'
]);

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) {
      const dot = name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = name.slice(dot);
      if (SOURCE_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

// ---------------- key derivation ----------------

function componentKey(filePath, app) {
  const srcRoot = resolve(app.root, app.sourceRoot);
  const rel = relative(srcRoot, filePath);
  // If outside source root, key by relative-to-app-root with a top-level prefix.
  if (rel.startsWith('..')) {
    const relApp = relative(app.root, filePath);
    const parts = relApp.split(sep).filter(Boolean);
    return parts.slice(0, Math.max(1, app.depth - 1)).join('/') || '(root)';
  }
  const parts = rel.split(sep);
  const dirs = parts.slice(0, -1);
  if (dirs.length === 0) return '(top)';
  const k = dirs.slice(0, app.depth).join('/');
  return k || '(top)';
}

// ---------------- module resolution ----------------

const EXT_CANDIDATES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte'];
const INDEX_CANDIDATES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.svelte'];

function tryResolve(target) {
  for (const ext of EXT_CANDIDATES) {
    const p = target + ext;
    if (existsSync(p)) {
      try {
        if (statSync(p).isFile()) return p;
      } catch {}
    }
  }
  for (const idx of INDEX_CANDIDATES) {
    const p = join(target, idx);
    if (existsSync(p)) return p;
  }
  return null;
}

function resolveImport(spec, fromFile, aliases) {
  if (!spec) return null;
  if (spec.startsWith('.')) {
    return tryResolve(resolve(dirname(fromFile), spec));
  }
  for (const { prefix, target } of aliases) {
    if (spec === prefix) return tryResolve(target);
    if (spec.startsWith(prefix + '/')) {
      const rest = spec.slice(prefix.length + 1);
      return tryResolve(resolve(target, rest));
    }
  }
  return null; // external package
}

// ---------------- Svelte import extraction ----------------

const IMPORT_RE =
  /(?:^|\n)\s*import\s+(?:[\s\S]+?\s+from\s+)?['"]([^'"]+)['"]/g;

function extractSvelteImports(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const scripts = [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1]
  );
  if (scripts.length === 0) return [];
  const out = [];
  for (const block of scripts) {
    for (const m of block.matchAll(IMPORT_RE)) out.push(m[1]);
  }
  return out;
}

// ---------------- TS/JS import extraction ----------------

function extractTsImports(sourceFile) {
  const out = [];
  for (const decl of sourceFile.getImportDeclarations()) {
    out.push(decl.getModuleSpecifierValue());
  }
  for (const decl of sourceFile.getExportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    if (spec) out.push(spec);
  }
  // dynamic imports
  const text = sourceFile.getFullText();
  for (const m of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.push(m[1]);
  }
  return out;
}

// ---------------- per-app extraction ----------------

async function extractApp(app, tsMorph) {
  const { Project } = tsMorph;
  const tsconfigPath = join(app.root, app.tsconfig);
  if (!existsSync(tsconfigPath)) {
    throw new Error(`tsconfig not found for app ${app.name}: ${tsconfigPath}`);
  }
  const aliases = buildAliases(tsconfigPath);
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, noEmit: true }
  });

  const files = walk(resolve(app.root, app.sourceRoot));

  const components = new Map();
  function ensure(key) {
    if (!components.has(key)) {
      components.set(key, {
        key,
        files: 0,
        tsFiles: 0,
        jsFiles: 0,
        svelteFiles: 0,
        sampleFiles: []
      });
    }
    return components.get(key);
  }

  const relCounts = new Map(); // "from→to" → count

  for (const file of files) {
    const key = componentKey(file, app);
    const c = ensure(key);
    c.files++;
    if (c.sampleFiles.length < 5) {
      c.sampleFiles.push(relative(app.root, file).split(sep).join('/'));
    }
    const ext = file.slice(file.lastIndexOf('.'));
    let specs = [];
    if (ext === '.svelte') {
      c.svelteFiles++;
      specs = extractSvelteImports(file);
    } else {
      if (ext === '.ts' || ext === '.tsx') c.tsFiles++;
      else c.jsFiles++;
      let sf;
      try {
        sf = project.addSourceFileAtPath(file);
      } catch {
        continue;
      }
      specs = extractTsImports(sf);
      project.removeSourceFile(sf);
    }
    const seenThisFile = new Set();
    for (const spec of specs) {
      const resolved = resolveImport(spec, file, aliases);
      if (!resolved) continue;
      const toKey = componentKey(resolved, app);
      if (toKey === key) continue;
      const edge = `${key}→${toKey}`;
      if (seenThisFile.has(edge)) continue;
      seenThisFile.add(edge);
      relCounts.set(edge, (relCounts.get(edge) || 0) + 1);
    }
  }

  const compArr = [...components.values()].sort((a, b) =>
    a.key.localeCompare(b.key)
  );
  const relArr = [...relCounts.entries()]
    .map(([k, count]) => {
      const i = k.indexOf('→');
      return { from: k.slice(0, i), to: k.slice(i + 1), count };
    })
    .sort((a, b) => b.count - a.count);

  return { app: app.name, depth: app.depth, components: compArr, relations: relArr };
}

// ---------------- validation ----------------

function validate(appResult) {
  const big = appResult.components.filter((c) => c.files > 50);
  return big;
}

// ---------------- main ----------------

(async () => {
  const tsMorph = await loadTsMorph();
  const out = {
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    apps: {}
  };
  let failed = false;
  for (const app of APPS) {
    console.error(`[c4-model] Extracting ${app.name} (depth=${app.depth})…`);
    const result = await extractApp(app, tsMorph);
    out.apps[app.name] = result;
    const big = validate(result);
    console.error(
      `  ${result.components.length} components, ${result.relations.length} relations`
    );
    if (big.length) {
      failed = true;
      console.error(
        `  ✗ depth ${app.depth} is too shallow for "${app.name}". The following components have >50 files:`
      );
      for (const c of big.slice(0, 10)) {
        console.error(`      ${c.key}: ${c.files} files`);
      }
      console.error(
        `    Try: --depth-${app.name}=${app.depth + 1}`
      );
    }
  }

  const outDir = join(REPO_ROOT, 'docs', 'c4');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'components.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.error(`[c4-model] Wrote ${relative(REPO_ROOT, outPath)}`);

  if (failed) {
    console.error(
      '[c4-model] Depth validation failed. Re-run with the suggested --depth-* flags before generating diagrams.'
    );
    process.exit(2);
  }
})().catch((err) => {
  console.error('[c4-model] FAILED:', err.stack || err.message);
  process.exit(1);
});
