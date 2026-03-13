# C4 Model Conventions for ClassroomIO

## C4 Layers

- **Layer 1 (System Context)**: Shows ClassroomIO as a single box plus external actors/systems (users, Supabase, Stripe, OpenAI, etc.)
- **Layer 2 (Container)**: Decomposes ClassroomIO into containers: Dashboard (SvelteKit), API (Hono.js), Database (PostgreSQL/Supabase), Edge Functions, R2 Storage, Redis
- **Layer 3 (Component)**: Decomposes each container into components derived from AST analysis

## Mermaid C4 Syntax Reference

```mermaid
C4Context
  Person(alias, "label", "description")
  System(alias, "label", "description")
  System_Ext(alias, "label", "description")
  Rel(from, to, "label", "technology")
```

```mermaid
C4Container
  Container(alias, "label", "technology", "description")
  ContainerDb(alias, "label", "technology", "description")
  ContainerQueue(alias, "label", "technology", "description")
  Container_Boundary(alias, "label") { ... }
  Rel(from, to, "label", "technology")
```

```mermaid
C4Component
  Component(alias, "label", "technology", "description")
  ComponentDb(alias, "label", "technology", "description")
  Container_Boundary(alias, "label") { ... }
  Rel(from, to, "label", "technology")
```

## Component Granularity (Layer 3)

Per c4model.com/abstractions/component: a component is a grouping of related functionality encapsulated behind a well-defined interface. In this codebase:

- **Dashboard**: Components are directory-level groupings under `src/lib/components/`, `src/lib/utils/services/`, `src/lib/utils/store/`, `src/routes/`
- **API**: Components are directory-level groupings under `src/routes/`, `src/services/`, `src/middlewares/`, `src/utils/`

Each component maps to a directory subtree at a configurable depth. If any component has >50 files, increase the depth.

## Output Format

All diagrams go to `docs/c4/` as Markdown files containing Mermaid code blocks:
- `docs/c4/L1-system-context.md` — Layer 1
- `docs/c4/L2-container.md` — Layer 2
- `docs/c4/L3-dashboard.md` — Layer 3 for Dashboard container
- `docs/c4/L3-api.md` — Layer 3 for API container
- `docs/c4/database.md` — Database schema (from Supabase)

Diagrams should be concise — optimized for AI context consumption, not presentation slides.
