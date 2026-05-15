#!/usr/bin/env node
/**
 * generate-diagrams.mjs — render Mermaid C4 diagrams from:
 *   - references/classroomio-system.md  (curated Layer 1 + 2 facts)
 *   - docs/c4/.extraction/<app>.json    (AST output, Layer 3)
 *
 * Writes:
 *   docs/c4/README.md
 *   docs/c4/layer1-context.md
 *   docs/c4/layer2-containers.md
 *   docs/c4/layer3-<appKey>.md   (one per `appKey` in classroomio-system.md)
 *
 * Flags:
 *   --max-elements N   Cap Layer-3 components to top-N by edge degree (default 30).
 *   --min-edge-count N Drop edges with import count below N (default 1).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'c4');
const EXTRACT_DIR = path.join(OUT_DIR, '.extraction');

const args = process.argv.slice(2);
const flagVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const MAX_ELEMENTS = parseInt(flagVal('--max-elements', '30'), 10);
const MIN_EDGE_COUNT = parseInt(flagVal('--min-edge-count', '1'), 10);

// ---------------------------------------------------------------------------

function loadCurated() {
  const md = fs.readFileSync(path.join(SKILL_DIR, 'references', 'classroomio-system.md'), 'utf8');
  // Require the fence on its own line so inline mentions in prose are ignored.
  const re = /^```json\s*\n([\s\S]*?)\n^```\s*$/gm;
  const merged = {};
  let m;
  while ((m = re.exec(md)) !== null) {
    let obj;
    try {
      obj = JSON.parse(m[1]);
    } catch (e) {
      throw new Error(`Invalid JSON in classroomio-system.md: ${e.message}\n--- block ---\n${m[1].slice(0, 200)}…`);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && Array.isArray(merged[k])) merged[k] = merged[k].concat(v);
      else merged[k] = v;
    }
  }
  return merged;
}

function slugify(s) {
  let out = s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!/^[a-zA-Z]/.test(out)) out = 'c_' + out;
  return out;
}

function esc(s) {
  return String(s ?? '')
    .replace(/"/g, "'")
    .replace(/\r?\n/g, ' ');
}

// ---------------------------------------------------------------------------
// Layer 1

function renderLayer1(curated) {
  const sys = curated.system;
  if (!sys) throw new Error('classroomio-system.md is missing the `system` block');
  const people = curated.people ?? [];
  const ext = curated.externalSystems ?? [];
  const rels = curated.contextRelationships ?? [];
  const out = ['C4Context', `  title System context — ${esc(sys.label)}`, ''];
  for (const p of people) out.push(`  Person(${p.alias}, "${esc(p.label)}", "${esc(p.description)}")`);
  out.push('');
  out.push(`  System(${sys.alias}, "${esc(sys.label)}", "${esc(sys.description)}")`);
  out.push('');
  for (const e of ext) {
    const kind = e.kind === 'db' ? 'SystemDb_Ext' : 'System_Ext';
    out.push(`  ${kind}(${e.alias}, "${esc(e.label)}", "${esc(e.description)}")`);
  }
  out.push('');
  for (const r of rels) out.push(`  Rel(${r.from}, ${r.to}, "${esc(r.label)}")`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Layer 2

function renderLayer2(curated) {
  const sys = curated.system;
  const people = curated.people ?? [];
  const ext = curated.externalSystems ?? [];
  const containers = curated.containers ?? [];
  const rels = curated.containerRelationships ?? [];
  const out = ['C4Container', `  title Containers — ${esc(sys.label)}`, ''];
  for (const p of people) out.push(`  Person(${p.alias}, "${esc(p.label)}", "${esc(p.description)}")`);
  out.push('');
  out.push(`  System_Boundary(${sys.alias}, "${esc(sys.label)}") {`);
  for (const c of containers) {
    const kind = c.kind === 'db' ? 'ContainerDb' : 'Container';
    out.push(
      `    ${kind}(${c.alias}, "${esc(c.label)}", "${esc(c.technology)}", "${esc(c.description)}")`
    );
  }
  out.push('  }');
  out.push('');
  for (const e of ext) {
    const kind = e.kind === 'db' ? 'SystemDb_Ext' : 'System_Ext';
    out.push(`  ${kind}(${e.alias}, "${esc(e.label)}", "${esc(e.description)}")`);
  }
  out.push('');
  for (const r of rels) {
    const tech = r.technology ? `, "${esc(r.technology)}"` : '';
    out.push(`  Rel(${r.from}, ${r.to}, "${esc(r.label)}"${tech})`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Layer 3

function renderLayer3(extracted, containerLabel) {
  const out = ['C4Component', `  title ${esc(containerLabel)} — components (depth=${extracted.depth})`, ''];

  const degree = new Map();
  for (const r of extracted.relationships) {
    if (r.count < MIN_EDGE_COUNT) continue;
    degree.set(r.from, (degree.get(r.from) ?? 0) + r.count);
    degree.set(r.to, (degree.get(r.to) ?? 0) + r.count);
  }
  const components = [...extracted.components];
  // Highest-degree first; tie-break by file count desc, then key
  components.sort(
    (a, b) =>
      (degree.get(b.key) ?? 0) - (degree.get(a.key) ?? 0) ||
      b.files - a.files ||
      a.key.localeCompare(b.key)
  );
  const kept = components.slice(0, MAX_ELEMENTS);
  const keptKeys = new Set(kept.map((c) => c.key));

  // Ensure unique aliases
  const usedAliases = new Set();
  const aliasFor = new Map();
  for (const c of kept) {
    let a = slugify(c.key);
    let i = 1;
    while (usedAliases.has(a)) a = `${slugify(c.key)}_${++i}`;
    usedAliases.add(a);
    aliasFor.set(c.key, a);
  }

  out.push(`  Container_Boundary(boundary, "${esc(containerLabel)}") {`);
  // Order kept by key so the diagram is alphabetical / readable
  const orderedKept = [...kept].sort((a, b) => a.key.localeCompare(b.key));
  for (const c of orderedKept) {
    const tech = [];
    if (c.ts) tech.push(`${c.ts} ts`);
    if (c.svelte) tech.push(`${c.svelte} svelte`);
    if (c.js) tech.push(`${c.js} js`);
    out.push(
      `    Component(${aliasFor.get(c.key)}, "${esc(c.key)}", "${esc(tech.join(', '))}", "${esc(c.files + ' files')}")`
    );
  }
  out.push('  }');
  out.push('');

  let drawn = 0;
  for (const r of extracted.relationships) {
    if (r.count < MIN_EDGE_COUNT) continue;
    if (!keptKeys.has(r.from) || !keptKeys.has(r.to)) continue;
    const label = r.count > 1 ? `uses ×${r.count}` : 'uses';
    out.push(`  Rel(${aliasFor.get(r.from)}, ${aliasFor.get(r.to)}, "${label}")`);
    drawn++;
  }

  const totalEdges = extracted.relationships.length;
  const trailer = [
    `- Components kept: **${kept.length}** of ${components.length}` +
      (components.length > kept.length
        ? ` (cap \`--max-elements ${MAX_ELEMENTS}\`)`
        : ''),
    `- Edges drawn: **${drawn}** of ${totalEdges}`
  ];
  if (components.length > kept.length) {
    const omitted = components.slice(MAX_ELEMENTS).map((c) => c.key);
    trailer.push(`- Omitted (low connectivity): ${omitted.slice(0, 20).join(', ')}${omitted.length > 20 ? `, … (+${omitted.length - 20})` : ''}`);
  }
  return { mermaid: out.join('\n'), trailer };
}

// ---------------------------------------------------------------------------

function writeMd(file, body) {
  fs.writeFileSync(file, body);
  console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
}

function wrap(mermaid) {
  return '```mermaid\n' + mermaid + '\n```';
}

// ---------------------------------------------------------------------------

const curated = loadCurated();
fs.mkdirSync(OUT_DIR, { recursive: true });

writeMd(
  path.join(OUT_DIR, 'layer1-context.md'),
  `# Layer 1 — System context

> Generated by \`.claude/skills/c4-model\`. Edit \`references/classroomio-system.md\` to change Layer 1 facts.

${wrap(renderLayer1(curated))}
`
);

writeMd(
  path.join(OUT_DIR, 'layer2-containers.md'),
  `# Layer 2 — Containers

> Generated by \`.claude/skills/c4-model\`. Edit \`references/classroomio-system.md\` to change Layer 2 facts.

${wrap(renderLayer2(curated))}
`
);

const generatedLayer3 = [];
for (const container of curated.containers ?? []) {
  if (!container.appKey) continue;
  const jsonPath = path.join(EXTRACT_DIR, `${container.appKey}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.warn(
      `[skip] layer3-${container.appKey}.md — no extraction at ${path.relative(REPO_ROOT, jsonPath)} (run extract-components.mjs first)`
    );
    continue;
  }
  const extracted = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const { mermaid, trailer } = renderLayer3(extracted, container.label);
  const warningBlock = extracted.warnings?.length
    ? `\n**Warnings**\n\n${extracted.warnings.map((w) => `- ${w}`).join('\n')}\n`
    : '';
  const md = `# Layer 3 — ${container.label} components

> Generated by \`.claude/skills/c4-model\` from \`docs/c4/.extraction/${container.appKey}.json\`.
> Source root: \`${extracted.root}/${extracted.src}\`, depth=${extracted.depth}.

${wrap(mermaid)}

${trailer.join('\n')}
${warningBlock}`;
  writeMd(path.join(OUT_DIR, `layer3-${container.appKey}.md`), md);
  generatedLayer3.push({ key: container.appKey, label: container.label });
}

// Index README
const layer3Links = generatedLayer3
  .map((g) => `- [Layer 3 — ${g.label}](layer3-${g.key}.md)`)
  .join('\n');
const dbExists = fs.existsSync(path.join(OUT_DIR, 'database.md'));
writeMd(
  path.join(OUT_DIR, 'README.md'),
  `# C4 model — ClassroomIO

Generated by [\`.claude/skills/c4-model\`](../../.claude/skills/c4-model/SKILL.md).
Layer 3 is derived from the source AST (ts-morph + Svelte script scanning).
Layers 1 and 2 are curated in [\`references/classroomio-system.md\`](../../.claude/skills/c4-model/references/classroomio-system.md).

## Diagrams

- [Layer 1 — System context](layer1-context.md)
- [Layer 2 — Containers](layer2-containers.md)
${layer3Links}
${dbExists ? '- [Database schema](database.md)' : '- _Database schema not generated — run `extract-database.sh` with Supabase running._'}

## Refresh

\`\`\`bash
cd .claude/skills/c4-model && pnpm install --ignore-workspace --silent \\
  && node extract-components.mjs dashboard \\
  && node extract-components.mjs api \\
  && bash extract-database.sh \\
  && node generate-diagrams.mjs
\`\`\`
`
);
