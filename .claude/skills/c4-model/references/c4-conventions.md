# C4 Model Conventions Reference

Source: https://c4model.com/

## Abstraction Levels

| Level | Name | "What is a…?" | Granularity |
|-------|------|---------------|-------------|
| 1 | System Context | A software system | One box per deployed product |
| 2 | Container | A separately deployable/runnable process | Frontend app, backend service, database, queue |
| 3 | Component | A grouping of related functionality inside a container | A directory/module, a set of routes, a service class |
| 4 | Code | Individual classes/functions | Only worth drawing for complex domains |

## Key Rules

- **Every diagram has a title and describes its level.**
- **Components (L3) must be derivable from the code**, not invented. They correspond to real directory groupings, packages, or modules.
- **Relationships carry a verb and optionally a technology** (e.g., "reads from, SQL" or "calls, HTTP/JSON").
- A component at L3 is NOT a class. It's closer to a package or module — typically 1 directory with 2–20 files.
- External systems always appear outside the system/container boundary.

## L3 Granularity Guide (from c4model.com/abstractions/component)

- If a component grouping has >50 files, depth is too shallow — split it.
- A good L3 diagram has 5–20 components per container.
- Components should map to how a developer would describe the system when onboarding ("we have a services layer, a routes layer, a stores layer…").

## Mermaid C4 Shapes

```
C4Context     — for L1
C4Container   — for L2
C4Component   — for L3

Person(id, label, description)
Person_Ext(id, label, description)
System(id, label, description)
System_Ext(id, label, description)
System_Boundary(id, label) { ... }
Container(id, label, technology, description)
ContainerDb(id, label, technology, description)
Container_Boundary(id, label) { ... }
Component(id, label, technology, description)
Rel(from, to, label)
Rel(from, to, label, technology)
BiRel(from, to, label)
```
