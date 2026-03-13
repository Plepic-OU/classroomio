/**
 * AST-based component extraction for C4 Layer 3 diagrams.
 *
 * Uses ts-morph to parse TypeScript/JavaScript files, groups them into
 * components by directory, and maps cross-component import relationships.
 *
 * Handles path alias resolution by reading tsconfig.json paths dynamically.
 * Handles .svelte files by counting them per directory (ts-morph can't parse them).
 *
 * Usage: npx tsx .claude/skills/c4-model/extract-components.ts
 */

import { Project, SourceFile } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// --- Configuration ---

interface AppConfig {
  name: string;
  /** Absolute path to app root */
  root: string;
  /** Absolute path to source directory */
  srcDir: string;
  /** File globs to include */
  globs: string[];
  /** Number of directory levels (relative to srcDir) that form a component key */
  componentDepth: number;
  /** Path aliases from tsconfig.json — populated dynamically */
  aliases: Record<string, string>;
}

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const APP_CONFIGS: AppConfig[] = [
  {
    name: "api",
    root: path.join(REPO_ROOT, "apps/api"),
    srcDir: path.join(REPO_ROOT, "apps/api/src"),
    globs: ["src/**/*.ts", "src/**/*.js"],
    componentDepth: 2,
    aliases: {},
  },
  {
    name: "dashboard",
    root: path.join(REPO_ROOT, "apps/dashboard"),
    srcDir: path.join(REPO_ROOT, "apps/dashboard/src"),
    globs: ["src/**/*.ts", "src/**/*.js"],
    componentDepth: 4,
    aliases: {},
  },
];

// --- Types ---

interface ComponentInfo {
  key: string;
  files: string[];
  svelteFileCount: number;
  totalFileCount: number;
  description: string;
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface ExtractionResult {
  app: string;
  extractedAt: string;
  componentDepth: number;
  components: ComponentInfo[];
  relationships: Relationship[];
}

// --- Alias Resolution ---

function loadAliases(appRoot: string): Record<string, string> {
  const tsconfigPath = path.join(appRoot, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return {};

  const raw = fs.readFileSync(tsconfigPath, "utf-8");

  let tsconfig: any;
  // Try parsing as-is first, then strip comments/trailing commas
  try {
    tsconfig = JSON.parse(raw);
  } catch {
    try {
      const stripped = raw
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,(\s*[}\]])/g, "$1");
      tsconfig = JSON.parse(stripped);
    } catch (e) {
      console.warn(`Warning: Could not parse ${tsconfigPath}:`, (e as Error).message);
      return {};
    }
  }

  const paths = tsconfig?.compilerOptions?.paths;
  if (!paths) return {};

  const baseUrl = tsconfig?.compilerOptions?.baseUrl || ".";
  const baseDir = path.resolve(appRoot, baseUrl);

  const aliases: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const target = targets[0] as string;

    // Strip trailing /* for wildcard aliases
    const cleanAlias = alias.replace(/\/\*$/, "");
    const cleanTarget = target.replace(/\/\*$/, "");

    aliases[cleanAlias] = path.resolve(baseDir, cleanTarget);
  }

  return aliases;
}

function resolveImportPath(
  specifier: string,
  aliases: Record<string, string>
): string | null {
  // Try exact match first, then prefix match
  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier === alias) {
      return target;
    }
    if (specifier.startsWith(alias + "/")) {
      return path.join(target, specifier.slice(alias.length + 1));
    }
  }
  return null;
}

// --- Component Key ---

function getComponentKey(
  filePath: string,
  srcDir: string,
  depth: number
): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);

  // Use directory parts up to `depth`, or fewer if file is shallower
  // For files at the root of srcDir, use the filename without extension
  const dirParts = parts.slice(0, -1); // remove filename
  if (dirParts.length === 0) {
    return path.parse(parts[0]).name; // root-level file
  }

  const keyParts = dirParts.slice(0, depth);
  return keyParts.join("/");
}

// --- Svelte File Counting ---

function countSvelteFiles(
  srcDir: string,
  depth: number
): Record<string, number> {
  const counts: Record<string, number> = {};

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".svelte")) {
        const key = getComponentKey(fullPath, srcDir, depth);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }

  walk(srcDir);
  return counts;
}

// --- Main Extraction ---

function extractApp(config: AppConfig): ExtractionResult {
  config.aliases = loadAliases(config.root);
  console.log(
    `[${config.name}] Loaded aliases:`,
    Object.keys(config.aliases).join(", ") || "(none)"
  );

  const project = new Project({
    tsConfigFilePath: path.join(config.root, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files
  for (const glob of config.globs) {
    project.addSourceFilesAtPaths(path.join(config.root, glob));
  }

  const sourceFiles = project.getSourceFiles();
  console.log(`[${config.name}] Parsed ${sourceFiles.length} TS/JS files`);

  // Count svelte files per component
  const svelteCounts = countSvelteFiles(config.srcDir, config.componentDepth);

  // Group files into components
  const componentFiles: Record<string, string[]> = {};

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    // Only include files under srcDir
    if (!filePath.startsWith(config.srcDir)) continue;

    const key = getComponentKey(filePath, config.srcDir, config.componentDepth);
    if (!componentFiles[key]) componentFiles[key] = [];
    componentFiles[key].push(path.relative(config.srcDir, filePath));
  }

  // Build component list
  const components: ComponentInfo[] = [];
  for (const [key, files] of Object.entries(componentFiles)) {
    const svelteCount = svelteCounts[key] || 0;
    const totalCount = files.length + svelteCount;

    let description = `${files.length} TS/JS files`;
    if (svelteCount > 0) {
      description += `, ${svelteCount} Svelte components`;
    }

    components.push({
      key,
      files,
      svelteFileCount: svelteCount,
      totalFileCount: totalCount,
      description,
    });
  }

  // Also add svelte-only directories as components
  for (const [key, count] of Object.entries(svelteCounts)) {
    if (!componentFiles[key]) {
      components.push({
        key,
        files: [],
        svelteFileCount: count,
        totalFileCount: count,
        description: `${count} Svelte components`,
      });
    }
  }

  // Validate depth
  const oversized = components.filter((c) => c.totalFileCount > 50);
  if (oversized.length > 0) {
    console.warn(
      `[${config.name}] WARNING: ${oversized.length} component(s) have >50 files. Consider increasing componentDepth (currently ${config.componentDepth}).`
    );
    for (const c of oversized) {
      console.warn(`  - "${c.key}": ${c.totalFileCount} files`);
    }
  }

  // Extract relationships (cross-component imports)
  const relMap: Record<string, number> = {};

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    if (!filePath.startsWith(config.srcDir)) continue;

    const fromKey = getComponentKey(
      filePath,
      config.srcDir,
      config.componentDepth
    );

    for (const imp of sf.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();

      let resolvedPath: string | null = null;

      // Try alias resolution
      resolvedPath = resolveImportPath(specifier, config.aliases);

      // Try ts-morph resolution
      if (!resolvedPath) {
        const resolvedSourceFile = imp.getModuleSpecifierSourceFile();
        if (resolvedSourceFile) {
          resolvedPath = resolvedSourceFile.getFilePath();
        }
      }

      if (!resolvedPath) continue;

      // Normalize to absolute path if not already
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(path.dirname(filePath), resolvedPath);
      }

      // Only track intra-app relationships
      if (!resolvedPath.startsWith(config.srcDir)) continue;

      // Resolve to a component key — we need to find the actual file
      // The resolvedPath might be a directory (for alias like $src → ./src)
      // Try adding common extensions
      let targetFile = resolvedPath;
      if (
        !fs.existsSync(targetFile) ||
        fs.statSync(targetFile).isDirectory()
      ) {
        const candidates = [
          resolvedPath + ".ts",
          resolvedPath + ".js",
          resolvedPath + "/index.ts",
          resolvedPath + "/index.js",
        ];
        targetFile =
          candidates.find((c) => fs.existsSync(c)) || resolvedPath;
      }

      const toKey = getComponentKey(
        targetFile,
        config.srcDir,
        config.componentDepth
      );

      if (fromKey === toKey) continue; // skip self-references

      const relKey = `${fromKey}|${toKey}`;
      relMap[relKey] = (relMap[relKey] || 0) + 1;
    }
  }

  const relationships: Relationship[] = Object.entries(relMap)
    .map(([key, count]) => {
      const [from, to] = key.split("|");
      return { from, to, importCount: count };
    })
    .sort((a, b) => b.importCount - a.importCount);

  return {
    app: config.name,
    extractedAt: new Date().toISOString(),
    componentDepth: config.componentDepth,
    components: components.sort((a, b) => a.key.localeCompare(b.key)),
    relationships,
  };
}

// --- Output ---

const outDir = path.join(REPO_ROOT, "docs/c4");
fs.mkdirSync(outDir, { recursive: true });

for (const config of APP_CONFIGS) {
  console.log(`\nExtracting ${config.name}...`);
  const result = extractApp(config);

  const outPath = path.join(outDir, `components-${config.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `[${config.name}] Output: ${outPath} (${result.components.length} components, ${result.relationships.length} relationships)`
  );
}

console.log("\nDone.");
