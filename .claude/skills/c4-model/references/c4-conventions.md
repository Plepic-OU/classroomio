# C4 Model Conventions for ClassroomIO

Reference: https://c4model.com/ | Mermaid syntax: https://mermaid.js.org/syntax/c4.html

---

## Abstraction Levels

| Layer | Diagram Type | Audience | Granularity |
|-------|-------------|----------|-------------|
| 1 — Context  | `C4Context`   | Everyone | The entire system + its users and external dependencies |
| 2 — Container | `C4Container` | Developers | Deployable units (apps, databases, queues) |
| 3 — Component | `C4Component` | Developers | Major structural building blocks within a container |

**We do not generate Layer 4 (Code)** — it is too volatile and already derivable from the AST.

---

## ClassroomIO Actors & External Systems

### Actors
| Alias | Type | Description |
|-------|------|-------------|
| `instructor` | `Person` | Org admin — creates courses, manages students, views analytics |
| `student` | `Person` | Learner — browses courses, submits exercises, earns certificates |

### External Systems
| Alias | System | Notes |
|-------|--------|-------|
| `supabase_auth` | Supabase Auth (GoTrue) | JWT authentication, session management |
| `supabase_realtime` | Supabase Realtime | WebSocket subscriptions (newsfeed, notifications) |
| `zepto_mail` | ZeptoMail / Nodemailer | Transactional email |
| `cloudflare_r2` | Cloudflare R2 | Object storage (media, PDFs) |
| `polar` | Polar.sh | Payment processing / subscription management |
| `posthog` | PostHog | Product analytics |
| `sentry` | Sentry | Error monitoring |
| `unsplash` | Unsplash API | Stock photography for course covers |

---

## ClassroomIO Containers (Layer 2)

| Alias | Label | Technology | Port |
|-------|-------|------------|------|
| `dashboard` | Dashboard | SvelteKit 1.x + TailwindCSS | 5173 |
| `api` | API Service | Hono on Node.js (ESM) | 3002 |
| `postgres` | PostgreSQL | via Supabase (local: 54322) | 54322 |
| `supabase_api` | Supabase REST/RPC | PostgREST + GoTrue | 54321 |
| `redis` | Redis | Session cache, rate limiting | — |
| `storage` | Object Storage | Cloudflare R2 / Supabase Storage | — |
| `edge_functions` | Edge Functions | Deno (supabase/functions/) | — |

---

## Dashboard Components (Layer 3 — derived from AST)

Primary groupings when AST is aggregated at depth 3:

| Component Group | Path prefix | Role |
|----------------|-------------|------|
| Routes — Org Admin | `routes/org` | Course management, audience, settings, quiz |
| Routes — Student LMS | `routes/lms` | Home, explore, my learning, community, exercises |
| Routes — Course Pages | `routes/course` | Public course landing pages |
| Routes — Server API | `routes/api` | SvelteKit server-side API handlers (server role) |
| Routes — Auth | `routes/login`, `routes/signup` | Authentication flows |
| UI Components | `lib/components` | Svelte UI components (per-feature subdirs) |
| Services | `lib/utils/services` | Data-fetching services (Supabase RPC + Hono client) |
| Stores | `lib/utils/store` | Svelte writable stores (app, user, org state) |
| Utilities | `lib/utils/functions` | Pure helpers, Supabase browser/server clients |
| Constants | `lib/utils/constants` | Route enums, public routes, app-wide constants |
| Types | `lib/utils/types` | TypeScript type definitions |
| Server Hooks | `hooks.server.ts` | Auth middleware for all `/api/*` routes |
| i18n | `lib/utils/translations` | sveltekit-i18n locale files |

---

## API Components (Layer 3 — derived from AST)

| Component Group | Path prefix | Role |
|----------------|-------------|------|
| Course Routes | `routes/course` | PDF certificate, content download, cloning, KaTeX, presign |
| Mail Routes | `routes/mail` | Transactional email dispatch |
| Course Services | `services/course` | Course business logic |
| Utilities | `utils` | Certificate PDF gen, course PDF gen, auth, redis, openapi |
| Types | `types` | Zod schemas for requests/responses |
| Middleware | `middlewares` | Rate limiter |
| Config | `config` | Env Zod validation at startup |

---

## Mermaid C4 Element Reference

```
C4Context / C4Container / C4Component

Person(alias, "Label", "Descr")
Person_Ext(alias, "Label", "Descr")

System(alias, "Label", "Descr")
System_Ext(alias, "Label", "Descr")

Container(alias, "Label", "Technology", "Descr")
Container_Ext(alias, "Label", "Technology", "Descr")
ContainerDb(alias, "Label", "Technology", "Descr")
ContainerQueue(alias, "Label", "Technology", "Descr")

Component(alias, "Label", "Technology", "Descr")
Component_Ext(alias, "Label", "Technology", "Descr")
ComponentDb(alias, "Label", "Technology", "Descr")

Rel(from, to, "Label")
Rel(from, to, "Label", "Technology")
BiRel(from, to, "Label")
Rel_Back(from, to, "Label")

System_Boundary(alias, "Label") { ... }
Container_Boundary(alias, "Label") { ... }
Enterprise_Boundary(alias, "Label") { ... }

UpdateLayoutConfig($c4ShapeInRow, $c4BoundaryInRow)
```

---

## Output Files

| File | Contents |
|------|----------|
| `docs/c4/context.md` | Layer 1 — System Context |
| `docs/c4/containers.md` | Layer 2 — Containers |
| `docs/c4/components-dashboard.md` | Layer 3 — Dashboard components |
| `docs/c4/components-api.md` | Layer 3 — API components |
| `docs/c4/database.md` | DB schema summary (generated by db-schema.sh) |
| `docs/c4/ast-output.json` | Raw AST extraction output (gitignored) |

---

## Diagram Quality Rules

1. **Max ~20 nodes per diagram** — split into sub-diagrams if needed.
2. **Aliases must be valid Mermaid identifiers** — replace `/`, `-`, `[`, `]`, `.` with `_`.
3. **Technology field** (containers/components) should be concise: `SvelteKit 1.x`, `Hono 4`, `PostgreSQL 15`, `Zod`, etc.
4. **Relationships** — show data flow direction; use technology label for protocol (HTTP, RPC, SQL, WS).
5. **Trim noise** — omit pure type/constant/mock components from Layer 3; focus on runtime behaviour.
6. **Group small leaf components** — if a component has <2 .ts files and no relationships, consider merging it into its parent.
