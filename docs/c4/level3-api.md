# Layer 3 — API Component Diagram

Derived from the codebase AST (ts-morph), not hand-authored. Regenerate after structural changes:

```bash
pnpm exec tsx .claude/skills/c4-model/scripts/extract-components.ts api --depth=2
pnpm exec tsx .claude/skills/c4-model/scripts/render-mermaid.ts api
```

Generated: 2026-09-11T08:06:54.069Z · depth: 2 · source: `apps/api/src`

```mermaid
C4Component
title API — Component Diagram (Layer 3)

Container_Boundary(api, "API", "Hono (TypeScript)") {
    Component(api_config, "config", "TypeScript", "1 ts")
    Component(api_constants, "constants", "TypeScript", "3 ts")
    Component(api_middlewares, "middlewares", "TypeScript", "2 ts")
    Boundary(api_b_routes, "routes") {
      Component(api_routes, "routes (files here)", "TypeScript", "1 ts")
      Component(api_routes_course, "course", "TypeScript", "5 ts")
    }
    Boundary(api_b_services, "services") {
      Component(api_services, "services (files here)", "TypeScript", "1 ts")
      Component(api_services_course, "course", "TypeScript", "1 ts")
    }
    Boundary(api_b_types, "types") {
      Component(api_types, "types (files here)", "TypeScript", "3 ts")
      Component(api_types_course, "course", "TypeScript", "2 ts")
    }
    Boundary(api_b_utils, "utils") {
      Component(api_utils, "utils (files here)", "TypeScript", "10 ts")
      Component(api_utils_auth, "auth", "TypeScript", "1 ts")
      Component(api_utils_openapi, "openapi", "TypeScript", "1 ts")
      Component(api_utils_redis, "redis", "TypeScript", "3 ts")
    }
}

    Rel(api_routes_course, api_utils, "imports", "×6")
    Rel(api_routes_course, api_types_course, "imports", "×4")
    Rel(api_utils, api_types_course, "imports", "×3")
    Rel(api_middlewares, api_utils_redis, "imports", "×2")
    Rel(api_routes_course, api_constants, "imports", "×2")
    Rel(api_routes_course, api_middlewares, "imports", "×2")
    Rel(api_services, api_utils, "imports", "×2")
    Rel(api_utils, api_config, "imports", "×2")
    Rel(api_utils, api_constants, "imports", "×2")
    Rel(api_constants, api_config, "imports", "×1")
    Rel(api_middlewares, api_constants, "imports", "×1")
    Rel(api_middlewares, api_utils_auth, "imports", "×1")
    Rel(api_routes, api_config, "imports", "×1")
    Rel(api_routes, api_services, "imports", "×1")
    Rel(api_routes, api_types, "imports", "×1")
    Rel(api_routes_course, api_services_course, "imports", "×1")
    Rel(api_routes_course, api_types, "imports", "×1")
    Rel(api_services, api_config, "imports", "×1")
    Rel(api_services, api_types, "imports", "×1")
    Rel(api_services_course, api_types, "imports", "×1")
    Rel(api_services_course, api_utils, "imports", "×1")
    Rel(api_types, api_types_course, "imports", "×1")
    Rel(api_types_course, api_constants, "imports", "×1")
    Rel(api_utils_auth, api_utils, "imports", "×1")
    Rel(api_utils_openapi, api_config, "imports", "×1")
    Rel(api_utils_redis, api_config, "imports", "×1")
    Rel(api_utils_redis, api_constants, "imports", "×1")
    Rel(api_utils_redis, api_utils, "imports", "×1")
```
