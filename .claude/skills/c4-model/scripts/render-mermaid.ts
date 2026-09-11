#!/usr/bin/env tsx
/**
 * Renders a Mermaid C4Component diagram from the JSON produced by
 * extract-components.ts. Purely mechanical (no LLM/manual input) so Layer 3
 * output stays a faithful, deterministic rendering of the AST extraction.
 *
 * Usage:
 *   tsx render-mermaid.ts <dashboard|api> [--in=path] [--out=path]
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../../');

interface ComponentEntry {
  key: string;
  dir: string;
  tsFileCount: number;
  svelteFileCount: number;
  fileCount: number;
  warning?: string;
}
interface RelationshipEntry {
  source: string;
  target: string;
  weight: number;
}
interface Report {
  app: string;
  generatedAt: string;
  depth: number;
  srcRoot: string;
  components: ComponentEntry[];
  relationships: RelationshipEntry[];
  stats: { componentsOverWarningThreshold: string[] };
}

interface TreeNode {
  segment: string;
  pathKey: string;
  children: Map<string, TreeNode>;
  component?: ComponentEntry;
}

const CONTAINER_META: Record<string, { id: string; label: string; tech: string }> = {
  dashboard: { id: 'dashboard', label: 'Dashboard', tech: 'SvelteKit (Svelte 4, TypeScript)' },
  api: { id: 'api', label: 'API', tech: 'Hono (TypeScript)' }
};

function slug(key: string): string {
  return key.replace(/[^A-Za-z0-9_]/g, '_');
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'");
}

function techFor(c: ComponentEntry): string {
  if (c.tsFileCount > 0 && c.svelteFileCount > 0) return 'TS + Svelte';
  if (c.svelteFileCount > 0) return 'Svelte';
  return 'TypeScript';
}

function describe(c: ComponentEntry): string {
  const parts: string[] = [];
  if (c.tsFileCount > 0) parts.push(`${c.tsFileCount} ts`);
  if (c.svelteFileCount > 0) parts.push(`${c.svelteFileCount} svelte`);
  const base = parts.join(', ') || `${c.fileCount} files`;
  return c.warning ? `${base} (!)` : base;
}

function buildTree(components: ComponentEntry[]): TreeNode {
  const root: TreeNode = { segment: '', pathKey: '', children: new Map() };
  for (const c of components) {
    if (c.key === '(src root)') {
      root.component = c;
      continue;
    }
    const parts = c.key.split('/');
    let node = root;
    const acc: string[] = [];
    for (const part of parts) {
      acc.push(part);
      const pathKey = acc.join('/');
      let child = node.children.get(part);
      if (!child) {
        child = { segment: part, pathKey, children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    }
    node.component = c;
  }
  return root;
}

/** Renders the tree, returns the mermaid lines and a map of component key -> mermaid node id. */
function renderNode(
  node: TreeNode,
  indent: string,
  appId: string,
  lines: string[],
  keyToNodeId: Map<string, string>
) {
  for (const child of Array.from(node.children.values()).sort((a, b) => a.segment.localeCompare(b.segment))) {
    const isPureLeaf = child.component && child.children.size === 0;
    if (isPureLeaf) {
      const c = child.component!;
      const id = `${appId}_${slug(c.key)}`;
      keyToNodeId.set(c.key, id);
      lines.push(`${indent}Component(${id}, "${escapeLabel(child.segment)}", "${techFor(c)}", "${describe(c)}")`);
      continue;
    }
    const boundaryId = `${appId}_b_${slug(child.pathKey)}`;
    lines.push(`${indent}Boundary(${boundaryId}, "${escapeLabel(child.segment)}") {`);
    if (child.component) {
      const c = child.component;
      const id = `${appId}_${slug(c.key)}`;
      keyToNodeId.set(c.key, id);
      lines.push(
        `${indent}  Component(${id}, "${escapeLabel(child.segment)} (files here)", "${techFor(c)}", "${describe(c)}")`
      );
    }
    renderNode(child, indent + '  ', appId, lines, keyToNodeId);
    lines.push(`${indent}}`);
  }
}

function render(report: Report): string {
  const meta = CONTAINER_META[report.app] ?? { id: report.app, label: report.app, tech: '' };
  const tree = buildTree(report.components);
  const bodyLines: string[] = [];
  const keyToNodeId = new Map<string, string>();
  renderNode(tree, '    ', meta.id, bodyLines, keyToNodeId);

  const relLines = report.relationships
    .map((r) => {
      const source = keyToNodeId.get(r.source);
      const target = keyToNodeId.get(r.target);
      if (!source || !target) return null;
      return `    Rel(${source}, ${target}, "imports", "×${r.weight}")`;
    })
    .filter((l): l is string => l !== null);

  return [
    'C4Component',
    `title ${meta.label} — Component Diagram (Layer 3)`,
    '',
    `Container_Boundary(${meta.id}, "${meta.label}", "${meta.tech}") {`,
    ...bodyLines,
    '}',
    '',
    ...relLines
  ].join('\n');
}

function main() {
  const [app, ...rest] = process.argv.slice(2);
  if (!app) {
    console.error('Usage: render-mermaid.ts <dashboard|api> [--in=path] [--out=path]');
    process.exit(1);
  }
  let inPath: string | undefined;
  let outPath: string | undefined;
  for (const arg of rest) {
    if (arg.startsWith('--in=')) inPath = arg.slice('--in='.length);
    else if (arg.startsWith('--out=')) outPath = arg.slice('--out='.length);
  }
  const resolvedIn = inPath ? path.resolve(REPO_ROOT, inPath) : path.join(REPO_ROOT, 'docs/c4/.data', `${app}-components.json`);
  const resolvedOut = outPath ? path.resolve(REPO_ROOT, outPath) : path.join(REPO_ROOT, 'docs/c4', `level3-${app}.md`);

  if (!fs.existsSync(resolvedIn)) {
    console.error(`Extraction JSON not found: ${resolvedIn}. Run extract-components.ts first.`);
    process.exit(1);
  }
  const report: Report = JSON.parse(fs.readFileSync(resolvedIn, 'utf8'));
  const mermaid = render(report);
  const meta = CONTAINER_META[report.app] ?? { label: report.app };

  const warnings = report.stats.componentsOverWarningThreshold ?? [];
  const warningBlock = warnings.length
    ? `\n> **Depth warning:** ${warnings.length} component(s) exceed 50 files at depth=${report.depth} — the grouping is probably too coarse there. Re-run extraction with a higher \`--depth\` for finer granularity: ${warnings.map((w) => `\`${w}\``).join(', ')}.\n`
    : '';

  const doc = `# Layer 3 — ${meta.label} Component Diagram

Derived from the codebase AST (ts-morph), not hand-authored. Regenerate after structural changes:

\`\`\`bash
pnpm exec tsx .claude/skills/c4-model/scripts/extract-components.ts ${report.app} --depth=${report.depth}
pnpm exec tsx .claude/skills/c4-model/scripts/render-mermaid.ts ${report.app}
\`\`\`

Generated: ${report.generatedAt} · depth: ${report.depth} · source: \`${report.srcRoot}\`
${warningBlock}
\`\`\`mermaid
${mermaid}
\`\`\`
`;

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, doc);
  console.log(`wrote ${path.relative(REPO_ROOT, resolvedOut)}`);
}

main();
