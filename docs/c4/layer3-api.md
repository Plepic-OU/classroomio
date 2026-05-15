# C4 Layer 3 — API container

Components inside `apps/api` (Hono 4 on Node). Derived from AST extraction
(`docs/c4/components.json`, depth=2) — regenerate with
`node .claude/skills/c4-model/scripts/extract-components.mjs` whenever the
source layout changes.

```mermaid
C4Component
  title ClassroomIO API — Component view

  Container_Boundary(api, "API (Hono 4 on Node)") {
    Component(entry, "Entry / app", "Hono", "src/app.ts; src/index.ts; src/rpc-types.ts — middleware chain (logger; prettyJSON; secureHeaders; CORS; rate limiter) then routes")
    Component(config, "Config", "TypeScript", "src/config/env.ts — typed env loader")
    Component(constants, "Constants", "TypeScript", "Rate-limiter and upload constants")

    Component(middlewares, "Middlewares", "Hono", "Bearer-token auth (validates against Supabase); Redis rate limiter")

    Component(routes_mail, "Mail route", "Hono", "src/routes/mail.ts — email send endpoint")
    Component(routes_course, "Course routes", "Hono", "clone; course; katex; lesson; presign — content PDF; certificate PDF; KaTeX rendering; presigned uploads; course cloning")

    Component(services_mail, "Mail service", "TypeScript", "src/services/mail.ts — nodemailer + Zeptomail dispatch")
    Component(services_course, "Course service", "TypeScript", "src/services/course/clone.ts — course-clone orchestration")

    Component(utils, "Utils", "TypeScript", "10 files — certificate PDF generation; Cloudflare R2 helpers; course helpers; email helpers; ID gen")
    Component(utils_auth, "Auth util", "TypeScript", "Validates Supabase user from bearer token")
    Component(utils_openapi, "OpenAPI util", "zod-openapi", "Builds OpenAPI spec from Zod schemas")
    Component(utils_redis, "Redis util", "ioredis", "Connection; key generators; limiter helpers")

    Component(types, "Types (root)", "TypeScript", "database; mail; shared types")
    Component(types_course, "Course types", "TypeScript", "Course / lesson DTOs")
  }

  System_Ext(supabase_pg, "Supabase Postgres", "Core data store")
  System_Ext(supabase_auth, "Supabase Auth", "Token validation")
  System_Ext(r2, "Cloudflare R2", "Object storage")
  System_Ext(smtp, "SMTP / Zeptomail", "Email")
  System_Ext(redis, "Redis", "Rate-limit state")
  System_Ext(openai_x, "OpenAI", "AI completions (where invoked)")

  Rel(entry, middlewares, "Mounts")
  Rel(entry, routes_course, "Mounts /course/*")
  Rel(entry, routes_mail, "Mounts /mail")
  Rel(entry, utils_openapi, "Serves /openapi")
  Rel(entry, config, "Reads env")

  Rel(routes_course, services_course, "Delegates")
  Rel(routes_course, utils, "Uses helpers")
  Rel(routes_course, types_course, "Uses types")
  Rel(routes_course, middlewares, "Auth / rate-limit")
  Rel(routes_mail, services_mail, "Sends")

  Rel(middlewares, utils_auth, "Verifies token")
  Rel(middlewares, utils_redis, "Counts requests")

  Rel(utils_auth, supabase_auth, "Validates bearer", "HTTPS")
  Rel(utils, supabase_pg, "Reads/writes", "service role")
  Rel(services_course, supabase_pg, "Clones course data", "service role")
  Rel(utils, r2, "Presigns; uploads", "S3 API")
  Rel(services_mail, smtp, "Sends mail", "SMTP")
  Rel(utils_redis, redis, "RESP", "TCP")
```

## Component breakdown (from `components.json`)

| Component | Files | Notes |
|---|---:|---|
| `(top)` | 3 | `app.ts`, `index.ts`, `rpc-types.ts` |
| `config` | 1 | Env loader |
| `constants` | 3 | Rate-limiter; upload |
| `middlewares` | 2 | Auth; rate limiter |
| `routes` | 1 | `mail.ts` |
| `routes/course` | 5 | clone; course; katex; lesson; presign |
| `services` | 1 | mail |
| `services/course` | 1 | clone |
| `types` | 3 | database; index; mail |
| `types/course` | 2 | index; lesson |
| `utils` | 10 | certificate; cloudflare; course; email; genUniqueId; … |
| `utils/auth` | 1 | validate-user |
| `utils/openapi` | 1 | OpenAPI spec |
| `utils/redis` | 3 | key-generators; limiter; redis |
