# C4 Model Conventions for ClassroomIO

## Mermaid C4 Syntax Quick Reference

### Diagram Types
- `C4Context` — Level 1: System Context
- `C4Container` — Level 2: Container
- `C4Component` — Level 3: Component

### Elements
```
Person(alias, "Label", "Description")
Person_Ext(alias, "Label", "Description")
System(alias, "Label", "Description")
System_Ext(alias, "Label", "Description")
SystemDb(alias, "Label", "Description")
Container(alias, "Label", "Technology", "Description")
ContainerDb(alias, "Label", "Technology", "Description")
ContainerQueue(alias, "Label", "Technology", "Description")
Component(alias, "Label", "Technology", "Description")
ComponentDb(alias, "Label", "Technology", "Description")
```

### Boundaries
```
System_Boundary(alias, "Label") { ... }
Container_Boundary(alias, "Label") { ... }
Enterprise_Boundary(alias, "Label") { ... }
Boundary(alias, "Label", "type") { ... }
```

### Relationships
```
Rel(from, to, "Label", "Technology")
BiRel(from, to, "Label", "Technology")
Rel_D(from, to, "Label")   # Downward
Rel_U(from, to, "Label")   # Upward
Rel_L(from, to, "Label")   # Left
Rel_R(from, to, "Label")   # Right
```

### Layout
```
UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## ClassroomIO Architecture Context

### Personas
- **Student** — Enrolls in courses, completes exercises, views grades
- **Instructor** — Creates courses, manages content, grades students
- **Org Admin** — Manages organization settings, members, billing

### External Systems
- **Supabase Auth** — Authentication provider
- **Cloudflare R2** — Object storage (file uploads)
- **Redis** — Caching layer
- **SMTP** — Email delivery

### Containers
- **Dashboard** (SvelteKit) — Main web application for students and instructors
- **API** (Hono/TypeScript) — Backend API for course operations, mail, etc.
- **Supabase DB** (PostgreSQL) — Primary data store
- **Supabase Edge Functions** (Deno) — Serverless functions for notifications, grades

### Component Granularity (Layer 3)

Per C4 model: a component is "a grouping of related functionality encapsulated behind a well-defined interface." For this project:

- **Dashboard components** = directory groupings under `src/lib/components/`, `src/lib/utils/`, and `src/routes/` at configurable depth
- **API components** = directory groupings under `src/routes/`, `src/services/`, `src/utils/` at configurable depth
- Components must be derived from AST extraction, never hardcoded

### Alias Mappings
- Dashboard: `$lib` → `src/lib`, `$mail` → `src/mail`
- API: `$src` → `src`
