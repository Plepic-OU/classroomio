# C4 Model Conventions for ClassroomIO

## C4 Layers

- **Layer 1 – System Context**: Shows ClassroomIO as a box, plus external actors (Teachers, Students, Admins) and external systems (Supabase, Email, S3/R2).
- **Layer 2 – Container**: Zooms into ClassroomIO showing containers: Dashboard (SvelteKit), API (Hono), Supabase (DB/Auth/Storage), Redis, S3/R2.
- **Layer 3 – Component**: Zooms into a single container (Dashboard or API) showing internal components derived from AST extraction.

## Mermaid C4 Syntax Quick Reference

```
C4Context          — Layer 1
C4Container        — Layer 2
C4Component        — Layer 3

Person(alias, label, descr)
System(alias, label, descr)
System_Ext(alias, label, descr)
Container(alias, label, techn, descr)
ContainerDb(alias, label, techn, descr)
Component(alias, label, techn, descr)
Container_Boundary(alias, label) { ... }
System_Boundary(alias, label) { ... }

Rel(from, to, label, techn)
BiRel(from, to, label)
```

## Component Granularity (Layer 3)

Per c4model.com/abstractions/component:
- A component is a grouping of related functionality behind a well-defined interface.
- In this project, components map to directory-level modules (e.g., `lib/utils/services/courses`, `lib/components/Course`).
- A good component has 5–50 files. If >50, increase directory depth. If <3, merge with parent.

## Naming Conventions

- Aliases: lowercase, hyphenated (e.g., `course-service`, `auth-middleware`)
- Labels: Title Case (e.g., "Course Service", "Auth Middleware")
- Technology: brief (e.g., "Svelte", "Hono Route", "TypeScript")

## Relationship Rules

- Only show significant cross-component dependencies (>2 imports)
- Use `Rel(from, to, "Uses")` for most relationships
- Use technology label for protocol-level relationships (e.g., "HTTP", "JDBC", "RPC")
