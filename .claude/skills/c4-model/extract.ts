#!/usr/bin/env tsx
/**
 * C4 Model AST Extractor
 *
 * Parses apps/dashboard and apps/api source files using ts-morph,
 * groups files into components by directory depth, and maps
 * cross-component import relationships.
 *
 * Output: docs/c4/components.json
 */

import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Strip single-line (//) and block (/* */) comments without touching string values.
function stripJsonComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      // Copy the entire JSON string literal verbatim (handles \" escapes)
      out += src[i++];
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i++];
          if (i < src.length) out += src[i++];
        } else if (src[i] === '"') {
          out += src[i++];
          break;
        } else {
          out += src[i++];
        }
      }
    } else if (src[i] === "/" && src[i + 1] === "/") {
      // Line comment — skip to end of line
      while (i < src.length && src[i] !== "\n") i++;
    } else if (src[i] === "/" && src[i + 1] === "*") {
      // Block comment — skip to closing */
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += src[i++];
    }
  }
  return out;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "docs/c4");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "components.json");

interface AppConfig {
  name: string;
  /** Absolute path to the app root (where tsconfig.json lives) */
  appDir: string;
  /** Absolute path to the source directory to analyse */
  srcDir: string;
  /**
   * How many directory levels (from srcDir) form a "component key".
   * dashboard=3 gives lib/components/AI, lib/utils/services, routes/org/[slug]
   * api=2 gives routes/course, services/course, utils/auth
   */
  depth: number;
  tsconfig: string;
}

const APPS: AppConfig[] = [
  {
    name: "dashboard",
    appDir: path.join(REPO_ROOT, "apps/dashboard"),
    srcDir: path.join(REPO_ROOT, "apps/dashboard/src"),
    depth: 3,
    tsconfig: path.join(REPO_ROOT, "apps/dashboard/tsconfig.json"),
  },
  {
    name: "api",
    appDir: path.join(REPO_ROOT, "apps/api"),
    srcDir: path.join(REPO_ROOT, "apps/api/src"),
    depth: 2,
    tsconfig: path.join(REPO_ROOT, "apps/api/tsconfig.json"),
  },
];

interface ComponentInfo {
  key: string;
  label: string;
  /** Relative paths from srcDir */
  files: string[];
  /** Number of .svelte files in the component directory tree */
  svelteCount: number;
  /** Component keys this component imports from (within same app) */
  relationships: string[];
}

interface AppExtraction {
  name: string;
  depth: number;
  components: Record<string, ComponentInfo>;
}

// ─── Alias resolution ────────────────────────────────────────────────────────

/**
 * Reads tsconfig.json (and any extended config) to build a map of
 * alias prefix → absolute resolved path.
 * e.g. "$lib" → "/workspaces/classroomio/apps/dashboard/src/lib"
 */
function readPathAliases(
  tsconfigPath: string,
  appDir: string,
  visited = new Set<string>()
): Record<string, string> {
  if (visited.has(tsconfigPath) || !fs.existsSync(tsconfigPath)) return {};
  visited.add(tsconfigPath);

  const aliases: Record<string, string> = {};

  let tsconfig: any;
  try {
    tsconfig = JSON.parse(stripJsonComments(fs.readFileSync(tsconfigPath, "utf-8")));
  } catch (e) {
    console.warn(`  Could not parse ${tsconfigPath}: ${e}`);
    return aliases;
  }

  const paths: Record<string, string[]> = tsconfig.compilerOptions?.paths ?? {};
  const rawBaseUrl: string = tsconfig.compilerOptions?.baseUrl ?? ".";
  const baseUrl = path.resolve(path.dirname(tsconfigPath), rawBaseUrl);

  for (const [alias, targets] of Object.entries(paths)) {
    const target = targets[0];
    // Strip trailing /* for prefix matching
    const aliasPrefix = alias.replace(/\/\*$/, "");
    const targetAbs = path.resolve(baseUrl, target.replace(/\/\*$/, ""));
    aliases[aliasPrefix] = targetAbs;
  }

  // Merge parent config, but do not override explicit aliases
  if (tsconfig.extends) {
    const extPath = path.resolve(path.dirname(tsconfigPath), tsconfig.extends);
    const parentAliases = readPathAliases(extPath, appDir, visited);
    for (const [k, v] of Object.entries(parentAliases)) {
      if (!(k in aliases)) aliases[k] = v;
    }
  }

  return aliases;
}

/**
 * Attempts to resolve an aliased import specifier to an absolute path.
 * Returns null if the specifier does not match any known alias.
 */
function resolveAlias(
  moduleSpecifier: string,
  aliases: Record<string, string>
): string | null {
  for (const [prefix, target] of Object.entries(aliases)) {
    if (moduleSpecifier === prefix) return target;
    if (moduleSpecifier.startsWith(prefix + "/")) {
      return target + moduleSpecifier.slice(prefix.length);
    }
  }
  return null;
}

// ─── Component key helpers ────────────────────────────────────────────────────

/**
 * Derives the component key for a file by taking `depth` path segments
 * relative to srcDir.  Falls back to the single top-level segment when
 * the file is shallower than `depth`.
 */
function getComponentKey(
  absoluteFilePath: string,
  srcDir: string,
  depth: number
): string {
  const rel = path.relative(srcDir, absoluteFilePath);
  const parts = rel.split(path.sep);
  return parts.slice(0, Math.min(depth, parts.length - 1) || 1).join("/");
}

function componentLabel(key: string): string {
  const last = key.split("/").pop() ?? key;
  return last
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── .svelte file counting ───────────────────────────────────────────────────

function countSvelteFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        count += countSvelteFiles(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".svelte")) {
        count++;
      }
    }
  } catch {}
  return count;
}

// ─── Main extraction ──────────────────────────────────────────────────────────

function extractApp(app: AppConfig): AppExtraction {
  console.log(`\nExtracting ${app.name} (depth=${app.depth})...`);

  const aliases = readPathAliases(app.tsconfig, app.appDir);
  console.log(`  Aliases: ${JSON.stringify(aliases, null, 2)}`);

  const project = new Project({
    // Don't load all files from tsconfig — we control what we add
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
    },
  });

  // Add TS/JS source files, excluding build artefacts, type stubs, tests, and data mocks
  project.addSourceFilesAtPaths([
    path.join(app.srcDir, "**/*.ts"),
    path.join(app.srcDir, "**/*.js"),
    `!${path.join(app.srcDir, "**/*.d.ts")}`,
    `!${path.join(app.srcDir, "**/*.test.ts")}`,
    `!${path.join(app.srcDir, "**/*.spec.ts")}`,
    `!${path.join(app.srcDir, "**/__mocks__/**")}`,
    `!${path.join(app.srcDir, "**/mocks/**")}`,   // code-snippet data mocks
    `!${path.join(app.appDir, ".svelte-kit/**")}`,
    `!${path.join(app.appDir, "dist/**")}`,
    `!${path.join(app.appDir, "node_modules/**")}`,
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`  Parsed ${sourceFiles.length} TS/JS source files`);

  const components: Record<string, ComponentInfo> = {};

  // ── Pass 1: assign files to component buckets ──────────────────────────────
  for (const sf of sourceFiles) {
    const fp = sf.getFilePath() as string;
    if (!fp.startsWith(app.srcDir)) continue;

    const key = getComponentKey(fp, app.srcDir, app.depth);
    if (!components[key]) {
      components[key] = {
        key,
        label: componentLabel(key),
        files: [],
        svelteCount: 0,
        relationships: [],
      };
    }
    components[key].files.push(path.relative(app.srcDir, fp));
  }

  // ── Count .svelte files per component directory ───────────────────────────
  for (const key of Object.keys(components)) {
    const dirPath = path.join(app.srcDir, ...key.split("/"));
    components[key].svelteCount = countSvelteFiles(dirPath);
  }

  // ── Pass 2: resolve imports → relationships ───────────────────────────────
  const relSets: Record<string, Set<string>> = {};
  for (const key of Object.keys(components)) relSets[key] = new Set();

  for (const sf of sourceFiles) {
    const fp = sf.getFilePath() as string;
    if (!fp.startsWith(app.srcDir)) continue;

    const srcKey = getComponentKey(fp, app.srcDir, app.depth);
    const fileDir = path.dirname(fp);

    for (const importDecl of sf.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      let resolved: string | null = null;

      if (specifier.startsWith(".")) {
        resolved = path.resolve(fileDir, specifier);
      } else {
        resolved = resolveAlias(specifier, aliases);
      }

      if (!resolved) continue;
      if (!resolved.startsWith(app.srcDir)) continue;

      const targetKey = getComponentKey(resolved, app.srcDir, app.depth);
      if (targetKey !== srcKey && components[targetKey]) {
        relSets[srcKey].add(targetKey);
      }
    }
  }

  for (const [key, rels] of Object.entries(relSets)) {
    if (components[key]) {
      components[key].relationships = Array.from(rels).sort();
    }
  }

  // ── Depth validation ──────────────────────────────────────────────────────
  // Use only TS/JS file count for depth warnings — svelteCount is recursive
  // metadata and would give false positives for shallow catch-all keys.
  let warnCount = 0;
  for (const [key, comp] of Object.entries(components)) {
    if (comp.files.length > 50) {
      console.warn(
        `  ⚠ Component '${key}' has ${comp.files.length} TS/JS files — consider increasing depth above ${app.depth}`
      );
      warnCount++;
    }
  }
  if (warnCount === 0) console.log(`  ✓ Depth validation passed`);

  console.log(`  → ${Object.keys(components).length} components extracted`);
  return { name: app.name, depth: app.depth, components };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const result: Record<string, AppExtraction> = {};
for (const app of APPS) {
  result[app.name] = extractApp(app);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(`\n✓ Output written to ${OUTPUT_FILE}`);
