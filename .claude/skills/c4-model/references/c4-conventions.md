# C4 Mermaid Conventions

## Diagram Types

```
C4Context    — Layer 1: System Context
C4Container  — Layer 2: Container
C4Component  — Layer 3: Component
```

## Element Syntax

```mermaid
Person(id, "Label", "Description")
Person_Ext(id, "Label", "Description")
System(id, "Label", "Description")
System_Ext(id, "Label", "Description")
SystemDb(id, "Label", "Description")
SystemDb_Ext(id, "Label", "Description")
Container(id, "Label", "Technology", "Description")
ContainerDb(id, "Label", "Technology", "Description")
Component(id, "Label", "Technology", "Description")
```

## Boundaries

```mermaid
Enterprise_Boundary(id, "Label") {
  ...
}
System_Boundary(id, "Label") {
  ...
}
Container_Boundary(id, "Label") {
  ...
}
Boundary(id, "Label", "type") {
  ...
}
```

## Relationships

```mermaid
Rel(from, to, "label")
Rel(from, to, "label", "technology")
BiRel(from, to, "label")
```

## Best Practices for ClassroomIO Diagrams

- IDs: alphanumeric + underscores only. Sanitize paths: `src/routes/course` → `routes_course`
- Keep descriptions under 60 chars
- Technology field: use framework name (e.g., "SvelteKit", "Hono.js", "PostgreSQL")
- Group related components with `Container_Boundary` or `Boundary`
- External systems use `_Ext` suffix variants
- For Layer 3, derive components from AST extraction JSON — never hardcode
- Limit diagrams to ~20 components max; group small components if needed
