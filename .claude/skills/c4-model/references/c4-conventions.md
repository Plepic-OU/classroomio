# C4 Model Conventions

Source: https://c4model.com/

## The Four Levels

| Layer | Audience | Scope |
|-------|----------|-------|
| L1 – System Context | Everyone | System + external actors/systems |
| L2 – Container | Technical | Major deployable units (web apps, APIs, DBs) |
| L3 – Component | Developers | Internal structure of one Container |
| L4 – Code | Developers | Class/function level (rarely diagrammed) |

## Key Abstractions

- **Person** – a human user of the system (role, not individual)
- **Software System** – highest-level abstraction; may be the system under design or an external dependency
- **Container** – a separately runnable/deployable unit (web app, API, DB, message queue). NOT a Docker container.
- **Component** – a grouping of related code within a Container; loosely maps to a module, package, or directory cluster

## Component Granularity (L3)

> "A component is a grouping of related functionality encapsulated behind a well-defined interface."

For a SvelteKit app: components are natural groupings like route trees (`/org/*`, `/lms/*`) and library modules (`services/`, `stores/`, `components/<Domain>/`).

For a Hono API: components are route handlers and service modules.

**Rules of thumb:**
- 5–20 components per Container is a good target
- Each component should have a clear single responsibility
- If a "component" has >50 source files, it's probably too coarse — split it further

## Relationships

- Only draw relationships that are architecturally significant
- Each relationship should have a label (verb phrase) and optionally a technology
- Avoid drawing every import — focus on data flow, not file dependencies
- Direction: caller → callee

## Notation

C4 diagrams use shapes and labels, NOT UML stereotypes. Every element must have:
1. A **name**
2. A **type** (person, system, container, component)
3. A short **description** (what it does, not how)
4. A **technology** label for containers and components
