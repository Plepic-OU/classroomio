# C4 Layer 3 — API Components

```mermaid
C4Component
  title Component diagram — API (Hono / Node.js)

  Container_Boundary(api, "API") {
    Component(app, "App Entry", "Hono",
      "Registers middleware and routes; exports RPC types for dashboard")
    Component(routes_mail, "Mail Route", "Hono Route Handler",
      "Handles email-sending endpoints")
    Component(routes_course, "Course Routes", "Hono Route Handler",
      "clone, katex rendering, lesson ops, presigned upload URLs")
    Component(middlewares, "Middlewares", "Hono Middleware",
      "JWT auth validation and Redis rate-limiting")
    Component(services_mail, "Mail Service", "TypeScript Service",
      "Builds and sends transactional emails")
    Component(services_course, "Course Service", "TypeScript Service",
      "Business logic for cloning courses")
    Component(utils, "Utils", "TypeScript Utility",
      "Supabase client, S3/Cloudflare upload, email helpers, certificate gen")
    Component(utils_auth, "Auth Util", "TypeScript Utility",
      "Validates Supabase JWT for protected routes")
    Component(utils_redis, "Redis Util", "TypeScript Utility",
      "Rate-limiter key generators and Upstash Redis client")
    Component(utils_openapi, "OpenAPI Util", "TypeScript Utility",
      "OpenAPI schema generation for the Hono app")
    Component(config, "Config", "TypeScript Utility",
      "Environment variable loading and validation")
    Component(constants, "Constants", "TypeScript Types",
      "Rate-limiter and upload configuration constants")
    Component(types, "Types", "TypeScript Types",
      "Shared domain types: mail, database, course")
  }

  System_Ext(supabase, "Supabase", "PostgreSQL + Auth")
  System_Ext(cloudflare, "Cloudflare R2", "Object storage")
  System_Ext(smtp, "SMTP", "Email delivery")

  Rel(app, routes_course, "Mounts", "")
  Rel(app, routes_mail, "Mounts", "")
  Rel(app, middlewares, "Applies", "")
  Rel(middlewares, utils_auth, "Delegates JWT check", "")
  Rel(middlewares, utils_redis, "Rate-limits via", "")
  Rel(routes_course, utils, "Calls upload/S3/cert helpers", "")
  Rel(routes_course, services_course, "Delegates clone logic", "")
  Rel(routes_course, middlewares, "Protected by", "")
  Rel(routes_mail, services_mail, "Delegates email send", "")
  Rel(services_mail, utils, "Uses email/supabase helpers", "")
  Rel(utils, supabase, "Reads/writes data", "REST")
  Rel(utils, cloudflare, "Uploads files", "S3 API")
  Rel(services_mail, smtp, "Sends email", "SMTP")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```
