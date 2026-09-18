#!/usr/bin/env tsx
/**
 * Static gap inventory for the bdd-extend skill.
 *
 * 1. Walks apps/dashboard/src/routes/**\/+page.svelte and classifies each leaf route by
 *    audience from its path prefix: org/ or courses/ -> teacher, lms/ -> student,
 *    everything else -> auth/shared.
 * 2. Reads references/coverage-plan.md and parses its `- **Wave N — Label:** ...` lines,
 *    pulling the backtick-quoted route hints out of each wave's description. This file is
 *    the single source of priority order — this script doesn't hardcode a parallel wave
 *    list, so editing coverage-plan.md is enough to change what ranks next.
 * 3. Walks tests/e2e/features/**\/*.feature and, without a full Gherkin parse, pulls out
 *    each file's `Feature:` title, `Scenario:`/`Scenario Outline:` titles, and `@tag`s.
 * 4. For each wave route hint (skipping wave 0 "exists" and wave 4 "backlog"), checks
 *    whether an existing feature file's path or title textually references it. This is a
 *    heuristic, not an oracle — it's meant to produce a ranked starting point for a human
 *    or the skill to review, not a verdict.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/bdd-extend/scripts/inventory-flows.ts [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ROUTES_DIR = path.join(REPO_ROOT, 'apps/dashboard/src/routes');
const FEATURES_DIR = path.join(REPO_ROOT, 'tests/e2e/features');
const COVERAGE_PLAN = path.join(__dirname, '../references/coverage-plan.md');

type Audience = 'teacher' | 'student' | 'auth/shared';

interface RouteEntry {
  /** route path relative to routes/, '+page.svelte' stripped, e.g. "courses/[id]/lessons" */
  route: string;
  audience: Audience;
}

interface Wave {
  number: number;
  label: string;
  raw: string;
  routeHints: string[];
  skip: boolean; // wave 0 (exists) or wave 4+ (explicitly backlog) — not a gap to rank
}

interface FeatureFile {
  path: string; // relative to repo root
  title: string;
  scenarios: string[];
  tags: string[];
}

function walkPageRoutes(dir: string, base = dir): RouteEntry[] {
  const entries: RouteEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walkPageRoutes(full, base));
    } else if (name === '+page.svelte') {
      const relDir = path.relative(base, dir).split(path.sep).join('/');
      const route = relDir === '' ? '/' : relDir;
      entries.push({ route, audience: classifyAudience(route) });
    }
  }
  return entries;
}

function classifyAudience(route: string): Audience {
  // Match the bare segment too ("lms", not just "lms/...") — a leaf route at exactly
  // apps/dashboard/src/routes/lms/+page.svelte resolves to the route string "lms" with no
  // trailing slash, which a startsWith('lms/') check alone would miss.
  if (route === 'org' || route.startsWith('org/')) return 'teacher';
  if (route === 'courses' || route.startsWith('courses/')) return 'teacher';
  if (route === 'lms' || route.startsWith('lms/')) return 'student';
  return 'auth/shared';
}

function parseWaves(markdown: string): Wave[] {
  const waves: Wave[] = [];
  const lineRe = /^- \*\*Wave (\d+)([^*]*)\*\*:?\s*(.*)$/;
  for (const line of markdown.split('\n')) {
    const match = line.match(lineRe);
    if (!match) continue;
    const [, numStr, labelRaw, desc] = match;
    const number = Number(numStr);
    const label = labelRaw
      .trim()
      .replace(/^—\s*/, '')
      .replace(/:$/, '')
      .replace(/[()]/g, '')
      .trim();
    const routeHints = [...desc.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // Only the wave's own label decides skip — testing the free-form description too would
    // drop a legitimate future wave whose flow text happens to contain "exists"/"backlog"
    // (e.g. "verify the certificate exists").
    const skip = /exists|backlog/i.test(labelRaw);
    waves.push({ number, label, raw: line, routeHints, skip });
  }
  return waves.sort((a, b) => a.number - b.number);
}

function walkFeatureFiles(dir: string): FeatureFile[] {
  if (!fs.existsSync(dir)) return [];
  const files: FeatureFile[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkFeatureFiles(full));
      continue;
    }
    if (!name.endsWith('.feature')) continue;
    const content = fs.readFileSync(full, 'utf-8');
    const titleMatch = content.match(/^Feature:\s*(.+)$/m);
    // "Example" is Gherkin's accepted synonym for "Scenario" (both singular — the plural
    // "Examples:" is the Scenario Outline data-table keyword, deliberately not matched here).
    const scenarios = [...content.matchAll(/^\s*(?:Scenario|Example)(?: Outline)?:\s*(.+)$/gm)].map(
      (m) => m[1].trim()
    );
    // Only from lines that (once trimmed) are themselves a tag line — a plain content
    // match would also catch an '@' inside quoted step text, e.g. "admin@test.com".
    // A tag line can be indented (scenario-level) and carry more than one tag.
    const tags = [
      ...new Set(
        content
          .split('\n')
          .filter((line) => line.trim().startsWith('@'))
          .flatMap((line) => [...line.matchAll(/@[\w-]+/g)].map((m) => m[0]))
      )
    ];
    files.push({
      path: path.relative(REPO_ROOT, full),
      title: titleMatch?.[1]?.trim() ?? '(untitled)',
      scenarios,
      tags
    });
  }
  return files;
}

/**
 * Segments that show up in nearly every route as directory scaffolding, not as anything
 * distinguishing a specific flow — must be excluded or e.g. "courses/[id]/lessons" false-
 * matches any feature merely living under features/courses/ (course-creation.feature).
 */
const GENERIC_SEGMENTS = new Set([
  'courses',
  'course',
  'org',
  'lms',
  'id',
  'slug',
  'hash',
  'params'
]);

/** Strips everything but letters/digits, so "my-learning" and "mylearning" compare equal. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface CoverageMatch {
  feature: FeatureFile | undefined;
  /** true when the hint had no non-generic keyword to match on at all — distinct from a
   *  genuine GAP, since there's nothing here for this heuristic to have ruled on. */
  unrankable: boolean;
}

/**
 * Loose textual match: does any feature's path/title/scenario text reference this route
 * hint? Matches on normalized (punctuation-stripped) substrings, trying both a keyword and
 * its naive singular (trailing 's' stripped) so "lessons" still matches "lesson-creation"
 * and "mylearning" still matches "my-learning". This is a heuristic, not an oracle — it can
 * still both over-match (a keyword that's also a substring of an unrelated word) and
 * under-match (synonyms, non-trivial plurals); skim the named feature file before trusting
 * a "covered" verdict.
 */
function isHintCovered(hint: string, features: FeatureFile[]): CoverageMatch {
  const rawKeywords = hint
    .toLowerCase()
    // Split on whitespace too, not just path punctuation — a hint isn't guaranteed to be a
    // bare path (e.g. free-form prose in a wave description), and filtering/normalizing
    // must agree on the same token or a stray trailing space defeats GENERIC_SEGMENTS.
    .split(/[\s/[\]().]+/)
    .map(normalize)
    .filter((w) => w.length > 2 && !GENERIC_SEGMENTS.has(w));

  if (rawKeywords.length === 0) return { feature: undefined, unrankable: true };

  const variants = rawKeywords.flatMap((norm) =>
    norm.endsWith('s') && norm.length > 3 ? [norm, norm.slice(0, -1)] : [norm]
  );

  const feature = features.find((f) => {
    const haystack = normalize(`${f.path} ${f.title} ${f.scenarios.join(' ')}`);
    return variants.some((kw) => haystack.includes(kw));
  });

  return { feature, unrankable: false };
}

function main() {
  const asJson = process.argv.includes('--json');

  const routes = walkPageRoutes(ROUTES_DIR);
  const waves = parseWaves(fs.readFileSync(COVERAGE_PLAN, 'utf-8'));
  const features = walkFeatureFiles(FEATURES_DIR);

  const gaps = waves
    .filter((w) => !w.skip)
    .flatMap((wave) =>
      wave.routeHints.map((hint) => {
        const { feature, unrankable } = isHintCovered(hint, features);
        return {
          wave: wave.number,
          label: wave.label,
          routeHint: hint,
          // classifyAudience is prefix-based and self-sufficient for any hint string —
          // no need to cross-reference the route inventory (and a naive hint.startsWith(
          // route) would wrongly match e.g. "lms/mylearning" against the bare "lms" route).
          audience: classifyAudience(hint),
          covered: Boolean(feature),
          coveredBy: feature?.path,
          unrankable
        };
      })
    )
    .sort((a, b) => a.wave - b.wave);

  if (asJson) {
    console.log(JSON.stringify({ routes, waves, features, gaps }, null, 2));
    return;
  }

  console.log(`Route inventory: ${routes.length} leaf routes under apps/dashboard/src/routes\n`);
  for (const audience of ['teacher', 'student', 'auth/shared'] as Audience[]) {
    const subset = routes.filter((r) => r.audience === audience);
    console.log(`  ${audience} (${subset.length}):`);
    for (const r of subset) console.log(`    ${r.route}`);
  }

  console.log(`\nExisting feature files: ${features.length}`);
  for (const f of features) {
    console.log(`  ${f.path} — "${f.title}"${f.tags.length ? ` [${f.tags.join(', ')}]` : ''}`);
  }

  console.log('\nRanked gaps (next-wave-first; skips wave 0/exists and backlog waves):');
  let lastWave = -1;
  for (const gap of gaps) {
    if (gap.wave !== lastWave) {
      console.log(`\n  Wave ${gap.wave} — ${gap.label}`);
      lastWave = gap.wave;
    }
    const status = gap.covered
      ? `covered by ${gap.coveredBy}`
      : gap.unrankable
        ? 'UNRANKABLE (no distinguishing keyword in this hint — check manually)'
        : 'GAP';
    console.log(`    [${gap.audience}] ${gap.routeHint} — ${status}`);
  }

  const openGaps = gaps.filter((g) => !g.covered && !g.unrankable);
  console.log(
    `\n${openGaps.length} open gap(s) across ${new Set(openGaps.map((g) => g.wave)).size} wave(s). Next up: Wave ${openGaps[0]?.wave ?? 'none'}.`
  );
}

main();
