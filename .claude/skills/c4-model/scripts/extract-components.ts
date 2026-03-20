#!/usr/bin/env node
/**
 * C4 Component Extractor — uses ts-morph to parse TypeScript/JavaScript source
 * files and aggregate them into C4 Layer 3 components grouped by directory.
 *
 * Usage:
 *   npx tsx extract-components.ts \
 *     --app <abs-or-rel path to app root> \
 *     --depth <int>  \
 *     --name <string> \
 *     --out  <abs-or-rel path for JSON output>
 *
 * Depth controls how many directory levels below src/ form a "component key".
 * e.g. depth=3  →  src/lib/components/Course  →  key "lib/components/Course"
 *      depth=2  →  src/routes/course           →  key "routes/course"
 *
 * Svelte files (.svelte) cannot be parsed by ts-morph; they are counted per
 * component directory and included in the output as metadata only.
 *
 * Install deps once: cd .claude/skills/c4-model/scripts && npm install
 */

import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Args {
  app: string;
  depth: number;
  name: string;
  out: string;
}

interface ComponentEntry {
  key: string;
  tsFileCount: number;
  svelteFileCount: number;
  totalFileCount: number;
}

interface RelationshipEntry {
  from: string;
  to: string;
  count: number;
}

interface Output {
  app: string;
  extractedAt: string;
  depth: number;
  components: ComponentEntry[];
  relationships: RelationshipEntry[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const result: Partial<Args> = {};

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--app":
        result.app = argv[++i];
        break;
      case "--depth":
        result.depth = parseInt(argv[++i], 10);
        break;
      case "--name":
        result.name = argv[++i];
        break;
      case "--out":
        result.out = argv[++i];
        break;
    }
  }

  if (!result.app) throw new Error("--app is required");
  if (!result.depth) throw new Error("--depth is required (integer >= 1)");
  if (!result.name) throw new Error("--name is required");
  if (!result.out) throw new Error("--out is required");

  result.app = path.resolve(result.app);
  result.out = path.resolve(result.out);

  return result as Args;
}

// ---------------------------------------------------------------------------
// tsconfig path-alias loading (manual JSON parse — handles JS-style comments)
// ---------------------------------------------------------------------------

function stripJsonComments(raw: string): string {
  // State-machine parser: skips comments outside string literals,
  // which avoids mangling keys like "$src/*" that contain "/*".
  let result = "";
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    if (ch === '"') {
      // Consume string literal verbatim (handle backslash escapes)
      result += ch;
      i++;
      while (i < raw.length) {
        const sc = raw[i];
        result += sc;
        i++;
        if (sc === "\\") { result += raw[i]; i++; continue; }
        if (sc === '"') break;
      }
    } else if (ch === "/" && raw[i + 1] === "/") {
      // Single-line comment — skip to end of line
      while (i < raw.length && raw[i] !== "\n") i++;
    } else if (ch === "/" && raw[i + 1] === "*") {
      // Block comment — skip to closing */
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i++;
      i += 2;
    } else {
      result += ch;
      i++;
    }
  }

  // Remove trailing commas (e.g. last element before } or ])
  return result.replace(/,(\s*[}\]])/g, "$1");
}

function loadAliases(tsconfigPath: string): Record<string, string> {
  if (!fs.existsSync(tsconfigPath)) {
    console.error(`[c4-extract] tsconfig not found at ${tsconfigPath}, skipping aliases`);
    return {};
  }

  const raw = fs.readFileSync(tsconfigPath, "utf8");
  let config: Record<string, any>;
  try {
    config = JSON.parse(stripJsonComments(raw));
  } catch (e) {
    console.error(`[c4-extract] Failed to parse ${tsconfigPath}: ${e}`);
    return {};
  }

  const paths: Record<string, string[]> = config?.compilerOptions?.paths ?? {};
  const baseUrl: string = config?.compilerOptions?.baseUrl ?? ".";
  const tsconfigDir = path.dirname(tsconfigPath);
  const baseAbs = path.resolve(tsconfigDir, baseUrl);

  const aliases: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const rawTarget = targets[0];
    // Strip trailing /*  from both alias key and the target path
    const normAlias = alias.replace(/\/\*$/, "");
    const normTarget = rawTarget.replace(/\/\*$/, "");
    aliases[normAlias] = path.resolve(baseAbs, normTarget);
  }

  return aliases;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Return the component key for a file path (first `depth` segments from src). */
function componentKey(filePath: string, srcPath: string, depth: number): string {
  const rel = path.relative(srcPath, filePath);
  const parts = rel.split(path.sep).filter(Boolean);
  return parts.slice(0, depth).join("/");
}

/**
 * Resolve an import specifier to an absolute path within srcPath.
 * Returns null if the import is external (node_modules / virtual modules).
 */
function resolveImport(
  spec: string,
  sourceFilePath: string,
  aliases: Record<string, string>,
  srcPath: string
): string | null {
  // Virtual / node_modules imports (SvelteKit builtins, npm packages)
  const isAlias = Object.keys(aliases).some(
    (a) => spec === a || spec.startsWith(a + "/")
  );
  if (!spec.startsWith(".") && !isAlias) return null;

  let resolvedAbs: string;

  if (spec.startsWith(".")) {
    resolvedAbs = path.resolve(path.dirname(sourceFilePath), spec);
  } else {
    // Alias resolution
    let matched = false;
    resolvedAbs = spec; // default, will be overwritten
    for (const [alias, target] of Object.entries(aliases)) {
      if (spec === alias) {
        resolvedAbs = target;
        matched = true;
        break;
      }
      if (spec.startsWith(alias + "/")) {
        resolvedAbs = path.join(target, spec.slice(alias.length + 1));
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }

  // Try to find actual file (add common extensions / index fallbacks)
  const candidates = [
    resolvedAbs,
    resolvedAbs + ".ts",
    resolvedAbs + ".js",
    resolvedAbs + ".tsx",
    resolvedAbs + ".jsx",
    path.join(resolvedAbs, "index.ts"),
    path.join(resolvedAbs, "index.js"),
  ];

  let finalPath = resolvedAbs; // may not exist — we still compute the key
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      finalPath = c;
      break;
    }
  }

  // Must be inside srcPath
  const srcNorm = srcPath.endsWith(path.sep) ? srcPath : srcPath + path.sep;
  if (!finalPath.startsWith(srcNorm)) return null;

  return finalPath;
}

// ---------------------------------------------------------------------------
// Svelte file counter (walk without ts-morph)
// ---------------------------------------------------------------------------

function countSvelteFiles(
  srcPath: string,
  depth: number
): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".svelte")) {
        const key = componentKey(full, srcPath, depth);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  walk(srcPath);
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs();
  const srcPath = path.join(args.app, "src");
  const tsconfigPath = path.join(args.app, "tsconfig.json");

  console.error(`[c4-extract] app=${args.name}  depth=${args.depth}`);
  console.error(`[c4-extract] srcPath=${srcPath}`);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`src/ not found: ${srcPath}`);
  }

  const aliases = loadAliases(tsconfigPath);
  console.error(`[c4-extract] aliases: ${JSON.stringify(Object.keys(aliases))}`);

  const svelteCount = countSvelteFiles(srcPath, args.depth);

  // Build ts-morph project without tsconfig to avoid .svelte-kit/tsconfig.json
  // extend-chain issues; we supply aliases manually for import resolution.
  const project = new Project({
    compilerOptions: { allowJs: true, skipLibCheck: true },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  project.addSourceFilesAtPaths([
    `${srcPath}/**/*.ts`,
    `${srcPath}/**/*.js`,
    `!${srcPath}/**/*.d.ts`,
    `!${srcPath}/**/*.test.ts`,
    `!${srcPath}/**/*.spec.ts`,
    `!${srcPath}/**/__mocks__/**`,
  ]);

  const sourceFiles = project.getSourceFiles();
  console.error(`[c4-extract] parsed ${sourceFiles.length} TS/JS files`);

  // component key → { files[], importTargets map }
  const comps = new Map<
    string,
    { files: string[]; importTargets: Map<string, number> }
  >();

  const getComp = (key: string) => {
    if (!comps.has(key)) comps.set(key, { files: [], importTargets: new Map() });
    return comps.get(key)!;
  };

  for (const sf of sourceFiles) {
    const fp = sf.getFilePath();
    const srcNorm = srcPath.endsWith(path.sep) ? srcPath : srcPath + path.sep;
    if (!fp.startsWith(srcNorm)) continue;

    const ck = componentKey(fp, srcPath, args.depth);
    const comp = getComp(ck);
    comp.files.push(path.relative(srcPath, fp));

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      const resolved = resolveImport(spec, fp, aliases, srcPath);
      if (!resolved) continue;

      const targetKey = componentKey(resolved, srcPath, args.depth);
      if (!targetKey || targetKey === ck) continue;

      comp.importTargets.set(
        targetKey,
        (comp.importTargets.get(targetKey) ?? 0) + 1
      );
    }
  }

  // Ensure svelte-only directories also appear as components
  for (const [key] of svelteCount) {
    getComp(key);
  }

  // Build output
  const warnings: string[] = [];
  const componentsOut: ComponentEntry[] = [];

  for (const [key, data] of comps) {
    const svelteFiles = svelteCount.get(key) ?? 0;
    const tsFileCount = data.files.length;
    const totalFileCount = tsFileCount + svelteFiles;

    if (totalFileCount > 50) {
      warnings.push(
        `Component "${key}" has ${totalFileCount} files — consider increasing --depth.`
      );
    }

    componentsOut.push({ key, tsFileCount, svelteFileCount: svelteFiles, totalFileCount });
  }

  componentsOut.sort((a, b) => a.key.localeCompare(b.key));

  const relationshipsOut: RelationshipEntry[] = [];
  for (const [fromKey, data] of comps) {
    for (const [toKey, count] of data.importTargets) {
      // Only include relationships where both endpoints exist as components
      if (comps.has(toKey)) {
        relationshipsOut.push({ from: fromKey, to: toKey, count });
      }
    }
  }
  relationshipsOut.sort((a, b) =>
    `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`)
  );

  const output: Output = {
    app: args.name,
    extractedAt: new Date().toISOString(),
    depth: args.depth,
    components: componentsOut,
    relationships: relationshipsOut,
    warnings,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(output, null, 2));

  console.error(
    `[c4-extract] done — ${componentsOut.length} components, ${relationshipsOut.length} relationships`
  );
  if (warnings.length) {
    console.error("[c4-extract] WARNINGS:");
    warnings.forEach((w) => console.error(`  ⚠  ${w}`));
  }
}

main();
