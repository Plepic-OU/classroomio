Goal: Build a Claude Code skill that generates or updates a C4 model (Layers 1–3) for ClassroomIO. Layer 3 diagrams for
the API and Dashboard containers, outputting Mermaid C4 diagrams to `docs/c4/`.

Familiarize yourself with https://c4model.com/ (especially https://c4model.com/abstractions/component for Layer 3
granularity) and https://mermaid.js.org/syntax/c4.html.

### Sub goals

- [ ] Explain in skill what is AST.
- [ ] Explain each tech stack element in two sentences.
  - [ ] Make footnotes (1),(2),... for each tech stack element on the diagram

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