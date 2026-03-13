#!/usr/bin/env node
/**
 * C4 Component Extractor
 *
 * Extracts component structure from apps/dashboard and apps/api using ts-morph.
 * Aggregates TS/JS source files by directory into components and maps
 * cross-directory imports as relationships. Outputs structured JSON.
 *
 * Usage (from monorepo root):
 *   node .claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
 *
 * Options:
 *   --repo-root=<path>        Monorepo root (default: cwd)
 *   --output-dir=<path>       JSON output dir (default: docs/c4)
 *   --dashboard-depth=<n>     Component key depth for dashboard (default: 4)
 *   --api-depth=<n>           Component key depth for api (default: 3)
 */

import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? "true";
}

const REPO_ROOT = path.resolve(args["repo-root"] ?? process.cwd());
const OUTPUT_DIR = path.resolve(
  args["output-dir"] ?? path.join(REPO_ROOT, "docs/c4")
);
const DASHBOARD_DEPTH = parseInt(args["dashboard-depth"] ?? "4", 10);
const API_DEPTH = parseInt(args["api-depth"] ?? "3", 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ComponentInfo {
  /** Path segments relative to app root, joined by "/", up to `depth` levels */
  key: string;
  /** Human-readable label (last key segment, capitalized) */
  label: string;
  /** TS/JS files relative to app root */
  files: string[];
  /** .svelte files in the same directory tree (ts-morph can't parse these) */
  svelteFileCount: number;
}

interface Relationship {
  from: string;
  to: string;
  /** Number of distinct import statements between these two components */
  count: number;
}

interface AppExtraction {
  app: string;
  depth: number;
  components: ComponentInfo[];
  relationships: Relationship[];
  warnings: string[];
}

interface AppConfig {
  name: string;
  root: string;
  tsconfig: string;
  depth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute "component key" = first `depth` directory segments relative to appRoot */
function getComponentKey(
  filePath: string,
  appRoot: string,
  depth: number
): string {
  const rel = path.relative(appRoot, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");
  const dirs = parts.slice(0, -1); // strip filename
  return dirs.slice(0, depth).join("/") || "_root";
}

/** Capitalize first letter of a string */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Recursively count .svelte files, grouped by component key */
function countSvelteFiles(
  dir: string,
  appRoot: string,
  depth: number
): Map<string, number> {
  const counts = new Map<string, number>();
  function walk(d: string) {
    if (/node_modules|\.svelte-kit/.test(d)) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(fp);
      } else if (e.name.endsWith(".svelte")) {
        const k = getComponentKey(fp, appRoot, depth);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  walk(dir);
  return counts;
}

/**
 * Read tsconfig.json (strips // comments) and collect compilerOptions.paths,
 * following the `extends` chain recursively. Own paths override parent paths.
 */
function collectTsConfigPaths(
  tsconfigPath: string,
  visited = new Set<string>()
): Record<string, string[]> {
  const resolved = path.resolve(tsconfigPath);
  if (visited.has(resolved) || !fs.existsSync(resolved)) return {};
  visited.add(resolved);

  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch {
    return {};
  }

  // Strip single-line and block comments (tsconfig is not strict JSON)
  const cleaned = raw
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(cleaned);
  } catch {
    return {};
  }

  const baseDir = path.dirname(resolved);
  let paths: Record<string, string[]> = {};

  // Follow extends first (lower priority)
  if (typeof cfg.extends === "string") {
    let ext = path.resolve(baseDir, cfg.extends as string);
    if (!ext.endsWith(".json")) ext += ".json";
    paths = { ...paths, ...collectTsConfigPaths(ext, visited) };
  }

  // Own paths override parent
  const opts = cfg.compilerOptions as Record<string, unknown> | undefined;
  if (opts?.paths) {
    for (const [alias, targets] of Object.entries(
      opts.paths as Record<string, string[]>
    )) {
      paths[alias] = (targets as string[]).map((t) =>
        path.resolve(baseDir, t)
      );
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------
function extractApp(config: AppConfig): AppExtraction {
  const warnings: string[] = [];
  console.log(`\nExtracting ${config.name} (depth=${config.depth})…`);

  // Collect path aliases, following extends chain (handles missing .svelte-kit/)
  const rawPaths = collectTsConfigPaths(config.tsconfig);

  // Create ts-morph Project — try tsconfig first, fall back to manual options
  let project: Project;
  try {
    project = new Project({
      tsConfigFilePath: config.tsconfig,
      skipAddingFilesFromTsConfig: true,
    });
  } catch {
    console.warn(
      `  Could not load tsconfig at ${path.relative(REPO_ROOT, config.tsconfig)}; using manual path resolution`
    );
    project = new Project({
      compilerOptions: {
        baseUrl: config.root,
        paths: rawPaths,
        allowJs: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
  }

  // Add .ts/.js source files; skip .svelte, node_modules, .svelte-kit, .d.ts
  project.addSourceFilesAtPaths([
    path.join(config.root, "src/**/*.{ts,js}"),
    `!${path.join(config.root, "**/node_modules/**")}`,
    `!${path.join(config.root, "**/.svelte-kit/**")}`,
    `!${path.join(config.root, "**/*.d.ts")}`,
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`  TS/JS source files: ${sourceFiles.length}`);

  const components = new Map<string, ComponentInfo>();
  const relMap = new Map<string, Relationship>();

  for (const sf of sourceFiles) {
    const fp = sf.getFilePath() as string;
    if (!fp.startsWith(config.root)) continue;

    const key = getComponentKey(fp, config.root, config.depth);

    if (!components.has(key)) {
      const parts = key.split("/");
      const rawLabel = parts[parts.length - 1] ?? key;
      components.set(key, {
        key,
        label: capitalize(rawLabel),
        files: [],
        svelteFileCount: 0,
      });
    }
    components.get(key)!.files.push(path.relative(config.root, fp));

    // Track cross-component imports
    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue; // unresolvable (npm pkg, etc.)

      const tp = target.getFilePath() as string;
      if (!tp.startsWith(config.root)) continue; // external dep

      const targetKey = getComponentKey(tp, config.root, config.depth);
      if (targetKey === key) continue; // same component

      const rk = `${key}→${targetKey}`;
      if (!relMap.has(rk)) relMap.set(rk, { from: key, to: targetKey, count: 0 });
      relMap.get(rk)!.count++;
    }
  }

  // Count .svelte files per component (ts-morph can't parse them)
  const svelteCounts = countSvelteFiles(
    path.join(config.root, "src"),
    config.root,
    config.depth
  );
  for (const [k, n] of svelteCounts) {
    if (!components.has(k)) {
      const parts = k.split("/");
      components.set(k, {
        key: k,
        label: capitalize(parts[parts.length - 1] ?? k),
        files: [],
        svelteFileCount: 0,
      });
    }
    components.get(k)!.svelteFileCount = n;
  }

  // Depth validation: warn if any component has >50 total files
  for (const [k, c] of components) {
    const total = c.files.length + c.svelteFileCount;
    if (total > 50) {
      const msg =
        `"${k}" has ${total} files (${c.files.length} TS + ${c.svelteFileCount} Svelte)` +
        ` — consider increasing --${config.name}-depth (currently ${config.depth})`;
      console.warn(`  ⚠  ${msg}`);
      warnings.push(msg);
    }
  }

  const result: AppExtraction = {
    app: config.name,
    depth: config.depth,
    components: [...components.values()].sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    relationships: [...relMap.values()],
    warnings,
  };

  console.log(
    `  Components: ${result.components.length}, Relationships: ${result.relationships.length}` +
      (warnings.length ? `, ⚠ Warnings: ${warnings.length}` : "")
  );
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const APPS: AppConfig[] = [
  {
    name: "dashboard",
    root: path.join(REPO_ROOT, "apps/dashboard"),
    tsconfig: path.join(REPO_ROOT, "apps/dashboard/tsconfig.json"),
    depth: DASHBOARD_DEPTH,
  },
  {
    name: "api",
    root: path.join(REPO_ROOT, "apps/api"),
    tsconfig: path.join(REPO_ROOT, "apps/api/tsconfig.json"),
    depth: API_DEPTH,
  },
];

let hasError = false;
for (const appCfg of APPS) {
  try {
    const result = extractApp(appCfg);
    const outPath = path.join(OUTPUT_DIR, `${appCfg.name}-components.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`  → ${path.relative(REPO_ROOT, outPath)}`);
  } catch (err) {
    console.error(`\nFailed to extract ${appCfg.name}:`, err);
    hasError = true;
  }
}

if (!hasError) {
  console.log(
    `\n✓ Extraction complete. JSON written to ${path.relative(REPO_ROOT, OUTPUT_DIR)}/`
  );
}
