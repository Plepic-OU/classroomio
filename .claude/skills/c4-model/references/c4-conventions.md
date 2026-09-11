# C4 model conventions for this skill

Source: [c4model.com](https://c4model.com/) and [mermaid.js C4 syntax](https://mermaid.js.org/syntax/c4.html). This file is the condensed version — read it instead of re-fetching those pages.

## The four levels (we generate 1–3)

1. **System Context** — the system in scope as a single box, the people (actors) who use it, and the other software systems it talks to. No tech detail. Answers "what is this and who/what does it talk to."
2. **Container** — zooms into the system to show its separately deployable/runnable units: web apps, SPAs, API services, databases, mobile apps, file/blob stores, message brokers. Shows how containers communicate (protocol/purpose on the edges). Still no code-level detail.
3. **Component** — zooms into *one* container to show its major structural building blocks and how they collaborate. A component is "a grouping of related functionality behind a well-defined interface" — in this codebase, a directory that groups related modules (not an arbitrary file, not a whole container). Per c4model.com/abstractions/component: components should map to a real structural abstraction that exists in the code, and a healthy diagram is usually on the order of 5–25 components *per meaningful subtree* — many more than that in one flat diagram is a sign the grouping is too fine, many less is a sign it's too coarse. This skill uses directory depth (see below) as a deterministic proxy for "component," and nests boundaries so the diagram reads as a tree rather than a flat wall of boxes.
4. **Code** — class/function level. Out of scope for this skill; IDEs generate this better than a static script can, and it churns too fast to be worth committing.

## Component key depth (Layer 3 specific to this repo)

`extract-components.ts` buckets every source file into a "component" by taking the first `N` directory segments below `src/` (`N` = `--depth`, configurable per app — see script header). Files deeper than `N` segments roll up into their `N`-th ancestor directory.

- Too shallow → unrelated modules collapse into one mega-component (defeats the point of Layer 3). The script flags any component with >50 files as a signal to raise `--depth` for that app.
- Too deep → every leaf folder becomes its own component, and the diagram stops reading as "major building blocks" and starts reading as a file tree.
- Current defaults: `dashboard` depth=4 (its `lib/components/<Name>` and `routes/<area>/<sub>` folders both need 3-4 segments to separate cleanly), `api` depth=2 (`routes/course`, `services/course`, `utils/redis`, etc. separate cleanly at 2). One directory subtree can still legitimately exceed 50 files at the app's chosen depth (e.g. `lib/components/Course/components` in the dashboard) — that's a real signal the *specific* subtree is dense, not necessarily that the whole app's depth is wrong; re-run with a higher depth only if you want to split that subtree further.

## Relationships

A relationship is recorded between two components only when a file in component A imports a file in component B *and A ≠ B* (intra-component imports are noise at this granularity). Weight = number of import statements between them, shown as `×N` on the edge. Bare/external/virtual specifiers (npm packages, `$app/*`, `$env/*`, etc.) are not part of the component graph — only internal, resolvable imports are.

## Mermaid syntax cheat sheet (only what this skill uses)

```
C4Context
  title <text>
  Person(alias, "Label", "Description")
  Person_Ext(alias, "Label", "Description")          # person outside the system
  System(alias, "Label", "Description")               # system in scope
  System_Ext(alias, "Label", "Description")            # external system
  SystemDb(alias, "Label", "Description")              # external/other system that is a datastore
  Rel(from, to, "Label", "Technology/protocol")
  Rel_Back(from, to, "Label")                          # reverse arrow
  BiRel(from, to, "Label")                             # bidirectional

C4Container
  Container(alias, "Label", "Tech", "Description")
  ContainerDb(alias, "Label", "Tech", "Description")
  System_Boundary(alias, "Label") { ... }               # group containers under a system
  Rel(from, to, "Label", "Tech/protocol")

C4Component
  Container_Boundary(alias, "Label", "Tech") { ... }    # the container this diagram zooms into
  Boundary(alias, "Label") { ... }                      # generic nesting group (this skill: one per directory segment)
  Component(alias, "Label", "Tech", "Description")
  ComponentDb(alias, "Label", "Tech", "Description")
  Rel(from, to, "Label", "Technology")
```

Notes:
- `alias` must be a bare identifier (`[A-Za-z0-9_]`) — this skill slugifies directory-derived keys (`lib/components/Course` → `dashboard_lib_components_Course`).
- Double quotes inside a label break parsing — escape by using single quotes instead (the render script does this automatically).
- Boundaries/containers can nest arbitrarily; Mermaid lays out nested boxes as clusters.
- Keep labels short — this output is read by an LLM as often as a human, and Mermaid source size roughly tracks token cost.

## File conventions in `docs/c4/`

- `level1-system-context.md`, `level2-container.md` — hand-authored (by whoever runs this skill) from repo inspection (README, CLAUDE.md, package.json, env vars, third-party SDKs). Re-derive rather than assume stale — these describe intent/architecture and don't have an AST source of truth the way Layer 3 does.
- `level3-dashboard.md`, `level3-api.md` — **always** regenerated by `extract-components.ts` + `render-mermaid.ts`. Never hand-edit; hand edits will be silently overwritten and (per the task constraints) Layer 3 must stay AST-derived, not hardcoded.
- `database.md` — regenerated by `extract-database.sh` against the live local Supabase Postgres container.
- `.data/*.json` — intermediate AST extraction output, gitignored (regenerate, don't commit).
