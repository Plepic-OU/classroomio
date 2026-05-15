#!/usr/bin/env node
/**
 * extract.ts — walk the monorepo and emit a JSON inventory of every test/spec file
 * with its describe/it/test block names.
 *
 * Run from monorepo root:
 *   apps/api/node_modules/.bin/tsx .claude/skills/coverage/extract.ts
 *
 * Writes: docs/c4/test-inventory.json  (gitignored)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'docs/c4/test-inventory.json')

const SKIP_DIRS = new Set([
  'node_modules', '.svelte-kit', 'dist', 'build', '.git',
  '.turbo', 'coverage', '.cache', '.next',
])

function isTestFile(name: string): boolean {
  const lower = name.toLowerCase()
  const ext = extname(name)
  return (lower.includes('.spec.') || lower.includes('.test.')) &&
    ['.ts', '.js', '.mts', '.mjs'].includes(ext)
}

function walk(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(full))
    } else if (entry.isFile() && isTestFile(entry.name)) {
      results.push(full)
    }
  }
  return results
}

// Regex patterns — capture the string literal after describe/it/test
const DESCRIBE_RE = /\b(?:describe|context)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g
const IT_RE = /\b(?:it|test)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g

function extractMatches(re: RegExp, src: string): string[] {
  const results: string[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    // one of the three capture groups will be non-null (single/double/backtick)
    results.push(m[1] ?? m[2] ?? m[3])
  }
  return results
}

function detectFramework(filePath: string, src: string): string {
  if (filePath.includes('packages/course-app') && src.includes('page')) return 'vitest'
  if (src.includes("from 'vitest'") || src.includes('from "vitest"')) return 'vitest'
  if (src.includes('playwright') || src.includes('@playwright')) return 'playwright'
  if (src.includes("from '@testing-library'") || src.includes('svelte-testing-library')) return 'vitest'
  // dashboard specs don't import jest explicitly — Jest is ambient
  return 'jest'
}

const files = walk(ROOT)

interface TestFile {
  path: string       // relative to repo root
  framework: string
  describes: string[]
  tests: string[]
}

const inventory: TestFile[] = files.map(file => {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)
  return {
    path: rel,
    framework: detectFramework(rel, src),
    describes: extractMatches(DESCRIBE_RE, src),
    tests: extractMatches(IT_RE, src),
  }
})

// Sort by path for stable output
inventory.sort((a, b) => a.path.localeCompare(b.path))

writeFileSync(OUT, JSON.stringify(inventory, null, 2))

const totalTests = inventory.reduce((n, f) => n + f.tests.length, 0)
console.log(`Wrote ${inventory.length} files, ${totalTests} tests → docs/c4/test-inventory.json`)
