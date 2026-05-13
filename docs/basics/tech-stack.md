# Tech Stack

This document covers the frameworks and libraries each ClassroomIO app is built with. It assumes you are comfortable
with JavaScript and TypeScript but may not have worked with SvelteKit, Hono, or TanStack Start before. A sibling
document covers the tooling layer (pnpm, Turborepo, Supabase, Cypress).

---

## `@cio/dashboard` — the main LMS app (port 5173)

The dashboard is the heart of ClassroomIO: it is the interface that teachers use to create and manage courses and that
students use to take them. It is a full-stack web app with server-side rendering, client-side navigation, and real-time
data.

### SvelteKit 1.x + Svelte 4

Svelte is a UI framework, but it works differently from React or Vue. Instead of shipping a virtual DOM runtime to the
browser, Svelte compiles your components at build time into small, direct DOM operations. The result is fast initial
loads, smaller bundles, and components that are relatively easy to read because there is less framework boilerplate.

SvelteKit is Svelte's application framework — the equivalent of Next.js for React. It handles file-based routing,
server-side rendering, server actions (code that runs on the server but is called from a page), and adapter-based
deployment. A `+page.svelte` file at `src/routes/foo/bar/+page.svelte` becomes the `/foo/bar` route. A sibling
`+page.server.ts` contains the server-only logic for that route.

```
@sveltejs/kit   ^1.29.0
svelte          ^4.1.2
vite            ^4.4.8
```

The dashboard ships with three deployment adapters: `adapter-auto` (detects the target platform automatically),
`adapter-node` (plain Node.js server), and `adapter-vercel` (Vercel Edge/Serverless). You pick the adapter at build time
by setting an environment variable; the code itself does not change.

### Styling: Tailwind CSS 3 + Carbon Design System

Tailwind CSS provides utility classes (`flex`, `text-sm`, `bg-blue-600`) that you compose directly in your markup rather
than writing separate CSS files. The dashboard uses Tailwind 3 alongside `@tailwindcss/forms` and
`@tailwindcss/typography` plugins.

For the component library, ClassroomIO uses the IBM Carbon Design System through `carbon-components-svelte`. Carbon
provides a comprehensive set of accessible UI components — data tables, modals, dropdowns, notifications — styled
according to IBM's design guidelines. `carbon-icons-svelte` provides the matching icon set.

### Data: Supabase

The dashboard communicates with the database through `@supabase/supabase-js` using the **anon key**. This key is safe to
ship to the browser because Supabase's Row Level Security policies (defined in the database itself) enforce access
control regardless of which client is querying. The anon key identifies the request; RLS determines what data the
request is allowed to see.

### Type-safe API calls: Hono RPC

The dashboard does not call the API (`@cio/api`) with raw `fetch` calls. Instead, it imports the API package's exported
RPC type definitions and constructs a typed client from them. This means TypeScript knows the exact shape of every
request and response at the call site in the dashboard — a typo in a parameter name or a wrong return type assumption is
a compile error, not a runtime bug. The mechanics of how this works are explained in
the [How the apps relate](#how-the-apps-relate) section.

### Data visualisation: D3

ClassroomIO uses D3 for analytics charts and custom visualisations — word clouds, Sankey diagrams, and general charting.
`d3`, `d3-cloud`, and `d3-sankey` handle the low-level calculations, while `@carbon/charts-svelte` provides higher-level
chart components that integrate with the Carbon design system.

### AI: Vercel AI SDK

The `ai` package (version 2.x) is the Vercel AI SDK. It provides streaming utilities, hooks, and edge-friendly helpers
for building AI-powered features like chat interfaces and text generation. The dashboard pairs it with `openai-edge`, a
lightweight OpenAI client compatible with edge runtimes where the standard `openai` package's Node.js-specific code does
not run.

### Internationalisation

The dashboard is localised using `sveltekit-i18n` with the `@sveltekit-i18n/base` and `@sveltekit-i18n/parser-icu`
packages. ICU message format allows complex pluralisation and locale-aware formatting rules in translation strings
without resorting to conditional logic in templates.

### PDF and image export

`jspdf` and `jspdf-autotable` generate PDF documents client-side from data — used for exporting course reports and
certificates. `html-to-image` captures a rendered DOM node as a PNG or SVG, which is then fed into the PDF or offered as
a direct download.

### Payments and billing

The dashboard integrates three payment platforms: **Stripe** (`stripe` ^14.22.0), **Lemon Squeezy** (
`@lemonsqueezy/lemonsqueezy.js`), and **Polar** (`@polar-sh/sveltekit`).

### Analytics

`posthog-js` tracks product analytics events in the browser. PostHog is an open-source analytics platform that can be
self-hosted, which fits ClassroomIO's self-hosted deployment model.

### Validation

`zod` (^3.21.4) is used throughout for runtime schema validation — parsing environment variables, validating form
inputs, and typing API responses.

### Other notable libraries

- `dayjs` — lightweight date manipulation
- `lodash` — utility functions (array, object, string helpers)
- `papaparse` — CSV parsing
- `dompurify` — sanitises HTML before rendering user-generated content to prevent XSS
- `hotkeys-js` — keyboard shortcut registration
- `ky` — a small, modern HTTP client built on `fetch` (used where the Hono RPC client is not appropriate)
- `canvas-confetti` — celebration animations
- `svelte-dnd-action` — drag-and-drop behaviour

### Testing

The dashboard uses **Jest** with `@testing-library/svelte` for unit and component tests. Run them with `pnpm test` from
`apps/dashboard`.

---

## `@cio/api` — backend service (port 3002)

The API handles work that should not run in a browser: sending transactional emails, generating documents, processing
file uploads, and performing privileged database operations. It is a Node.js HTTP server written in TypeScript.

### Hono 4 on Node.js

Hono is a small, fast web framework that targets multiple JavaScript runtimes — Node.js, Cloudflare Workers, Deno, Bun.
Its API is similar to Express but is built around the standard `Request`/`Response` objects from the Fetch API rather
than Node's legacy `http` module, which is what makes it portable across runtimes.

You define routes and middleware the same way you would in Express, but Hono's TypeScript integration is first class:
routes can declare typed schemas for request bodies and query parameters, and the framework enforces those types at
runtime and at the type level simultaneously.

```
hono                  ^4.9.7
@hono/node-server     ^1.8.2
@hono/zod-validator   ^0.7.2
```

`@hono/node-server` is the adapter that makes Hono run on Node.js. `@hono/zod-validator` and `@hono/standard-validator`
are middleware that validate incoming request payloads against Zod schemas before your route handler runs.

The dev server uses `tsx watch` to run TypeScript directly without a separate compile step. For production, TypeScript
is compiled with `tsc` and path aliases are resolved with `tsc-alias`.

### API documentation: OpenAPI

The API generates an OpenAPI specification automatically from its route definitions using `hono-openapi` and
`zod-openapi`. This means the spec stays in sync with the code rather than being written and maintained separately.

`@scalar/hono-api-reference` serves an interactive API explorer UI at a route in the API itself. During development you
can browse to it in a browser, inspect all available endpoints, and make test requests — no separate Postman collection
needed.

### Rate limiting

`hono-rate-limiter` sits in the middleware chain to enforce per-client request limits. It uses Redis (via `ioredis`) as
the backing store so rate limit counters are shared across multiple API instances if you scale horizontally.

### Database: Supabase with the service role key

Like the dashboard, the API uses `@supabase/supabase-js`. Unlike the dashboard, it authenticates with the **service role
key**, which bypasses Row Level Security entirely. This is appropriate for the API because it runs in a trusted server
environment and performs operations on behalf of users rather than as users — sending them emails, generating their
certificates, managing files that the user does not directly own.

The service role key must never be exposed to the browser. It lives only in the API's environment and is accessed
through typed env var helpers in `config/env.ts`.

### Email

Two email clients are present. `nodemailer` is the standard Node.js email library — it is used for local development
where you want to send to a real SMTP server (or to Inbucket, the local email capture service in the Supabase stack).
`zeptomail` is a transactional email service client used in production for reliable, deliverable email at scale.

### File storage

The API handles file uploads and downloads via the AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
In production, ClassroomIO points this at Cloudflare R2, which exposes an S3-compatible API. Switching storage backends
is a configuration change, not a code change.

### Cache and queues

`ioredis` is the Redis client. Beyond backing the rate limiter, Redis is available for caching expensive computations or
queuing background jobs.

### Markdown and math rendering

The API renders markdown and mathematical expressions server-side before returning HTML to the client. `marked` parses
Markdown into HTML, and `katex` renders LaTeX math notation — the two are used together for content that mixes prose and
equations.

### Error monitoring

`@sentry/node` and `@sentry/profiling-node` instrument the API for production error tracking and performance profiling.
Sentry captures unhandled exceptions, slow transactions, and performance traces.

### Validation

`zod` (^4.1.8) — note this is Zod v4, while the dashboard uses Zod v3. The two are independent installs in separate
packages; they do not conflict.

### RPC types export

The API package exports a `./rpc-types` entry point. This is not runtime code — it is a TypeScript type definition that
describes every route's input and output types using Hono's RPC type inference. The dashboard imports this to construct
a fully typed client. This is what makes calling the API from SvelteKit server actions end-to-end type safe, without any
code generation step. The mechanics are explained in [How the apps relate](#how-the-apps-relate).

### Testing

The API uses **Vitest** with `@vitest/coverage-v8` for unit and integration tests. Run `pnpm test` or
`pnpm test:coverage` from `apps/api`.

### Deployment targets

The API includes `wrangler` alongside the Node.js adapter. Wrangler is Cloudflare's CLI for deploying to Cloudflare
Workers. Because Hono is runtime-agnostic, the same application code can be deployed to a Node.js server or to
Cloudflare's edge network with only a configuration change. The Node.js path is the default for self-hosted deployments;
the Cloudflare Workers path is an option for edge deployments.

---

## `@cio/classroomio-com` — marketing site (port 5174)

The marketing site is the public-facing landing page for ClassroomIO. It is not connected to the LMS database; its job
is to present the product and convert visitors, not to serve authenticated users.

### SvelteKit 2.x + Svelte 4

The marketing site uses a newer version of SvelteKit than the dashboard:

```
@sveltejs/kit   ^2.0.0
svelte          ^4.1.2
vite            ^5.4.4
```

SvelteKit 2 introduced a few breaking changes from 1.x (mostly around how cookies and redirects work), but for the
purposes of a marketing site the practical difference is minor. The same file-based routing, the same component model,
the same adapter system.

### Content: mdsvex

The marketing site uses **mdsvex** to write content in Markdown with embedded Svelte components. A `.svx` file is
processed by mdsvex and compiled as a Svelte component, which means you can write a blog post in Markdown and drop in an
interactive pricing table or a code demo as a Svelte component inline.

```
mdsvex   ^0.11.0
```

The Markdown pipeline uses three plugins:

- `remark-toc` — automatically generates a table of contents from headings
- `remark-unwrap-images` — removes the `<p>` wrapper that Markdown normally adds around standalone images, which makes
  image styling more predictable
- `rehype-slug` — adds `id` attributes to headings so they can be linked to directly

`shiki` handles syntax highlighting in code blocks. Shiki uses the same TextMate grammars as VS Code, so highlighted
code looks consistent with what developers are used to.

### Styling

Tailwind CSS 3 and `carbon-icons-svelte`. The marketing site does not use the full Carbon component library — just the
icon set.

### Analytics

`posthog-node` tracks server-side analytics events, complementing any client-side tracking.

---

## `@cio/docs-v2` — developer documentation (port 3000)

The docs app is the developer-facing reference site. It is where this document lives. Unlike the other three apps, it is
built with React rather than Svelte.

### React 19 + TanStack Start

React 19 is the latest major version of React. It introduces the Actions API, improved server component support, and new
hooks like `useOptimistic` and `useFormStatus`. For a docs site, most of these are invisible — the relevant thing is
that the docs toolchain (Fumadocs) is built for React.

TanStack Start is a full-stack React framework that provides file-based routing, server functions, and SSR/SSG support
on top of Vite. It is backed by the same team that makes TanStack Query and TanStack Router, and it uses Nitro as its
server engine.

```
react                   ^19.2.0
@tanstack/react-start   ^1.134.12
@tanstack/react-router  ^1.134.12
vite                    ^7.2.0
nitro                   3.0.1-alpha.1
```

TanStack Start's file-based routing works similarly to Next.js's App Router: files in the routes directory map to URL
paths, co-located loader functions fetch data server-side, and components render the result.

### Fumadocs

Fumadocs is a documentation framework for React. It handles the structure and navigation common to all documentation
sites — sidebar generation from a file tree, breadcrumbs, previous/next page links, search — so you do not have to build
them yourself.

```
fumadocs-core   16.2.1
fumadocs-ui     16.2.1
fumadocs-mdx    14.0.4
```

`fumadocs-mdx` processes `.mdx` files (Markdown with JSX) into content that Fumadocs can render. `fumadocs-ui` provides
the visual components — the sidebar, the table of contents panel, the content area. `fumadocs-core` is the data layer,
handling routing and content resolution.

You write documentation as `.mdx` files, Fumadocs reads them and builds the navigation automatically, and TanStack Start
serves the result.

### Styling: Tailwind CSS 4

The docs app uses **Tailwind CSS 4** — a notable divergence from every other app in the monorepo, which uses Tailwind 3.
Tailwind 4 is a near-complete rewrite: configuration moves from a `tailwind.config.js` file to CSS variables and
`@theme` declarations, and the PostCSS plugin is replaced by a Vite plugin (`@tailwindcss/vite`). The two major versions
are not compatible, but because they are installed in separate packages they do not conflict.

---

## What serves the apps

### In development

When you run `pnpm dev:container` locally, all four apps are served by **Vite's dev server** — with one exception.

The dashboard, the marketing site, and the docs app each start a Vite dev server on their respective ports. Vite is a
build tool and dev server, not a production web server. In dev mode it does not bundle your code at all: it serves files
over native ES modules and lets the browser import them directly. Changes to your source are reflected in the browser
near-instantly through hot module replacement — no rebuild step, no page reload required.

The API is the exception. It runs with `tsx watch src/index.ts`. `tsx` is a TypeScript executor that lets Node.js run
`.ts` files directly without a prior compile step. The `watch` flag restarts the process when source files change. There
is no Vite involved in the API's dev setup.

### In production

Each app compiles to a self-contained Node.js HTTP server. There is no nginx, no Apache, no Caddy in this codebase —
each app is its own web server.

The **dashboard** uses SvelteKit's `adapter-node`, which compiles the SvelteKit app into a standard Node.js HTTP server.
It is started with `node build`.

The **API** runs on `@hono/node-server`, which wraps Node's built-in `http` module. Hono itself is runtime-agnostic, but
this adapter binds it to Node. It is started with `node dist/index.js` after TypeScript has been compiled by `tsc`.

The **docs** app uses TanStack Start with Nitro as its server engine. Nitro is a universal server toolkit; here it
outputs a Node.js server that TanStack Start hands requests off to. It is started with `node .output/server/index.mjs`.

The **marketing site** uses `@sveltejs/adapter-auto`, which detects the deployment platform at build time and outputs
accordingly. In practice this means it is deployed to a platform edge network (Vercel, Netlify, or similar) rather than
run as a standalone Node process — it does not have a `node build` equivalent you would run yourself.

The key point: there is no traditional web server in this stack. Each app is the HTTP server. In a production
self-hosted deployment you would typically put a reverse proxy — nginx or Caddy — in front to handle TLS termination and
route traffic to the correct port. But that is infrastructure configuration that lives outside this codebase, not
something the code itself depends on.

---

## How the apps relate

The four apps are not fully independent. Several cross-cutting connections are worth keeping in mind.

### End-to-end type safety via Hono RPC

The dashboard and the API share a type boundary. The API's `rpc-types` entry point exports a pre-typed wrapper around
Hono's `hc` client factory — a function called `hcWithType` that already has the full application type baked in. The
dashboard imports it and constructs a typed API client in one call:

```typescript
// apps/dashboard/src/lib/utils/services/api/index.ts
import { hcWithType } from '@cio/api/rpc-types'

export const classroomio = hcWithType(env.PUBLIC_SERVER_URL, { fetch: ... })
```

The resulting `classroomio` object has a method for every API route, fully typed — TypeScript knows exactly what
parameters each route accepts and what shape it returns. If the API changes a response shape, the dashboard gets a
compile error at the call site immediately. There is no code generation step and no schema file to keep in sync — the
types flow directly from the route definitions.

The API also exports `InferRequestType` and `InferResponseType` helpers from Hono's client so individual call sites can
derive typed variables from specific routes without having to manually write out the types.

This is why Turborepo's pipeline ensures the API is compiled before the dashboard builds: the dashboard needs the
compiled type declarations to exist on disk before TypeScript can check them.

### Shared Supabase, different keys

Both the dashboard and the API communicate with the same Supabase instance, but they use different API keys.

The dashboard uses the **anon key**, which is safe to ship in browser bundles. Supabase's Row Level Security policies
run at the database level and enforce access based on the authenticated user's JWT — the anon key opens the door, but
RLS decides what is behind it.

The API uses the **service role key**, which bypasses Row Level Security entirely. This is appropriate for server-side
operations that need to act on behalf of users or across user boundaries (for example, sending a user their password
reset email, or generating a report that aggregates data across many students). The service role key never leaves the
server.

### The marketing site and docs are independent

`@cio/classroomio-com` and `@cio/docs-v2` do not connect to the Supabase database. They have no auth, no user sessions,
and no access to course data. They exist to present information to the public. The marketing site uses `posthog-node`
for analytics, and the docs site is entirely static from a data perspective.

### Shared packages: `packages/shared` and `packages/tsconfig`

All four apps pull from `packages/shared` for common utilities — types, helpers, and constants that would otherwise be
duplicated. The dashboard references it as `shared` (a workspace alias), and the marketing site does the same. The API
also consumes it where relevant.

`packages/tsconfig` contains the base `tsconfig.json` files that each app extends. TypeScript settings — strict mode,
module resolution, path aliases — are defined once there and inherited, so compiler behaviour is consistent across the
monorepo.
