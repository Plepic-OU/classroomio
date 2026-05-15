# C4 Model Conventions

## Abstraction Levels

| Level | Diagram | Question answered |
|-------|---------|-------------------|
| 1 | System Context | What does the system do and who uses it? |
| 2 | Container | What are the deployable/runnable units? |
| 3 | Component | What logical groupings exist within each container? |

## Key Definitions

**Person** — a human role that interacts with the system (teacher, student).  
**System** — the software system being described (ClassroomIO).  
**System_Ext** — an external system the system depends on (Supabase, Cloudflare R2).  
**Container** — a separately deployable unit: web app, API server, database. Not a Docker container (though it can be).  
**Component** — a grouping of related functionality within a container behind a well-defined interface. NOT separately deployable. In JavaScript: a directory/module grouping related functions and types.

## Component Granularity (Layer 3)

- Group by **responsibility**, not by technical layer alone.
- A component should be cohesive enough that changes to one rarely require changes to another.
- Avoid mega-components (>50 files = too coarse; reduce depth to get more granularity).
- Each component should be nameable with a noun or short phrase that describes its role.
- Routes, services, and utilities are natural component boundaries in this codebase.

## ClassroomIO Mapping

### API Container Components
Derived from `src/` directory segments at depth 2:
- `config` → Config — Zod-validated env vars
- `constants` → Constants — shared constants and limits
- `middlewares` → Middlewares — auth + rate-limiter
- `routes/course` → Course Routes — HTTP handlers for course operations
- `routes/mail` → Mail Routes — email endpoint
- `services/course` → Course Services — course clone business logic
- `types` → Types — shared TypeScript type definitions
- `utils` → Core Utils — PDF gen, S3, certificate, Supabase client, email helpers
- `utils/auth` → Auth Utils — JWT/token validation
- `utils/openapi` → OpenAPI — API spec generation
- `utils/redis` → Redis Utils — rate-limit store helpers

### Dashboard Container Components
Derived from `src/` directory segments at depth 3:
- `lib/components/*` → UI components by domain
- `lib/utils/services` → Service layer (Supabase data-fetching)
- `lib/utils/store` → Svelte stores (reactive state)
- `lib/utils/functions` → Utility functions
- `lib/utils/constants` → App-wide constants
- `lib/utils/translations` → i18n bundles
- `routes/api/*` → Server-side API handlers (SvelteKit endpoints)
- `routes/org` → Organisation admin pages
- `routes/courses` → Course management pages
- `routes/lms` → Student LMS pages

## Relationship Rules

- Only diagram relationships between components in the same container in C4Component.
- Cross-container dependencies go in C4Container.
- External system usage in a component should be shown in C4Component with `System_Ext` nodes.
- Aggregate multiple imports between the same pair into a single relationship.
