#!/usr/bin/env node
/**
 * C4 Component Extractor for ClassroomIO
 *
 * Extracts component structure from TypeScript/Svelte source files using ts-morph.
 * Aggregates files by directory into C4 components and maps cross-directory
 * imports as relationships. Outputs structured JSON to docs/c4/.
 *
 * Usage:
 *   npx tsx .claude/skills/c4-model/extract.ts
 *
 * Requires ts-morph and tsx (install once):
 *   pnpm add -w -D ts-morph tsx
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/c4');

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppConfig {
  /** Identifier used in output filenames */
  name: string;
  /** Path to app root relative to REPO_ROOT */
  root: string;
  /**
   * How many directory levels from src/ form a component key.
   * e.g. depth 2 → src/routes/courses/file.ts → key "routes/courses"
   */
  defaultDepth: number;
  /**
   * Override depth for specific src-relative directory prefixes.
   * Longest prefix wins. Useful for deep component trees.
   * e.g. { "lib/components": 3 } → src/lib/components/Course/x.ts → "lib/components/Course"
   */
  pathDepthOverrides: Record<string, number>;
}

interface Component {
  key: string;
  label: string;
  tsFiles: number;
  svelteFiles: number;
  /** Component keys this component imports from (internal deps only) */
  relations: string[];
}

interface AppModel {
  app: string;
  components: Record<string, Component>;
  warnings: string[];
}

// ── App configuration ─────────────────────────────────────────────────────────

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    root: 'apps/dashboard',
    defaultDepth: 2,
    // lib/components has 30+ top-level components — use depth 3 so each gets its own key
    pathDepthOverrides: { 'lib/components': 3 },
  },
  {
    name: 'api',
    root: 'apps/api',
    defaultDepth: 2,
    pathDepthOverrides: {},
  },
];

// ── Path alias loading ────────────────────────────────────────────────────────

/**
 * Reads tsconfig.json paths and returns a map of alias-prefix → target-prefix.
 * e.g. "$lib/*" and "$lib" both become "$lib/" → "src/lib/"
 */
function loadAliases(appRoot: string): Record<string, string> {
  const tsconfigPath = path.join(appRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return {};

  const raw = fs.readFileSync(tsconfigPath, 'utf-8');
  // Strip JS-style comments (tsconfig allows them)
  const stripped = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(stripped);
  } catch {
    console.warn(`[warn] Failed to parse ${tsconfigPath}`);
    return {};
  }

  const pathsObj = (json.compilerOptions as Record<string, unknown>)?.paths as
    | Record<string, string[]>
    | undefined ?? {};

  const aliases: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(pathsObj)) {
    // Normalise both "$lib" and "$lib/*" to prefix "$lib/"
    const cleanAlias = alias.endsWith('/*')
      ? alias.slice(0, -1)          // "$lib/*" → "$lib/"
      : alias.endsWith('/')
        ? alias
        : alias + '/';             // "$lib"  → "$lib/"
    // Normalise target: strip leading "./" and trailing "/*"
    const target = targets[0].replace(/\/\*$/, '/').replace(/^\.\//, '');
    aliases[cleanAlias] = target;
  }
  return aliases;
}

// ── Import resolution ─────────────────────────────────────────────────────────

function resolveImport(
  importPath: string,
  fromFile: string,
  appRoot: string,
  aliases: Record<string, string>,
): string | null {
  // Check if any alias prefix matches (longest first)
  const matchedAlias = Object.keys(aliases)
    .sort((a, b) => b.length - a.length)
    .find(a => importPath.startsWith(a) || importPath + '/' === a);

  let resolved: string;

  if (matchedAlias) {
    const rest = importPath.startsWith(matchedAlias)
      ? importPath.slice(matchedAlias.length)
      : '';
    resolved = path.join(appRoot, aliases[matchedAlias], rest);
  } else if (importPath.startsWith('.')) {
    resolved = path.resolve(path.dirname(fromFile), importPath);
  } else {
    // External package — skip
    return null;
  }

  // Try common extensions / index files
  for (const ext of ['', '.ts', '.js', '.tsx', '/index.ts', '/index.js']) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  return resolved; // best-guess even if file not found (svelte co-location etc.)
}

// ── Component key calculation ─────────────────────────────────────────────────

function getComponentKey(
  filePath: string,
  srcDir: string,
  config: AppConfig,
): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  const dirs = parts.slice(0, -1); // drop filename

  if (dirs.length === 0) return 'src-root';

  const dirKey = dirs.join('/');

  // Find longest matching override prefix
  const overrideEntry = Object.entries(config.pathDepthOverrides)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => dirKey === prefix || dirKey.startsWith(prefix + '/'));

  const depth = overrideEntry ? overrideEntry[1] : config.defaultDepth;
  return dirs.slice(0, depth).join('/');
}

// ── Svelte file counting ──────────────────────────────────────────────────────

/**
 * ts-morph cannot parse .svelte files. This function walks the src directory,
 * finds all .svelte files, and counts them per component key.
 */
function countSvelteByComponent(
  srcDir: string,
  config: AppConfig,
): Record<string, number> {
  const counts: Record<string, number> = {};

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.svelte')) {
        const key = getComponentKey(full, srcDir, config);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  walk(srcDir);
  return counts;
}

// ── Main extraction ───────────────────────────────────────────────────────────

function extractApp(config: AppConfig): AppModel {
  const appRoot = path.join(REPO_ROOT, config.root);
  const srcDir = path.join(appRoot, 'src');
  const aliases = loadAliases(appRoot);

  console.log(`\n[${config.name}] Root:    ${appRoot}`);
  console.log(`[${config.name}] Aliases: ${JSON.stringify(aliases)}`);

  if (!fs.existsSync(srcDir)) {
    console.warn(`[${config.name}] src/ not found — skipping`);
    return { app: config.name, components: {}, warnings: ['src/ directory not found'] };
  }

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    `${srcDir}/**/*.ts`,
    `${srcDir}/**/*.js`,
    `!${srcDir}/**/*.d.ts`,
    `!${srcDir}/**/*.test.ts`,
    `!${srcDir}/**/*.spec.ts`,
    `!${srcDir}/**/__mocks__/**`,
    `!${srcDir}/**/node_modules/**`,
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`[${config.name}] TS/JS files: ${sourceFiles.length}`);

  const components: Record<string, Component> = {};

  function getOrCreate(key: string): Component {
    if (!components[key]) {
      const label = key.split('/').pop() ?? key;
      components[key] = { key, label, tsFiles: 0, svelteFiles: 0, relations: [] };
    }
    return components[key];
  }

  // Pass 1 — count TS/JS files per component key
  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (!filePath.startsWith(srcDir)) continue;
    getOrCreate(getComponentKey(filePath, srcDir, config)).tsFiles++;
  }

  // Pass 2 — count Svelte files per component key
  const svelteCounts = countSvelteByComponent(srcDir, config);
  for (const [key, count] of Object.entries(svelteCounts)) {
    getOrCreate(key).svelteFiles = count;
  }

  // Pass 3 — extract import relationships
  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (!filePath.startsWith(srcDir)) continue;
    const fromKey = getComponentKey(filePath, srcDir, config);

    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpec = importDecl.getModuleSpecifierValue();
      const resolved = resolveImport(moduleSpec, filePath, appRoot, aliases);
      if (!resolved || !resolved.startsWith(srcDir)) continue;

      const toKey = getComponentKey(resolved, srcDir, config);
      if (toKey !== fromKey) {
        const comp = getOrCreate(fromKey);
        if (!comp.relations.includes(toKey)) {
          comp.relations.push(toKey);
        }
      }
    }
  }

  // Validate depth — warn if any component has too many files
  const warnings: string[] = [];
  for (const comp of Object.values(components)) {
    const total = comp.tsFiles + comp.svelteFiles;
    if (total > 50) {
      warnings.push(
        `"${comp.key}" has ${total} files — increase depth or add a pathDepthOverride`,
      );
    }
  }

  if (warnings.length) {
    console.warn(`\n[${config.name}] DEPTH WARNINGS:`);
    warnings.forEach(w => console.warn('  ⚠', w));
  }

  console.log(`[${config.name}] Components found: ${Object.keys(components).length}`);
  return { app: config.name, components, warnings };
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const appConfig of APPS) {
    const model = extractApp(appConfig);
    const outPath = path.join(OUTPUT_DIR, `components-${model.app}.json`);
    fs.writeFileSync(outPath, JSON.stringify(model, null, 2));
    console.log(`\n[${model.app}] Written → ${outPath}`);
  }

  console.log('\nDone. Now run the /c4-model skill to generate diagrams from the JSON.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
