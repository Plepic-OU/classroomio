#!/usr/bin/env npx tsx
/**
 * C4 Layer 3 — AST-based component extraction for ClassroomIO.
 *
 * Uses ts-morph to parse .ts/.js files, groups them by directory into
 * "components", and maps cross-directory imports as relationships.
 * Svelte files are counted per directory for metadata (ts-morph can't parse them).
 *
 * Output: docs/c4/components.json  (git-ignored)
 *
 * Usage:
 *   npx tsx .claude/skills/c4-model/extract-components.ts
 *
 * Environment variables (optional):
 *   DASHBOARD_DEPTH  — directory depth for dashboard components (default: 4)
 *   API_DEPTH        — directory depth for API components (default: 2)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Project } from "ts-morph";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");

interface AppConfig {
  name: string;
  srcDir: string;
  tsconfigPath: string;
  /** How many directory segments (relative to srcDir) form a component key */
  depth: number;
  /** Path aliases from tsconfig.json paths field */
  aliases: Record<string, string>;
}

// Strip JSON-with-comments (JSONC) for tsconfig parsing.
// Handles block comments, line comments, and avoids stripping inside strings.
function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    // String literal
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\") j++; // skip escaped char
        j++;
      }
      result += text.slice(i, j + 1);
      i = j + 1;
    }
    // Block comment
    else if (text[i] === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    }
    // Line comment
    else if (text[i] === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    }
    else {
      result += text[i];
      i++;
    }
  }
  return result;
}

function readAliases(tsconfigPath: string): Record<string, string> {
  const raw = JSON.parse(stripJsonComments(fs.readFileSync(tsconfigPath, "utf-8")));
  const paths: Record<string, string[]> = raw?.compilerOptions?.paths ?? {};
  const baseUrl = raw?.compilerOptions?.baseUrl ?? ".";
  const tsDir = path.dirname(tsconfigPath);
  const aliases: Record<string, string> = {};

  for (const [alias, targets] of Object.entries(paths)) {
    // Take first target; strip trailing /*
    const target = targets[0].replace(/\/\*$/, "");
    const cleanAlias = alias.replace(/\/\*$/, "");
    aliases[cleanAlias] = path.resolve(tsDir, baseUrl, target);
  }
  return aliases;
}

function buildAppConfigs(): AppConfig[] {
  const dashboardTsconfig = path.join(ROOT, "apps/dashboard/tsconfig.json");
  const apiTsconfig = path.join(ROOT, "apps/api/tsconfig.json");

  return [
    {
      name: "dashboard",
      srcDir: path.join(ROOT, "apps/dashboard/src"),
      tsconfigPath: dashboardTsconfig,
      depth: parseInt(process.env.DASHBOARD_DEPTH ?? "4", 10),
      aliases: readAliases(dashboardTsconfig),
    },
    {
      name: "api",
      srcDir: path.join(ROOT, "apps/api/src"),
      tsconfigPath: apiTsconfig,
      depth: parseInt(process.env.API_DEPTH ?? "2", 10),
      aliases: readAliases(apiTsconfig),
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a relative path to `depth` directory segments. */
function componentKey(relPath: string, depth: number): string {
  const parts = relPath.split("/").filter(Boolean);
  // Take directory segments only (drop the filename)
  const dirs = parts.slice(0, -1);
  return dirs.slice(0, depth).join("/") || "(root)";
}

/** Resolve a module specifier to an absolute path using alias map. */
function resolveAlias(
  specifier: string,
  aliases: Record<string, string>
): string | null {
  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier === alias) return target;
    if (specifier.startsWith(alias + "/")) {
      return path.join(target, specifier.slice(alias.length + 1));
    }
  }
  return null;
}

/** Count .svelte files per directory under srcDir, grouped by component depth. */
function countSvelteFiles(
  srcDir: string,
  depth: number
): Record<string, number> {
  const counts: Record<string, number> = {};

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".svelte-kit") continue;
        walk(full);
      } else if (entry.name.endsWith(".svelte")) {
        const rel = path.relative(srcDir, full);
        const key = componentKey(rel, depth);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  walk(srcDir);
  return counts;
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

interface ComponentInfo {
  key: string;
  tsFiles: number;
  svelteFiles: number;
  /** Unique component keys this component imports from */
  dependsOn: string[];
}

interface AppOutput {
  app: string;
  depth: number;
  components: ComponentInfo[];
  warnings: string[];
}

function extractApp(config: AppConfig): AppOutput {
  const { name, srcDir, depth, aliases } = config;
  const warnings: string[] = [];

  // Create ts-morph project — skip type checking for speed
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
      target: 99, // ESNext
      module: 99,
      moduleResolution: 100, // Bundler
      baseUrl: path.dirname(config.tsconfigPath),
      paths: Object.fromEntries(
        Object.entries(aliases).map(([k, v]) => [k + "/*", [v + "/*"]])
      ),
    },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  project.addSourceFilesAtPaths([
    path.join(srcDir, "**/*.ts"),
    path.join(srcDir, "**/*.js"),
    "!" + path.join(srcDir, "**/*.d.ts"),
    "!" + path.join(srcDir, "**/node_modules/**"),
    "!" + path.join(srcDir, "**/.svelte-kit/**"),
  ]);

  // Map: component key -> set of imported component keys
  const compFiles: Record<string, number> = {};
  const compDeps: Record<string, Set<string>> = {};

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const rel = path.relative(srcDir, filePath);
    if (rel.startsWith("..")) continue; // outside src

    const key = componentKey(rel, depth);
    compFiles[key] = (compFiles[key] ?? 0) + 1;
    if (!compDeps[key]) compDeps[key] = new Set();

    for (const imp of sourceFile.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();

      // Try alias resolution first
      let resolvedAbs = resolveAlias(specifier, aliases);

      if (!resolvedAbs) {
        // Relative import
        if (specifier.startsWith(".")) {
          resolvedAbs = path.resolve(path.dirname(filePath), specifier);
        } else {
          // External package — skip
          continue;
        }
      }

      // Check if resolved path is within srcDir
      const resolvedRel = path.relative(srcDir, resolvedAbs);
      if (resolvedRel.startsWith("..")) continue;

      const targetKey = componentKey(resolvedRel + "/index.ts", depth);
      if (targetKey !== key) {
        compDeps[key].add(targetKey);
      }
    }
  }

  // Merge svelte counts
  const svelteCounts = countSvelteFiles(srcDir, depth);

  // Build component list
  const allKeys = new Set([...Object.keys(compFiles), ...Object.keys(svelteCounts)]);
  const components: ComponentInfo[] = [];

  for (const key of [...allKeys].sort()) {
    const tsFiles = compFiles[key] ?? 0;
    const svelteFiles = svelteCounts[key] ?? 0;
    const total = tsFiles + svelteFiles;

    if (total > 50) {
      warnings.push(
        `Component "${key}" in ${name} has ${total} files — consider increasing depth`
      );
    }

    components.push({
      key,
      tsFiles,
      svelteFiles,
      dependsOn: [...(compDeps[key] ?? [])].sort(),
    });
  }

  return { app: name, depth, components, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const configs = buildAppConfigs();
  const results: AppOutput[] = [];

  for (const config of configs) {
    console.error(`Extracting ${config.name} (depth=${config.depth})...`);
    const output = extractApp(config);
    results.push(output);

    if (output.warnings.length > 0) {
      console.error(`  Warnings:`);
      for (const w of output.warnings) console.error(`    - ${w}`);
    }
    console.error(
      `  Found ${output.components.length} components, ` +
        `${output.components.reduce((s, c) => s + c.dependsOn.length, 0)} relationships`
    );
  }

  const outPath = path.join(ROOT, "docs/c4/components.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");
  console.error(`\nWritten to ${outPath}`);
}

main();
