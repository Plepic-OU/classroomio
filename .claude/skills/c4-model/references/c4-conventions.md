# C4 Model Conventions

Source: https://c4model.com/

## Layers

| Layer | Name | What it shows |
|-------|------|---------------|
| 1 | System Context | The system and its external actors/systems |
| 2 | Container | Deployable units (web app, API, database) inside the system |
| 3 | Component | Logical groupings of code inside a container |
| 4 | Code | (Optional) Class/function level — usually too fine-grained for docs |

## Abstractions

**Person** — a human user (role-based, not individual).

**Software System** — highest-level boundary; something that delivers value. Can be internal or external.

**Container** — a deployable/runnable unit: web application, API, mobile app, database, message queue. Not a Docker container — it's a runtime process or data store.

**Component** (Layer 3) — a grouping of related functionality encapsulated behind a well-defined interface, executing *within* a container. Language-specific:
- OOP: classes/interfaces grouped by concern
- Procedural: files in a directory
- Functional: logical grouping of functions + types
- JS/TS: modules (directories) with a coherent purpose

## Key rules

- Components are **not** independently deployable — they run inside a container.
- Component granularity is judgment-based. The Spring PetClinic example treats `OwnerController`, `PetController` as separate components; but `JpaOwnerRepository` + `JpaVetRepository` could be one "Repositories" component.
- **Aim:** each component has one clear responsibility and a name a non-developer could understand.
- Components for ClassroomIO are derived from directory structure (one directory = one component at the configured depth).

## ClassroomIO-specific decisions

### Layer 1 — System Context

Actors:
- **Admin/Teacher** — creates courses, manages org
- **Student** — takes courses, submits exercises

External systems:
- **Supabase** (auth, database, storage) — hosted service
- **Email (SMTP)** — transactional email
- **AWS S3** — file/video storage
- **PostHog** — product analytics
- **Sentry** — error monitoring
- **Polar** — payments/subscriptions
- **Unsplash** — stock images API

### Layer 2 — Containers

| Container | Tech | Purpose |
|-----------|------|---------|
| Dashboard | SvelteKit | Main LMS web UI — admin + student |
| API | Hono / Node.js | Backend for heavy ops (PDF, S3, email, cloning) |
| Edge Functions | Deno / Supabase | Notifications, grade triggers |
| Supabase DB | PostgreSQL | Primary data store with RLS |
| Supabase Auth | GoTrue | JWT-based authentication |
| Supabase Storage | S3-compatible | File/image/video uploads |
| Marketing Site | SvelteKit | classroomio.com public pages |
| Course App | Next.js / React | Embeddable course viewer widget |

### Layer 3 — Components (derived from AST)

Dashboard component depth = **3** (e.g. `lib/components/AI`, `lib/utils/services`, `routes/org/[slug]`).
API component depth = **2** (e.g. `routes/course`, `services/course`, `utils/auth`).
