#!/usr/bin/env npx tsx
/**
 * C4 Architecture Extractor for ClassroomIO
 *
 * Uses ts-morph to perform static import analysis on apps/dashboard and apps/api,
 * aggregating source files into components and mapping relationships.
 *
 * Output: docs/c4/extracted.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project, SourceFile } from 'ts-morph';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface AppConfig {
  name: string;
  root: string;
  srcRoot: string;
  /** Preferred tsconfig; falls back to fallbackTsconfig if absent */
  tsconfigPath: string;
  fallbackTsconfigPath?: string;
  /**
   * Number of directory levels below srcRoot that define a component boundary.
   * e.g. depth=3, srcRoot=src/ => src/lib/components/Course is one component.
   */
  componentDepth: number;
  svelteAware: boolean;
}

const REPO_ROOT = '/workspaces/classroomio';

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    root: path.join(REPO_ROOT, 'apps/dashboard'),
    srcRoot: path.join(REPO_ROOT, 'apps/dashboard/src'),
    tsconfigPath: path.join(REPO_ROOT, 'apps/dashboard/.svelte-kit/tsconfig.json'),
    fallbackTsconfigPath: path.join(REPO_ROOT, 'apps/dashboard/tsconfig.json'),
    componentDepth: 5,
    svelteAware: true,
  },
  {
    name: 'api',
    root: path.join(REPO_ROOT, 'apps/api'),
    srcRoot: path.join(REPO_ROOT, 'apps/api/src'),
    tsconfigPath: path.join(REPO_ROOT, 'apps/api/tsconfig.json'),
    componentDepth: 2,
    svelteAware: false,
  },
];

/** Files/dirs with more than this many files trigger a depth warning */
const DEPTH_WARNING_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// External system detection
// ---------------------------------------------------------------------------

const EXTERNAL_SYSTEM_PATTERNS: Array<{ pattern: RegExp; system: string }> = [
  { pattern: /^@supabase\//, system: 'Supabase' },
  { pattern: /^ioredis$/, system: 'Redis' },
  { pattern: /^@aws-sdk\//, system: 'S3/R2' },
  { pattern: /^openai(-edge)?$/, system: 'OpenAI' },
  { pattern: /^@ai-sdk\//, system: 'OpenAI' },
  { pattern: /^ai$/, system: 'OpenAI' },
  { pattern: /^@lemonsqueezy\//, system: 'LemonSqueezy' },
  { pattern: /^@polar-sh\//, system: 'Polar' },
  { pattern: /^@sentry\//, system: 'Sentry' },
];

function detectExternalSystem(specifier: string): string | null {
  for (const { pattern, system } of EXTERNAL_SYSTEM_PATTERNS) {
    if (pattern.test(specifier)) return system;
  }
  // Cloudflare R2 / S3 by file path reference in api
  if (specifier.includes('cloudflare') || specifier.includes('/s3')) return 'S3/R2';
  if (specifier.includes('/redis')) return 'Redis';
  return null;
}

// ---------------------------------------------------------------------------
// Alias resolution
// ---------------------------------------------------------------------------

interface AliasMap {
  [prefix: string]: string; // e.g. "$lib/" => "/workspaces/.../src/lib/"
}

function loadAliasMap(tsconfigPath: string): AliasMap {
  const aliasMap: AliasMap = {};
  const tsconfigDir = path.dirname(tsconfigPath);

  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
  } catch {
    return aliasMap;
  }

  const paths: Record<string, string[]> = raw?.compilerOptions?.paths ?? {};

  for (const [key, values] of Object.entries(paths)) {
    if (!values.length) continue;
    // Strip trailing /* from the key and value
    const cleanKey = key.endsWith('/*') ? key.slice(0, -2) : key;
    const cleanValue = values[0].endsWith('/*') ? values[0].slice(0, -2) : values[0];
    const resolved = path.resolve(tsconfigDir, cleanValue);
    aliasMap[cleanKey] = resolved;
  }

  return aliasMap;
}

function resolveImport(
  specifier: string,
  sourceFilePath: string,
  aliasMap: AliasMap,
): string | null {
  // External package (not relative, not a known alias prefix)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    // Check alias prefixes first
    for (const [prefix, target] of Object.entries(aliasMap)) {
      if (specifier === prefix) return target + '/index';
      if (specifier.startsWith(prefix + '/')) {
        return target + specifier.slice(prefix.length);
      }
    }
    // Not an alias => external package
    return null;
  }

  // Relative import
  return path.resolve(path.dirname(sourceFilePath), specifier);
}

// ---------------------------------------------------------------------------
// Component key computation
// ---------------------------------------------------------------------------

function fileToComponentKey(absPath: string, srcRoot: string, depth: number): string {
  const rel = path.relative(srcRoot, absPath);
  const parts = rel.split(path.sep);
  // Drop the filename (last element) — keep only directory parts
  const dirParts = parts.slice(0, -1);
  if (dirParts.length === 0) return '__root';
  // Take first `depth` directory levels
  return dirParts.slice(0, depth).join('/');
}

function slugify(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '-');
}

function shortLabel(key: string): string {
  const parts = key.split('/');
  if (parts.length <= 2) return key;
  // Show last 2 parts for readability in diagrams
  return parts.slice(-2).join('/');
}

// ---------------------------------------------------------------------------
// Svelte file counting — mapped to component keys (same logic as TS files)
// ---------------------------------------------------------------------------

function buildSvelteCountMap(srcRoot: string, depth: number): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith('.svelte')) {
        const key = fileToComponentKey(fullPath, srcRoot, depth);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  };
  if (fs.existsSync(srcRoot)) walk(srcRoot);
  return counts;
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

interface ComponentNode {
  id: string;
  label: string;
  fullPath: string;
  app: string;
  tsFileCount: number;
  svelteFileCount: number;
}

interface Relationship {
  from: string;
  to: string;
  weight: number;
}

interface AppResult {
  appName: string;
  components: ComponentNode[];
  internalRelationships: Relationship[];
  externalRelationships: Relationship[];
  warnings: string[];
}

interface ExtractionOutput {
  generatedAt: string;
  apps: AppResult[];
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

function processApp(config: AppConfig): AppResult {
  const warnings: string[] = [];

  // Choose tsconfig
  const tsconfigPath = fs.existsSync(config.tsconfigPath)
    ? config.tsconfigPath
    : config.fallbackTsconfigPath ?? config.tsconfigPath;

  console.log(`  [${config.name}] Using tsconfig: ${path.relative(REPO_ROOT, tsconfigPath)}`);

  const aliasMap = loadAliasMap(tsconfigPath);
  console.log(`  [${config.name}] Aliases: ${Object.keys(aliasMap).join(', ') || 'none'}`);

  // Build ts-morph project — skip type resolution, we only need imports
  const project = new Project({
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
    },
  });

  // Add only .ts/.js files under srcRoot
  const globPattern = path.join(config.srcRoot, '**/*.{ts,js}');
  project.addSourceFilesFromTsConfig(tsconfigPath);

  // Filter to only files under srcRoot
  const sourceFiles = project
    .getSourceFiles()
    .filter((f) => f.getFilePath().startsWith(config.srcRoot));

  console.log(`  [${config.name}] Source files found: ${sourceFiles.length}`);

  // Component bookkeeping
  const componentTsFiles = new Map<string, Set<string>>(); // key -> set of file paths
  const internalRelWeights = new Map<string, number>(); // "from->to" -> weight
  const externalRelWeights = new Map<string, number>(); // "from->system" -> weight

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const compKey = fileToComponentKey(filePath, config.srcRoot, config.componentDepth);

    if (!componentTsFiles.has(compKey)) componentTsFiles.set(compKey, new Set());
    componentTsFiles.get(compKey)!.add(filePath);

    // Process imports
    for (const decl of sf.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue();
      const resolved = resolveImport(specifier, filePath, aliasMap);

      if (resolved === null) {
        // External package
        const system = detectExternalSystem(specifier);
        if (system) {
          const relKey = `${compKey}=>${system}`;
          externalRelWeights.set(relKey, (externalRelWeights.get(relKey) ?? 0) + 1);
        }
      } else if (resolved.startsWith(config.srcRoot)) {
        // Internal import — check if different component
        const targetKey = fileToComponentKey(resolved, config.srcRoot, config.componentDepth);
        if (targetKey !== compKey) {
          const relKey = `${compKey}=>${targetKey}`;
          internalRelWeights.set(relKey, (internalRelWeights.get(relKey) ?? 0) + 1);
        }
      }
    }
  }

  // Build svelte count map — assigns each .svelte file to the same component key as TS files
  const svelteCountMap = config.svelteAware
    ? buildSvelteCountMap(config.srcRoot, config.componentDepth)
    : new Map<string, number>();

  // Build component nodes
  const components: ComponentNode[] = [];
  for (const [key, files] of componentTsFiles.entries()) {
    const tsFileCount = files.size;
    const svelteFileCount = svelteCountMap.get(key) ?? 0;
    const totalFiles = tsFileCount + svelteFileCount;

    if (totalFiles > DEPTH_WARNING_THRESHOLD) {
      warnings.push(
        `Component "${key}" has ${totalFiles} files (${tsFileCount} ts + ${svelteFileCount} svelte) — componentDepth may be too shallow`,
      );
    }

    components.push({
      id: `${config.name}-${slugify(key)}`,
      label: shortLabel(key),
      fullPath: key,
      app: config.name,
      tsFileCount,
      svelteFileCount,
    });
  }

  // Sort for determinism
  components.sort((a, b) => a.fullPath.localeCompare(b.fullPath));

  // Build internal relationships
  const internalRelationships: Relationship[] = [];
  for (const [relKey, weight] of internalRelWeights.entries()) {
    const [fromKey, toKey] = relKey.split('=>');
    const fromComp = components.find((c) => c.fullPath === fromKey);
    const toComp = components.find((c) => c.fullPath === toKey);
    if (fromComp && toComp) {
      internalRelationships.push({ from: fromComp.id, to: toComp.id, weight });
    }
  }

  // Build external relationships
  const externalRelationships: Relationship[] = [];
  for (const [relKey, weight] of externalRelWeights.entries()) {
    const [fromKey, system] = relKey.split('=>');
    const fromComp = components.find((c) => c.fullPath === fromKey);
    if (fromComp) {
      externalRelationships.push({ from: fromComp.id, to: system, weight });
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n  ⚠️  Warnings for ${config.name}:`);
    warnings.forEach((w) => console.warn(`     - ${w}`));
  }

  return {
    appName: config.name,
    components,
    internalRelationships,
    externalRelationships,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('C4 Architecture Extractor\n');

  const outputPath = path.join(REPO_ROOT, 'docs/c4/extracted.json');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results: AppResult[] = [];

  for (const appConfig of APPS) {
    console.log(`Processing ${appConfig.name}...`);
    try {
      const result = processApp(appConfig);
      results.push(result);
      console.log(
        `  ✓ ${result.components.length} components, ` +
          `${result.internalRelationships.length} internal rels, ` +
          `${result.externalRelationships.length} external rels\n`,
      );
    } catch (err) {
      console.error(`  ✗ Failed to process ${appConfig.name}:`, err);
      process.exit(1);
    }
  }

  const output: ExtractionOutput = {
    generatedAt: new Date().toISOString(),
    apps: results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Output written to: ${path.relative(REPO_ROOT, outputPath)}`);

  // Ensure extracted.json is gitignored
  const gitignorePath = path.join(REPO_ROOT, '.gitignore');
  const gitignoreEntry = 'docs/c4/extracted.json';
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (!gitignoreContent.includes(gitignoreEntry)) {
    fs.appendFileSync(gitignorePath, `\n# C4 architecture extractor output\n${gitignoreEntry}\n`);
    console.log(`✅ Added ${gitignoreEntry} to .gitignore`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
