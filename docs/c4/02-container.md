## Level 2 — Containers

ClassroomIO is a pnpm + Turborepo monorepo with four user-facing apps and a Supabase backend. The **dashboard** is the main product; it talks to **Supabase** directly for CRUD (RLS-protected) and to the **API** for work the edge can't handle (PDFs, video presigning, mail, course cloning). A separate marketing site and docs site round out the public surface.

```mermaid
C4Container
    title Containers — ClassroomIO

    Person(student, "Student")
    Person(instructor, "Instructor")
    Person(org_admin, "Org admin")

    System_Boundary(classroomio, "ClassroomIO") {
        Container(dashboard, "Dashboard", "SvelteKit + TailwindCSS (Vercel / Node adapter)", "Main LMS web app. Student, instructor, and admin UI. Hosts /api/* server endpoints for AI, payments, email, analytics.")
        Container(api, "API", "Hono on Node 20", "Backend for work the dashboard cannot do at the edge: certificate PDFs, video presigning, KaTeX, course cloning, transactional mail. Port 3002.")
        Container(marketing, "Marketing site", "SvelteKit (adapter-auto)", "Public marketing pages at classroomio.com. Port 5174.")
        Container(docs, "Docs site", "Tanstack Start + Fumadocs", "Developer documentation. Port 3000.")

        Container(edge_fns, "Supabase Edge Functions", "Deno", "Ad-hoc server logic alongside Supabase — currently only grade-calculation helpers.")
        Container(sb_auth, "Supabase Auth", "GoTrue (managed/self-hosted)", "JWT-based user authentication. Issues access tokens consumed by dashboard & API.")
        ContainerDb(sb_db, "Application database", "PostgreSQL (Supabase) with RLS", "Primary store: orgs, courses, lessons, exercises, submissions, marks, profiles, roles.")
        ContainerDb(redis, "Rate-limit cache", "Redis", "Backs the API's request rate limiter. Port 6379.")
    }

    System_Ext(payments, "Payment providers", "Stripe, LemonSqueezy, Polar")
    System_Ext(openai, "OpenAI", "LLM API")
    System_Ext(r2, "Cloudflare R2", "S3-compatible object storage")
    System_Ext(mail, "Email provider", "Zoho ZeptoMail / SMTP")
    System_Ext(unsplash, "Unsplash", "Image search API")
    System_Ext(vercel, "Vercel platform API", "Domain provisioning")
    System_Ext(observability, "Observability", "Sentry + PostHog")

    Rel(student, dashboard, "Uses", "HTTPS")
    Rel(instructor, dashboard, "Uses", "HTTPS")
    Rel(org_admin, dashboard, "Uses", "HTTPS")
    Rel(student, marketing, "Browses", "HTTPS")
    Rel(instructor, docs, "Reads", "HTTPS")

    Rel(dashboard, sb_auth, "Signs users in via", "JSON/HTTPS")
    Rel(dashboard, sb_db, "Reads/writes (RLS-scoped, anon key)", "PostgREST/HTTPS")
    Rel(dashboard, api, "Calls typed RPC for PDFs, presign, clone, mail", "JSON/HTTPS")
    Rel(dashboard, openai, "Streams completions from", "JSON/HTTPS")
    Rel(dashboard, payments, "Checkout & webhook endpoints", "JSON/HTTPS")
    Rel(dashboard, unsplash, "Searches images via", "JSON/HTTPS")
    Rel(dashboard, vercel, "Provisions custom domains via", "JSON/HTTPS")
    Rel(dashboard, observability, "Sends events & errors to", "JSON/HTTPS")

    Rel(api, sb_db, "Reads/writes (service role, bypasses RLS)", "PostgREST/HTTPS")
    Rel(api, redis, "Rate-limit counters", "RESP")
    Rel(api, r2, "Presigns uploads, fetches signed download URLs", "S3 API/HTTPS")
    Rel(api, mail, "Sends transactional mail via", "SMTP / JSON/HTTPS")
    Rel(api, observability, "Sends errors to", "JSON/HTTPS")

    Rel(edge_fns, sb_db, "Calls Postgres RPC functions", "PostgREST/HTTPS")
```

### Notes

- **Dashboard split personality.** The dashboard hosts SvelteKit server endpoints under `/api/*` for things that *would* be in the API service but happen to live on the edge — AI streaming (OpenAI), payment webhooks (Polar, LemonSqueezy), analytics, custom-domain provisioning, transactional-email orchestration. The Hono API in `apps/api` is reserved for work that genuinely can't run on the edge (binary PDFs, R2 SDK, KaTeX). See Level 3 for the split.
- **Typed RPC, not REST.** Dashboard → API is end-to-end typed: the API exports its Hono app type via `@cio/api/rpc-types`, and the dashboard imports it with `hcWithType`. `turbo.json` declares `@cio/dashboard#build` depends on `@cio/api#build` so the types resolve at build time. Don't break the chained `.route()` calls in `apps/api/src/app.ts` — splitting them across statements drops the inferred type.
- **Two Supabase clients.** Dashboard uses the **anon key** (RLS enforced — users see only their own rows). The API uses the **service role key** (bypasses RLS for admin operations like cloning a course or batch grading).
- **Build / deploy variants.** `PUBLIC_IS_SELFHOSTED=true` switches the dashboard to `adapter-node` (single `node build` binary). Default is `adapter-vercel` (serverless functions on Vercel). The API is always Node. Edges in the diagram are identical either way; only the deploy target changes.
- **Edge Functions are minimal.** `supabase/functions/` contains only a `grades-tmp` helper and a stub `notify`. They exist but are not load-bearing in the current architecture.
- **Marketing & Docs are leaf nodes.** They render static-ish content and don't talk to Supabase or the API at runtime, so they have no outgoing edges in the diagram.
