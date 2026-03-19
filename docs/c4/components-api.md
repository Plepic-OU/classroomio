# C4 Layer 3 — API Components

> Derived from AST extraction. Run `/c4-model components` to refresh.
>
> Pruning applied: 14 raw components → 11 nodes.
> Dropped: `src-root` (entry glue), `routes` index (1 ts, no relations), `services` index (1 ts, no relations).

```mermaid
C4Component
  title Component Diagram — API (Hono / Node.js)

  Container_Boundary(api, "API") {

    Container_Boundary(routes_b, "Routes") {
      Component(routes_course, "course routes", "Hono router", "Course CRUD, lesson and exercise endpoints (5 ts)")
    }

    Container_Boundary(services_b, "Services") {
      Component(svc_course, "course service", "TypeScript", "Business logic for course operations")
    }

    Container_Boundary(utils_b, "Utilities") {
      Component(utils_main, "utils", "TypeScript", "Shared helper functions (10 ts)")
      Component(utils_auth, "auth", "TypeScript", "JWT validation and session helpers")
      Component(utils_redis, "redis", "TypeScript", "Rate limiting and cache helpers (3 ts)")
      Component(utils_openapi, "openapi", "TypeScript", "OpenAPI schema generation and spec upload")
    }

    Container_Boundary(types_b, "Types") {
      Component(types_main, "types", "TypeScript", "Shared type definitions (3 ts)")
      Component(types_course, "course types", "TypeScript", "Course domain types (2 ts)")
    }

    Component(middlewares, "middlewares", "Hono middleware", "Auth guard, rate limiting, CORS, error handling")
    Component(constants, "constants", "TypeScript", "App-wide constants (3 ts)")
    Component(config, "config", "TypeScript", "Environment config and app bootstrap")
  }

  Rel(routes_course, svc_course, "Delegates to")
  Rel(routes_course, middlewares, "Protected by")
  Rel(routes_course, types_course, "Uses types")
  Rel(svc_course, utils_main, "Uses helpers")
  Rel(middlewares, utils_redis, "Rate limits via")
  Rel(middlewares, utils_auth, "Validates JWT via")
  Rel(utils_auth, utils_main, "Uses shared helpers")
```
