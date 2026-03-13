# L3: API Components

> Derived from AST extraction — do not edit manually.
> Re-generate with `/c4-model diagrams`.

```mermaid
C4Component
  title API Service — Components

  Container_Boundary(api, "API (Hono/Node.js)") {
    Component(core, "API Core", "Hono", "App bootstrap (app.ts), server entry (index.ts), RPC type exports")
    Component(courseRoutes, "Course Routes", "Hono", "Certificate/content PDF, KaTeX, S3 presign, clone, lesson")
    Component(mailRoutes, "Mail Routes", "Hono", "Transactional email endpoints")
    Component(courseSvc, "Course Service", "TypeScript", "Business logic for course clone operations")
    Component(mailSvc, "Mail Service", "TypeScript", "Email construction and dispatch logic")
    Component(middlewares, "Middlewares", "Hono", "Auth JWT verification, rate limiter")
    Component(utils, "Utils", "TypeScript", "Certificate, S3, supabase client, email, upload helpers")
    Component(authUtils, "Auth Utils", "TypeScript", "JWT / user validation")
    Component(redisUtils, "Redis Utils", "TypeScript", "Redis client and rate-limit key generators")
    Component(openapi, "OpenAPI Utils", "Hono OpenAPI", "Scalar API docs generation")
    Component(config, "Config", "Zod", "Environment variable validation")
    Component(constants, "Constants", "TypeScript", "Rate-limiter and upload constants")
    Component(types, "Types", "TypeScript", "Mail, database, and general type definitions")
    Component(courseTypes, "Course Types", "TypeScript", "Course and lesson domain types")
  }

  System_Ext(db, "Supabase DB", "PostgreSQL")
  System_Ext(s3, "AWS S3", "File storage")
  System_Ext(smtp, "SMTP", "Email delivery")

  Rel(core, middlewares, "Registers")
  Rel(core, courseRoutes, "Mounts")
  Rel(core, mailRoutes, "Mounts")
  Rel(core, config, "Reads config")
  Rel(core, utils, "Uses")
  Rel(courseRoutes, middlewares, "Protected by")
  Rel(courseRoutes, courseSvc, "Delegates to")
  Rel(courseRoutes, utils, "Uses")
  Rel(courseRoutes, constants, "Uses")
  Rel(courseRoutes, types, "Uses")
  Rel(courseRoutes, courseTypes, "Uses")
  Rel(courseRoutes, s3, "Presigns / uploads", "HTTPS")
  Rel(courseRoutes, db, "Reads course data", "SQL")
  Rel(mailRoutes, mailSvc, "Delegates to")
  Rel(mailRoutes, config, "Reads config")
  Rel(mailRoutes, types, "Uses")
  Rel(mailSvc, utils, "Uses")
  Rel(mailSvc, config, "Reads config")
  Rel(mailSvc, types, "Uses")
  Rel(mailSvc, smtp, "Sends", "SMTP")
  Rel(courseSvc, utils, "Uses")
  Rel(courseSvc, types, "Uses")
  Rel(courseSvc, db, "Reads/Writes", "SQL")
  Rel(middlewares, authUtils, "Calls")
  Rel(middlewares, redisUtils, "Rate limits via")
  Rel(middlewares, constants, "Uses")
  Rel(authUtils, utils, "Uses")
  Rel(authUtils, db, "Verifies JWT", "Supabase Auth")
  Rel(redisUtils, config, "Reads config")
  Rel(redisUtils, constants, "Uses")
  Rel(utils, config, "Reads config")
  Rel(utils, constants, "Uses")
  Rel(utils, types, "Uses")
  Rel(utils, courseTypes, "Uses")
  Rel(utils, db, "Queries via supabase client", "SQL")
  Rel(utils, s3, "Uploads files", "HTTPS")
  Rel(constants, config, "Reads config")
  Rel(courseTypes, constants, "Uses")
  Rel(openapi, config, "Reads config")
```
