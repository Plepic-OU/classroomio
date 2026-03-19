# Mermaid C4 Diagram Syntax

Source: https://mermaid.js.org/syntax/c4.html

> Note: Mermaid C4 support is experimental — syntax may change between releases.

## Diagram types

```
C4Context      — Layer 1: System Context
C4Container    — Layer 2: Container
C4Component    — Layer 3: Component
C4Dynamic      — Interaction / sequence (optional)
C4Deployment   — Infrastructure (optional)
```

## Layer 1 — System Context

```mermaid
C4Context
  title System Context — ClassroomIO

  Person(instructor, "Instructor", "Creates and manages courses")
  Person(student, "Student", "Enrols and completes courses")

  System(classroomio, "ClassroomIO", "LMS platform for teaching and learning")

  System_Ext(supabase, "Supabase", "Auth, database, storage")
  System_Ext(email, "Email (ZeptoMail)", "Transactional email")
  System_Ext(payments, "Stripe / Polar", "Subscription billing")

  Rel(instructor, classroomio, "Uses")
  Rel(student, classroomio, "Uses")
  Rel(classroomio, supabase, "Reads/writes data", "Supabase JS SDK / HTTP")
  Rel(classroomio, email, "Sends emails", "SMTP / API")
  Rel(classroomio, payments, "Processes payments", "HTTPS")
```

## Layer 2 — Container

```mermaid
C4Container
  title Container Diagram — ClassroomIO

  Person(user, "Instructor / Student")

  System_Boundary(classroomio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / TypeScript", "Web UI, SSR + client-side")
    Container(api, "API", "Hono / Node.js", "REST backend, Fly.io")
    ContainerDb(db, "Supabase", "PostgreSQL 15", "Courses, users, orgs, grading")
    Container(edge, "Edge Functions", "Deno / Supabase Functions", "Grades, notifications")
  }

  System_Ext(redis, "Redis (Upstash)", "Rate limiting, cache")
  System_Ext(s3, "AWS S3", "File storage")
  System_Ext(email, "ZeptoMail", "Email delivery")
  System_Ext(ai, "OpenAI", "AI grading & prompts")

  Rel(user, dashboard, "Uses", "HTTPS")
  Rel(dashboard, api, "Calls", "HTTPS / fetch")
  Rel(dashboard, db, "Reads/writes", "Supabase JS SDK")
  Rel(api, db, "Reads/writes", "Supabase JS SDK")
  Rel(api, redis, "Caches / rate-limits", "ioredis")
  Rel(api, s3, "Generates presigned URLs", "AWS SDK")
  Rel(api, email, "Sends emails", "SMTP")
  Rel(api, ai, "Calls LLM", "HTTP / Vercel AI SDK")
  Rel(edge, db, "Reads/writes", "Supabase client")
```

## Layer 3 — Component (template)

```mermaid
C4Component
  title Component Diagram — Dashboard

  Container_Boundary(dashboard, "Dashboard") {
    Component(routes, "Routes", "SvelteKit pages", "Page/layout components")
    Component(components, "UI Components", "Svelte", "Reusable Svelte components")
    Component(lib, "Lib / Utils", "TypeScript", "Shared stores, helpers, types")
    Component(apiRoutes, "API Routes", "SvelteKit server endpoints", "Server-side handlers")
    Component(mail, "Mail Templates", "HTML / TypeScript", "Email rendering")
  }

  Rel(routes, components, "Uses")
  Rel(routes, lib, "Uses")
  Rel(routes, apiRoutes, "Calls", "fetch")
  Rel(apiRoutes, mail, "Renders")
```

## Element reference

```
# People
Person(alias, label, description)
Person_Ext(alias, label, description)

# Systems
System(alias, label, description)
System_Ext(alias, label, description)
SystemDb(alias, label, description)       # database icon

# Containers
Container(alias, label, technology, description)
ContainerDb(alias, label, technology, description)
ContainerQueue(alias, label, technology, description)

# Components
Component(alias, label, technology, description)
ComponentDb(alias, label, technology, description)

# Boundaries
Enterprise_Boundary(alias, label) { ... }
System_Boundary(alias, label) { ... }
Container_Boundary(alias, label) { ... }

# Relationships
Rel(from, to, label)
Rel(from, to, label, technology)
BiRel(from, to, label)

# Layout hints (use sparingly)
Rel_R(from, to, label)   # force right
Rel_D(from, to, label)   # force down
```

## Styling (optional)

```
UpdateElementStyle(alias, $bgColor="#1168bd", $fontColor="#ffffff", $borderColor="#0e5da8")
UpdateRelStyle(from, to, $textColor="#999", $lineColor="#999", $offsetX="5", $offsetY="-10")
UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="2")
```

## Tips for AI-readable output

- Keep diagrams to ≤ 20 nodes for readability.
- For L3, only show components with significant relationships.
- Use `Container_Boundary` to group related components visually.
- Prune self-obvious relationships (every route uses lib — omit if noise).
