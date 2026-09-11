# Layer 2 — Container

Hand-authored from repo inspection (`CLAUDE.md`, `pnpm-workspace.yaml`, `apps/*`, `supabase/`) — no AST source of truth at this layer. Re-derive if the monorepo layout changes; see `CLAUDE.md` "Monorepo layout" for the authoritative app/package list.

```mermaid
C4Container
title ClassroomIO — Container Diagram

Person(teacher, "Teacher / Org Admin")
Person(student, "Student")
Person(visitor, "Public Visitor")

System_Boundary(classroomio, "ClassroomIO") {
  Container(dashboard, "Dashboard", "SvelteKit", "Teacher-facing admin (org/[slug]/*) + student-facing LMS (lms/*); auth, billing UI, AI completion routes, Unsplash proxy")
  Container(api, "API", "Hono / Node", "Heavy & async work only: course cloning, video/PDF processing, presigned S3/R2 uploads, transactional email, KaTeX rendering")
  Container(website, "classroomio-com", "SvelteKit", "Public marketing site")
  Container(docs, "Docs", "React / TanStack Start", "Documentation site (separate stack)")
  ContainerDb(postgres, "Postgres", "Supabase", "Primary datastore; RLS policies are the primary authorization layer")
  Container(auth, "Supabase Auth", "GoTrue", "Email/password + Google OAuth, issues JWTs")
  ContainerDb(supastorage, "Supabase Storage", "Supabase", "Smaller assets: avatars, org logos")
  Container(edgefn, "Edge Functions", "Deno", "supabase/functions/* — Postgres-triggered or scheduled logic")
  ContainerDb(redis, "Redis", "ioredis", "API-side caching / rate limiting")
}

System_Ext(objstorage, "R2 / S3", "Video & large file storage")
System_Ext(billing, "LemonSqueezy / Polar", "Billing")
System_Ext(openai, "OpenAI", "AI completions")
System_Ext(email, "ZeptoMail", "Transactional email")

Rel(teacher, dashboard, "Uses", "HTTPS")
Rel(student, dashboard, "Uses", "HTTPS")
Rel(visitor, website, "Browses", "HTTPS")
Rel(visitor, dashboard, "Browses public courses (lms/explore)", "HTTPS")

Rel(dashboard, postgres, "Reads/writes via", "supabase-js, RLS-scoped")
Rel(dashboard, auth, "Signs in via", "supabase-js")
Rel(dashboard, supastorage, "Uploads small assets via", "supabase-js")
Rel(dashboard, api, "Calls for heavy/async ops", "HTTP (RPC types)")
Rel(dashboard, openai, "Requests AI completions from", "HTTPS (openai-edge)")
Rel(dashboard, billing, "Initiates checkout with", "HTTPS")

Rel(api, postgres, "Reads/writes via", "supabase-js, service role")
Rel(api, redis, "Caches / rate-limits via", "ioredis")
Rel(api, objstorage, "Presigns uploads to", "S3 API")
Rel(api, email, "Sends mail via", "nodemailer/zeptomail")

Rel(edgefn, postgres, "Triggered by / queries", "Postgres")
Rel(auth, postgres, "Stores users in", "auth schema")
```
