#!/usr/bin/env node

/**
 * C4 Component Extraction Script
 *
 * Uses ts-morph to parse TypeScript/JavaScript source files, aggregate them
 * into components by directory, and map cross-directory imports as relationships.
 * Outputs structured JSON for C4 Layer 3 diagram generation.
 *
 * Usage: node .claude/skills/c4-model/extract-components.mjs
 */

import { Project } from 'ts-morph';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, dirname, join, sep, posix } from 'path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

// Per-app configuration: source root, tsconfig, file globs, and component key depth
const APP_CONFIGS = {
  dashboard: {
    name: 'Dashboard',
    technology: 'SvelteKit + Svelte 4',
    srcRoot: 'apps/dashboard/src',
    tsconfig: 'apps/dashboard/tsconfig.json',
    globs: ['**/*.ts', '**/*.js'],
    svelteGlobs: ['**/*.svelte'],
    // Depth of directory path segments that form a component key.
    // e.g. depth=5 on src/lib/components/Course/components/Lesson/x.ts -> lib/components/Course/components/Lesson
    componentDepth: 5,
    excludeDirs: ['__tests__', '__mocks__', 'mocks', '.svelte-kit']
  },
  api: {
    name: 'API',
    technology: 'Hono + Node.js',
    srcRoot: 'apps/api/src',
    tsconfig: 'apps/api/tsconfig.json',
    globs: ['**/*.ts', '**/*.js'],
    svelteGlobs: [],
    componentDepth: 2,
    excludeDirs: ['__tests__', '__mocks__', '.svelte-kit']
  }
};

/**
 * Parse tsconfig.json and extract path alias mappings.
 * Returns a map of alias prefix -> resolved directory.
 */
function resolvePathAliases(tsconfigPath) {
  const aliases = {};
  try {
    const raw = readFileSync(resolve(ROOT, tsconfigPath), 'utf-8');
    // Strip comments from JSON (tsconfig allows them), but preserve strings
    const stripped = raw.replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match) =>
      match.startsWith('"') ? match : ''
    );
    const tsconfig = JSON.parse(stripped);
    const paths = tsconfig?.compilerOptions?.paths || {};
    const baseUrl = tsconfig?.compilerOptions?.baseUrl || '.';
    const tsconfigDir = dirname(resolve(ROOT, tsconfigPath));
    const base = resolve(tsconfigDir, baseUrl);

    for (const [pattern, targets] of Object.entries(paths)) {
      if (targets.length === 0) continue;
      const target = targets[0];
      // Strip trailing /* from both pattern and target
      const aliasKey = pattern.replace(/\/\*$/, '');
      const aliasTarget = target.replace(/\/\*$/, '');
      aliases[aliasKey] = resolve(base, aliasTarget);
    }
  } catch {
    // If tsconfig can't be read, return empty aliases
  }
  return aliases;
}

/**
 * Count .svelte files per directory for metadata.
 */
function countSvelteFiles(srcRootAbs, globs) {
  const counts = {};
  if (!globs || globs.length === 0) return counts;

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.svelte')) {
        const rel = relative(srcRootAbs, dir);
        counts[rel] = (counts[rel] || 0) + 1;
      }
    }
  }
  walk(srcRootAbs);
  return counts;
}

/**
 * Derive a component key from a file's relative path using the configured depth.
 */
function getComponentKey(relPath, depth) {
  const parts = relPath.split(sep);
  // Take first `depth` directory segments (excluding the filename)
  const dirParts = parts.slice(0, -1);
  const key = dirParts.slice(0, depth).join(posix.sep);
  return key || '(root)';
}

/**
 * Resolve an import specifier to a component key within the same app.
 * Returns null if the import is external (node_modules, $app, $env, svelte/*, etc).
 */
function resolveImportToComponentKey(specifier, sourceFileDir, srcRootAbs, aliases, depth) {
  // Skip obvious externals
  if (
    specifier.startsWith('svelte/') ||
    (specifier.startsWith('svelte') && !specifier.includes('/')) ||
    specifier.startsWith('$app/') ||
    specifier.startsWith('$env/') ||
    specifier.startsWith('@sveltejs/') ||
    specifier.startsWith('@supabase/') ||
    specifier.startsWith('@hono/') ||
    specifier.startsWith('hono') ||
    specifier.startsWith('carbon-') ||
    specifier.startsWith('zod') ||
    (!specifier.startsWith('.') &&
      !specifier.startsWith('$') &&
      !specifier.startsWith('@cio/') &&
      !specifier.startsWith('shared/'))
  ) {
    return null;
  }

  let resolved = null;

  // Try alias resolution
  for (const [aliasKey, aliasTarget] of Object.entries(aliases)) {
    if (specifier === aliasKey || specifier.startsWith(aliasKey + '/')) {
      const rest = specifier.slice(aliasKey.length);
      resolved = resolve(aliasTarget + rest);
      break;
    }
  }

  // Handle `shared/` imports (cross-package, skip for intra-container analysis)
  if (specifier.startsWith('shared/') || specifier.startsWith('@cio/')) {
    return null;
  }

  // Relative import
  if (!resolved && specifier.startsWith('.')) {
    resolved = resolve(sourceFileDir, specifier);
  }

  if (!resolved) return null;

  // Check if resolved path is within our src root
  const rel = relative(srcRootAbs, resolved);
  if (rel.startsWith('..')) return null;

  return getComponentKey(rel + '/dummy.ts', depth);
}

/**
 * Extract components and relationships for a single app.
 */
function extractApp(appKey, config) {
  const srcRootAbs = resolve(ROOT, config.srcRoot);
  const aliases = resolvePathAliases(config.tsconfig);

  // Create ts-morph project
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true
    },
    skipAddingFilesFromTsConfig: true
  });

  // Add source files
  for (const glob of config.globs) {
    project.addSourceFilesAtPaths(resolve(srcRootAbs, glob));
  }

  // Count svelte files per directory
  const svelteCounts = countSvelteFiles(srcRootAbs, config.svelteGlobs);

  // Aggregate files into components
  const components = {}; // key -> { files: string[], tsFiles: number, svelteFiles: number, exports: Set, imports: Set<targetKey> }
  const relationships = {}; // "source->target" -> { source, target, importCount }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const relPath = relative(srcRootAbs, filePath);

    // Skip test files, declaration files, build artifacts, and excluded dirs
    const excludeDirs = config.excludeDirs || [];
    const pathSegments = relPath.split(sep);
    if (
      pathSegments.some((s) => excludeDirs.includes(s)) ||
      relPath.includes('.test.') ||
      relPath.includes('.spec.') ||
      relPath.includes('.d.ts')
    ) {
      continue;
    }

    const componentKey = getComponentKey(relPath, config.componentDepth);

    if (!components[componentKey]) {
      components[componentKey] = {
        files: [],
        tsFiles: 0,
        svelteFiles: 0,
        exports: new Set()
      };
    }

    components[componentKey].files.push(relPath);
    components[componentKey].tsFiles++;

    // Collect exported names
    for (const [name] of sourceFile.getExportedDeclarations()) {
      components[componentKey].exports.add(name);
    }

    // Analyze imports for relationships
    const sourceDir = dirname(filePath);
    for (const imp of sourceFile.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      const targetKey = resolveImportToComponentKey(
        specifier,
        sourceDir,
        srcRootAbs,
        aliases,
        config.componentDepth
      );

      if (targetKey && targetKey !== componentKey) {
        const relKey = `${componentKey}->${targetKey}`;
        if (!relationships[relKey]) {
          relationships[relKey] = { source: componentKey, target: targetKey, importCount: 0 };
        }
        relationships[relKey].importCount++;
      }
    }
  }

  // Merge svelte counts into components
  for (const [dir, count] of Object.entries(svelteCounts)) {
    const componentKey = getComponentKey(dir + '/dummy.svelte', config.componentDepth);
    if (!components[componentKey]) {
      components[componentKey] = {
        files: [],
        tsFiles: 0,
        svelteFiles: 0,
        exports: new Set()
      };
    }
    components[componentKey].svelteFiles += count;
  }

  // Convert sets to arrays for JSON serialization
  const serializedComponents = {};
  for (const [key, comp] of Object.entries(components)) {
    const totalFiles = comp.tsFiles + comp.svelteFiles;
    serializedComponents[key] = {
      tsFiles: comp.tsFiles,
      svelteFiles: comp.svelteFiles,
      totalFiles,
      exports: [...comp.exports].sort(),
      files: comp.files.sort()
    };
  }

  // Validate: warn if any component has >50 files
  const warnings = [];
  for (const [key, comp] of Object.entries(serializedComponents)) {
    if (comp.totalFiles > 50) {
      warnings.push(
        `Component "${key}" has ${comp.totalFiles} files. Consider increasing componentDepth for ${appKey}.`
      );
    }
  }

  return {
    app: appKey,
    name: config.name,
    technology: config.technology,
    componentDepth: config.componentDepth,
    aliases: Object.fromEntries(Object.entries(aliases).map(([k, v]) => [k, relative(ROOT, v)])),
    components: serializedComponents,
    relationships: Object.values(relationships)
      .filter((r) => r.importCount > 0)
      .sort((a, b) => b.importCount - a.importCount),
    warnings
  };
}

// Main
const output = {
  extractedAt: new Date().toISOString(),
  apps: {}
};

for (const [appKey, config] of Object.entries(APP_CONFIGS)) {
  console.log(`Extracting ${config.name}...`);
  try {
    output.apps[appKey] = extractApp(appKey, config);
    const compCount = Object.keys(output.apps[appKey].components).length;
    const relCount = output.apps[appKey].relationships.length;
    const warns = output.apps[appKey].warnings;
    console.log(`  ${compCount} components, ${relCount} relationships`);
    if (warns.length > 0) {
      for (const w of warns) console.warn(`  WARNING: ${w}`);
    }
  } catch (err) {
    console.error(`  Error extracting ${config.name}: ${err.message}`);
    output.apps[appKey] = { error: err.message };
  }
}

const outPath = resolve(ROOT, 'docs/c4/extracted-components.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nOutput written to docs/c4/extracted-components.json`);
