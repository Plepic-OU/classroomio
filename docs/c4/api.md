# Layer 3 — API Components

```mermaid
C4Component
  title API — Component Diagram (depth=2)

  Container_Boundary(src, "src") {
    Component(src_app_ts, "app.ts", "1 TS", "app.ts")
    Component(src_index_ts, "index.ts", "1 TS", "index.ts")
    Component(src_rpc_types_ts, "rpc-types.ts", "1 TS", "rpc-types.ts")
  }

  Container_Boundary(src_config, "config") {
    Component(src_config, "config", "1 TS", "Configuration")
  }

  Container_Boundary(src_constants, "constants") {
    Component(src_constants, "constants", "3 TS", "Constants & Config")
  }

  Container_Boundary(src_middlewares, "middlewares") {
    Component(src_middlewares, "middlewares", "2 TS", "Middleware")
  }

  Container_Boundary(src_routes, "routes") {
    Component(src_routes, "routes", "6 TS", "Page Routes")
  }

  Container_Boundary(src_services, "services") {
    Component(src_services, "services", "2 TS", "Data Services")
  }

  Container_Boundary(src_types, "types") {
    Component(src_types, "types", "5 TS", "TypeScript Types")
  }

  Container_Boundary(src_utils, "utils") {
    Component(src_utils, "utils", "15 TS", "Utility Functions")
  }

  Rel(src_routes, src_types, "uses", "6 imports")
  Rel(src_routes, src_utils, "uses", "6 imports")
  Rel(src_utils, src_config, "uses", "4 imports")
  Rel(src_middlewares, src_utils, "uses", "3 imports")
  Rel(src_services, src_utils, "uses", "3 imports")
  Rel(src_utils, src_types, "uses", "3 imports")
  Rel(src_utils, src_constants, "uses", "3 imports")
  Rel(src_app_ts, src_routes, "uses", "2 imports")
  Rel(src_routes, src_services, "uses", "2 imports")
  Rel(src_services, src_types, "uses", "2 imports")
  Rel(src_routes, src_middlewares, "uses", "2 imports")
  Rel(src_routes, src_constants, "uses", "2 imports")
  Rel(src_app_ts, src_middlewares, "uses", "1 imports")
  Rel(src_index_ts, src_utils, "uses", "1 imports")
  Rel(src_index_ts, src_config, "uses", "1 imports")
  Rel(src_constants, src_config, "uses", "1 imports")
  Rel(src_middlewares, src_constants, "uses", "1 imports")
  Rel(src_routes, src_config, "uses", "1 imports")
  Rel(src_services, src_config, "uses", "1 imports")
  Rel(src_types, src_constants, "uses", "1 imports")
```

_Generated 2026-03-13 from AST extraction. Re-run `extract.ts` + `generate-diagrams.ts` to update._

## Components

| Key | TS files | Svelte files | Description |
|-----|----------|--------------|-------------|
| `src/app.ts` | 1 | 0 | app.ts |
| `src/config` | 1 | 0 | Configuration |
| `src/constants` | 3 | 0 | Constants & Config |
| `src/index.ts` | 1 | 0 | index.ts |
| `src/middlewares` | 2 | 0 | Middleware |
| `src/routes` | 6 | 0 | Page Routes |
| `src/rpc-types.ts` | 1 | 0 | rpc-types.ts |
| `src/services` | 2 | 0 | Data Services |
| `src/types` | 5 | 0 | TypeScript Types |
| `src/utils` | 15 | 0 | Utility Functions |

## Top External Dependencies

| Package | Import count |
|---------|-------------|
| `hono` | 19 |
| `zod` | 5 |
| `@hono/zod-validator` | 4 |
| `@supabase/supabase-js` | 4 |
| `nodemailer` | 3 |
| `dotenv` | 2 |
| `marked` | 2 |
| `@aws-sdk/client-s3` | 2 |
| `@aws-sdk/s3-request-presigner` | 2 |
| `ioredis` | 2 |