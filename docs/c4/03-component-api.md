## Level 3 — Components: API

The API (`apps/api`, `@cio/api`) is a small Hono server on Node 20 that owns the work the dashboard can't do at the edge: binary PDF generation, AWS S3-SDK presigning against Cloudflare R2, KaTeX rendering, course cloning with service-role DB writes, and transactional mail. The entrypoint `apps/api/src/app.ts` mounts a single `courseRouter` at `/course` and a `mailRouter` at `/mail`, behind a global middleware stack. Routes are declared with chained `.route()` so the inferred type can be re-exported as `Client` for the dashboard.

```mermaid
C4Component
    title Components — API container

    Container(dashboard, "Dashboard", "SvelteKit")
    ContainerDb(sb_db, "Supabase Postgres", "PostgreSQL + RLS")
    ContainerDb(redis, "Rate-limit cache", "Redis")
    System_Ext(r2, "Cloudflare R2", "S3-compatible storage")
    System_Ext(mail, "Email provider", "Zoho ZeptoMail / SMTP")
    System_Ext(observability, "Sentry")

    Container_Boundary(api, "API (Hono on Node 20)") {
        Component(http, "HTTP server & router", "Hono app (app.ts)", "Mounts /course and /mail. Applies logger, prettyJSON, secureHeaders, CORS. Re-exports its inferred type as rpc-types for typed RPC.")
        Component(rate_limiter, "Rate limiter", "hono-rate-limiter + ioredis", "Redis-backed per-IP / per-user request shaping. Returns 429 when exceeded.")
        Component(auth_mw, "Auth middleware", "Hono middleware", "Verifies Supabase JWT from Authorization header and resolves a User. Required for mutation routes (e.g. course clone).")
        Component(error_handler, "Error handler & validation", "Hono onError + zValidator", "Catches uncaught errors → 500 JSON. Per-route Zod schemas → 400 on validation failure. Forwards to Sentry.")

        Component(certificate, "Certificate generator", "/course/download/certificate", "Renders course-completion certificate PDFs from a template.")
        Component(content_pdf, "Course-content PDF", "/course/download/content", "Bundles a course's lessons & exercises into a printable PDF.")
        Component(katex, "KaTeX renderer", "/course/katex", "Renders LaTeX math expressions to SVG/PNG for embedding.")
        Component(lesson, "Lesson router", "/course/lesson", "Server-side lesson CRUD (create, fetch, update) using the service-role key.")
        Component(presign, "Presign router", "/course/presign", "Issues short-lived signed URLs against Cloudflare R2 for video/document uploads & downloads.")
        Component(clone, "Course cloner", "/course/clone", "Deep-copies a course (lessons, exercises, metadata) into a new org. Requires auth.")
        Component(mail_router, "Mail router", "/mail/send", "Accepts an array of email payloads, validates sender domain (@mail.classroomio.com), dispatches via Zoho ZeptoMail when configured, falls back to Nodemailer SMTP.")
    }

    Rel(dashboard, http, "Calls typed RPC for /course/* and /mail/*", "JSON/HTTPS")

    Rel(http, rate_limiter, "Delegates to")
    Rel(http, auth_mw, "Delegates to (mutation routes)")
    Rel(http, error_handler, "Delegates to")

    Rel(rate_limiter, redis, "Reads/writes counters", "RESP")

    Rel(http, certificate, "Routes /course/download/certificate")
    Rel(http, content_pdf, "Routes /course/download/content")
    Rel(http, katex, "Routes /course/katex")
    Rel(http, lesson, "Routes /course/lesson")
    Rel(http, presign, "Routes /course/presign")
    Rel(http, clone, "Routes /course/clone")
    Rel(http, mail_router, "Routes /mail/send")

    Rel(certificate, sb_db, "Reads course & user data", "PostgREST/HTTPS")
    Rel(content_pdf, sb_db, "Reads lessons & exercises", "PostgREST/HTTPS")
    Rel(lesson, sb_db, "Reads/writes lessons (service role)", "PostgREST/HTTPS")
    Rel(clone, sb_db, "Reads source, writes clone (service role)", "PostgREST/HTTPS")

    Rel(presign, r2, "Signs PUT / GET URLs", "S3 API/HTTPS")
    Rel(mail_router, mail, "Sends transactional mail via", "SMTP / JSON/HTTPS")

    Rel(error_handler, observability, "Reports exceptions to", "JSON/HTTPS")
```

### Notes

- **Type-export discipline.** `apps/api/src/app.ts` chains `.route()` calls so Hono can infer the full app type. The dashboard imports that type via `@cio/api/rpc-types` (`hcWithType`, `Client`). Splitting the `app` declaration across statements drops the inference and breaks the dashboard build — this is the single most fragile contract in the repo. `turbo.json` enforces the build order (`@cio/dashboard#build` depends on `@cio/api#build`) so the types resolve.
- **Service role inside the boundary.** API routes use the Supabase service-role key, which bypasses RLS. That's intentional — course cloning and certificate generation need to read rows the calling user doesn't own. The auth middleware on mutation routes (e.g. `/course/clone`) is the compensating control: the JWT identifies *who* is allowed to ask, then the service role does the work.
- **Mail has a dual provider strategy.** Zoho ZeptoMail is preferred when `ZOHO_TOKEN` is set; Nodemailer SMTP is the fallback. Sender domain is hard-validated against `@mail.classroomio.com` regardless of provider, so the API can't be used as an arbitrary SMTP relay.
- **OpenAPI is wired but minimal.** `hono-openapi` is in the dependency tree and `presign.ts` declares routes with `describeRoute` — there's a Scalar reference UI implied but no general policy that every route documents itself yet.
- **What's not in here.** The API does not call OpenAI, payment providers, Unsplash, or PostHog — those all live in dashboard `/api/*` endpoints (see [`03-component-dashboard.md`](./03-component-dashboard.md)). The split is: anything that wants binary output, the AWS SDK, or a long-running Node runtime goes here; everything else stays on the edge.
