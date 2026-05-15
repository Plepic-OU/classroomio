# C4 Model Conventions

Source: https://c4model.com

## The Four Levels

| Level | Diagram | Audience | Question answered |
|-------|---------|----------|-------------------|
| 1 | System Context | Everyone | What is this system and who uses it? |
| 2 | Container | Developers | What are the deployable/runnable units? |
| 3 | Component | Developers | What major building blocks live inside a container? |
| 4 | Code | Developers | How does a component map to classes/functions? |

ClassroomIO generates Levels 1–3. Level 4 is too fine-grained for this tooling.

## Level 1 — System Context

- Show the software system as a single box.
- Show the people (roles) that interact with it.
- Show external systems the software system depends on or communicates with.
- No technology details at this level.

## Level 2 — Container

A **container** is an independently runnable/deployable unit:
- a web application, an API server, a mobile app, a database, a message queue.
- NOT a Docker container (though there's overlap).

Each container has a label, a technology, and a short description.
Containers communicate via clearly labelled arrows (protocol + data format).

## Level 3 — Component

A **component** is a grouping of related functionality behind a well-defined interface.
In practice: a directory or module boundary within a container.

Rules:
- Components live inside a single container; they are NOT separately deployable.
- Group by cohesion, not by layer. A feature slice (routes + service + types) can be one component.
- Remove noise: model classes, DTOs, and pure utilities are rarely architecturally significant alone.
- A component should be describable in one sentence.
- Relationships between components should reflect actual import/call dependencies.

### Granularity guidance

Too coarse: `api/src` → 1 mega-component.  
Too fine: every file is its own component.  
Right: every directory that has a coherent responsibility is one component.

For ClassroomIO:
- **API depth=2**: `routes/course`, `services`, `utils/redis` — natural feature/layer splits.
- **Dashboard depth=3**: `lib/components/AI`, `lib/utils/services`, `routes/lms` — feature areas.

## Relationship notation

- Arrow direction = dependency (caller → callee, importer → imported).
- Label the relationship with an interaction verb: "reads from", "calls", "imports", "subscribes to".
- Technology label on arrow when the protocol matters: "HTTP/JSON", "WebSocket", "SQL".

## Common mistakes to avoid

1. **Showing the same box at different levels** — a Container on the Layer 2 diagram shouldn't also appear as a Component on a Layer 3 diagram of a different container.
2. **Omitting external systems** — if a component makes outbound calls to Supabase or OpenAI, show those as external nodes.
3. **Over-connecting** — only draw relationships that are architecturally meaningful. Not every utility import needs an arrow.
4. **Hardcoding components** — derive them from the source structure. Diagrams that drift from reality are worse than no diagrams.
