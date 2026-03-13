# Layer 3: API Components — ClassroomIO

```mermaid
C4Component
    title Component Diagram - API

    Container_Boundary(api, "API (Hono)") {
        Component(root, "App Entrypoint", "Hono", "Server bootstrap and route mounting")
        Component(config, "Config", "Zod", "Environment variable validation")
        Component(constants, "Constants", "TypeScript", "HTTP status, rate limits, file limits")
        Component(middlewares, "Middlewares", "Hono", "Auth (JWT) and rate limiting")
        Component(routes_mail, "Mail Routes", "Hono", "Email sending endpoints")
        Component(routes_course, "Course Routes", "Hono", "Clone, presign, KaTeX, download")
        Component(services_mail, "Mail Service", "Nodemailer", "Nodemailer and ZeptoMail delivery")
        Component(services_course, "Course Service", "TypeScript", "Course cloning logic")
        Component(types, "Types", "Zod", "Request/response schemas")
        Component(types_course, "Course Types", "Zod", "Course-specific schemas")
        Component(utils, "Utils", "TypeScript", "PDF gen, S3 client, Supabase client")
        Component(utils_auth, "Auth Utils", "Supabase", "JWT validation")
        Component(utils_openapi, "OpenAPI", "Hono", "API documentation config")
        Component(utils_redis, "Redis Utils", "ioredis", "Rate limiter and key generators")
    }

    SystemDb_Ext(supabase, "Supabase", "PostgreSQL + Auth")
    System_Ext(r2, "Cloudflare R2", "S3-compatible storage")
    System_Ext(smtp, "SMTP Provider", "Email delivery")
    System_Ext(redis, "Redis", "Rate limiting store")

    Rel(root, routes_course, "Mounts")
    Rel(root, routes_mail, "Mounts")
    Rel(root, middlewares, "Registers")
    Rel(root, config, "Reads env")
    Rel(middlewares, utils_auth, "Validates JWT")
    Rel(middlewares, constants, "Uses limits")
    Rel(middlewares, utils_redis, "Checks rate limits")
    Rel(routes_mail, services_mail, "Calls")
    Rel(routes_mail, types, "Validates")
    Rel(routes_mail, config, "Reads env")
    Rel(routes_course, services_course, "Calls")
    Rel(routes_course, middlewares, "Protected by")
    Rel(routes_course, utils, "Uses S3/PDF")
    Rel(routes_course, types_course, "Validates")
    Rel(routes_course, constants, "Uses limits")
    Rel(services_mail, utils, "Email templates")
    Rel(services_mail, config, "SMTP config")
    Rel(services_course, utils, "Supabase queries")
    Rel(utils, config, "Reads env")
    Rel(utils_auth, utils, "Gets Supabase client")
    Rel(utils_redis, config, "Reads env")
    Rel(utils_redis, constants, "Uses defaults")
    Rel(types_course, constants, "Uses limits")

    Rel(utils, supabase, "Queries data")
    Rel(utils, r2, "Stores/retrieves files")
    Rel(services_mail, smtp, "Sends emails")
    Rel(utils_redis, redis, "Rate limit state")
    Rel(utils_auth, supabase, "Validates tokens")

    UpdateLayoutConfig(4, 2)
```
