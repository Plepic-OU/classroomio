#!/usr/bin/env npx ts-node
/**
 * C4 AST Extractor for ClassroomIO
 * Uses ts-morph to extract component structure from apps/dashboard and apps/api.
 * Outputs structured JSON to docs/c4/components-<app>.json
 *
 * Usage:
 *   npx ts-node .claude/skills/c4-model/extract.ts
 *   npx ts-node .claude/skills/c4-model/extract.ts --depth-dashboard=2 --depth-api=1
 */

import { Project, SourceFile } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'docs/c4');

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    root: path.join(ROOT, 'apps/dashboard'),
    srcDir: 'src',
    tsconfig: 'tsconfig.json',
    depth: getArgInt('--depth-dashboard', 2),
  },
  {
    name: 'api',
    root: path.join(ROOT, 'apps/api'),
    srcDir: 'src',
    tsconfig: 'tsconfig.json',
    depth: getArgInt('--depth-api', 1),
  },
];

interface AppConfig {
  name: string;
  root: string;
  srcDir: string;
  tsconfig: string;
  depth: number;
}

interface Component {
  key: string;
  label: string;
  files: number;
  svelteFiles: number;
  relationships: Set<string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getArgInt(flag: string, defaultVal: number): number {
  const arg = process.argv.find(a => a.startsWith(flag + '='));
  return arg ? parseInt(arg.split('=')[1], 10) : defaultVal;
}

function componentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);
  return parts.slice(0, depth).join('/') || 'root';
}

function loadPathAliases(tsconfigPath: string, appRoot: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    // Strip comments for JSON parse
    const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(stripped);
    const paths = config?.compilerOptions?.paths ?? {};
    for (const [alias, targets] of Object.entries(paths)) {
      if (Array.isArray(targets) && targets.length > 0) {
        const cleanAlias = alias.replace('/*', '');
        const cleanTarget = path.resolve(appRoot, (targets[0] as string).replace('/*', ''));
        aliases[cleanAlias] = cleanTarget;
      }
    }
  } catch (e) {
    console.warn(`  Could not parse tsconfig at ${tsconfigPath}`);
  }
  return aliases;
}

function resolveImport(
  importPath: string,
  sourceFile: string,
  aliases: Record<string, string>,
  srcDir: string
): string | null {
  // Try alias resolution
  for (const [alias, target] of Object.entries(aliases)) {
    if (importPath === alias || importPath.startsWith(alias + '/')) {
      const rest = importPath.slice(alias.length).replace(/^\//, '');
      return path.join(target, rest);
    }
  }
  // Relative import
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(sourceFile), importPath);
  }
  return null;
}

// ── Count Svelte files per directory ─────────────────────────────────────────

function countSvelteFiles(dir: string): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(d: string) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.svelte')) {
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
    }
  }
  walk(dir);
  return counts;
}

// ── Extract ───────────────────────────────────────────────────────────────────

function extractApp(app: AppConfig): void {
  console.log(`\nExtracting ${app.name} (depth=${app.depth})...`);

  const tsconfigPath = path.join(app.root, app.tsconfig);
  const srcDir = path.join(app.root, app.srcDir);
  const aliases = loadPathAliases(tsconfigPath, app.root);

  console.log(`  Aliases: ${JSON.stringify(aliases)}`);

  // Use ts-morph Project — add only .ts/.js files (not .svelte)
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  // Glob TS/JS files manually
  const extensions = ['.ts', '.js', '.tsx', '.jsx'];
  function addFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.svelte-kit') {
        addFiles(full);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        project.addSourceFileAtPath(full);
      }
    }
  }
  addFiles(srcDir);

  const sourceFiles = project.getSourceFiles();
  console.log(`  Found ${sourceFiles.length} TS/JS files`);

  const svelteCounts = countSvelteFiles(srcDir);
  const components = new Map<string, Component>();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const key = componentKey(filePath, srcDir, app.depth);

    if (!components.has(key)) {
      // Count svelte files in the same directory prefix
      let svelteCount = 0;
      const compDir = path.join(srcDir, key);
      for (const [dir, count] of svelteCounts.entries()) {
        if (dir.startsWith(compDir)) svelteCount += count;
      }
      components.set(key, {
        key,
        label: key.split('/').pop() ?? key,
        files: 0,
        svelteFiles: svelteCount,
        relationships: new Set(),
      });
    }

    const comp = components.get(key)!;
    comp.files++;

    // Extract imports
    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const resolved = resolveImport(moduleSpecifier, filePath, aliases, srcDir);
      if (!resolved) continue;

      // Check if resolved is inside srcDir
      if (!resolved.startsWith(srcDir)) continue;

      const targetKey = componentKey(resolved, srcDir, app.depth);
      if (targetKey !== key) {
        comp.relationships.add(targetKey);
      }
    }
  }

  // Validate depth
  let maxFiles = 0;
  for (const comp of components.values()) {
    if (comp.files > maxFiles) maxFiles = comp.files;
  }
  if (maxFiles > 50) {
    console.warn(
      `  ⚠️  WARNING: Component with ${maxFiles} files found. Consider increasing depth (current: ${app.depth})`
    );
  }

  // Serialize
  const output = {
    app: app.name,
    depth: app.depth,
    extractedAt: new Date().toISOString(),
    componentCount: components.size,
    components: Array.from(components.values()).map(c => ({
      key: c.key,
      label: c.label,
      files: c.files,
      svelteFiles: c.svelteFiles,
      relationships: Array.from(c.relationships),
    })),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `components-${app.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  ✅ Written to ${outPath} (${components.size} components)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

for (const app of APPS) {
  extractApp(app);
}

console.log('\nDone! Run the /c4-model skill in Claude to generate diagrams from the JSON.');
