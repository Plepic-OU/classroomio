# C4 Model Conventions for ClassroomIO

## Layer Definitions

### Layer 1 — System Context
Shows ClassroomIO as a single box plus external actors and systems.
- **People**: Students, Instructors, Org Admins
- **External Systems**: Supabase (Auth + DB + Storage), Email Provider, PostHog Analytics, Sentry, Polar (payments), Unsplash API

### Layer 2 — Container
Decompose ClassroomIO into deployable containers:
- **Dashboard** (SvelteKit app, port 5173) — main LMS web app
- **API** (Hono service, port 3002) — backend for PDF, video, email
- **Marketing Site** (SvelteKit, port 5174) — classroomio.com landing page
- **Docs** (React + Fumadocs, port 3000) — documentation site
- **Supabase** — Postgres DB, Auth, Storage (external/managed)

### Layer 3 — Component
Decompose each container into logical components derived from AST analysis.
- Components = directory-grouped modules (configurable depth)
- Relationships = cross-directory import edges
- Granularity guideline: no single component should contain >50 files

## Mermaid C4 Syntax Reference

```mermaid
C4Component
  title Component diagram for X

  Container_Boundary(alias, "Label") {
    Component(alias, "Name", "Tech", "Description")
    ComponentDb(alias, "Name", "Tech", "Description")
  }

  Rel(from, to, "label", "tech")
```

### Diagram types
- `C4Context` — Layer 1
- `C4Container` — Layer 2
- `C4Component` — Layer 3

### Elements
- `Person(alias, label, descr)` / `Person_Ext`
- `System(alias, label, descr)` / `System_Ext`
- `Container(alias, label, tech, descr)` / `Container_Ext`
- `ContainerDb` / `ContainerQueue`
- `Component(alias, label, tech, descr)` / `Component_Ext`
- `ComponentDb` / `ComponentQueue`

### Boundaries
- `System_Boundary(alias, label) { ... }`
- `Container_Boundary(alias, label) { ... }`
- `Boundary(alias, label, type) { ... }`

### Relationships
- `Rel(from, to, label, tech)`
- `BiRel(from, to, label)`
- `Rel_D`, `Rel_U`, `Rel_L`, `Rel_R` — directional hints

## Output Rules
- Keep diagrams concise — primary consumer is AI context
- Use short, descriptive aliases (snake_case)
- Tech field should be brief: "SvelteKit", "Hono", "TypeScript"
- Description field: one short phrase about responsibility
- Omit components with <3 files unless architecturally significant
