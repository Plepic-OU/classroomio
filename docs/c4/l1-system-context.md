# L1 System Context
_Generated: 2026-03-13T08:23:26Z_

```mermaid
graph TD
  Educator["Educator\n(user)"]
  Student["Student\n(user)"]

  CIO["ClassroomIO\n(LMS platform)"]

  Supabase["Supabase\n(DB + Auth + Realtime\n+ Storage + Edge Fn)"]
  Redis["Redis\n(cache + rate limiting)"]
  S3["Cloudflare R2 / S3\n(file storage)"]
  OpenAI["OpenAI\n(AI course generation)"]
  Vercel["Vercel\n(Dashboard hosting)"]
  Fly["Fly.io\n(API hosting)"]
  LemonSqueezy["LemonSqueezy\n(billing)"]
  Polar["Polar\n(billing alt)"]
  Sentry["Sentry\n(error monitoring)"]
  Unsplash["Unsplash\n(stock images)"]

  Educator -->|"creates courses, manages org"| CIO
  Student -->|"enrolls, submits exercises"| CIO

  CIO -->|"auth, data, realtime"| Supabase
  CIO -->|"cache, rate limit"| Redis
  CIO -->|"upload/serve videos, PDFs"| S3
  CIO -->|"AI course generation"| OpenAI
  CIO -->|"hosts UI"| Vercel
  CIO -->|"hosts API"| Fly
  CIO -->|"billing (cloud)"| LemonSqueezy
  CIO -->|"billing alt (cloud)"| Polar
  CIO -->|"error tracking"| Sentry
  CIO -->|"course cover images"| Unsplash
```

| System | Role |
|--------|------|
| Supabase | PostgreSQL + Auth + Realtime + Storage + Edge Functions |
| Redis | API-layer caching and rate limiting |
| Cloudflare R2 / S3 | Video and PDF file storage |
| OpenAI | AI-powered course generation (completions) |
| Vercel | Dashboard (SvelteKit) hosting and serverless functions |
| Fly.io | API (Hono/Node) hosting |
| LemonSqueezy | Subscription billing (cloud only) |
| Polar | Alternative billing provider (cloud only) |
| Sentry | Runtime error monitoring (Dashboard) |
| Unsplash | Stock photo API for course cover images |
