/**
 * C4 AST extractor — uses ts-morph to build component/relationship JSON.
 *
 * Usage: node extract.mjs [--app api|dashboard]
 *
 * Outputs: docs/c4/extracted-{app}.json  (gitignored)
 */

import { Project } from 'ts-morph';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const OUTPUT_DIR = join(REPO_ROOT, 'docs/c4');

// ---------------------------------------------------------------------------
// App configurations
// ---------------------------------------------------------------------------

const APP_CONFIGS = {
  api: {
    name: 'api',
    appDir: join(REPO_ROOT, 'apps/api'),
    srcSubdir: 'src',
    depth: 2,
    stripDynamic: false,
    excludeDirs: [],
    mergeRules: [],
  },
  dashboard: {
    name: 'dashboard',
    appDir: join(REPO_ROOT, 'apps/dashboard'),
    srcSubdir: 'src',
    depth: 3,
    stripDynamic: true, // strip SvelteKit [param] segments
    // Exclude test/mock artefacts — not architectural
    excludeDirs: ['__mocks__', 'lib/mocks'],
    // Collapse high-cardinality subtrees for diagram readability
    mergeRules: [
      { prefix: 'lib/components/', into: 'lib/components' }, // 30+ UI component dirs → 1 node
      { prefix: 'routes/api/', into: 'routes/api' },         // many API handler dirs → 1 node
      { prefix: 'routes/lms/', into: 'routes/lms' },         // LMS sub-pages → 1 node
      { prefix: 'routes/invite', into: 'routes/invite' },    // invite sub-pages → 1 node
    ],
  },
};

// Map well-known package names to external system identifiers
const KNOWN_EXTERNAL_SYSTEMS = {
  '@supabase/supabase-js': 'supabase',
  '@supabase/ssr': 'supabase',
  redis: 'redis',
  ioredis: 'redis',
  '@aws-sdk/client-s3': 's3',
  '@aws-sdk/s3-request-presigner': 's3',
  nodemailer: 'smtp',
  '@sentry/node': 'sentry',
  '@sentry/sveltekit': 'sentry',
  openai: 'openai',
  puppeteer: 'puppeteer',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all files matching ext list under dir. */
function collectFiles(dir, exts, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        collectFiles(full, exts, results);
      } else if (exts.includes(extname(entry).toLowerCase())) {
        results.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return results;
}

/** Parse JSONC (JSON with comments) — handles // line comments and block comments. */
function parseJsonWithComments(text) {
  let out = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        out += ch + text[i + 1];
        i += 2;
      } else if (ch === '"') {
        inString = false;
        out += ch;
        i++;
      } else {
        out += ch;
        i++;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
      i++;
    } else if (ch === '/' && text[i + 1] === '/') {
      // Line comment — skip to EOL
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '/' && text[i + 1] === '*') {
      // Block comment — skip to */
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
    } else {
      out += ch;
      i++;
    }
  }
  return JSON.parse(out);
}

/**
 * Compute component key for an absolute file path.
 * Key = first `depth` directory segments relative to srcDir, joined by '/'.
 * Files directly in srcDir get key '_root'.
 * Dynamic SvelteKit segments ([param]) are filtered when stripDynamic=true.
 */
function componentKey(filePath, srcAbsDir, depth, stripDynamic) {
  const rel = relative(srcAbsDir, filePath); // e.g. "routes/course/course.ts"
  const parts = rel.split('/');
  const dirs = parts.slice(0, -1); // drop filename
  if (dirs.length === 0) return '_root';

  let segments = dirs.slice(0, depth);
  if (stripDynamic) {
    segments = segments.filter((s) => !s.startsWith('['));
  }
  return segments.join('/') || '_root';
}

/**
 * Apply merge rules: if a key starts with a rule's prefix, return rule.into instead.
 */
function applyMerge(key, mergeRules) {
  for (const rule of mergeRules) {
    if (key.startsWith(rule.prefix)) return rule.into;
  }
  return key;
}

/**
 * Read tsconfig.json (non-extended, but handles JS comments) and extract paths.
 * Returns Map<aliasPrefix, resolvedBaseDir> e.g. '$lib' → '/abs/path/to/src/lib'
 */
function readAliases(tsconfigPath, appAbsDir) {
  const aliases = new Map();
  try {
    const raw = parseJsonWithComments(readFileSync(tsconfigPath, 'utf8'));
    const paths = raw.compilerOptions?.paths ?? {};
    for (const [alias, targets] of Object.entries(paths)) {
      const aliasBase = alias.replace(/\/\*$/, '');
      const targetBase = (targets[0] ?? '').replace(/\/\*$/, '');
      const resolved = resolve(appAbsDir, targetBase);
      aliases.set(aliasBase, resolved);
    }
    // Also try the extended tsconfig for additional aliases
    const extendedPath = raw.extends;
    if (extendedPath) {
      const extAbs = resolve(appAbsDir, extendedPath);
      if (existsSync(extAbs)) {
        try {
          const extRaw = parseJsonWithComments(readFileSync(extAbs, 'utf8'));
          const extPaths = extRaw.compilerOptions?.paths ?? {};
          for (const [alias, targets] of Object.entries(extPaths)) {
            const aliasBase = alias.replace(/\/\*$/, '');
            if (!aliases.has(aliasBase)) {
              const targetBase = (targets[0] ?? '').replace(/\/\*$/, '');
              // Extended tsconfig paths are relative to the extended file's location
              const resolved = resolve(dirname(extAbs), targetBase);
              aliases.set(aliasBase, resolved);
            }
          }
        } catch {
          // ignore parse errors in extended config
        }
      }
    }
  } catch (e) {
    console.warn(`  Could not read aliases from ${tsconfigPath}: ${e.message}`);
  }
  return aliases;
}

/**
 * Resolve an import specifier to an absolute path, or null if unresolvable.
 */
function resolveImport(spec, importingFile, aliases, srcAbsDir) {
  // External package (no leading . or /)
  if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('$')) {
    const pkg = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
    return { type: 'external', pkg };
  }

  let basePath;

  if (spec.startsWith('.')) {
    basePath = resolve(dirname(importingFile), spec);
  } else if (spec.startsWith('$')) {
    let matched = false;
    for (const [aliasBase, targetDir] of aliases) {
      if (spec === aliasBase || spec.startsWith(aliasBase + '/')) {
        const rest = spec.slice(aliasBase.length);
        basePath = resolve(targetDir, rest.startsWith('/') ? rest.slice(1) : rest);
        matched = true;
        break;
      }
    }
    if (!matched) return null; // unknown alias ($app/*, $env/*)
  } else {
    return null;
  }

  // Must be within srcAbsDir to count as internal
  if (!basePath.startsWith(srcAbsDir)) return null;

  // Try extension variants
  for (const candidate of [
    basePath,
    basePath + '.ts',
    basePath + '.js',
    basePath + '.mts',
    join(basePath, 'index.ts'),
    join(basePath, 'index.js'),
  ]) {
    if (existsSync(candidate)) return { type: 'internal', path: candidate };
  }

  // Treat as internal even if file not found (may be generated/conditional)
  return { type: 'internal', path: basePath };
}

/** Humanise a component key into a readable label. */
function keyToLabel(key) {
  if (key === '_root') return 'Root';
  return key
    .split('/')
    .map((s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' / ');
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

async function extractApp(cfg) {
  const { name, appDir, srcSubdir, depth, stripDynamic, mergeRules, excludeDirs = [] } = cfg;
  const srcAbsDir = join(appDir, srcSubdir);
  const tsconfigPath = join(appDir, 'tsconfig.json');

  console.log(`\n[${name}] Extracting from ${srcAbsDir}`);

  const aliases = readAliases(tsconfigPath, appDir);
  console.log(`[${name}] Resolved ${aliases.size} path aliases: ${[...aliases.keys()].join(', ')}`);

  /** Returns true if a file path (relative to srcAbsDir) should be excluded. */
  const isExcluded = (absPath) => {
    const rel = relative(srcAbsDir, absPath).replace(/\\/g, '/');
    return excludeDirs.some((d) => rel.startsWith(d + '/') || rel === d);
  };

  // Collect TS/JS source files under srcAbsDir only
  const allTs = collectFiles(srcAbsDir, ['.ts', '.mts', '.cts', '.js', '.mjs'])
    .filter((f) => !f.includes('/node_modules/') && !f.includes('/dist/') && !f.endsWith('.d.ts'))
    .filter((f) => !isExcluded(f));

  // Count .svelte files per component key
  const allSvelte = collectFiles(srcAbsDir, ['.svelte'])
    .filter((f) => !f.includes('/node_modules/'))
    .filter((f) => !isExcluded(f));
  const sveltePerKey = {};
  for (const sf of allSvelte) {
    const rawKey = componentKey(sf, srcAbsDir, depth, stripDynamic);
    const key = applyMerge(rawKey, mergeRules);
    sveltePerKey[key] = (sveltePerKey[key] ?? 0) + 1;
  }

  // ts-morph project — suppress errors from .svelte imports and generated files
  const project = new Project({
    tsConfigFilePath: existsSync(tsconfigPath) ? tsconfigPath : undefined,
    addFilesFromTsConfig: false,
    skipFileDependencyResolution: true,
    compilerOptions: {
      skipLibCheck: true,
      noEmitOnError: false,
      allowJs: true,
      checkJs: false,
    },
  });

  for (const f of allTs) {
    try {
      project.addSourceFileAtPath(f);
    } catch {
      // skip unreadable
    }
  }

  const components = {}; // key → { key, label, files[], svelteCount, externalImports{} }
  const relMap = {};     // `from→to` → count

  // Only process files within srcAbsDir (filter out .svelte-kit/ etc.)
  const srcFiles = project.getSourceFiles()
    .filter((sf) => sf.getFilePath().startsWith(srcAbsDir + '/'));

  for (const sf of srcFiles) {
    const filePath = sf.getFilePath();
    const rawKey = componentKey(filePath, srcAbsDir, depth, stripDynamic);
    const key = applyMerge(rawKey, mergeRules);

    if (!components[key]) {
      components[key] = {
        key,
        label: keyToLabel(key),
        files: [],
        svelteCount: sveltePerKey[key] ?? 0,
        externalImports: {},
      };
    }
    components[key].files.push(relative(appDir, filePath));

    // Gather import specifiers (static imports + re-exports)
    const importSpecs = [
      ...sf.getImportDeclarations().map((d) => d.getModuleSpecifierValue()),
      ...sf.getExportDeclarations()
          .map((d) => d.getModuleSpecifierValue())
          .filter(Boolean),
    ];

    for (const spec of importSpecs) {
      const resolved = resolveImport(spec, filePath, aliases, srcAbsDir);
      if (!resolved) continue;

      if (resolved.type === 'external') {
        const sysId = KNOWN_EXTERNAL_SYSTEMS[resolved.pkg];
        if (sysId) {
          components[key].externalImports[sysId] = (components[key].externalImports[sysId] ?? 0) + 1;
        }
      } else {
        const rawTargetKey = componentKey(resolved.path, srcAbsDir, depth, stripDynamic);
        const targetKey = applyMerge(rawTargetKey, mergeRules);
        if (targetKey !== key) {
          const edge = `${key}→${targetKey}`;
          relMap[edge] = (relMap[edge] ?? 0) + 1;
        }
      }
    }
  }

  // Fill in svelte-only keys that had no TS counterpart
  for (const [key, count] of Object.entries(sveltePerKey)) {
    if (!components[key]) {
      components[key] = { key, label: keyToLabel(key), files: [], svelteCount: count, externalImports: {} };
    } else {
      // Ensure svelteCount is up to date after merging
      components[key].svelteCount = Math.max(components[key].svelteCount, count);
    }
  }

  const relationships = Object.entries(relMap).map(([edge, count]) => {
    const [from, to] = edge.split('→');
    return { from, to, count };
  });

  // Validation
  const warnings = [];
  for (const comp of Object.values(components)) {
    const total = comp.files.length + comp.svelteCount;
    if (total > 50) {
      warnings.push(
        `Component '${comp.key}' has ${total} files — consider a merge rule or increasing depth (currently ${depth})`
      );
    }
  }
  if (warnings.length > 0) {
    console.warn(`[${name}] WARNINGS:`);
    warnings.forEach((w) => console.warn('  ⚠', w));
  }

  const result = {
    app: name,
    extractedAt: new Date().toISOString(),
    config: { depth, stripDynamic, excludeDirs, mergeRules },
    stats: {
      tsFiles: allTs.length,
      svelteFiles: allSvelte.length,
      components: Object.keys(components).length,
      relationships: relationships.length,
    },
    warnings,
    components,
    relationships,
  };

  const outPath = join(OUTPUT_DIR, `extracted-${name}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`[${name}] Wrote ${outPath}`);
  console.log(`[${name}] Components: ${result.stats.components}, Relationships: ${result.stats.relationships}`);

  return result;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const appFilter = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;

const appsToRun = appFilter
  ? [APP_CONFIGS[appFilter]].filter(Boolean)
  : Object.values(APP_CONFIGS);

if (appsToRun.length === 0) {
  console.error(`Unknown app '${appFilter}'. Valid: ${Object.keys(APP_CONFIGS).join(', ')}`);
  process.exit(1);
}

for (const cfg of appsToRun) {
  await extractApp(cfg);
}

console.log('\nExtraction complete.');
