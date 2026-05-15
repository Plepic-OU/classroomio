/**
 * C4 diagram generator
 * Reads .claude/skills/c4-model/output/structure.json and writes Mermaid C4 diagrams to docs/c4/.
 *
 * Usage (from repo root):
 *   ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts
 *   ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts 3  # Layer 3 only
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const REPO_ROOT = process.cwd()
const STRUCTURE_JSON = path.join(REPO_ROOT, '.claude/skills/c4-model/output/structure.json')
const OUT_DIR = path.join(REPO_ROOT, 'docs/c4')
const LAYER_ONLY = process.argv[2] ? Number(process.argv[2]) : null

fs.mkdirSync(OUT_DIR, { recursive: true })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a component key to a safe Mermaid node ID */
function toId(key: string): string {
  return key.replace(/[/\-.]/g, '_').replace(/^_+|_+$/g, '') || 'root_id'
}

/** Infer a short technology label from the component key */
function inferTech(appName: string, key: string): string {
  if (appName === 'dashboard') {
    if (key.startsWith('lib/components')) return 'Svelte'
    if (key === 'lib/config') return 'Supabase client'
    if (key.startsWith('lib/utils/store')) return 'Svelte store'
    if (key.startsWith('lib/utils/services')) return 'TypeScript'
    if (key.startsWith('lib/utils')) return 'TypeScript'
    if (key.startsWith('routes/api')) return 'SvelteKit server'
    if (key.startsWith('routes')) return 'SvelteKit page'
    if (key === 'root') return 'SvelteKit hooks'
  }
  if (appName === 'api') {
    if (key.startsWith('routes')) return 'Hono router'
    if (key.startsWith('middlewares')) return 'Hono middleware'
    if (key.startsWith('services')) return 'TypeScript'
    if (key.startsWith('config')) return 'Zod'
    if (key.includes('redis')) return 'ioredis'
    if (key.includes('openapi')) return 'Scalar/OpenAPI'
  }
  return 'TypeScript'
}

/** Describe a component concisely for the diagram */
function describe(comp: { files: number; svelteFiles: number }): string {
  const parts: string[] = []
  if (comp.files > 0) parts.push(`${comp.files} TS`)
  if (comp.svelteFiles > 0) parts.push(`${comp.svelteFiles} Svelte`)
  return parts.join(' + ') + ' files'
}

function write(filename: string, content: string): void {
  const full = path.join(OUT_DIR, filename)
  fs.writeFileSync(full, content)
  console.log(`  wrote ${path.relative(REPO_ROOT, full)}`)
}

// ---------------------------------------------------------------------------
// Layer 1 — System Context
// ---------------------------------------------------------------------------

function generateL1(): string {
  return `# Layer 1: System Context

\`\`\`mermaid
C4Context
  title System Context — ClassroomIO LMS

  Person(student, "Student", "Learns via courses and exercises")
  Person(teacher, "Teacher", "Creates and manages courses, quizzes, attendance")

  System_Boundary(cio, "ClassroomIO") {
    System(dashboard, "Dashboard", "SvelteKit web app — course authoring, LMS, org management")
    System(api, "API", "Hono backend — file ops, email, certificate generation")
  }

  System_Ext(supabase, "Supabase", "PostgreSQL + Auth + Realtime")
  System_Ext(storage, "Cloud Storage", "Cloudflare R2 / AWS S3")
  System_Ext(email, "Email", "SMTP / Zeptomail")
  System_Ext(openai, "OpenAI", "AI content generation")
  System_Ext(polar, "Polar.sh", "Subscription billing")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error monitoring")

  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(teacher, dashboard, "Manages", "HTTPS")
  Rel(dashboard, api, "Calls", "HTTP/REST")
  Rel(dashboard, supabase, "Auth + direct queries", "Supabase SDK")
  Rel(api, supabase, "Reads/writes data", "Supabase SDK")
  Rel(api, storage, "Stores/retrieves files", "S3 API")
  Rel(api, email, "Sends email", "SMTP")
  Rel(dashboard, openai, "AI prompts", "HTTPS")
  Rel(dashboard, polar, "Billing webhooks", "HTTPS")
  Rel(dashboard, posthog, "Analytics events", "HTTPS")
  Rel(dashboard, sentry, "Error reports", "HTTPS")
  Rel(api, sentry, "Error reports", "HTTPS")
\`\`\`
`
}

// ---------------------------------------------------------------------------
// Layer 2 — Container
// ---------------------------------------------------------------------------

function generateL2(): string {
  return `# Layer 2: Container

\`\`\`mermaid
C4Container
  title Container Diagram — ClassroomIO

  Person(student, "Student")
  Person(teacher, "Teacher")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / Svelte 4", "LMS web app, port 5173. Conditional adapter: Node (self-hosted) or Vercel (cloud)")
    Container(api, "API", "Hono / Node.js", "Backend services, port 3002. File ops, email, cert generation, course cloning")
    Container(courseapp, "Course Player", "SvelteKit (embedded)", "Standalone embeddable course viewer, published as npm package")
  }

  ContainerDb(supabase, "Supabase", "PostgreSQL + Auth + Realtime", "Primary data store and auth provider")
  Container_Ext(r2, "Cloudflare R2", "Object Storage", "Primary file store (CLOUDFLARE_* env vars)")
  Container_Ext(s3, "AWS S3", "Object Storage", "Fallback file store (AWS_* env vars)")
  Container_Ext(smtp, "Email", "SMTP / Zeptomail / Nodemailer", "Transactional email delivery")
  Container_Ext(openai, "OpenAI", "LLM API", "AI-generated course content and exercise grading")
  Container_Ext(polar, "Polar.sh", "Billing API", "Subscription management and webhooks")
  Container_Ext(redis, "Redis", "Cache / Rate-limiter", "API rate limiting and caching")

  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(teacher, dashboard, "Uses", "HTTPS")
  Rel(dashboard, api, "REST calls via PUBLIC_SERVER_URL", "HTTP")
  Rel(dashboard, supabase, "Direct queries + auth", "Supabase SDK / WebSocket")
  Rel(api, supabase, "Data access (service role)", "Supabase SDK")
  Rel(api, r2, "File storage (primary)", "S3 API")
  Rel(api, s3, "File storage (fallback)", "AWS SDK v3")
  Rel(api, smtp, "Send email", "SMTP")
  Rel(api, redis, "Rate limiting", "ioredis")
  Rel(dashboard, openai, "AI prompts (server-side routes)", "HTTPS")
  Rel(dashboard, polar, "Billing (webhooks + portal)", "HTTPS")
\`\`\`
`
}

// ---------------------------------------------------------------------------
// Layer 3 — Component (per app, derived from AST extraction)
// ---------------------------------------------------------------------------

interface ComponentData {
  files: number
  svelteFiles: number
}
interface RelData {
  from: string
  to: string
  importCount: number
}
interface AppData {
  depth: number
  components: Record<string, ComponentData>
  relationships: RelData[]
  warnings: string[]
}

/**
 * Collapse sibling components that share the same parent key into that parent.
 * Triggered when >=minSiblings children appear under one parent — prevents
 * data-only directory clusters (e.g. lib/mocks/react, lib/mocks/python, ...)
 * from bloating the diagram.
 */
function collapseLeafClusters(
  components: Record<string, ComponentData>,
  relationships: RelData[],
  minSiblings = 10
): { components: Record<string, ComponentData>; relationships: RelData[] } {
  // Identify parents whose direct children are numerous
  const childrenOf: Record<string, string[]> = {}
  for (const key of Object.keys(components)) {
    if (!key.includes('/')) continue
    const parent = key.split('/').slice(0, -1).join('/')
    ;(childrenOf[parent] ??= []).push(key)
  }

  const collapseChild = new Map<string, string>() // child key → parent key
  const collapsedParents = new Set<string>()
  for (const [parent, children] of Object.entries(childrenOf)) {
    if (children.length < minSiblings) continue
    // Only collapse data-only clusters: no child has Svelte files (i.e. these are pure TS data dirs)
    const anySvelte = children.some(c => (components[c]?.svelteFiles ?? 0) > 0)
    if (anySvelte) continue
    for (const child of children) collapseChild.set(child, parent)
    collapsedParents.add(parent)
  }

  if (collapsedParents.size === 0) return { components, relationships }

  const newComponents: Record<string, ComponentData> = {}
  for (const [key, data] of Object.entries(components)) {
    const mappedKey = collapseChild.get(key) ?? key
    if (!newComponents[mappedKey]) newComponents[mappedKey] = { files: 0, svelteFiles: 0 }
    newComponents[mappedKey].files += data.files
    newComponents[mappedKey].svelteFiles += data.svelteFiles
  }

  const relMap = new Map<string, number>()
  const mapKey = (k: string) => collapseChild.get(k) ?? k
  for (const rel of relationships) {
    const from = mapKey(rel.from)
    const to = mapKey(rel.to)
    if (from === to) continue
    const rk = `${from}\x00${to}`
    relMap.set(rk, (relMap.get(rk) ?? 0) + rel.importCount)
  }
  const newRels: RelData[] = Array.from(relMap.entries()).map(([rk, count]) => {
    const sep = rk.indexOf('\x00')
    return { from: rk.slice(0, sep), to: rk.slice(sep + 1), importCount: count }
  })

  return { components: newComponents, relationships: newRels }
}

function generateL3(appName: string, data: AppData): string {
  const { depth, warnings } = data
  const { components, relationships } = collapseLeafClusters(data.components, data.relationships)
  const lines: string[] = []

  lines.push(`# Layer 3: Components — @cio/${appName}`)
  lines.push('')
  lines.push(`> Extracted at depth=${depth}. ${Object.keys(components).length} components, ${relationships.length} cross-component imports.`)
  if (warnings.length > 0) {
    lines.push(`> ⚠ Warnings: ${warnings.join('; ')}`)
  }
  lines.push('')

  lines.push('```mermaid')
  lines.push('C4Component')
  lines.push(`  title Component Diagram — @cio/${appName}`)
  lines.push('')
  lines.push(`  Container_Boundary(${appName}_b, "@cio/${appName}") {`)

  for (const [key, comp] of Object.entries(components)) {
    const id = toId(appName + '_' + key)
    const tech = inferTech(appName, key)
    const desc = describe(comp)
    // Use the last path segment as the short label, full key as description prefix
    const label = key === 'root' ? '(root)' : key.split('/').pop()!
    lines.push(`    Component(${id}, "${label}", "${tech}", "${key} — ${desc}")`)
  }

  lines.push('  }')
  lines.push('')

  // External systems referenced at the component level
  if (appName === 'dashboard') {
    lines.push('  ContainerDb(dash_supabase, "Supabase", "PostgreSQL + Auth", "Direct SDK access")')
    lines.push('  Container_Ext(dash_api, "@cio/api", "Hono backend", "Called from server routes")')
    lines.push('')
  }
  if (appName === 'api') {
    lines.push('  ContainerDb(api_supabase, "Supabase", "PostgreSQL", "Service-role access")')
    lines.push('  Container_Ext(api_r2, "Cloudflare R2 / S3", "Object Storage", "File storage")')
    lines.push('  Container_Ext(api_smtp, "SMTP", "Nodemailer", "Email delivery")')
    lines.push('  Container_Ext(api_redis, "Redis", "ioredis", "Rate limiting / cache")')
    lines.push('')
  }

  for (const rel of relationships) {
    const fromId = toId(appName + '_' + rel.from)
    const toId_ = toId(appName + '_' + rel.to)
    lines.push(`  Rel(${fromId}, ${toId_}, "imports", "${rel.importCount}x")`)
  }

  // Add known external rels for key components
  if (appName === 'dashboard') {
    const libConfigId = toId(appName + '_lib/config')
    if (components['lib/config']) {
      lines.push(`  Rel(${libConfigId}, dash_supabase, "initializes client")`)
    }
    const routesApiId = toId(appName + '_routes/api')
    if (components['routes/api']) {
      lines.push(`  Rel(${routesApiId}, dash_api, "HTTP calls")`)
    }
  }
  if (appName === 'api') {
    const routesCourseId = toId(appName + '_routes/course')
    if (components['routes/course']) {
      lines.push(`  Rel(${routesCourseId}, api_supabase, "queries")`)
      lines.push(`  Rel(${routesCourseId}, api_r2, "file ops")`)
    }
    if (components['routes/mail']) {
      const routesMailId = toId(appName + '_routes/mail')
      lines.push(`  Rel(${routesMailId}, api_smtp, "send email")`)
    } else if (components['routes']) {
      const routesId = toId(appName + '_routes')
      lines.push(`  Rel(${routesId}, api_smtp, "send email")`)
    }
    const utilsRedisId = toId(appName + '_utils/redis')
    if (components['utils/redis']) {
      lines.push(`  Rel(${utilsRedisId}, api_redis, "rate limiting")`)
    }
  }

  lines.push('```')
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// README index
// ---------------------------------------------------------------------------

function generateReadme(hasDb: boolean): string {
  return `# C4 Architecture Diagrams — ClassroomIO

Auto-generated by \`.claude/skills/c4-model\`. Do not edit by hand; re-run the skill instead.

| File | Level | Description |
|------|-------|-------------|
| [L1-context.md](L1-context.md) | 1 — System Context | External actors and high-level system boundary |
| [L2-containers.md](L2-containers.md) | 2 — Container | Deployable units and their interactions |
| [L3-dashboard.md](L3-dashboard.md) | 3 — Component | Internal modules of @cio/dashboard (AST-derived) |
| [L3-api.md](L3-api.md) | 3 — Component | Internal modules of @cio/api (AST-derived) |
${hasDb ? '| [database.md](database.md) | DB schema | Tables, columns, and FK relationships |\n' : ''}
## Regenerating

\`\`\`bash
# Full refresh (all layers):
pnpm add -D -w ts-morph && ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts

# Database schema (requires supabase start):
bash .claude/skills/c4-model/db-extract.sh

# Layer 3 only (after extraction):
./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/generate.ts 3
\`\`\`

## Component depth

| App | Depth | Rationale |
|-----|-------|-----------|
| dashboard | 3 | e.g. \`lib/components/Course\`, \`lib/utils/store\`, \`routes/api/courses\` |
| api | 2 | e.g. \`routes/course\`, \`services/course\`, \`utils/redis\` |

Override: \`DASHBOARD_DEPTH=4 ./apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts\`
`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`Reading ${path.relative(REPO_ROOT, STRUCTURE_JSON)}`)
const structure: Record<string, AppData> = JSON.parse(fs.readFileSync(STRUCTURE_JSON, 'utf-8'))

if (!LAYER_ONLY || LAYER_ONLY === 1) {
  console.log('Generating L1...')
  write('L1-context.md', generateL1())
}
if (!LAYER_ONLY || LAYER_ONLY === 2) {
  console.log('Generating L2...')
  write('L2-containers.md', generateL2())
}
if (!LAYER_ONLY || LAYER_ONLY === 3) {
  console.log('Generating L3...')
  for (const [appName, data] of Object.entries(structure)) {
    write(`L3-${appName}.md`, generateL3(appName, data))
  }
}

const hasDb = fs.existsSync(path.join(OUT_DIR, 'database.md'))
write('README.md', generateReadme(hasDb))

console.log('\nDone. Diagrams in docs/c4/')
