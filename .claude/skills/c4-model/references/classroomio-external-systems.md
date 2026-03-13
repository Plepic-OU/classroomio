# ClassroomIO External Systems

Canonical list for L1 and L2 diagrams. Do not improvise additional systems.

## User-facing Actors

| Actor | Description |
|-------|-------------|
| Educator | Creates and manages courses, organizations |
| Student | Enrolls in courses, submits exercises |

## External Systems

| System | Role | Used By | npm packages |
|--------|------|---------|--------------|
| Supabase | PostgreSQL DB + Auth + Realtime + Storage + Edge Functions | Dashboard, API | `@supabase/supabase-js` |
| Redis | Caching and rate limiting | API | `ioredis` |
| Cloudflare R2 / AWS S3 | File storage (videos, PDFs, uploads) | API | `@aws-sdk/client-s3`, cloudflare utils |
| OpenAI | AI course generation (completions) | Dashboard (server-side), API | `openai`, `openai-edge`, `@ai-sdk/openai`, `ai` |
| Vercel | Dashboard hosting + serverless functions | Dashboard | `@sveltejs/adapter-vercel` |
| Fly.io | API hosting | API | deployment target |
| LemonSqueezy | Billing / subscriptions (cloud only) | Dashboard | `@lemonsqueezy/lemonsqueezy.js` |
| Polar | Billing alternative (cloud only) | Dashboard | `@polar-sh/sdk` |
| Sentry | Error monitoring | Dashboard | `@sentry/sveltekit` |
| Unsplash | Stock images for course covers | Dashboard | REST API via fetch |
| Mailpit | Local email testing (dev only) | Supabase | devcontainer only |
