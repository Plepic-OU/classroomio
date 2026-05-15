# C4 conventions cheat sheet

A compressed reference for the C4 model (https://c4model.com/). Read this before writing diagrams.

## Levels

| Level | What it shows | Audience |
| --- | --- | --- |
| 1 — System Context | The system as one black box, with persons and external systems around it. | Anyone, including non-technical |
| 2 — Containers | Deployable units inside the system (apps, services, databases, queues, browsers). | Technical readers |
| 3 — Components | Major logical groupings inside one container. | Engineers in/near that container |
| 4 — Code | Class/file-level diagrams. **Out of scope for this skill.** | Engineers touching code |

A "container" in C4 is a separately running process / deployable artifact — not a Docker container specifically (often is one, often isn't).

## Element types (Mermaid C4 names in parens)

- **Person** (`Person(...)`, `Person_Ext(...)`): a human user role. Lump variations unless explicitly distinguished. Internal vs. external person is rarely meaningful at the system level — use the `_Ext` variant for users outside the org.
- **System** (`System(...)`, `System_Ext(...)`): a software system. `_Ext` marks one you don't own/build.
- **Container** (`Container(...)`, `ContainerDb(...)`, `ContainerQueue(...)`): a deployable unit. The `Db` and `Queue` variants get different shapes/icons.
- **Component** (`Component(...)`, `ComponentDb(...)`): a logical grouping inside a container.
- **Boundary** (`System_Boundary`, `Container_Boundary`, `Enterprise_Boundary`): a dashed container that groups other elements.

## What goes where

**Level 1.**
- Persons: distinct user roles (student, instructor, admin). Lump unless the user explicitly distinguishes.
- External systems: anything **not built and deployed by this repo**. Auth providers, payment gateways, transactional mail providers, object storage as-a-service, analytics, third-party APIs.
- ❌ NOT external systems at Level 1: a Postgres you operate, a Redis you operate, a worker container you ship. Those are Level 2 containers.

Target: 5-12 boxes. >15 means you've leaked Level 2 detail upward.

**Level 2.**
- One node per deployable unit (web app, API service, worker, CLI, browser SPA, database, cache, queue, object store you operate).
- ❌ NOT containers: libraries, shared packages, build tools, linters. They're code, not deployable units.

Label every node with: name, technology ("SvelteKit + Node", "Hono on Node 20", "PostgreSQL 15"), short description.

**Level 3.**
- One diagram per container worth diagramming. Skip stock infra (Postgres, Redis, CDN edge worker) — there's nothing to say.
- A component is a logical grouping by responsibility — auth subsystem, payments module, job scheduler, outbound mail.
- Target: 5-15 components per container. 40 means you're at Level 4; re-cluster by responsibility.
- Cross-boundary edges reuse Level 2 aliases (same `dashboard`, `api`, `sb_db`, `r2` identifiers).

## Element naming

- **Alias**: short snake_case identifier reused across diagrams (`student`, `dashboard`, `sb_db`, `r2`). Stable — don't rename across runs, it churns diffs.
- **Display name**: human label, can be verbose. Don't suffix with "(System)" / "(Container)" — Mermaid already styles that.
- **Tech tag**: middle argument in Mermaid C4 element fns. Be specific: "PostgreSQL 15", not "Database".
- **Description**: third argument. One sentence; explain purpose, not implementation.

## Edge labeling

- Every `Rel(a, b, label, [tech])` gets a labeled verb. Bare arrows are a smell.
- Lead the label with a verb phrase: "Reads from", "Authenticates with", "Sends email via", "Publishes to channel `events`".
- The optional 4th argument is the protocol/transport ("JSON/HTTPS", "RESP", "SMTP", "PostgREST"). Include it when it carries information.
- Direction matters: `Rel(a, b, ...)` means a→b (a initiates the call). For bidirectional traffic, use two `Rel(...)` calls with distinct labels, not `BiRel` (rarely worth it).

## Don'ts

- Don't draw libraries / shared code packages as containers.
- Don't draw build/test tooling on architecture diagrams.
- Don't draw the same external system at Level 1 with a different alias at Level 2 — readers will think they're different systems.
- Don't drift into Level 4. If a Level 3 component is "the `useFoo` hook", you've gone too deep.
- Don't reflow diagrams for cosmetics across runs. Diff noise erodes trust in the model.

## When updating

- Preserve element aliases.
- Diff observed structure against existing files.
- Surgical `Edit`s beat full rewrites unless >50% changed.
- Trust the AST extraction for Level 3 components, not your memory.
