#!/usr/bin/env npx tsx
/**
 * AST-based component extractor for C4 Layer 3 diagrams.
 * Uses ts-morph to parse TypeScript source files, groups them by directory into components,
 * and maps cross-directory imports as relationships.
 *
 * Usage: npx tsx .claude/skills/c4-model/extract-components.ts [--depth-api N] [--depth-dashboard N]
 */

import { Project, SourceFile, SyntaxKind } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");

// --- Config ---

interface AppConfig {
  name: string;
  rootDir: string;
  tsconfigPath: string;
  depth: number; // directory levels for component key
  includeSvelte: boolean;
}

function parseArgs(): { depthApi: number; depthDashboard: number } {
  const args = process.argv.slice(2);
  let depthApi = 3;
  let depthDashboard = 3;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--depth-api" && args[i + 1]) depthApi = parseInt(args[i + 1]);
    if (args[i] === "--depth-dashboard" && args[i + 1]) depthDashboard = parseInt(args[i + 1]);
  }
  return { depthApi, depthDashboard };
}

// --- Path alias resolution ---

interface AliasMapping {
  prefix: string; // e.g. "$lib"
  paths: string[]; // resolved absolute paths
}

function stripJsonComments(text: string): string {
  // Remove single-line comments (// ...) and multi-line comments (/* ... */)
  // Be careful not to strip inside strings
  let result = "";
  let i = 0;
  let inString = false;
  let stringChar = "";
  while (i < text.length) {
    if (inString) {
      if (text[i] === "\\" && i + 1 < text.length) {
        result += text[i] + text[i + 1];
        i += 2;
        continue;
      }
      if (text[i] === stringChar) inString = false;
      result += text[i];
      i++;
    } else {
      if (text[i] === '"' || text[i] === "'") {
        inString = true;
        stringChar = text[i];
        result += text[i];
        i++;
      } else if (text[i] === "/" && text[i + 1] === "/") {
        // Skip to end of line
        while (i < text.length && text[i] !== "\n") i++;
      } else if (text[i] === "/" && text[i + 1] === "*") {
        i += 2;
        while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
        i += 2; // skip */
      } else {
        result += text[i];
        i++;
      }
    }
  }
  return result;
}

function loadAliases(tsconfigPath: string): AliasMapping[] {
  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  const tsconfig = JSON.parse(stripJsonComments(raw));
  const paths = tsconfig?.compilerOptions?.paths;
  if (!paths) return [];

  const baseUrl = tsconfig?.compilerOptions?.baseUrl || ".";
  const tsconfigDir = path.dirname(tsconfigPath);
  const base = path.resolve(tsconfigDir, baseUrl);

  const aliases: AliasMapping[] = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    // Skip wildcard variants — we handle them via prefix matching
    if (pattern.endsWith("/*")) continue;
    const resolvedPaths = (targets as string[]).map((t) => path.resolve(base, t));
    aliases.push({ prefix: pattern, paths: resolvedPaths });
  }
  return aliases;
}

function resolveImportPath(
  importPath: string,
  sourceFilePath: string,
  aliases: AliasMapping[],
  appRoot: string
): string | null {
  // Try alias resolution
  for (const alias of aliases) {
    if (importPath === alias.prefix || importPath.startsWith(alias.prefix + "/")) {
      const remainder = importPath.slice(alias.prefix.length);
      return path.join(alias.paths[0], remainder);
    }
  }

  // Relative imports
  if (importPath.startsWith(".")) {
    return path.resolve(path.dirname(sourceFilePath), importPath);
  }

  // External package — skip
  return null;
}

// --- Component key computation ---

function getComponentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);
  // Use up to `depth` directory levels (exclude filename)
  const dirParts = parts.slice(0, -1);
  const key = dirParts.slice(0, depth).join("/");
  return key || "(root)";
}

// --- Svelte file counting ---

function countSvelteFiles(srcDir: string): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.name.endsWith(".svelte")) {
        const rel = path.relative(srcDir, path.dirname(full));
        counts.set(rel, (counts.get(rel) || 0) + 1);
      }
    }
  }
  walk(srcDir);
  return counts;
}

// --- Extract from a single app ---

interface ComponentInfo {
  key: string;
  files: string[];
  svelteCount: number;
  exports: string[];
  imports: Set<string>; // component keys this depends on
  externalDeps: Set<string>; // npm packages imported
  technology: string;
}

interface AppResult {
  app: string;
  srcDir: string;
  components: Record<string, ComponentInfo>;
  relationships: Array<{ from: string; to: string; label: string }>;
}

function extractApp(config: AppConfig): AppResult {
  const srcDir = path.join(config.rootDir, "src");
  const aliases = loadAliases(config.tsconfigPath);

  const project = new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
      target: 99, // ESNext
      module: 99,
      moduleResolution: 100, // Bundler
    },
    skipAddingFilesFromTsConfig: true,
  });

  // Add all .ts and .js files under src/
  const tsFiles: string[] = [];
  function findTsFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".svelte-kit") {
        findTsFiles(full);
      } else if (/\.(ts|js|mts|mjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        tsFiles.push(full);
      }
    }
  }
  findTsFiles(srcDir);
  project.addSourceFilesAtPaths(tsFiles);

  // Count svelte files per directory
  const svelteCounts = config.includeSvelte ? countSvelteFiles(srcDir) : new Map<string, number>();

  // Build components
  const components: Record<string, ComponentInfo> = {};

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const key = getComponentKey(filePath, srcDir, config.depth);

    if (!components[key]) {
      components[key] = {
        key,
        files: [],
        svelteCount: 0,
        exports: [],
        imports: new Set(),
        externalDeps: new Set(),
        technology: "",
      };
    }

    const comp = components[key];
    comp.files.push(path.relative(srcDir, filePath));

    // Collect named exports
    for (const exp of sourceFile.getExportedDeclarations()) {
      comp.exports.push(exp[0]);
    }

    // Collect imports and map to component keys
    const importDecls = [
      ...sourceFile.getImportDeclarations(),
    ];

    for (const imp of importDecls) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const resolved = resolveImportPath(moduleSpecifier, filePath, aliases, config.rootDir);

      if (resolved) {
        // Find which component this resolves to
        const targetKey = getComponentKey(resolved, srcDir, config.depth);
        if (targetKey !== key) {
          comp.imports.add(targetKey);
        }
      } else if (!moduleSpecifier.startsWith(".")) {
        // External package
        const pkgName = moduleSpecifier.startsWith("@")
          ? moduleSpecifier.split("/").slice(0, 2).join("/")
          : moduleSpecifier.split("/")[0];
        comp.externalDeps.add(pkgName);
      }
    }
  }

  // Add svelte counts to components
  for (const [relDir, count] of svelteCounts) {
    // Find which component key this directory falls under
    const parts = relDir.split(path.sep);
    const key = parts.slice(0, config.depth).join("/") || "(root)";
    if (!components[key]) {
      components[key] = {
        key,
        files: [],
        svelteCount: 0,
        exports: [],
        imports: new Set(),
        externalDeps: new Set(),
        technology: "",
      };
    }
    components[key].svelteCount += count;
  }

  // Infer technology per component
  for (const comp of Object.values(components)) {
    if (comp.svelteCount > 0) {
      comp.technology = "Svelte";
    } else if (comp.externalDeps.has("hono") || comp.externalDeps.has("@hono/node-server")) {
      comp.technology = "Hono";
    } else if (comp.externalDeps.has("@supabase/supabase-js")) {
      comp.technology = "Supabase Client";
    } else {
      comp.technology = "TypeScript";
    }
  }

  // Build relationships (only between components that both exist)
  const relationships: Array<{ from: string; to: string; label: string }> = [];
  for (const comp of Object.values(components)) {
    for (const targetKey of comp.imports) {
      if (components[targetKey]) {
        relationships.push({
          from: comp.key,
          to: targetKey,
          label: "imports",
        });
      }
    }
  }

  return { app: config.name, srcDir, components, relationships };
}

// --- Validation ---

function validate(result: AppResult, depth: number): string[] {
  const warnings: string[] = [];
  for (const comp of Object.values(result.components)) {
    const totalFiles = comp.files.length + comp.svelteCount;
    if (totalFiles > 50) {
      warnings.push(
        `WARNING: Component "${comp.key}" in ${result.app} has ${totalFiles} files. ` +
          `Consider increasing --depth-${result.app.toLowerCase()} beyond ${depth}.`
      );
    }
  }
  return warnings;
}

// --- Serialization ---

function serializeResult(result: AppResult): object {
  const components: Record<string, object> = {};
  for (const [key, comp] of Object.entries(result.components)) {
    components[key] = {
      key: comp.key,
      tsFileCount: comp.files.length,
      svelteFileCount: comp.svelteCount,
      totalFiles: comp.files.length + comp.svelteCount,
      exports: [...new Set(comp.exports)].sort().slice(0, 30), // cap for readability
      exportCount: new Set(comp.exports).size,
      technology: comp.technology,
      externalDeps: [...comp.externalDeps].sort(),
      dependsOn: [...comp.imports].sort(),
    };
  }

  return {
    app: result.app,
    componentCount: Object.keys(components).length,
    components,
    relationships: result.relationships.map((r) => ({
      from: r.from,
      to: r.to,
      label: r.label,
    })),
  };
}

// --- Main ---

const { depthApi, depthDashboard } = parseArgs();

const apps: AppConfig[] = [
  {
    name: "API",
    rootDir: path.join(ROOT, "apps/api"),
    tsconfigPath: path.join(ROOT, "apps/api/tsconfig.json"),
    depth: depthApi,
    includeSvelte: false,
  },
  {
    name: "Dashboard",
    rootDir: path.join(ROOT, "apps/dashboard"),
    tsconfigPath: path.join(ROOT, "apps/dashboard/tsconfig.json"),
    depth: depthDashboard,
    includeSvelte: true,
  },
];

const output: Record<string, object> = {};
const allWarnings: string[] = [];

for (const app of apps) {
  const result = extractApp(app);
  const warnings = validate(result, app.depth);
  allWarnings.push(...warnings);
  output[app.name] = serializeResult(result);
}

if (allWarnings.length > 0) {
  console.error("\n" + allWarnings.join("\n") + "\n");
}

const outPath = path.join(ROOT, "docs/c4/components.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}`);
console.log(
  `API: ${Object.keys((output.API as any).components).length} components, ` +
    `Dashboard: ${Object.keys((output.Dashboard as any).components).length} components`
);
