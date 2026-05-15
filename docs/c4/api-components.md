# C4 Level 3 — Components: API (Hono.js)

_Extracted 2026-05-15 · depth=2_

```mermaid
C4Component
  title Component Diagram for API (Hono.js)

  Container_Boundary(api_boundary, "API (Hono.js)") {
    Component(middlewares, "middlewares", "2 TS", "middlewares")
    Component(utils, "utils", "10 TS", "utils")
    Component(utils_auth, "auth", "1 TS", "utils/auth")
    Component(utils_redis, "redis", "3 TS", "utils/redis")
    Component(routes_course, "course", "5 TS", "routes/course")
    Component(c_root, "Root", "3 TS", "_root")
    Component(constants, "constants", "3 TS", "constants")
    Component(types, "types", "3 TS", "types")
  }

  Rel(middlewares, utils_redis, "imports")
  Rel(utils_auth, utils, "imports")
```

## Component Inventory

| Component | TS | Svelte | Path |
|-----------|----:|-------:|------|
| Root | 3 | 0 | `_root` |
| config | 1 | 0 | `config` |
| constants | 3 | 0 | `constants` |
| middlewares | 2 | 0 | `middlewares` |
| routes | 1 | 0 | `routes` |
| course | 5 | 0 | `routes/course` |
| services | 1 | 0 | `services` |
| course | 1 | 0 | `services/course` |
| types | 3 | 0 | `types` |
| course | 2 | 0 | `types/course` |
| utils | 10 | 0 | `utils` |
| auth | 1 | 0 | `utils/auth` |
| openapi | 1 | 0 | `utils/openapi` |
| redis | 3 | 0 | `utils/redis` |
