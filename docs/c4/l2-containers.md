# L2 Containers
_Generated: 2026-03-13T08:23:26Z_

```mermaid
graph TD
  Educator["Educator\n(user)"]
  Student["Student\n(user)"]

  subgraph ClassroomIO
    Dashboard["Dashboard\n(SvelteKit / Vercel)"]
    API["API\n(Hono / Node / Fly.io)"]
    EdgeFn["Edge Functions\n(Supabase Deno)"]
  end

  Supabase["Supabase\n(PostgreSQL + Auth\n+ Realtime + Storage)"]
  Redis["Redis\n(ioredis)"]
  S3["Cloudflare R2 / S3"]
  OpenAI["OpenAI"]
  LemonSqueezy["LemonSqueezy\n(billing)"]
  Polar["Polar\n(billing alt)"]
  Sentry["Sentry"]
  Unsplash["Unsplash"]

  Educator -->|"HTTPS"| Dashboard
  Student -->|"HTTPS"| Dashboard

  Dashboard -->|"REST/Realtime (supabase-js)"| Supabase
  Dashboard -->|"calls (HTTP) — long-running tasks"| API
  Dashboard -->|"AI completions (server-side)"| OpenAI
  Dashboard -->|"billing API"| LemonSqueezy
  Dashboard -->|"billing API"| Polar
  Dashboard -->|"error events"| Sentry
  Dashboard -->|"REST API"| Unsplash

  API -->|"service role (supabase-js)"| Supabase
  API -->|"cache + rate limit (ioredis)"| Redis
  API -->|"upload/serve files (aws-sdk)"| S3

  Supabase -->|"triggers"| EdgeFn
```

| Container | Tech | Responsibility |
|-----------|------|----------------|
| Dashboard | SvelteKit, Tailwind, Carbon DS, Vercel adapter | Main LMS UI — course management, student portal, org admin |
| API | Hono (Node.js), Fly.io | Long-running tasks: PDF/video processing, email, AI, file upload |
| Edge Functions | Supabase Deno | DB-triggered serverless logic (`notify` and related functions) |
| Supabase | PostgreSQL 15, GoTrue, Realtime | Primary data store, auth, real-time subscriptions, file storage |
| Redis | ioredis | API-layer caching and per-route rate limiting |
| Cloudflare R2 / S3 | AWS SDK v3 | Binary file storage (videos, PDFs, uploads) |

**Note:** Dashboard → API HTTP calls are not captured by static import analysis. These cross-container relationships are documented manually based on `lib/utils/services/api` and `routes/api/` proxy patterns.
