# L3 API Components
_Generated: 2026-03-13T08:23:26Z | componentDepth: 2 | Source files: 37 ts_
_AST-derived via ts-morph._

```mermaid
graph TD

  ext-Supabase["Supabase\n(external)"]
  ext-Redis["Redis\n(external)"]
  ext-S3R2["S3 / R2\n(external)"]

  subgraph Routes
    api---root["__root\n(3ts — app bootstrap)"]
    api-routes["routes\n(1ts — mail route)"]
    api-routes-course["routes/course\n(5ts — course/lesson/exercise\npresign, clone)"]
  end

  subgraph Services
    api-services["services\n(1ts — mail service)"]
    api-services-course["services/course\n(1ts — clone logic)"]
  end

  subgraph Utils
    api-utils["utils\n(10ts — S3/R2 helpers,\nSupabase client)"]
    api-utils-auth["utils/auth\n(1ts — JWT validation)"]
    api-utils-openapi["utils/openapi\n(1ts — OpenAPI spec)"]
    api-utils-redis["utils/redis\n(3ts — cache client,\nrate limiter)"]
  end

  subgraph Infrastructure
    api-config["config\n(1ts — env vars)"]
    api-constants["constants\n(3ts — rate limits,\nupload config)"]
    api-middlewares["middlewares\n(2ts — auth, rate limiter)"]
    api-types["types\n(3ts)"]
    api-types-course["types/course\n(2ts)"]
  end

  %% Entry point
  api---root -->|"uses"| api-routes-course
  api---root -->|"uses"| api-routes
  api---root -->|"uses"| api-middlewares
  api---root -->|"uses"| api-utils
  api---root -->|"uses"| api-config

  %% Routes
  api-routes -->|"uses"| api-services
  api-routes -->|"uses"| api-types
  api-routes -->|"uses"| api-config
  api-routes-course -->|"uses (4 imports)"| api-types
  api-routes-course -->|"uses"| api-services-course
  api-routes-course -->|"uses (2 imports)"| api-middlewares
  api-routes-course -->|"heavily uses (6 imports)"| api-utils
  api-routes-course -->|"uses"| api-types-course
  api-routes-course -->|"uses"| api-constants
  api-routes-course -->|"uses"| api---root

  %% Services
  api-services -->|"uses (2 imports)"| api-utils
  api-services -->|"uses"| api-types
  api-services -->|"uses"| api-config
  api-services-course -->|"uses"| api-utils
  api-services-course -->|"uses"| api-types

  %% Utils
  api-utils -->|"uses (2 imports)"| api-types-course
  api-utils -->|"uses (2 imports)"| api---root
  api-utils -->|"uses"| api-types
  api-utils -->|"uses (2 imports)"| api-config
  api-utils-auth -->|"uses"| api-utils
  api-utils-openapi -->|"uses"| api-config
  api-utils-redis -->|"uses"| api-utils
  api-utils-redis -->|"uses"| api-constants
  api-utils-redis -->|"uses"| api-config

  %% Infrastructure
  api-middlewares -->|"uses"| api-utils-auth
  api-middlewares -->|"uses"| api-constants
  api-middlewares -->|"uses (2 imports)"| api-utils-redis
  api-constants -->|"uses"| api-config
  api-types-course -->|"uses"| api-constants

  %% External
  api-utils -->|"uses (2 imports)"| ext-S3R2
  api-utils -->|"uses"| ext-Supabase
  api-routes-course -->|"uses"| ext-Supabase
  api-routes-course -->|"uses (2 imports)"| ext-S3R2
  api-services-course -->|"uses"| ext-Supabase
  api-utils-auth -->|"uses"| ext-Supabase
  api-utils-redis -->|"uses (2 imports)"| ext-Redis
```

| Component | Responsibility |
|-----------|----------------|
| `__root` | Hono app setup, route registration, middleware application |
| `routes/course` | Course/lesson/exercise CRUD, file presigning, course clone |
| `routes` (mail) | Email send endpoint |
| `services/course` | Course clone business logic |
| `utils` | Supabase service-role client, Cloudflare R2/S3 upload helpers |
| `utils/auth` | JWT verification for API authentication |
| `utils/redis` | Redis client initialisation, rate-limiter helpers |
| `middlewares` | Auth guard and rate-limit middleware for Hono |
| `config` | Environment variable validation and export |
| `constants` | Rate limit rules, upload size/type constraints |
