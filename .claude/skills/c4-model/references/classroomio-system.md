# ClassroomIO — curated Layer 1 / Layer 2 facts

This file is the source of truth for the **people**, **external systems**, and **container topology** that the generator uses to render `layer1-context.md` and `layer2-containers.md`. Edit it when those facts change, then run `node generate-diagrams.mjs`.

The generator parses this file as JSON inside the fenced ```` ```json ```` blocks below. Keep aliases unique and stable.

## People

```json
{
  "people": [
    {
      "alias": "learner",
      "label": "Learner",
      "description": "Enrolls in courses, completes lessons, takes quizzes."
    },
    {
      "alias": "tutor",
      "label": "Tutor / Org admin",
      "description": "Authors courses, manages students, grades submissions inside an organization."
    },
    {
      "alias": "visitor",
      "label": "Visitor",
      "description": "Anonymous user browsing public course landing pages or marketing site."
    }
  ]
}
```

## External systems

```json
{
  "externalSystems": [
    {
      "alias": "supabase",
      "label": "Supabase",
      "kind": "db",
      "description": "Auth, Postgres, Realtime, Storage. Primary persistence."
    },
    {
      "alias": "openai",
      "label": "OpenAI",
      "kind": "system",
      "description": "AI features: grading assistance, content generation."
    },
    {
      "alias": "stripe",
      "label": "Stripe",
      "kind": "system",
      "description": "Subscription billing for some plans."
    },
    {
      "alias": "lemonsqueezy",
      "label": "LemonSqueezy",
      "kind": "system",
      "description": "Alternative billing provider."
    },
    {
      "alias": "polar",
      "label": "Polar",
      "kind": "system",
      "description": "Polar.sh billing integration."
    },
    {
      "alias": "r2",
      "label": "Cloudflare R2 / AWS S3",
      "kind": "system",
      "description": "Object storage for course assets, PDFs, certificates."
    },
    {
      "alias": "zeptomail",
      "label": "ZeptoMail / SMTP",
      "kind": "system",
      "description": "Transactional email delivery."
    },
    {
      "alias": "posthog",
      "label": "PostHog",
      "kind": "system",
      "description": "Product analytics."
    },
    {
      "alias": "sentry",
      "label": "Sentry",
      "kind": "system",
      "description": "Error tracking and performance."
    },
    {
      "alias": "unsplash",
      "label": "Unsplash",
      "kind": "system",
      "description": "Stock images for course covers."
    }
  ]
}
```

## Containers (Layer 2)

`appKey` matches the Layer 3 extraction key — set it when an extracted Layer 3 diagram should be linked from this container.

```json
{
  "containers": [
    {
      "alias": "dashboard",
      "label": "Dashboard",
      "technology": "SvelteKit, TypeScript",
      "description": "Main LMS web app. Course authoring, learner experience, org admin. Runs on adapter-vercel (cloud) or adapter-node (self-hosted).",
      "appKey": "dashboard"
    },
    {
      "alias": "api",
      "label": "API",
      "technology": "Hono on Node 20",
      "description": "Backend for long-running processes: PDF generation, course cloning, mail sending. Exposes typed RPC at @cio/api/rpc-types.",
      "appKey": "api"
    },
    {
      "alias": "landing",
      "label": "Marketing site",
      "technology": "SvelteKit + mdsvex",
      "description": "Public landing pages and blog at classroomio.com."
    },
    {
      "alias": "docs",
      "label": "Docs site",
      "technology": "React, TanStack Router, Fumadocs",
      "description": "Product documentation."
    },
    {
      "alias": "redis",
      "label": "Redis",
      "kind": "db",
      "technology": "Redis 7",
      "description": "Rate-limiter state for the API."
    }
  ]
}
```

## Container relationships (Layer 2)

Used verbatim by the generator. Aliases must match `people`, `externalSystems`, or `containers` above.

```json
{
  "containerRelationships": [
    { "from": "learner",      "to": "dashboard", "label": "uses",        "technology": "HTTPS" },
    { "from": "tutor",        "to": "dashboard", "label": "uses",        "technology": "HTTPS" },
    { "from": "visitor",      "to": "landing",   "label": "visits",      "technology": "HTTPS" },
    { "from": "visitor",      "to": "dashboard", "label": "views public course pages", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "api",       "label": "RPC",         "technology": "HTTPS/JSON" },
    { "from": "dashboard",    "to": "supabase",  "label": "auth, queries, realtime", "technology": "PostgREST, WS" },
    { "from": "api",          "to": "supabase",  "label": "service-role queries", "technology": "PostgREST" },
    { "from": "api",          "to": "redis",     "label": "rate-limit",  "technology": "TCP" },
    { "from": "api",          "to": "r2",        "label": "stores assets", "technology": "S3 API" },
    { "from": "api",          "to": "zeptomail", "label": "sends mail",  "technology": "SMTP/API" },
    { "from": "dashboard",    "to": "openai",    "label": "AI features", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "stripe",    "label": "checkout, webhooks", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "lemonsqueezy", "label": "checkout, webhooks", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "polar",     "label": "checkout, webhooks", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "unsplash",  "label": "stock images", "technology": "HTTPS" },
    { "from": "dashboard",    "to": "posthog",   "label": "events",      "technology": "HTTPS" },
    { "from": "dashboard",    "to": "sentry",    "label": "errors",      "technology": "HTTPS" },
    { "from": "api",          "to": "sentry",    "label": "errors",      "technology": "HTTPS" },
    { "from": "docs",         "to": "visitor",   "label": "is read by",  "technology": "HTTPS" }
  ]
}
```

## Context-layer relationships (Layer 1)

At Layer 1 the whole product is one box (`system: classroomio`). Edges connect that box to people and external systems.

```json
{
  "system": {
    "alias": "classroomio",
    "label": "ClassroomIO",
    "description": "Open-source LMS for organizations: course authoring, delivery, grading, certificates."
  },
  "contextRelationships": [
    { "from": "learner",      "to": "classroomio", "label": "learns with" },
    { "from": "tutor",        "to": "classroomio", "label": "teaches with" },
    { "from": "visitor",      "to": "classroomio", "label": "browses" },
    { "from": "classroomio",  "to": "supabase",    "label": "persists data" },
    { "from": "classroomio",  "to": "openai",      "label": "calls for AI features" },
    { "from": "classroomio",  "to": "stripe",      "label": "bills via" },
    { "from": "classroomio",  "to": "lemonsqueezy","label": "bills via" },
    { "from": "classroomio",  "to": "polar",       "label": "bills via" },
    { "from": "classroomio",  "to": "r2",          "label": "stores files in" },
    { "from": "classroomio",  "to": "zeptomail",   "label": "sends mail via" },
    { "from": "classroomio",  "to": "posthog",     "label": "ships analytics to" },
    { "from": "classroomio",  "to": "sentry",      "label": "ships errors to" },
    { "from": "classroomio",  "to": "unsplash",    "label": "fetches images from" }
  ]
}
```
