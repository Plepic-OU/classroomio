/**
 * C4 model extraction script
 * Parses TypeScript/JavaScript source files with ts-morph to build a component dependency graph.
 * Aggregates by directory into components; maps cross-directory imports as relationships.
 *
 * Usage (from repo root):
 *   ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
 *
 * Output: .claude/skills/c4-model/output/structure.json
 *
 * Config:
 *   DASHBOARD_DEPTH  override depth for dashboard (default 3)
 *   API_DEPTH        override depth for api (default 2)
 */

import { Project } from 'ts-morph'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REPO_ROOT = process.cwd()

interface AppConfig {
  name: string
  root: string
  srcDir: string
  /** How many directory levels from <srcDir>/ form one component key */
  depth: number
}

const APPS: AppConfig[] = [
  {
    name: 'dashboard',
    root: path.join(REPO_ROOT, 'apps/dashboard'),
    srcDir: 'src',
    depth: Number(process.env.DASHBOARD_DEPTH ?? 3),
  },
  {
    name: 'api',
    root: path.join(REPO_ROOT, 'apps/api'),
    srcDir: 'src',
    depth: Number(process.env.API_DEPTH ?? 2),
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read path aliases from an app's own tsconfig.json (no extends resolution). */
function readAliases(appRoot: string): Record<string, string> {
  const tsconfigPath = path.join(appRoot, 'tsconfig.json')
  let tsconfig: any
  try {
    tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'))
  } catch {
    return {}
  }
  const aliases: Record<string, string> = {}
  const paths: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {}
  for (const [key, values] of Object.entries(paths)) {
    if (!Array.isArray(values) || values.length === 0) continue
    const aliasBase = key.replace(/\/\*$/, '')
    const targetBase = values[0].replace(/\/\*$/, '')
    aliases[aliasBase] = path.resolve(appRoot, targetBase)
  }
  return aliases
}

/**
 * Derive the component key for a file.
 * Takes the first `depth` directory segments of the file's path relative to srcRoot.
 * Files directly in srcRoot get key "root".
 */
function componentKey(relPath: string, depth: number): string {
  const parts = relPath.replace(/\\/g, '/').split('/')
  const dirParts = parts.slice(0, -1) // drop filename
  const keyParts = dirParts.slice(0, depth)
  return keyParts.length > 0 ? keyParts.join('/') : 'root'
}

/** Try adding common extensions to find an actual file on disk. */
function resolveToFile(p: string): string | null {
  for (const suffix of ['', '.ts', '.js', '/index.ts', '/index.js']) {
    try {
      const full = p + suffix
      if (fs.statSync(full).isFile()) return full
    } catch {
      // not found
    }
  }
  return null
}

/**
 * Resolve an import specifier to an absolute file path.
 * Returns null for external packages.
 */
function resolveImport(
  spec: string,
  fromFile: string,
  aliases: Record<string, string>
): string | null {
  if (spec.startsWith('.')) {
    return resolveToFile(path.resolve(path.dirname(fromFile), spec))
  }
  for (const [alias, aliasPath] of Object.entries(aliases)) {
    if (spec === alias) return resolveToFile(aliasPath)
    if (spec.startsWith(alias + '/')) {
      return resolveToFile(aliasPath + spec.slice(alias.length))
    }
  }
  return null // external package
}

/** Recursively collect files with the given extensions, skipping node_modules and dot-dirs. */
function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts))
    } else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Per-app extraction
// ---------------------------------------------------------------------------

interface ComponentData {
  /** TypeScript/JavaScript source files */
  files: number
  /** Svelte component files (co-located, not parsed by ts-morph) */
  svelteFiles: number
}

interface RelationshipData {
  from: string
  to: string
  /** Number of import statements that cross this component boundary */
  importCount: number
}

interface AppExtraction {
  depth: number
  components: Record<string, ComponentData>
  relationships: RelationshipData[]
  warnings: string[]
}

function extractApp(cfg: AppConfig): AppExtraction {
  const srcRoot = path.join(cfg.root, cfg.srcDir)
  const aliases = readAliases(cfg.root)

  const tsFiles = collectFiles(srcRoot, ['.ts', '.js']).filter(f => !f.endsWith('.d.ts'))
  const svelteFiles = collectFiles(srcRoot, ['.svelte'])

  // ts-morph project — skip tsconfig so we don't fail on missing .svelte-kit/tsconfig
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: false })
  project.addSourceFilesAtPaths(tsFiles)

  const components: Record<string, ComponentData> = {}
  const relCounts: Record<string, number> = {}

  // Count .svelte files per component key (metadata only; not parsed)
  for (const sf of svelteFiles) {
    const rel = path.relative(srcRoot, sf).replace(/\\/g, '/')
    const key = componentKey(rel, cfg.depth)
    if (!components[key]) components[key] = { files: 0, svelteFiles: 0 }
    components[key].svelteFiles++
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath() as string
    const rel = path.relative(srcRoot, filePath).replace(/\\/g, '/')
    const fromKey = componentKey(rel, cfg.depth)

    if (!components[fromKey]) components[fromKey] = { files: 0, svelteFiles: 0 }
    components[fromKey].files++

    for (const imp of sourceFile.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue()
      const resolved = resolveImport(spec, filePath, aliases)
      if (!resolved || !resolved.startsWith(srcRoot + path.sep) && resolved !== srcRoot) continue

      const toRel = path.relative(srcRoot, resolved).replace(/\\/g, '/')
      const toKey = componentKey(toRel, cfg.depth)
      if (toKey === fromKey) continue

      const relKey = `${fromKey}\x00${toKey}`
      relCounts[relKey] = (relCounts[relKey] ?? 0) + 1
    }
  }

  const warnings: string[] = []
  for (const [key, data] of Object.entries(components)) {
    if (data.files > 50) {
      warnings.push(
        `${cfg.name}/${key} has ${data.files} TS files — depth ${cfg.depth} may be too shallow`
      )
    }
  }

  const relationships: RelationshipData[] = Object.entries(relCounts).map(([rk, count]) => {
    const sep = rk.indexOf('\x00')
    return { from: rk.slice(0, sep), to: rk.slice(sep + 1), importCount: count }
  })

  return { depth: cfg.depth, components, relationships, warnings }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const output: Record<string, AppExtraction> = {}
const allWarnings: string[] = []

for (const app of APPS) {
  process.stdout.write(`Extracting ${app.name} (depth=${app.depth})... `)
  const result = extractApp(app)
  output[app.name] = result
  allWarnings.push(...result.warnings)
  console.log(
    `${Object.keys(result.components).length} components, ${result.relationships.length} relationships`
  )
}

if (allWarnings.length > 0) {
  console.warn('\nWarnings:')
  allWarnings.forEach(w => console.warn('  ⚠', w))
}

const outDir = path.join(REPO_ROOT, '.claude/skills/c4-model/output')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'structure.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
console.log(`\nWritten: ${path.relative(REPO_ROOT, outPath)}`)
