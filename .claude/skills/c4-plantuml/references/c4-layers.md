# C4 layers — granularity quick reference

See https://c4model.com/ for the canonical definitions. Notes below are tuned for ClassroomIO output.

## Layer 1 — System Context

**Audience:** anyone. **Scope:** the whole world around the system.

- Show **the system** as one box.
- Show **people** (user roles) interacting with it.
- Show **external systems** it depends on or integrates with.
- No internals. No tech labels except on relationships.
- Aim: <15 nodes.

## Layer 2 — Containers

**Audience:** technical. **Scope:** zoom into the system box.

A "container" = a separately deployable/runnable unit: a web app, mobile app, server-side app, single-page app, database, file system, microservice, serverless function, etc. **Not** a Docker container specifically.

- For ClassroomIO, containers map ~1:1 with `apps/*` + Supabase Postgres + Supabase Edge Functions + external object storage (R2).
- Each container has a tech stack label (e.g., `SvelteKit 4`, `Hono 4 on Node`).
- Keep external systems on the perimeter; show how each container talks to each external system.

## Layer 3 — Components

**Audience:** developers. **Scope:** zoom into one container.

See https://c4model.com/abstractions/component for the formal definition.

> A grouping of related functionality encapsulated behind a well-defined interface… not a separately deployable unit; typically all components execute in the same container process.

For this repo:

- A **component** is a related cluster of source files — typically a directory at the configured depth.
- Components are **derived from the AST** (`scripts/extract-components.mjs`). Do not invent them.
- Component diagrams target ~10–25 nodes. If extraction yields more, group siblings (`Course/*` → "Course UI components") with the count in the description.
- Edges are imports between component keys, aggregated. Filter low-signal edges (count <2) unless they're the only edge for a component.
- Show the container as a `Container_Boundary`. Show the most relevant **external** dependencies that the container talks to (e.g., the API container points at Supabase, R2, SMTP, Redis).

## What NOT to do

- Don't diagram individual classes or functions — that's L4 (code), which we skip.
- Don't hardcode L3 — always run the extractor.
- Don't draw every edge — readability first.
- Don't mix layers in one diagram.
