/**
 * AST-based component extractor for C4 Layer 3 diagrams.
 *
 * Uses ts-morph to parse TypeScript files, groups them into components
 * by directory path, and maps cross-directory imports as relationships.
 *
 * Usage:
 *   npx tsx .claude/skills/c4-model/extract-components.ts [--depth-dashboard N] [--depth-api N]
 *
 * Output: docs/c4/extracted-components.json
 */

import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '../../..');

interface AppConfig {
  name: string;
  tsConfigPath: string;
  srcRoot: string;
  depth: number;
  aliases: Record<string, string>;
}

interface ComponentInfo {
  key: string;
  tsFiles: string[];
  svelteFileCount: number;
  totalFiles: number;
  imports: Set<string>;
}

interface ComponentOutput {
  key: string;
  tsFiles: string[];
  svelteFileCount: number;
  totalFiles: number;
  relationships: string[];
}

interface AppOutput {
  name: string;
  depth: number;
  components: ComponentOutput[];
}

function parseArgs(): { dashboardDepth: number; apiDepth: number } {
  const args = process.argv.slice(2);
  let dashboardDepth = 3;
  let apiDepth = 2;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--depth-dashboard' && args[i + 1]) {
      dashboardDepth = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--depth-api' && args[i + 1]) {
      apiDepth = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { dashboardDepth, apiDepth };
}

/**
 * Read tsconfig.json and extract path aliases, resolving them to absolute paths.
 */
function extractAliases(tsConfigPath: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const configDir = path.dirname(tsConfigPath);

  try {
    const raw = fs.readFileSync(tsConfigPath, 'utf-8');
    // Strip JSON with comments (JSONC) — handle strings safely, then strip comments and trailing commas
    let stripped = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        stripped += ch;
        escape = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') escape = true;
        if (ch === '"') inString = false;
        stripped += ch;
        continue;
      }
      // Not in a string
      if (ch === '"') {
        inString = true;
        stripped += ch;
      } else if (ch === '/' && raw[i + 1] === '/') {
        // Line comment — skip to end of line
        while (i < raw.length && raw[i] !== '\n') i++;
        stripped += '\n';
      } else if (ch === '/' && raw[i + 1] === '*') {
        // Block comment — skip to */
        i += 2;
        while (i < raw.length - 1 && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
        i++; // skip past /
      } else {
        stripped += ch;
      }
    }
    // Remove trailing commas before ] or }
    stripped = stripped.replace(/,(\s*[}\]])/g, '$1');
    const config = JSON.parse(stripped);
    const paths = config?.compilerOptions?.paths;
    const baseUrl = config?.compilerOptions?.baseUrl || '.';
    const resolvedBase = path.resolve(configDir, baseUrl);

    if (paths) {
      for (const [alias, targets] of Object.entries(paths)) {
        if (Array.isArray(targets) && targets.length > 0) {
          // Strip trailing /* from alias and target
          const cleanAlias = alias.replace(/\/\*$/, '');
          const cleanTarget = (targets[0] as string).replace(/\/\*$/, '');
          aliases[cleanAlias] = path.resolve(resolvedBase, cleanTarget);
        }
      }
    }
  } catch (e) {
    console.warn(`Warning: Could not read tsconfig at ${tsConfigPath}:`, (e as Error).message);
  }

  return aliases;
}

/**
 * Resolve a module specifier to an absolute path using aliases.
 */
function resolveModuleSpecifier(
  specifier: string,
  aliases: Record<string, string>,
  sourceFilePath: string
): string | null {
  // Check aliases first
  for (const [alias, resolved] of Object.entries(aliases)) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      const remainder = specifier.slice(alias.length);
      return path.join(resolved, remainder);
    }
  }

  // Relative import
  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(sourceFilePath), specifier);
  }

  // External package — ignore
  return null;
}

/**
 * Compute a component key from a file path relative to srcRoot at the given depth.
 */
function componentKey(filePath: string, srcRoot: string, depth: number): string {
  const rel = path.relative(srcRoot, filePath);
  const parts = rel.split(path.sep);
  return parts.slice(0, Math.min(depth, parts.length - 1)).join('/') || parts[0];
}

/**
 * Count .svelte files in directories under srcRoot.
 */
function countSvelteFiles(srcRoot: string): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
        walk(fullPath);
      } else if (entry.name.endsWith('.svelte')) {
        const dirKey = path.relative(srcRoot, dir);
        counts.set(dirKey, (counts.get(dirKey) || 0) + 1);
      }
    }
  }

  walk(srcRoot);
  return counts;
}

function processApp(config: AppConfig): AppOutput {
  console.log(`\nProcessing ${config.name} (depth=${config.depth})...`);

  const project = new Project({
    tsConfigFilePath: config.tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  // Add .ts and .js files (not .svelte — ts-morph can't parse those)
  const globPatterns = [
    path.join(config.srcRoot, '**/*.ts'),
    path.join(config.srcRoot, '**/*.js'),
  ];

  for (const pattern of globPatterns) {
    project.addSourceFilesAtPaths(pattern);
  }

  const sourceFiles = project.getSourceFiles();
  console.log(`  Found ${sourceFiles.length} TS/JS files`);

  // Build component map
  const components = new Map<string, ComponentInfo>();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const key = componentKey(filePath, config.srcRoot, config.depth);

    if (!components.has(key)) {
      components.set(key, {
        key,
        tsFiles: [],
        svelteFileCount: 0,
        totalFiles: 0,
        imports: new Set(),
      });
    }

    const comp = components.get(key)!;
    comp.tsFiles.push(path.relative(config.srcRoot, filePath));
    comp.totalFiles++;

    // Extract imports
    for (const importDecl of sf.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      const resolved = resolveModuleSpecifier(specifier, config.aliases, filePath);

      if (resolved) {
        const targetKey = componentKey(resolved, config.srcRoot, config.depth);
        if (targetKey !== key) {
          comp.imports.add(targetKey);
        }
      }
    }
  }

  // Count svelte files per component
  const svelteCounts = countSvelteFiles(config.srcRoot);
  for (const [dirKey, count] of svelteCounts) {
    const parts = dirKey.split(path.sep);
    const key = parts.slice(0, Math.min(config.depth, parts.length)).join('/') || parts[0];

    if (!components.has(key)) {
      components.set(key, {
        key,
        tsFiles: [],
        svelteFileCount: 0,
        totalFiles: 0,
        imports: new Set(),
      });
    }
    const comp = components.get(key)!;
    comp.svelteFileCount += count;
    comp.totalFiles += count;
  }

  // Validate: warn if any component has >50 files
  for (const comp of components.values()) {
    if (comp.totalFiles > 50) {
      console.warn(
        `  WARNING: Component "${comp.key}" has ${comp.totalFiles} files — consider increasing depth`
      );
    }
  }

  // Convert to output format
  const output: ComponentOutput[] = Array.from(components.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((c) => ({
      key: c.key,
      tsFiles: c.tsFiles,
      svelteFileCount: c.svelteFileCount,
      totalFiles: c.totalFiles,
      relationships: Array.from(c.imports).sort(),
    }));

  console.log(`  Extracted ${output.length} components`);

  return {
    name: config.name,
    depth: config.depth,
    components: output,
  };
}

function main() {
  const { dashboardDepth, apiDepth } = parseArgs();

  const dashboardTsConfig = path.join(ROOT, 'apps/dashboard/tsconfig.json');
  const apiTsConfig = path.join(ROOT, 'apps/api/tsconfig.json');

  const apps: AppConfig[] = [
    {
      name: 'dashboard',
      tsConfigPath: dashboardTsConfig,
      srcRoot: path.join(ROOT, 'apps/dashboard/src'),
      depth: dashboardDepth,
      aliases: extractAliases(dashboardTsConfig),
    },
    {
      name: 'api',
      tsConfigPath: apiTsConfig,
      srcRoot: path.join(ROOT, 'apps/api/src'),
      depth: apiDepth,
      aliases: extractAliases(apiTsConfig),
    },
  ];

  console.log('Resolved aliases:');
  for (const app of apps) {
    console.log(`  ${app.name}:`, app.aliases);
  }

  const results = apps.map((app) => processApp(app));

  const outputPath = path.join(ROOT, 'docs/c4/extracted-components.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nOutput written to ${outputPath}`);
}

main();
