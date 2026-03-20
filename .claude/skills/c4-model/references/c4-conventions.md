# C4 Model — Quick Reference

Source: https://c4model.com/

## Abstractions

| Level | Name | Defined as |
|-------|------|-----------|
| 1 | System Context | The top-level system and its relationships with users and external systems |
| 2 | Container | Runtime units: applications, databases, message buses, etc. inside the system |
| 3 | Component | Groupings of code inside a container — ideally one component per directory/feature |
| 4 | Code | Individual classes / functions (usually auto-generated; skip unless needed) |

## Layer 1 — System Context

- One box for the system being built
- Person shapes for human users (actors)
- System_Ext shapes for every external system the software interacts with
- Relationships show direction of interaction, not data flow
- Keep labels short: verb + noun ("Reads courses", "Sends email")

## Layer 2 — Container

- Zoom into the ClassroomIO system boundary
- Each deployed/runnable unit is a Container: web app, API server, DB, cache
- Include the technology stack in every Container label
- External systems referenced in L1 reappear here as Container_Ext

## Layer 3 — Component (derived from AST)

- Zoom into one Container at a time
- Each Component = a cohesive directory of source files
- Component granularity: one "feature slice" or "service" per component
  - ✓ `lib/utils/services/courses` — course service layer
  - ✓ `routes/org` — teacher org admin routes
  - ✗ `lib` alone — too coarse (entire library folder)
- Relationships between components are import dependencies extracted by the AST script
- Keep description short: what the component is responsible for
- Validation rule: if any single component has >50 files, increase extraction depth

## Naming rules for Mermaid aliases

Mermaid C4 element aliases must be simple identifiers (no slashes or dots).
Convert component keys: replace `/` and `-` with `_`.
Example: `lib/utils/services/courses` → `lib_utils_services_courses`

## What to show / omit at L3

Show:
- All components that have at least one cross-component relationship
- Isolated components with ≥5 files (they represent meaningful feature areas)

Omit:
- Single-file utility leaves with no dependants
- `__mocks__`, `__tests__`, `mocks/` directories

## Relationship labels

Use concise verbs:
- "Reads / writes data" — for DB / storage
- "Calls API" — for HTTP RPC
- "Imports" — for code-level dependency
- "Uses" — for shared utilities
