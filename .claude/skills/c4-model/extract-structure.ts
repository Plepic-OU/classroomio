#!/usr/bin/env npx tsx
/**
 * AST-based component extractor for C4 Layer 3 diagrams.
 *
 * Uses ts-morph to parse TypeScript files, groups them by directory into
 * "components", and maps cross-directory imports as relationships.
 * Handles .svelte files by counting them per directory (ts-morph can't parse Svelte).
 *
 * Usage: npx tsx .claude/skills/c4-model/extract-structure.ts
 * Output: docs/c4/extracted-structure.json
 */

import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface AppConfig {
  name: string;
  rootDir: string; // absolute path to the app
  srcDir: string; // relative to rootDir
  tsconfigPath: string; // relative to rootDir
  componentDepth: number; // directory levels for component grouping
  fileGlobs: string[];
  excludeDirs?: string[]; // directory names to skip entirely
}

const ROOT = path.resolve(__dirname, "../../.."); // monorepo root

const APPS: AppConfig[] = [
  {
    name: "dashboard",
    rootDir: path.join(ROOT, "apps/dashboard"),
    srcDir: "src",
    tsconfigPath: "tsconfig.json",
    componentDepth: 4, // e.g. lib/utils/services/courses, lib/components/Course/Content
    fileGlobs: ["src/**/*.ts", "src/**/*.js", "!src/**/*.d.ts", "!src/**/*.test.ts", "!src/**/*.spec.ts"],
    excludeDirs: ["__mocks__", "mocks", ".svelte-kit", "node_modules"],
  },
  {
    name: "api",
    rootDir: path.join(ROOT, "apps/api"),
    srcDir: "src",
    tsconfigPath: "tsconfig.json",
    componentDepth: 2, // e.g. routes/course, utils/redis
    fileGlobs: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/*.test.ts", "!src/**/*.spec.ts"],
    excludeDirs: ["node_modules"],
  },
];

// ---------------------------------------------------------------------------
// Path alias resolution
// ---------------------------------------------------------------------------

interface PathAliases {
  [alias: string]: string; // alias pattern -> resolved base path
}

function loadPathAliases(appConfig: AppConfig): PathAliases {
  const tsconfigFullPath = path.join(appConfig.rootDir, appConfig.tsconfigPath);
  const aliases: PathAliases = {};

  if (!fs.existsSync(tsconfigFullPath)) return aliases;

  // tsconfig files use JSONC (with comments) — strip comments while preserving strings
  const raw = fs.readFileSync(tsconfigFullPath, "utf-8");
  const stripped = raw.replace(
    /"(?:[^"\\]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//gm,
    (match) => (match.startsWith('"') ? match : match.startsWith("//") ? "" : ""),
  );
  const tsconfig = JSON.parse(stripped);
  const paths = tsconfig?.compilerOptions?.paths;
  if (!paths) return aliases;

  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    // Strip trailing /* from pattern and target
    const cleanPattern = pattern.replace(/\/\*$/, "");
    const cleanTarget = (targets[0] as string).replace(/\/\*$/, "");
    aliases[cleanPattern] = path.resolve(appConfig.rootDir, cleanTarget);
  }

  return aliases;
}

function resolveModuleSpecifier(
  specifier: string,
  sourceFilePath: string,
  aliases: PathAliases,
  appConfig: AppConfig,
): string | null {
  // Skip node_modules / external packages
  if (!specifier.startsWith(".") && !specifier.startsWith("$") && !specifier.startsWith("@cio/")) {
    return null; // external dependency
  }

  // Try path aliases first
  for (const [alias, resolvedBase] of Object.entries(aliases)) {
    if (specifier === alias || specifier.startsWith(alias + "/")) {
      const rest = specifier.slice(alias.length);
      return path.join(resolvedBase, rest);
    }
  }

  // Relative import
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(sourceFilePath), specifier);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component key derivation
// ---------------------------------------------------------------------------

function isExcludedPath(filePath: string, appConfig: AppConfig): boolean {
  if (!appConfig.excludeDirs || appConfig.excludeDirs.length === 0) return false;
  const srcRoot = path.join(appConfig.rootDir, appConfig.srcDir);
  const relative = path.relative(srcRoot, filePath);
  const parts = relative.split(path.sep);
  return parts.some((p) => appConfig.excludeDirs!.includes(p));
}

function getComponentKey(filePath: string, appConfig: AppConfig, depth: number): string {
  const srcRoot = path.join(appConfig.rootDir, appConfig.srcDir);
  const relative = path.relative(srcRoot, filePath);
  const parts = relative.split(path.sep);

  // Use up to `depth` directory levels (exclude filename)
  const dirParts = parts.slice(0, -1);
  const keyParts = dirParts.slice(0, depth);

  if (keyParts.length === 0) return "(root)";
  return keyParts.join("/");
}

// ---------------------------------------------------------------------------
// Svelte file counting
// ---------------------------------------------------------------------------

function countSvelteFiles(appConfig: AppConfig, depth: number): Map<string, number> {
  const counts = new Map<string, number>();
  const srcRoot = path.join(appConfig.rootDir, appConfig.srcDir);

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (appConfig.excludeDirs?.includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.name.endsWith(".svelte")) {
        const key = getComponentKey(fullPath, appConfig, depth);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  walk(srcRoot);
  return counts;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

interface ComponentInfo {
  key: string;
  tsFileCount: number;
  svelteFileCount: number;
  totalFiles: number;
  sampleFiles: string[]; // up to 5 representative files
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppExtraction {
  app: string;
  componentDepth: number;
  components: ComponentInfo[];
  relationships: Relationship[];
}

function extractApp(appConfig: AppConfig): AppExtraction {
  const aliases = loadPathAliases(appConfig);
  const srcRoot = path.join(appConfig.rootDir, appConfig.srcDir);

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(appConfig.rootDir, appConfig.tsconfigPath),
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files
  const globs = appConfig.fileGlobs.map((g) =>
    g.startsWith("!") ? "!" + path.join(appConfig.rootDir, g.slice(1)) : path.join(appConfig.rootDir, g),
  );
  project.addSourceFilesAtPaths(globs);

  const sourceFiles = project.getSourceFiles();

  // Group files by component key
  const componentFiles = new Map<string, string[]>();
  const depth = appConfig.componentDepth;

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    // Only include files under srcDir, skip excluded dirs
    if (!filePath.startsWith(srcRoot)) continue;
    if (isExcludedPath(filePath, appConfig)) continue;
    const key = getComponentKey(filePath, appConfig, depth);
    if (!componentFiles.has(key)) componentFiles.set(key, []);
    componentFiles.get(key)!.push(path.relative(appConfig.rootDir, filePath));
  }

  // Count Svelte files per component
  const svelteCounts = countSvelteFiles(appConfig, depth);

  // Build component info
  const components: ComponentInfo[] = [];
  const allKeys = new Set([...componentFiles.keys(), ...svelteCounts.keys()]);

  for (const key of allKeys) {
    const tsFiles = componentFiles.get(key) || [];
    const svelteCount = svelteCounts.get(key) || 0;
    components.push({
      key,
      tsFileCount: tsFiles.length,
      svelteFileCount: svelteCount,
      totalFiles: tsFiles.length + svelteCount,
      sampleFiles: tsFiles.slice(0, 5),
    });
  }

  // Validate depth — warn if any component has >50 files
  for (const comp of components) {
    if (comp.totalFiles > 50) {
      console.warn(
        `⚠ Component "${comp.key}" in ${appConfig.name} has ${comp.totalFiles} files. ` +
          `Consider increasing componentDepth (currently ${depth}).`,
      );
    }
  }

  // Extract relationships (cross-component imports)
  const relMap = new Map<string, number>(); // "from->to" => count

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (!filePath.startsWith(srcRoot)) continue;
    if (isExcludedPath(filePath, appConfig)) continue;

    const fromKey = getComponentKey(filePath, appConfig, depth);

    for (const imp of sf.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      const resolved = resolveModuleSpecifier(specifier, filePath, aliases, appConfig);
      if (!resolved) continue;

      // Determine the target component key
      const resolvedInSrc = resolved.startsWith(srcRoot);
      if (!resolvedInSrc) continue;

      const toKey = getComponentKey(resolved, appConfig, depth);
      if (toKey === fromKey) continue; // skip intra-component imports

      const relKey = `${fromKey}->${toKey}`;
      relMap.set(relKey, (relMap.get(relKey) || 0) + 1);
    }
  }

  // Filter relationships: only include those with >2 imports (significant)
  const relationships: Relationship[] = [];
  for (const [relKey, count] of relMap) {
    if (count < 2) continue;
    const [from, to] = relKey.split("->");
    relationships.push({ from, to, importCount: count });
  }

  // Sort relationships by import count descending
  relationships.sort((a, b) => b.importCount - a.importCount);

  // Sort components by total files descending
  components.sort((a, b) => b.totalFiles - a.totalFiles);

  return {
    app: appConfig.name,
    componentDepth: depth,
    components,
    relationships,
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  const results: AppExtraction[] = [];

  for (const appConfig of APPS) {
    console.log(`\nExtracting ${appConfig.name}...`);
    const extraction = extractApp(appConfig);
    console.log(
      `  ${extraction.components.length} components, ${extraction.relationships.length} relationships`,
    );
    results.push(extraction);
  }

  const outDir = path.join(ROOT, "docs/c4");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "extracted-structure.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nOutput written to ${outPath}`);
}

main();
