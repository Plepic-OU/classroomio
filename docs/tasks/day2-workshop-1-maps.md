# Day 2, workshop 1 — maps of the project

## Goal

Give Claude a cheap-to-load mental model of the codebase. Build a skill that produces a C4 model (the first three
levels — system context, container, component) plus a database schema map, then link those maps from `CLAUDE.md` so they
get loaded into every session via the prompt cache.

## What you'll learn

- Why **layered summaries** matter: AI has no memory of your project, looking things up burns tokens, and static
  summaries pay for themselves through prompt caching.
- The C4 model as a way to describe software at increasing levels of detail — see https://c4model.com/introduction
  and https://c4model.com/abstractions.
- How `@path/to/file.md` references in `CLAUDE.md` pull a file into context, vs. plain links that only become useful
  when the agent decides to read them.

## Steps

1. **Create a skill that generates (or updates) a C4 model of the current project — first three levels only.** Use the
   starter prompt at the end of this file (*Starter prompt for the C4 skill*) as your input to Claude.

  - *Optional advanced challenge:* don't copy the prompt — write it yourself from scratch.

2. **Restart Claude and run the skill** to generate the C4 model. Read what comes out and check that it actually makes
   sense for ClassroomIO — does it name the right containers? Does the component view match what you see in the repo?

3. **Link the maps from `CLAUDE.md`:**
  - The C4 layer files should be added with `@../filename.md` syntax so they're pulled directly into context.
  - Link the database schema **without** `@` — that one is bigger; it should be loaded on demand, not by default.

## Optional / advanced

- **Switch from Mermaid to DOT (Graphviz)** for the diagrams. Experiment with layout directives — `rankdir`, clusters,
  etc. — to see what reads best for each level of the C4 model.
- **Find what's missing.** Compare the generated C4 to your own understanding of ClassroomIO. What's underspecified?
  Update the skill so the next run produces a richer model.
- **Compress the database schema** — keep the structural information (tables, key relationships, important columns) but
  cut bytes. The smaller the map, the more of it Claude can hold in context cheaply.
- **Test coverage as a map.** Write a separate skill that produces a *functional* test coverage report — coverage from
  the perspective of user-facing behaviour, not lines of code. Useful as another summary to link from `CLAUDE.md`.

## When you get stuck

Skill creation has a quiet failure mode: the skill loads but the output is generic or wrong, and it's not obvious why.
Debug *with* Claude:

- If the skill produces a bad C4, ask Claude to re-read the skill file and tell you what assumptions the prompt is
  making about the codebase. Often the prompt is asking for a generic answer instead of one grounded in the repo.
- If `@`-references don't seem to load, ask Claude to confirm what's in context right now (`/status` and friends) — `@`
  references are relative, and a wrong relative path silently fails.

Hitting these snags is the point. Each fix teaches you something about how Claude actually loads context.

---

# Starter prompt for the C4 skill

Goal: Build a Claude Code skill that generates or updates a C4 model (Layers 1–3) for ClassroomIO. Layer 3 diagrams for
the API and Dashboard containers, outputting Mermaid C4 diagrams to `docs/c4/`.

Familiarize yourself with https://c4model.com/ (especially https://c4model.com/abstractions/component for Layer 3
granularity) and https://mermaid.js.org/syntax/c4.html.

### Skill structure

Create a skill at `.claude/skills/c4-model/` with a `SKILL.md`, an extraction script, and a `references/` folder for C4
conventions.

### AST extraction

The skill must include a script using ts-morph that deterministically extracts component structure from `apps/dashboard`
and `apps/api`. The script must parse source files, aggregate by directory into components, and map cross-directory
imports as relationships. Output structured JSON. Add the JSON output to `.gitignore`.

**Path alias resolution.** The script must resolve all path aliases used in the codebase, not just relative imports.
Scan each app's `tsconfig.json` `paths` field to discover aliases dynamically.

**Component key depth.** The granularity of component grouping (how many directory levels form a "component key")
matters a lot. Using too few levels collapses distinct modules into single mega-components, which defeats the purpose of
Layer 3. Make depth configurable per app. Validate the output: if any single component contains >50 files, the depth is
probably too shallow.

**Svelte handling.** ts-morph can't parse `.svelte` files — handle this gracefully by extracting structure from
co-located `.ts`/`.js` files and counting `.svelte` files per directory for metadata.

### Database schema

The skill should extract database structure from the running local Supabase instance (via `docker exec` against
`information_schema` and `pg_catalog`) into `docs/c4/database.md`. Use a token-efficient format — not full DDL. Keep
foreign key references between tables. Requires `supabase start`.

### Constraints

- Use Mermaid C4 diagrams.
- Output should be concise — it's mainly for AI context consumption.
- Layer 3 components must be derived from AST, not hardcoded.
