/**
 * C4 Component Extraction Script
 *
 * Uses ts-morph to parse TypeScript/JavaScript files in apps/dashboard and apps/api,
 * aggregating them into logical components by directory and mapping cross-directory imports.
 *
 * Output: .claude/skills/c4-model/ast-output.json
 */

import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

interface AppConfig {
  name: string;
  root: string;
  srcDir: string;
  depth: number;
  pathAliases: Record<string, string>;
  extensions: string[];
}

interface ComponentInfo {
  name: string;
  directory: string;
  tsFiles: number;
  jsFiles: number;
  svelteFiles: number;
  totalFiles: number;
  files: string[];
}

interface Relationship {
  from: string;
  to: string;
  importCount: number;
}

interface AppOutput {
  app: string;
  components: ComponentInfo[];
  relationships: Relationship[];
}

const APPS: AppConfig[] = [
  {
    name: 'api',
    root: path.join(ROOT, 'apps/api'),
    srcDir: path.join(ROOT, 'apps/api/src'),
    depth: 2,
    pathAliases: {
      '$src': './src',
      '$src/': './src/',
    },
    extensions: ['.ts', '.js'],
  },
  {
    name: 'dashboard',
    root: path.join(ROOT, 'apps/dashboard'),
    srcDir: path.join(ROOT, 'apps/dashboard/src'),
    depth: 3,
    pathAliases: {
      '$lib': './src/lib',
      '$lib/': './src/lib/',
      '$mail': './src/mail',
      '$mail/': './src/mail/',
    },
    extensions: ['.ts', '.js'],
  },
];

function getComponentKey(filePath: string, srcDir: string, depth: number): string {
  const rel = path.relative(srcDir, filePath);
  const parts = rel.split(path.sep);
  return parts.slice(0, depth).join('/');
}

function countSvelteFiles(dir: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (!fs.existsSync(dir)) return counts;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
        walk(fullPath);
      } else if (entry.name.endsWith('.svelte')) {
        const rel = path.relative(dir, fullPath);
        counts.set(rel, (counts.get(rel) || 0) + 1);
      }
    }
  }
  walk(dir);
  return counts;
}

function resolveImportPath(
  importPath: string,
  appConfig: AppConfig
): string | null {
  for (const [alias, resolved] of Object.entries(appConfig.pathAliases)) {
    if (importPath === alias || importPath.startsWith(alias + '/')) {
      const rest = importPath.slice(alias.length);
      return path.join(appConfig.root, resolved + rest);
    }
  }
  if (importPath.startsWith('.')) {
    return importPath; // relative — handled by ts-morph
  }
  return null; // external package
}

function processApp(appConfig: AppConfig): AppOutput {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      skipLibCheck: true,
      noEmit: true,
    },
  });

  // Add source files
  const globPatterns = appConfig.extensions.map(
    (ext) => path.join(appConfig.srcDir, `**/*${ext}`)
  );
  project.addSourceFilesAtPaths(globPatterns);

  const sourceFiles = project.getSourceFiles();

  // Count svelte files per directory
  const svelteFiles = countSvelteFiles(appConfig.srcDir);
  const svelteCounts = new Map<string, number>();
  for (const [relPath] of svelteFiles) {
    const key = getComponentKey(
      path.join(appConfig.srcDir, relPath),
      appConfig.srcDir,
      appConfig.depth
    );
    svelteCounts.set(key, (svelteCounts.get(key) || 0) + 1);
  }

  // Aggregate files into components
  const componentMap = new Map<
    string,
    { tsFiles: string[]; jsFiles: string[] }
  >();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const key = getComponentKey(filePath, appConfig.srcDir, appConfig.depth);
    if (!componentMap.has(key)) {
      componentMap.set(key, { tsFiles: [], jsFiles: [] });
    }
    const entry = componentMap.get(key)!;
    if (filePath.endsWith('.ts')) {
      entry.tsFiles.push(path.relative(appConfig.srcDir, filePath));
    } else {
      entry.jsFiles.push(path.relative(appConfig.srcDir, filePath));
    }
  }

  // Build component list
  const components: ComponentInfo[] = [];
  for (const [key, data] of componentMap) {
    const svelteCount = svelteCounts.get(key) || 0;
    const totalFiles = data.tsFiles.length + data.jsFiles.length + svelteCount;
    const comp: ComponentInfo = {
      name: key.replace(/\//g, '.'),
      directory: key,
      tsFiles: data.tsFiles.length,
      jsFiles: data.jsFiles.length,
      svelteFiles: svelteCount,
      totalFiles,
      files: [...data.tsFiles, ...data.jsFiles],
    };
    if (totalFiles > 50) {
      console.warn(
        `WARNING: Component "${comp.name}" in ${appConfig.name} has ${totalFiles} files (>50). Consider increasing depth.`
      );
    }
    components.push(comp);
  }

  // Extract relationships from imports
  const relMap = new Map<string, number>();

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();
    const fromKey = getComponentKey(filePath, appConfig.srcDir, appConfig.depth);

    const importDecls = sf.getImportDeclarations();
    for (const imp of importDecls) {
      const moduleSpec = imp.getModuleSpecifierValue();

      // Try to resolve path alias
      const resolved = resolveImportPath(moduleSpec, appConfig);
      if (resolved === null) continue; // external package

      let targetPath: string;
      if (path.isAbsolute(resolved)) {
        targetPath = resolved;
      } else {
        // relative import — resolve from source file directory
        targetPath = path.resolve(path.dirname(filePath), resolved);
      }

      // Check if target is within srcDir
      if (!targetPath.startsWith(appConfig.srcDir)) continue;

      const toKey = getComponentKey(targetPath, appConfig.srcDir, appConfig.depth);
      if (fromKey === toKey) continue; // skip self-references

      const relKey = `${fromKey}|${toKey}`;
      relMap.set(relKey, (relMap.get(relKey) || 0) + 1);
    }
  }

  const relationships: Relationship[] = [];
  for (const [key, count] of relMap) {
    const [from, to] = key.split('|');
    relationships.push({
      from: from.replace(/\//g, '.'),
      to: to.replace(/\//g, '.'),
      importCount: count,
    });
  }

  // Sort for stable output
  components.sort((a, b) => a.name.localeCompare(b.name));
  relationships.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return {
    app: appConfig.name,
    components,
    relationships,
  };
}

// Main
const results: AppOutput[] = [];

for (const app of APPS) {
  console.log(`Processing ${app.name}...`);
  const output = processApp(app);
  console.log(
    `  ${output.components.length} components, ${output.relationships.length} relationships`
  );
  results.push(output);
}

const outputPath = path.join(ROOT, '.claude/skills/c4-model/ast-output.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nOutput written to ${outputPath}`);
