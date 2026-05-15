# C4 Model Conventions

Reference: https://c4model.com/

## Abstraction levels

| Level | Name | "What" | Audience |
|-------|------|--------|----------|
| 1 | System Context | The system and its external actors/systems | Everyone |
| 2 | Containers | Deployable units (apps, DBs, services) inside the system | Tech leads |
| 3 | Components | Groupings of related code within one container | Developers |
| 4 | Code | Classes/functions (usually auto-generated) | IDEs |

## Key rules

- **One level per diagram.** A C4 L2 diagram should not show internal component structure.
- **Relationships show intent, not mechanics.** Label with *why* (e.g. "reads course data") not *how* (e.g. "TCP port 5432").
- **Components ≠ files.** A component is a cohesive group of files that together provide a named capability.
- **External systems are grey boxes.** You do not show their internals.
- **Person** = role/persona that uses the system directly. Not every user is a separate Person node.

## Component granularity (L3)

A component should:
- Be independently deployable or at least independently replaceable.
- Have a clear name that a developer could find without reading the code.
- Typically map to a feature slice, a service layer, or a subdirectory with a coherent purpose.

Rule of thumb for ClassroomIO:
- Dashboard: group by `lib/<domain>/<layer>` (depth 3). Routes group by `routes/<section>` (depth 2).
- API: group by `<layer>/<domain>` (depth 2).

## ClassroomIO personas

| Persona | Description |
|---------|-------------|
| Teacher / Admin | Creates courses, manages org members, views analytics, configures billing |
| Student | Enrolls in courses, completes lessons and exercises, earns certificates |

## ClassroomIO external systems

| System | Role |
|--------|------|
| Supabase | PostgreSQL + Auth + Object Storage — primary data store |
| Polar | Org-level subscription billing |
| AWS S3 / Cloudflare R2 | File and asset storage (PDFs, uploads) |
| Email Provider | Transactional email via Nodemailer / ZeptoMail |
| PostHog | Product analytics and event tracking |
| Sentry | Error monitoring and performance |
| Redis | API rate-limiting cache |
