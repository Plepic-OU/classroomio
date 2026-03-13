# C4 Model Conventions

## Layer Definitions

| Layer | Diagram Type | Audience | Scope |
|-------|-------------|----------|-------|
| 1 - Context | C4Context | Anyone | System + external actors |
| 2 - Container | C4Container | Developers | Deployable units inside the system |
| 3 - Component | C4Component | Developers | Major structural units inside a container |

## Mermaid C4 Syntax Quick Reference

### Layer 1 - Context
```
C4Context
  title Layer 1 - System Context

  Person(alias, "Label", "Description")
  System(alias, "Label", "Description")
  System_Ext(alias, "Label", "Description")
  SystemDb(alias, "Label", "Description")

  Rel(from, to, "label")
  BiRel(from, to, "label")
```

### Layer 2 - Container
```
C4Container
  title Layer 2 - Container

  System_Boundary(alias, "Label") {
    Container(alias, "Label", "Technology", "Description")
    ContainerDb(alias, "Label", "Technology", "Description")
    ContainerQueue(alias, "Label", "Technology", "Description")
  }

  System_Ext(alias, "Label", "Description")
  Rel(from, to, "label", "technology")
```

### Layer 3 - Component
```
C4Component
  title Layer 3 - Component: <Container Name>

  Container_Boundary(alias, "Container Label") {
    Component(alias, "Label", "Technology", "Description")
    ComponentDb(alias, "Label", "Technology", "Description")
  }

  Rel(from, to, "label")
```

## Alias Rules (Mermaid)
- Aliases must match `[A-Za-z0-9_]+`
- Sanitise path keys: replace `/`, `-`, `[`, `]`, `.` with `_`

## Relationship Labels
- Use active-voice verbs: "reads from", "writes to", "calls", "subscribes"
- For weighted AST-derived rels, append import count: "uses (12 imports)"

## Granularity Guidelines

| Container | Recommended Component Grouping |
|-----------|-------------------------------|
| Dashboard (SvelteKit) | Group by src/<area>/<module> - routes, lib/components, lib/utils/services, lib/utils/store |
| API (Hono) | Group by src/<layer> - routes, services, middlewares, utils |

## Depth Guidance

| Depth | Dashboard components produced | Good for |
|-------|------------------------------|---------|
| 3 | src/lib/components, src/lib/utils, src/routes/org | High-level overview |
| 4 | src/lib/utils/services, src/lib/utils/store, src/routes/org | Service/store detail |

**Validation rule**: if any component key contains >50 files, increase depth for that app.

## ClassroomIO-Specific Notes

- `$lib/*` resolves to `apps/dashboard/src/lib/*`
- `$mail/*` resolves to `apps/dashboard/src/mail/*`
- `$src/*` resolves to `apps/api/src/*`
- `.svelte` files are counted per component but not AST-parsed (ts-morph limitation)
- SvelteKit dynamic route segments ([slug], [courseId]) appear in keys at depth >= 4; keep route grouping at depth 3
- `$env/dynamic/public`, `$app/*` are SvelteKit virtual modules - treated as external deps
