# C4 Model Conventions

Source: https://c4model.com

## The Four Layers

| Layer | Name | Answers |
|---|---|---|
| 1 | System Context | What does this system do and who uses it? |
| 2 | Container | What are the deployable units / runtime processes? |
| 3 | Component | What are the major structural building blocks inside a container? |
| 4 | Code | How is a specific component implemented? (out of scope here) |

## Abstractions

**Person** — a human actor (user, administrator, external party).

**Software System** — the highest level of abstraction; something that delivers value to users. Treat third-party systems (Supabase, Stripe) as external software systems.

**Container** — a separately runnable/deployable unit: web app, API server, database, mobile app, serverless function, message queue. One container = one OS process or similar runtime boundary.

**Component** — a grouping of related functionality inside a container, behind a well-defined interface. Components are *not* separately deployable. In practice, map one top-level directory (or feature module) to one component.

## Granularity Rules for Layer 3

- One component = one cohesive feature area / module directory.
- Exclude low-value scaffolding: utility classes, data-only structs, config files.
- Aim for 5–20 components per container in a diagram (more becomes unreadable).
- If a directory subtree has >50 files at the same component key, the depth is too shallow — increase it.
- Use the directory structure of the source code as the primary grouping signal.
- Show only *architecturally significant* relationships (avoid drawing every possible import edge).

## Relationship conventions

- Arrows point in the direction of dependency (A → B means "A uses B").
- Label relationships with the *technology* or *protocol* where helpful (HTTP, Supabase JS SDK, Redis pub/sub).
- Prefer showing the most important 3–8 relationships per component; prune trivial ones.

## ClassroomIO-specific container inventory

| Container | Technology | Description |
|---|---|---|
| Dashboard | SvelteKit, TypeScript, Tailwind | Instructor/student web UI, SSR + client |
| API | Hono, Node.js, TypeScript | REST/RPC backend, deployed on Fly.io |
| Supabase | PostgreSQL 15, PostgREST, Auth, Realtime, Storage | Managed BaaS (local: port 54321) |
| Redis | Upstash Redis | Rate limiting, session cache |
| Edge Functions | Deno (Supabase Functions) | grades-tmp, notify |

## External systems (ClassroomIO)

- ZeptoMail / Nodemailer — transactional email
- AWS S3 — file storage (presigned URLs via API)
- Stripe / Lemonsqueezy / Polar — payments
- PostHog — product analytics
- Sentry — error monitoring
- OpenAI (via Vercel AI SDK) — AI grading, exercise prompts
