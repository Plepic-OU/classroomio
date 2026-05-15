#!/usr/bin/env node
// AST-based component extractor for the c4-model skill.
//
// Reads a target app's tsconfig.json (following extends), discovers path aliases,
// walks .ts/.js source files via ts-morph, groups them by directory depth into
// "components", and emits cross-component imports as relationships.
//
// .svelte files are counted per-directory as metadata. ts-morph cannot parse them;
// the structure they participate in is recovered from co-located .ts/.js modules
// and from .svelte→.svelte imports being resolved by filesystem match.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { depth: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--app') out.app = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--depth') out.depth = parseInt(argv[++i], 10);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--repo') out.repo = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: extract-components.mjs --app <path> --name <id> [--depth N] --out <file> [--repo <path>]'
      );
      process.exit(0);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.app || !args.name || !args.out) {
  console.error('Missing required flags. See --help.');
  process.exit(2);
}
const repoRoot = args.repo ? path.resolve(args.repo) : path.resolve(__dirname, '../../..');
const appAbs = path.resolve(repoRoot, args.app);
const srcAbs = path.join(appAbs, 'src');

if (!fs.existsSync(srcAbs)) {
  console.error(`No src/ directory at ${srcAbs}`);
  process.exit(2);
}

// Load ts-morph from the skill's own node_modules.
let Project;
try {
  ({ Project } = await import('ts-morph'));
} catch {
  console.error(
    'ts-morph not installed. Run: (cd .claude/skills/c4-model && pnpm install --silent)'
  );
  process.exit(3);
}

// --- tsconfig walk: gather paths across extends chain ---------------------
function stripJsonc(src) {
  // State-machine: walk chars, drop // and /* */ comments, preserve string bodies.
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '"') {
      out += c;
      i++;
      while (i < n) {
        const d = src[i];
        out += d;
        i++;
        if (d === '\\' && i < n) {
          out += src[i];
          i++;
        } else if (d === '"') break;
      }
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function readJsonWithComments(file) {
  return JSON.parse(stripJsonc(fs.readFileSync(file, 'utf8')));
}

function loadTsconfigChain(start) {
  const chain = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur) && fs.existsSync(cur)) {
    seen.add(cur);
    let cfg;
    try {
      cfg = readJsonWithComments(cur);
    } catch (e) {
      break;
    }
    chain.push({ file: cur, cfg });
    if (cfg.extends) {
      cur = path.resolve(path.dirname(cur), cfg.extends);
      if (!cur.endsWith('.json')) cur += '.json';
    } else {
      cur = null;
    }
  }
  return chain;
}

function buildAliasMap(tsconfigPath) {
  const chain = loadTsconfigChain(tsconfigPath);
  const aliases = {}; // pattern -> [absolute target paths]
  // Walk from base to derived so derived overrides win.
  for (const { file, cfg } of [...chain].reverse()) {
    const co = cfg.compilerOptions || {};
    const baseUrl = co.baseUrl ? path.resolve(path.dirname(file), co.baseUrl) : path.dirname(file);
    if (co.paths) {
      for (const [pattern, targets] of Object.entries(co.paths)) {
        aliases[pattern] = targets.map((t) => path.resolve(baseUrl, t));
      }
    }
  }
  return aliases;
}

const tsconfigPath = path.join(appAbs, 'tsconfig.json');
const aliases = buildAliasMap(tsconfigPath);

function resolveAlias(spec) {
  // Try longest pattern first.
  const patterns = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const pat of patterns) {
    if (pat.endsWith('/*')) {
      const prefix = pat.slice(0, -2);
      if (spec === prefix || spec.startsWith(prefix + '/')) {
        const rest = spec === prefix ? '' : spec.slice(prefix.length + 1);
        return aliases[pat].map((t) => path.join(t.replace(/\/\*$/, ''), rest));
      }
    } else if (spec === pat) {
      return aliases[pat];
    }
  }
  return null;
}

// --- Component key: first N segments under srcAbs --------------------------
function componentKey(absFile) {
  const rel = path.relative(srcAbs, absFile);
  if (rel.startsWith('..')) return null;
  const parts = rel.split(path.sep);
  if (parts.length === 1) return '<root>';
  const take = Math.min(args.depth, parts.length - 1);
  return parts.slice(0, take).join('/');
}

// --- Filesystem scan for .svelte + total file map --------------------------
const TS_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SVELTE_EXT = new Set(['.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'dist', 'build', '.turbo', '__mocks__']);

const componentStats = new Map(); // key -> { files: Set, svelte: Set, ts: Set }

function ensureStats(key) {
  if (!componentStats.has(key)) {
    componentStats.set(key, { files: new Set(), svelte: new Set(), ts: new Set() });
  }
  return componentStats.get(key);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const key = componentKey(abs);
      if (!key) continue;
      if (TS_EXT.has(ext)) {
        ensureStats(key).ts.add(abs);
        ensureStats(key).files.add(abs);
      } else if (SVELTE_EXT.has(ext)) {
        ensureStats(key).svelte.add(abs);
        ensureStats(key).files.add(abs);
      }
    }
  }
}
walk(srcAbs);

// --- ts-morph: parse TS/JS, resolve imports --------------------------------
const project = new Project({
  tsConfigFilePath: tsconfigPath,
  skipAddingFilesFromTsConfig: false,
  skipLoadingLibFiles: true,
  compilerOptions: { allowJs: true, checkJs: false, noEmit: true }
});

// Ensure every .ts/.js under src is in the project (tsconfig include may miss some).
for (const stats of componentStats.values()) {
  for (const f of stats.ts) {
    if (!project.getSourceFile(f)) {
      try {
        project.addSourceFileAtPath(f);
      } catch {
        /* ignore unreadable */
      }
    }
  }
}

// Build a path->key lookup for fast resolution.
const fileToKey = new Map();
for (const [key, stats] of componentStats.entries()) {
  for (const f of stats.files) fileToKey.set(f, key);
}

function tryResolveCandidate(candidate) {
  // Already a file?
  if (fileToKey.has(candidate)) return candidate;
  // Try extensions.
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.svelte']) {
    const withExt = candidate + ext;
    if (fileToKey.has(withExt)) return withExt;
  }
  // Try index.
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
    const withIdx = path.join(candidate, 'index' + ext);
    if (fileToKey.has(withIdx)) return withIdx;
  }
  return null;
}

function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('node:') || /^[a-z@]/i.test(spec) === false) {
    // fall through; might be relative
  }
  if (spec.startsWith('.')) {
    const candidate = path.resolve(path.dirname(fromFile), spec);
    return tryResolveCandidate(candidate);
  }
  const aliasTargets = resolveAlias(spec);
  if (aliasTargets) {
    for (const t of aliasTargets) {
      const hit = tryResolveCandidate(t);
      if (hit) return hit;
    }
  }
  return null; // external / unresolved
}

// Aggregate relationships: from-key -> to-key -> { count, samples: Set<spec> }
const rels = new Map();
function bumpRel(fromKey, toKey, spec) {
  if (!rels.has(fromKey)) rels.set(fromKey, new Map());
  const inner = rels.get(fromKey);
  if (!inner.has(toKey)) inner.set(toKey, { count: 0, samples: new Set() });
  const slot = inner.get(toKey);
  slot.count++;
  if (slot.samples.size < 3) slot.samples.add(spec);
}

for (const sf of project.getSourceFiles()) {
  const fp = sf.getFilePath();
  if (!fp.startsWith(srcAbs + path.sep)) continue;
  const fromKey = fileToKey.get(fp);
  if (!fromKey) continue;
  const imports = [
    ...sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue()),
    ...sf.getExportDeclarations().map((d) => d.getModuleSpecifierValue()).filter(Boolean)
  ];
  // Dynamic imports: ts-morph exposes them via CallExpression
  for (const call of sf.getDescendantsOfKind(/* SyntaxKind.CallExpression */ 213)) {
    const expr = call.getExpression();
    if (expr && expr.getText() === 'import') {
      const arg = call.getArguments()[0];
      if (arg && arg.getKindName && arg.getKindName() === 'StringLiteral') {
        imports.push(arg.getLiteralValue());
      }
    }
  }
  for (const spec of imports) {
    if (!spec) continue;
    const target = resolveImport(fp, spec);
    if (!target) continue;
    const toKey = fileToKey.get(target);
    if (!toKey || toKey === fromKey) continue;
    bumpRel(fromKey, toKey, spec);
  }
}

// --- Build output ---------------------------------------------------------
const components = [...componentStats.entries()]
  .map(([key, s]) => ({
    key,
    path: path.posix.join('src', key),
    fileCount: s.files.size,
    tsFileCount: s.ts.size,
    svelteCount: s.svelte.size
  }))
  .sort((a, b) => b.fileCount - a.fileCount);

const relationships = [];
for (const [from, inner] of rels.entries()) {
  for (const [to, slot] of inner.entries()) {
    relationships.push({
      from,
      to,
      count: slot.count,
      samples: [...slot.samples]
    });
  }
}
relationships.sort((a, b) => b.count - a.count);

const warnings = [];
for (const c of components) {
  if (c.fileCount > 50) {
    warnings.push(
      `Component '${c.key}' has ${c.fileCount} files (>50). Re-run with deeper --depth or split this group manually.`
    );
  }
}
if (components.length > 20) {
  warnings.push(
    `Extracted ${components.length} components — likely too granular for a single Level 3 diagram. Aim for 5-15; reduce --depth or merge leaves.`
  );
}

const result = {
  app: args.name,
  appPath: args.app,
  rootDir: 'src',
  depth: args.depth,
  aliases: Object.fromEntries(
    Object.entries(aliases).map(([k, v]) => [k, v.map((p) => path.relative(repoRoot, p))])
  ),
  components,
  relationships,
  warnings
};

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, JSON.stringify(result, null, 2));

console.error(
  `[c4-model] ${args.name}: ${components.length} components, ${relationships.length} relationships, ${warnings.length} warnings → ${args.out}`
);
for (const w of warnings) console.error('  ! ' + w);
