# C4 model conventions for ClassroomIO

The [C4 model](https://c4model.com) is four nested levels of abstraction. We use the first three.

## Layer 1 — System Context

Audience: anyone who needs to know where ClassroomIO sits in the world.

Show:

- **People** that interact with the system — for ClassroomIO that's Students, Instructors, and Org admins. They are distinct roles in the product even though they may share an account.
- **The system itself** as a single box labelled "ClassroomIO".
- **External systems** ClassroomIO depends on — only those that actually appear in `externalRelationships` in either app's extraction JSON. Don't speculate.

Don't show internal containers or components here. Don't list features. Edges should describe the role of the interaction ("reads/writes course content", "authenticates with"), not the protocol.

## Layer 2 — Containers

Audience: developers and ops who need to know the deployable pieces.

A container is something that runs as its own process / service. For ClassroomIO:

- `Dashboard` (SvelteKit) — serves teacher dashboard AND student LMS from the same app
- `API` (Hono on @hono/node-server) — long-running work (PDFs, video, email, S3)
- `Supabase` — Postgres database + Auth + Storage, treat as one container with role `ContainerDb`

Plus external systems that the L1 diagram already mentions, kept here for traceability.

Edges should include the technology / protocol (e.g. `HTTPS / typed RPC`, `Postgres wire`, `S3 API`). Keep labels short — the technology goes in the `techn` parameter, the verb in the label.

A note about `PUBLIC_IS_SELFHOSTED` belongs here if relevant — it's the only flag that toggles container behaviour (Vercel adapter vs Node adapter for dashboard).

## Layer 3 — Components

Audience: developers working on a specific container, plus AI assistants needing repo context.

A component is a coherent grouping of related code within a container. For ClassroomIO the components are derived from the **directory structure** at a depth set in `config.json`. Examples (will change as the code evolves; refer to the extracted JSON):

- Dashboard components are clustered around `src/lib/components/<group>`, `src/lib/utils/services/<group>`, `src/lib/utils/store`, `src/routes/<area>`, `src/routes/api/<endpoint-group>`.
- API components are individual handler groups under `src/routes/<group>`, plus `src/services/<group>`, `src/middlewares`, `src/utils/<group>`.

### Rules for Layer 3 output

- One Mermaid `C4Component` diagram per container (so two files: dashboard and api).
- Wrap the container's components in a single `Container_Boundary(...)` so it's visually clear what belongs to the container.
- Component aliases: take the `key` from the JSON (e.g. `src/lib/utils/services/courses`) and sanitise it for Mermaid by replacing `/`, `-`, `.`, and space with `_`. The label is the component's `name` field.
- Component descriptions are a single short phrase. Include the file footprint (e.g. `12 TS + 8 Svelte`) so a reader knows roughly how heavy the component is.
- Internal edges come from `relationships` in the JSON. Each edge represents at least one import; the `count` field is for prioritising, not labelling. Use a single verb (`uses`, `reads`, `dispatches via`) — if you can't tell, use `uses`.
- External edges come from `externalRelationships`. Group by `system` (so Supabase appears once even if many components touch it). Use a `SystemDb_Ext` / `System_Ext` outside the boundary.
- Prune for readability. If the diagram has more than ~25 edges, drop edges where `count == 1` first, then `count <= 2`, until it's comfortable. Note the threshold in an HTML comment at the top of the file.

### What NOT to show

- Individual files or classes — those are Level 4 and we don't emit Level 4.
- Internal helpers used by exactly one other component — let them collapse into their caller mentally.
- Edges that come from test files (the extractor already excludes `*.test.ts` / `*.spec.ts`).

## Output style

These diagrams are for AI context as much as for humans. Keep them:

- **Concise** — short labels, short descriptions, one purpose per component.
- **Deterministic** — order components and edges by `key` / `from,to`, not by extraction order, so re-runs produce stable diffs.
- **Annotated at the top** — every generated `.md` file should have a `<!-- generated: ... -->` comment plus a one-paragraph human-readable summary above the Mermaid block, since C4 diagrams need a tiny bit of prose to be useful.
