#!/usr/bin/env tsx
/**
 * C4 Layer 3 AST Extractor for ClassroomIO
 *
 * Parses TypeScript/JavaScript source files in apps/api and apps/dashboard,
 * aggregates them into components by configurable directory depth, and maps
 * cross-component imports as relationships. Outputs structured JSON to docs/c4/.
 *
 * Run from monorepo root:
 *   npx tsx .claude/skills/c4-model/extract.ts
 *
 * Prerequisites:
 *   pnpm add -w -D ts-morph
 */
import { Project } from "ts-morph";
import ts from "typescript";
import * as path from "path";
import * as fs from "fs";

// ── Types ───────────────────────────────────────────────────────────────────

interface AppConfig {
  name: string;
  root: string;
  srcDir: string;
  /** How many directory levels below srcDir form a component key. */
  depth: number;
}

interface ComponentInfo {
  key: string;
  label: string;
  files: string[];
  svelteCount: number;
  imports: string[];
  externalPackages: string[];
}

interface ExtractionResult {
  app: string;
  extractedAt: string;
  depth: number;
  srcDir: string;
  components: ComponentInfo[];
  warnings: string[];
}

// ── File helpers ─────────────────────────────────────────────────────────────

function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Read tsconfig.json `compilerOptions.paths` (non-recursively) and return a
 * map of alias-prefix → absolute target directory. Strips trailing `/*` from
 * both alias and target. Handles JSON with line comments.
 */
function readAliases(appRoot: string): Record<string, string> {
  const tsconfigPath = path.join(appRoot, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return {};
  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  // Use TypeScript's own JSONC parser — handles // and /* */ comments correctly,
  // including inline /* */ after values and trailing // comment blocks.
  const { config, error } = ts.parseConfigFileTextToJson(tsconfigPath, raw);
  if (error || !config) {
    console.warn(`  [warn] Could not parse tsconfig at ${tsconfigPath}`);
    return {};
  }
  const tsconfig: Record<string, unknown> = config;
  const paths =
    (tsconfig.compilerOptions as Record<string, unknown> | undefined)?.paths as
    Record<string, string[]> | undefined ?? {};
  const result: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(paths)) {
    const cleanAlias = alias.replace(/\/\*$/, "");
    const cleanTarget = (targets[0] ?? "").replace(/\/\*$/, "");
    result[cleanAlias] = path.resolve(appRoot, cleanTarget);
  }
  return result;
}

// ── Component key logic ───────────────────────────────────────────────────────

/**
 * Returns a component key for a file: the first `depth` directory segments
 * of the path relative to srcDir, excluding the filename.
 *
 *   src/utils/redis/redis.ts  depth=2  →  "utils/redis"
 *   src/routes/mail.ts        depth=2  →  "routes"
 *   src/app.ts                depth=2  →  "(root)"
 */
function componentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);
  const dirParts = parts.slice(0, -1); // drop filename
  if (dirParts.length === 0) return "(root)";
  return dirParts.slice(0, depth).join("/");
}

// ── Import resolution ─────────────────────────────────────────────────────────

/**
 * Resolve an import specifier to an absolute path (may not include extension),
 * or return null if it's an external npm package.
 */
function resolveImport(
  spec: string,
  fromFile: string,
  aliases: Record<string, string>
): string | null {
  // Relative import
  if (spec.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  // Alias import (e.g. $lib/..., $src/...)
  for (const [alias, targetDir] of Object.entries(aliases)) {
    if (spec === alias || spec.startsWith(alias + "/")) {
      return path.resolve(targetDir + spec.slice(alias.length));
    }
  }
  // External package
  return null;
}

function externalPkgName(spec: string): string {
  if (spec.startsWith("$app") || spec.startsWith("$env") || spec.startsWith("virtual:")) {
    return ""; // SvelteKit / Vite built-ins — skip
  }
  const parts = spec.split("/");
  return parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

// ── Core extraction ───────────────────────────────────────────────────────────

function extractApp(config: AppConfig): ExtractionResult {
  const { name, root, srcDir: srcRelDir, depth } = config;
  const srcDir = path.join(root, srcRelDir);
  const aliases = readAliases(root);

  console.log(`  aliases: ${JSON.stringify(aliases)}`);

  const allFiles = walkDir(srcDir);
  const tsFiles = allFiles.filter(
    (f) => /\.(ts|tsx|js|jsx)$/.test(f) && !f.endsWith(".d.ts")
  );
  const svelteFiles = allFiles.filter((f) => f.endsWith(".svelte"));

  console.log(`  ${tsFiles.length} TS/JS files, ${svelteFiles.length} Svelte files`);

  // Count .svelte files per component key
  const svelteCounts = new Map<string, number>();
  for (const f of svelteFiles) {
    const k = componentKey(f, srcDir, depth);
    svelteCounts.set(k, (svelteCounts.get(k) ?? 0) + 1);
  }

  // Mutable component accumulator
  const comps = new Map<
    string,
    { files: string[]; imports: Set<string>; externals: Set<string> }
  >();

  function getComp(k: string) {
    if (!comps.has(k)) comps.set(k, { files: [], imports: new Set(), externals: new Set() });
    return comps.get(k)!;
  }

  // ts-morph project — do not load tsconfig to avoid missing .svelte-kit/tsconfig.json
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, skipLibCheck: true },
  });
  project.addSourceFilesAtPaths(tsFiles);

  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath() as string;
    const k = componentKey(fp, srcDir, depth);
    const comp = getComp(k);
    comp.files.push(path.relative(srcDir, fp));

    for (const decl of sf.getImportDeclarations()) {
      const spec = decl.getModuleSpecifierValue();
      const resolved = resolveImport(spec, fp, aliases);

      if (resolved === null) {
        const pkg = externalPkgName(spec);
        if (pkg) comp.externals.add(pkg);
      } else {
        const relToSrc = path.relative(srcDir, resolved);
        if (!relToSrc.startsWith("..")) {
          const targetKey = componentKey(resolved, srcDir, depth);
          if (targetKey !== k) comp.imports.add(targetKey);
        } else {
          // Resolved outside srcDir (e.g. local monorepo package via alias)
          const pkg = externalPkgName(spec);
          if (pkg) comp.externals.add(pkg);
        }
      }
    }
  }

  // Ensure svelte-only directories appear as components too
  for (const [k] of svelteCounts) {
    getComp(k);
  }

  // Validate depth
  const warnings: string[] = [];
  for (const [k, c] of comps) {
    const total = c.files.length + (svelteCounts.get(k) ?? 0);
    if (total > 50) {
      warnings.push(
        `"${k}": ${total} files (${c.files.length} TS + ${svelteCounts.get(k) ?? 0} Svelte) — depth=${depth} may be too shallow`
      );
    }
  }

  const components: ComponentInfo[] = [...comps.entries()]
    .map(([k, c]) => ({
      key: k,
      label: k.split("/").pop() ?? k,
      files: c.files.sort(),
      svelteCount: svelteCounts.get(k) ?? 0,
      imports: [...c.imports].sort(),
      externalPackages: [...c.externals].sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    app: name,
    extractedAt: new Date().toISOString(),
    depth,
    srcDir: path.relative(root, srcDir),
    components,
    warnings,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd(); // must be run from monorepo root

const APPS: AppConfig[] = [
  {
    name: "api",
    root: path.join(REPO_ROOT, "apps/api"),
    srcDir: "src",
    depth: 2, // e.g. "routes/course", "utils/redis"
  },
  {
    name: "dashboard",
    root: path.join(REPO_ROOT, "apps/dashboard"),
    srcDir: "src",
    depth: 3, // e.g. "lib/components/AI", "lib/utils/services"
  },
];

const OUT_DIR = path.join(REPO_ROOT, "docs/c4");
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const cfg of APPS) {
  console.log(`\nExtracting ${cfg.name} (depth=${cfg.depth})…`);
  const result = extractApp(cfg);

  if (result.warnings.length) {
    console.warn(`  ⚠  Depth warnings:`);
    result.warnings.forEach((w) => console.warn(`     ${w}`));
  }

  const outPath = path.join(OUT_DIR, `ast-${cfg.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `  → ${result.components.length} components written to ${path.relative(REPO_ROOT, outPath)}`
  );
}
