#!/usr/bin/env npx tsx
/**
 * C4 Component Extractor for ClassroomIO
 *
 * Uses ts-morph to parse TypeScript/JavaScript source files,
 * aggregates by directory into components, and maps cross-directory
 * imports as relationships. Outputs structured JSON.
 *
 * Usage: npx tsx .claude/skills/c4/extract-components.ts [--depth-dashboard N] [--depth-api N]
 */

import { Project, SourceFile } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// --- Types ---

interface AppConfig {
  name: string;
  root: string;         // absolute path to app root
  srcDir: string;       // relative src directory
  tsconfig: string;     // path to tsconfig.json
  depth: number;        // directory depth for component grouping
  aliases: Record<string, string>; // path alias → resolved directory
}

interface ComponentInfo {
  key: string;
  directory: string;
  tsFiles: string[];
  jsFiles: string[];
  svelteFileCount: number;
  totalFiles: number;
  exports: string[];
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppResult {
  app: string;
  components: ComponentInfo[];
  relationships: Relationship[];
  warnings: string[];
}

// --- Configuration ---

const REPO_ROOT = path.resolve(__dirname, "../../..");

function parseArgs(): { depthDashboard: number; depthApi: number } {
  const args = process.argv.slice(2);
  let depthDashboard = 3;
  let depthApi = 2;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--depth-dashboard" && args[i + 1]) {
      depthDashboard = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--depth-api" && args[i + 1]) {
      depthApi = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { depthDashboard, depthApi };
}

function loadAliases(tsconfigPath: string, appRoot: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    // Strip line comments, then trailing commas for JSON parse
    // Note: avoid stripping /* inside strings (path aliases like "$src/*")
    // by only removing block comments that span lines or have whitespace after /*
    const cleaned = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*\s[\s\S]*?\*\//g, "")
      .replace(/,\s*([\]}])/g, "$1");
    const config = JSON.parse(cleaned);
    const paths = config?.compilerOptions?.paths;
    if (paths) {
      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          // Strip trailing /* from alias and target
          const cleanAlias = alias.replace(/\/\*$/, "");
          const cleanTarget = (targets[0] as string).replace(/\/\*$/, "");
          aliases[cleanAlias] = path.resolve(appRoot, cleanTarget);
        }
      }
    }
  } catch {
    // If tsconfig can't be parsed, continue without aliases
  }
  return aliases;
}

function getComponentKey(filePath: string, srcRoot: string, depth: number): string {
  const rel = path.relative(srcRoot, filePath);
  const parts = path.dirname(rel).split(path.sep).filter(p => p !== ".");
  return parts.slice(0, depth).join("/") || "(root)";
}

function resolveImportToComponentKey(
  importSpecifier: string,
  sourceFilePath: string,
  srcRoot: string,
  aliases: Record<string, string>,
  depth: number
): string | null {
  // Try alias resolution first
  for (const [alias, resolved] of Object.entries(aliases)) {
    if (importSpecifier === alias || importSpecifier.startsWith(alias + "/")) {
      const rest = importSpecifier.slice(alias.length);
      const fullPath = path.join(resolved, rest);
      if (fullPath.startsWith(srcRoot)) {
        return getComponentKey(fullPath, srcRoot, depth);
      }
      // If alias points outside src, skip
      return null;
    }
  }

  // Relative imports
  if (importSpecifier.startsWith(".")) {
    const dir = path.dirname(sourceFilePath);
    const resolved = path.resolve(dir, importSpecifier);
    if (resolved.startsWith(srcRoot)) {
      return getComponentKey(resolved, srcRoot, depth);
    }
  }

  // External package — skip
  return null;
}

function countSvelteFiles(directory: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        count += countSvelteFiles(fullPath);
      } else if (entry.name.endsWith(".svelte")) {
        count++;
      }
    }
  } catch {
    // Directory might not exist
  }
  return count;
}

function extractApp(config: AppConfig): AppResult {
  const warnings: string[] = [];
  const srcRoot = path.join(config.root, config.srcDir);

  // Initialize ts-morph project
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files (.ts and .js only — ts-morph can't parse .svelte)
  const tsFiles = project.addSourceFilesAtPaths(path.join(srcRoot, "**/*.ts"));
  const jsFiles = project.addSourceFilesAtPaths(path.join(srcRoot, "**/*.js"));
  const allFiles = [...tsFiles, ...jsFiles];

  // Group files into components by directory key
  const componentMap = new Map<string, {
    tsFiles: string[];
    jsFiles: string[];
    exports: Set<string>;
    directories: Set<string>;
  }>();

  for (const sourceFile of allFiles) {
    const filePath = sourceFile.getFilePath();
    const key = getComponentKey(filePath, srcRoot, config.depth);

    if (!componentMap.has(key)) {
      componentMap.set(key, {
        tsFiles: [],
        jsFiles: [],
        exports: new Set(),
        directories: new Set(),
      });
    }

    const comp = componentMap.get(key)!;
    const relPath = path.relative(srcRoot, filePath);

    if (filePath.endsWith(".ts")) {
      comp.tsFiles.push(relPath);
    } else {
      comp.jsFiles.push(relPath);
    }

    comp.directories.add(path.dirname(filePath));

    // Collect named exports
    try {
      for (const [name] of sourceFile.getExportedDeclarations()) {
        comp.exports.add(name);
      }
    } catch {
      // Some files may fail to parse exports
    }
  }

  // Count svelte files per component
  const components: ComponentInfo[] = [];
  for (const [key, data] of componentMap) {
    let svelteCount = 0;
    for (const dir of data.directories) {
      // Count svelte files only in directories that belong to this component
      const dirKey = getComponentKey(path.join(dir, "dummy.ts"), srcRoot, config.depth);
      if (dirKey === key) {
        // Count svelte files in this specific directory (not recursively into deeper components)
        try {
          const entries = fs.readdirSync(dir);
          svelteCount += entries.filter(e => e.endsWith(".svelte")).length;
        } catch { /* skip */ }
      }
    }

    const totalFiles = data.tsFiles.length + data.jsFiles.length + svelteCount;

    if (totalFiles > 50) {
      warnings.push(
        `Component "${key}" in ${config.name} has ${totalFiles} files. Consider increasing depth.`
      );
    }

    components.push({
      key,
      directory: key,
      tsFiles: data.tsFiles,
      jsFiles: data.jsFiles,
      svelteFileCount: svelteCount,
      totalFiles,
      exports: Array.from(data.exports).slice(0, 30), // cap for readability
    });
  }

  // Sort by key
  components.sort((a, b) => a.key.localeCompare(b.key));

  // Extract relationships (cross-component imports)
  const relMap = new Map<string, number>(); // "from->to" -> count

  for (const sourceFile of allFiles) {
    const filePath = sourceFile.getFilePath();
    const fromKey = getComponentKey(filePath, srcRoot, config.depth);

    try {
      const imports = sourceFile.getImportDeclarations();
      for (const imp of imports) {
        const specifier = imp.getModuleSpecifierValue();
        const toKey = resolveImportToComponentKey(
          specifier,
          filePath,
          srcRoot,
          config.aliases,
          config.depth
        );

        if (toKey && toKey !== fromKey) {
          const relKey = `${fromKey}->${toKey}`;
          relMap.set(relKey, (relMap.get(relKey) || 0) + 1);
        }
      }
    } catch {
      // Skip files with parse errors
    }
  }

  const relationships: Relationship[] = [];
  for (const [key, count] of relMap) {
    const [from, to] = key.split("->");
    relationships.push({ from, to, importCount: count });
  }

  // Sort by import count descending
  relationships.sort((a, b) => b.importCount - a.importCount);

  return {
    app: config.name,
    components,
    relationships,
    warnings,
  };
}

// --- Main ---

function main() {
  const { depthDashboard, depthApi } = parseArgs();

  const apps: AppConfig[] = [
    {
      name: "dashboard",
      root: path.join(REPO_ROOT, "apps/dashboard"),
      srcDir: "src",
      tsconfig: path.join(REPO_ROOT, "apps/dashboard/tsconfig.json"),
      depth: depthDashboard,
      aliases: loadAliases(
        path.join(REPO_ROOT, "apps/dashboard/tsconfig.json"),
        path.join(REPO_ROOT, "apps/dashboard")
      ),
    },
    {
      name: "api",
      root: path.join(REPO_ROOT, "apps/api"),
      srcDir: "src",
      tsconfig: path.join(REPO_ROOT, "apps/api/tsconfig.json"),
      depth: depthApi,
      aliases: loadAliases(
        path.join(REPO_ROOT, "apps/api/tsconfig.json"),
        path.join(REPO_ROOT, "apps/api")
      ),
    },
  ];

  const results: AppResult[] = [];

  for (const app of apps) {
    console.error(`Extracting components for ${app.name} (depth=${app.depth})...`);
    const result = extractApp(app);
    results.push(result);

    console.error(`  ${result.components.length} components, ${result.relationships.length} relationships`);
    for (const w of result.warnings) {
      console.error(`  WARNING: ${w}`);
    }
  }

  // Output JSON to stdout
  const output = {
    extractedAt: new Date().toISOString(),
    config: apps.map(a => ({ name: a.name, depth: a.depth, aliases: a.aliases })),
    results,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
