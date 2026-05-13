# Tooling

This document covers the four main tools in the ClassroomIO dev workflow: pnpm, Turborepo, Supabase, and Cypress.

## pnpm

If you have been using npm for a while, pnpm will feel immediately familiar — same lockfile concept, same`package.json`,
same scripts. The key differences are in how packages are stored on disk and how multiple packages in a single
repository are wired together.

### How pnpm stores packages

With npm, every `npm install` copies each package into the local `node_modules` folder. If you have ten projects that
all depend on React 18.3.1, you end up with ten copies of React on your machine.

pnpm uses a **content-addressable store** instead. The first time you install a package, pnpm downloads it to a global
store (usually `~/.local/share/pnpm/store` on Linux). Every subsequent install — in any project, on the same machine —
links to that single copy rather than downloading or copying again. Inside `node_modules`, what you see are symlinks
that point back to the store.

The practical result: installs are faster on a warm machine, and a monorepo with five apps that share dependencies does
not balloon in disk usage.

### Why this project uses pnpm

ClassroomIO is a monorepo with several apps (`dashboard`, `api`, `classroomio-com`, `docs`) and shared packages. Those
apps overlap heavily in their dependencies. With npm you would pay the disk and time cost for each app independently.
With pnpm, shared versions are stored once and linked everywhere.

The devcontainer reinforces this by mounting the pnpm store as a named Docker volume (`classroomio-pnpm-store`). When
your container is rebuilt, the store survives, so the next `pnpm install` is fast rather than a full re-download.

### Workspaces

The file `pnpm-workspace.yaml` at the repository root is what turns a directory of packages into a pnpm workspace:

```yaml
packages:
  - apps/*
  - packages/*
  - packages/course-app/src/*
```

Each glob pattern tells pnpm which directories contain workspace packages. When you run `pnpm install` from the root,
pnpm reads every `package.json` matched by those patterns and installs all of their dependencies in one pass.

The workspace packages in this repository are:

| Package                | Path                   |
|------------------------|------------------------|
| `@cio/dashboard`       | `apps/dashboard`       |
| `@cio/api`             | `apps/api`             |
| `@cio/classroomio-com` | `apps/classroomio-com` |
| `@cio/docs-v2`         | `apps/docs`            |
| `packages/shared`      | `packages/shared`      |
| `packages/tsconfig`    | `packages/tsconfig`    |
| `packages/course-app`  | `packages/course-app`  |

### Cross-package dependencies with `workspace:*`

One of the most useful workspace features is being able to depend on a sibling package without publishing it to npm
first. In any `package.json` inside the monorepo you can write:

```json
{
  "dependencies": {
    "@cio/shared": "workspace:*"
  }
}
```

The `workspace:*` version range tells pnpm to resolve this dependency locally, from the workspace, rather than
downloading it from the registry. pnpm creates a symlink in `node_modules` pointing at the sibling package's source
directory. Changes to `packages/shared` are immediately visible to `apps/dashboard` without any publish or rebuild step
in between.

This is how `@cio/dashboard` consumes types from `@cio/api` — the dashboard declares `@cio/api` as a workspace
dependency, and the Turborepo build pipeline ensures the API is compiled before the dashboard build starts.

### corepack: pinning the pnpm version

Node ships with a tool called **corepack** that manages package manager versions. Rather than asking every developer to
run `npm install -g pnpm` and hope they land on the right version, the Dockerfile runs:

```bash
corepack enable
corepack prepare pnpm@10.28.2 --activate
```

This downloads and activates exactly pnpm 10.28.2 for the project. The version is pinned so everyone on the team — and
the CI environment — runs identical tooling. You do not need to do anything special; once the container is set up,`pnpm`
on the PATH is already the correct version.

### Filtering: targeting a single package

Running `pnpm dev` from the root starts all apps at once via Turborepo. When you only want to work on one package, use
`--filter`:

```bash
pnpm dev --filter=@cio/dashboard      # dashboard only (port 5173)
pnpm dev --filter=@cio/api            # API only (port 3002)
```

`--filter` accepts the package name from `package.json`, a relative directory path, or a glob. It also supports
dependency graph traversal — `--filter=@cio/dashboard...` would include the dashboard and all of the packages it depends
on — but you will not need that for day-to-day development here.

Adding a dependency to a specific package works the same way:

```bash
pnpm add zod --filter @cio/api
```

This adds `zod` to `apps/api/package.json` only, not to any other package.

### Common commands

```bash
# Install all workspace dependencies (run from root after cloning)
pnpm install

# Start all apps concurrently
pnpm dev

# Start a single app
pnpm dev --filter=@cio/dashboard

# Build everything
pnpm build

# Lint all packages
pnpm lint

# Format all files with Prettier
pnpm format

# Remove node_modules and build artifacts across all packages
pnpm clean

# Remove node_modules, build artifacts, and prune the pnpm store
pnpm clean:pnpm

# Add a package to a specific workspace member
pnpm add <pkg> --filter @cio/dashboard
```

### Maintaining the store

Over time the pnpm store accumulates versions of packages that no longer appear in any lockfile. To reclaim that disk
space:

```bash
pnpm store prune
```

This removes entries that are no longer referenced by any project on your machine. It is safe to run at any time; the
next install will re-download anything that turns out to be needed.

---

## Turborepo

This section explains how ClassroomIO uses Turborepo to coordinate building, developing, and linting multiple apps from
a single repository. It assumes you are new to both monorepos and Turborepo.

### What a monorepo is

A monorepo is a single Git repository that contains multiple apps and packages. ClassroomIO has four apps — the
dashboard, the API server, the marketing site, and the docs site — plus several shared packages. All of them live under
one root directory, share a single `node_modules` tree managed by [pnpm workspaces](#workspaces), and are
version-controlled together.

The main advantages of this layout are:

- **Shared code is easy.** The `packages/shared` library is imported directly by both the dashboard and the API. No
  publishing, no version mismatches.
- **Coordinated changes.** When you refactor a shared type, you can update every app that uses it in one commit and one
  review.
- **Single install.** One `pnpm install` at the root installs dependencies for every app and package.

The tradeoff is that naively running tasks — for example, running `build` in each of four apps in sequence — is slow and
ignores the fact that some apps must be compiled before others can start. That is the problem Turborepo solves.

### What Turborepo does

Turborepo is a task runner that sits on top of pnpm workspaces. You describe your tasks and their dependencies in
`turbo.json`, and Turborepo figures out the correct order to run them, runs independent tasks in parallel, and caches
outputs so that unchanged work is never repeated.

Think of it as `make` for JavaScript monorepos: it has a dependency graph, a caching layer, and the ability to run tasks
across every package at once with a single command.

Commands like `pnpm build` and `pnpm dev` at the repo root are thin wrappers that delegate to `turbo run build` and
`turbo run dev`. You rarely need to invoke Turbo directly.

### The pipeline — how task dependencies are declared

`turbo.json` at the root of the repo defines the pipeline:

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalEnv": [
    "PUBLIC_IS_SELFHOSTED"
  ],
  "pipeline": {
    "@cio/dashboard#build": {
      "dependsOn": [
        "@cio/api#build"
      ]
    },
    "build": {
      "dependsOn": [
        "^build"
      ],
      "outputs": [
        ".svelte-kit/**",
        ".vercel/**",
        "dist/**"
      ]
    },
    "lint": {
      "dependsOn": [
        "^build"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "prepare": {
      "dependsOn": [
        "^build"
      ],
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

There are two distinct ways to express a dependency.

**`"dependsOn": ["^build"]`** — the caret prefix means "run this task only after the `build` task of every package that
this package depends on has completed." So if Package A lists Package B in its `dependencies`, Turborepo will build B
first, then A. This is the general rule that applies to every package in the graph.

**`"dependsOn": ["@cio/api#build"]`** — an explicit named dependency. This says: before running `@cio/dashboard`'s
build, always run `@cio/api`'s build first, regardless of what `package.json` `dependencies` say. This rule exists in
ClassroomIO because the dashboard imports `@cio/api/rpc-types` to get end-to-end type safety between SvelteKit server
actions and the Hono API. The API's TypeScript must be compiled to emit those type declarations before the dashboard's
build can proceed.

In practice, the general `^build` rule handles most packages automatically. Named dependencies like
`@cio/dashboard#build` are reserved for cases where the dependency is not expressed through normal package imports or
where you want to be explicit.

### Caching

Turborepo hashes the inputs to each task — the source files, the package's `package.json`, any relevant environment
variables — and records the outputs. If you run the same task again without changing any inputs, Turbo replays the
cached result instead of running the task. For a clean build this can save several minutes.

The `outputs` field in a build task tells Turbo which directories to capture:

```json
"build": {
"dependsOn": ["^build"],
"outputs": [".svelte-kit/**", ".vercel/**", "dist/**"]
}
```

When Turbo restores a cache hit, it writes those directories back from the cache. The app behaves as if the build ran.

**`cache: false`** opts a task out of caching entirely. Development servers (`dev`, `start`) and destructive
operations (`clean`) set this flag because their side effects cannot be meaningfully cached or replayed.

**`globalEnv`** lists environment variables that Turbo includes in the hash for every task in the repo. ClassroomIO
includes `PUBLIC_IS_SELFHOSTED` here because changing that variable switches between the cloud and self-hosted feature
sets — a change that should invalidate every cached build output:

```json
"globalEnv": ["PUBLIC_IS_SELFHOSTED"]
```

If you add a new environment variable that affects build output, add it to `globalEnv` (or to a task-level `env` array)
so that cache entries are correctly invalidated when it changes.

### `persistent: true` — marking long-running tasks

Tasks like `dev` and `start` are long-running processes that never exit on their own. Turborepo needs to know this so it
does not treat the task as "completed" and never start tasks that depend on it.

The `persistent: true` flag communicates exactly that:

```json
"dev": {"cache": false, "persistent": true}
```

A task marked `persistent` can still depend on other tasks (as `prepare` does), but nothing else can depend on it in
turn — persistent tasks are always terminal nodes in the pipeline.

Note that `cache: false` and `persistent: true` are separate concerns. `cache: false` means "do not record or replay
outputs." `persistent: true` means "this task never exits." A dev server needs both. A task like `clean` needs only
`cache: false` because it exits after running.

### The `prepare` step

Before the dev servers start, each package may need to compile TypeScript declarations, run code generation, or do other
one-time setup. This is handled by the `prepare` task:

```json
"prepare": {"dependsOn": ["^build"], "persistent": true}
```

When you run `pnpm dev`, the root script runs `turbo prepare` first across all packages before starting the actual dev
servers:

```bash
turbo prepare --concurrency 13 && turbo run dev
```

The `prepare` task is marked `persistent: true` for packages (like the API) that keep a watcher process running. It
depends on `^build` so that any shared packages are compiled before individual apps prepare themselves. This ensures,
for example, that the API's RPC types exist on disk before the dashboard's dev server boots.

### Filtering — running tasks for one app

By default, `turbo run <task>` runs that task across every package in the monorepo. When you only want to work on one
app, use the `--filter` flag:

```bash
# Run only the dashboard's dev task
pnpm dev --filter=@cio/dashboard

# Run only the API's dev task
pnpm dev --filter=@cio/api

# Build only the dashboard (Turbo will still build @cio/api first because of the named dependency)
pnpm build --filter=@cio/dashboard
```

The `--filter` flag takes the package name as it appears in that package's `package.json` `"name"` field. Turborepo
still respects the dependency graph — if the filtered package depends on another package's build, that upstream build
still runs.

You can also pass a filter directly to Turbo:

```bash
turbo run dev --filter=@cio/dashboard
```

`pnpm dev --filter=@cio/dashboard` routes through pnpm workspaces and ends up at the same place.

### Practical commands

These are the commands you will use most often. Run them from the repository root.

```bash
# Install all dependencies
pnpm install

# Start all apps in dev mode (runs prepare first, then all dev servers in parallel)
pnpm dev

# Start only the dashboard
pnpm dev --filter=@cio/dashboard

# Start only the API
pnpm dev --filter=@cio/api

# Build all apps for production (respects the dependency graph)
pnpm build

# Lint all packages
pnpm lint

# Delete all build artifacts and node_modules
pnpm clean
```

When you run `pnpm dev`, Turbo starts all four dev servers concurrently. Output from each is prefixed with the package
name so you can tell them apart. The dashboard runs on port 5173, the API on 3002, the marketing site on 5174, and the
docs on 3000.

If you only need the dashboard, `pnpm dev --filter=@cio/dashboard` is significantly faster to start because it only
boots one app. The API prepare step still runs so its types are available, but the API dev server itself does not start.

---

## Supabase

Supabase is an open-source alternative to Firebase. At its core it is a hosted Postgres database, but it ships a full
stack of services on top of that database so you rarely need to write boilerplate infrastructure code.

Those services are:

- **PostgREST** — auto-generates a REST (and GraphQL) API directly from your database schema. Every table you create
  gets queryable endpoints immediately.
- **Auth** — JWT-based authentication with email/password, magic links, and OAuth providers.
- **Realtime** — streams Postgres row changes over WebSockets, so clients can subscribe to live updates.
- **Storage** — S3-compatible file storage with the same RLS policies as the rest of the database.
- **Edge Functions** — serverless functions that run on Deno inside Supabase's Edge runtime.
- **Studio** — a web UI for browsing your database, writing queries, and inspecting auth users.

When you run Supabase locally it spins up roughly ten Docker containers — one for Postgres, one for PostgREST, one for
the Auth service, one for Studio, and so on. The Supabase CLI manages all of them as a single unit.

### How ClassroomIO uses Supabase

All persistent state in ClassroomIO goes through Supabase — the database, auth sessions, and realtime events.

There are two places in the codebase that talk to Supabase:

**The dashboard** (`apps/dashboard`) is a SvelteKit application. It imports `@supabase/supabase-js` and uses it directly
from both the browser and SvelteKit server actions. It reads two environment variables:

```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

**The API** (`apps/api`) is a Hono server that handles privileged operations — sending emails, generating PDFs,
processing files. It uses the Supabase service role key so it can perform admin-level database operations:

```
PRIVATE_SUPABASE_SERVICE_ROLE=<service role key>
```

Understanding why these two keys exist — and why they matter for security — is important. That is covered in
the [Keys and Row Level Security](#keys-and-row-level-security) section below.

### Local setup

Docker must be running before you start Supabase locally. Inside the devcontainer, Docker-in-Docker is already
configured for you.

```bash
supabase start          # Pull images and start all services (first run takes a few minutes)
supabase status         # Show running services and print the anon key, service role key, and URLs
supabase stop           # Shut everything down
supabase db reset       # Drop the database, recreate it, and replay all migrations from scratch
```

When you run `supabase start` for the first time, the CLI pulls the Docker images for all services. Subsequent starts
are faster because the images are cached.

The services run on these local ports:

| Port  | Service                                 |
|-------|-----------------------------------------|
| 54321 | Supabase API (PostgREST, Auth, Storage) |
| 54322 | Postgres (direct connection)            |
| 54323 | Supabase Studio (web UI)                |
| 54324 | Inbucket (local email capture)          |

#### Automatic key injection

When the devcontainer starts it runs a setup script that calls `supabase status`, extracts the anon key and service role
key from the output, and writes them into the `.env` files for you. This means you do not need to copy and paste keys by
hand after `supabase start`. If you ever reset or restart your devcontainer and the keys seem wrong, run
`supabase status` to see the current values.

### Keys and Row Level Security

Supabase issues two API keys for each project.

**The anon key** is a JWT that identifies requests as coming from an unauthenticated (or authenticated) browser client.
It is safe to include in client-side code because Supabase does not use it alone to decide what data a request can
access. That job belongs to Row Level Security.

**The service role key** is a JWT that tells Supabase to skip all Row Level Security checks entirely. It grants
unrestricted read and write access to every table. Never expose this key in browser-side code or commit it to a public
repository. In ClassroomIO it stays on the API server only.

**Row Level Security (RLS)** is a Postgres feature that lets you write access policies in SQL, directly on each table.
Once RLS is enabled on a table, every query — regardless of which application code issued it — must pass the policies
attached to that table before Postgres will return or modify a row. The policies can inspect the JWT claims of the
requesting user (for example, `auth.uid() = user_id`) so the database itself enforces that a student can only read their
own course records, without any application-level filtering.

This is the reason the anon key is safe to ship to the browser: even if someone extracts the anon key and writes their
own queries, they will only see rows that your RLS policies permit. The service role key bypasses all of that, which is
why it must stay server-side.

### Migrations

Database schema changes are tracked as migration files in `supabase/migrations/`. Each file is named with a timestamp
prefix, for example:

```
supabase/migrations/20231115082347_remote_schema.sql
supabase/migrations/20231118210545_profile.sql
```

The timestamp ordering determines the replay sequence. When you run:

```bash
supabase db reset
```

Supabase drops the entire local database, recreates it from scratch, and then replays every file in
`supabase/migrations/` in timestamp order. This is the correct tool for local schema development because it guarantees
your local database matches exactly what the migration history describes. It is not additive — it rebuilds from zero —
so treat it as a routine part of local development rather than something to avoid.

To create a new migration, add a `.sql` file with a new timestamp prefix to `supabase/migrations/`, then run
`supabase db reset` to apply it locally.

When you are ready to apply migrations to production:

```bash
pnpm supabase:push      # Requires PROJECT_ID environment variable
```

This links your local migration history to the remote project and pushes any unapplied migrations.

### Edge Functions

Supabase Edge Functions are serverless functions that run on Deno. They live in `supabase/functions/`. ClassroomIO uses
them for tasks like sending notifications. The `notify` function is one example.

Edge Functions have access to the Supabase client and can use the service role key for privileged operations, since they
run in a trusted server environment rather than in the browser.

### Local email with Inbucket

During local development, ClassroomIO sends transactional emails — for example, auth confirmation emails and course
notifications. If those emails went to real inboxes they would be a nuisance to inspect and could accidentally reach
real users.

Supabase's local stack includes **Inbucket**, a throwaway SMTP server that catches every outgoing email and holds it in
a web interface. Any email the app sends during local development is intercepted and stored there instead of being
delivered.

Open Inbucket at [http://localhost:54324](http://localhost:54324) to read captured emails. This is useful for testing
auth flows (password reset links, magic links) without needing a real email account.

---

## Cypress

This project uses three different testing tools depending on what is being tested: Jest for the dashboard's unit tests,
Vitest for the API's unit and integration tests, and Cypress for end-to-end tests. This section explains what end-to-end
testing is, how Cypress works, and how to run the tests in this project.

### What end-to-end testing is

When people talk about "levels" of testing, they usually mean something like this:

- **Unit tests** exercise a single function or module in isolation. You call a function with some input and assert on
  the output. Nothing real runs — there is no network, no database, no browser.
- **Integration tests** exercise the boundary between two or more modules. A route handler calling a database client,
  for example. Still no browser, but more of the stack is involved.
- **End-to-end (E2E) tests** drive a real browser against a fully running application and assert on what a user actually
  sees and can do. The whole stack must be up: frontend, backend, database.

E2E tests are the most expensive to write and run, but they catch a class of bugs that no other tests can: broken
routing, failed redirects, auth token handling, UI state that only appears after a real login. Unit tests tell you that
your login function returns the right value; an E2E test tells you that a real user can actually log in.

### What Cypress is

Cypress is a browser automation tool built specifically for testing web applications. When you run a Cypress test,
Cypress opens a real browser (Chromium by default), loads your app, and executes a series of commands against it —
clicking buttons, filling forms, navigating pages — while making assertions about what should be on screen.

A few things make Cypress different from older tools like Selenium:

**Automatic waiting.** Cypress does not require you to add `sleep` calls or manual waits. When you tell Cypress to click
a button, it will retry until the button exists and is clickable, or until a timeout is reached. The same applies to
assertions: `cy.get('.welcome-message').should('be.visible')` will keep retrying until the element appears or the
timeout expires.

**A jQuery-like selector API.** You select elements with `cy.get()` using CSS selectors, the same syntax you probably
already know.

**An interactive test runner.** When developing or debugging, you can open the Cypress GUI instead of running
headlessly. The GUI shows each command as it executes, lets you time-travel through the command history, and highlights
the element each command acted on.

### The configuration

The Cypress configuration lives at `cypress.config.js` in the project root:

```js
module.exports = {
  projectId: '56i2dj',
  defaultCommandTimeout: 300000,
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    }
  }
};
```

#### `defaultCommandTimeout`

Cypress's built-in default timeout is 4 seconds. This project sets it to `300000` milliseconds — 5 minutes. That is a
very long timeout, and it is intentional. Auth flows that hit Supabase locally can be slow, especially on first run or
in CI environments where the database is still warming up. Rather than have tests fail with false negatives because
Supabase was a little slow, the timeout is generous.

In practice, a passing test will not actually wait 5 minutes — Cypress moves on as soon as the assertion succeeds. The
timeout is only the upper bound before a failure is declared.

#### `projectId`

This connects local Cypress runs to a project on [Cypress Cloud](https://cloud.cypress.io), a hosted service for
recording test results, viewing video replays of failures, and parallelizing test runs across multiple machines. The
`projectId` alone does not upload anything; recording requires passing `--record` with a secret key. For local
development you can ignore it entirely.

### Project structure

```
cypress/
  e2e/
    dashboard/
      authentication.cy.js
  fixtures/
  support/
```

**`cypress/e2e/`** contains the test files. Cypress discovers any file matching `*.cy.js` or `*.cy.ts` inside this
directory. Tests are grouped into subdirectories by feature area — right now there is one test file under `dashboard/`.

**`cypress/fixtures/`** holds static data files (usually JSON) that tests can load with `cy.fixture('filename')`. This
is useful for things like mock user credentials or sample API responses that you want to keep out of the test file
itself.

**`cypress/support/`** contains setup code that runs before every test. The two common files here are `commands.js` (
where you define custom `cy.myCommand()` helpers) and `e2e.js` (global hooks that run before the suite starts). Anything
you put here applies to all tests automatically.

### Running Cypress

#### Headless (CI)

From the project root:

```bash
pnpm ci
```

This runs `cypress run`, which executes all tests headlessly in Chromium and prints results to the terminal. This is the
command used in automated CI pipelines.

#### Interactive GUI (local development)

```bash
npx cypress open
```

This opens the Cypress test runner. You can pick which browser to use, see tests listed by file, run individual tests,
and watch the browser as commands execute. This is the right mode when writing new tests or debugging a failure — you
can click through the command history and inspect exactly what was on screen at each step.

### What needs to be running

Cypress is not self-contained. It opens a browser and loads a URL, which means the application must already be running.
For the tests in this project that means:

- The dashboard on port 5173 (`pnpm dev --filter=@cio/dashboard`)
- Supabase on port 54321 (`supabase start`)

If either of these is not running, Cypress will fail immediately when it tries to load the page.

For CI pipelines where you want everything to start automatically, the `start-server-and-test` package is a common
pattern: it starts the server, waits until a URL responds, runs the tests, then shuts everything down. That setup is not
currently wired up here, so for local runs you start the services manually before invoking `pnpm ci` or
`npx cypress open`.

### The authentication test

The only E2E test currently in the project is `cypress/e2e/dashboard/authentication.cy.js`. The name tells you what it
covers: the login flow.

A test like this typically does something along these lines — navigate to the app's login page, find the email and
password inputs, type credentials, submit the form, and then assert that the browser has landed on the expected
post-login page. If any step fails — say, the redirect after login is broken, or the session cookie is not being set —
the test catches it.

This is exactly the kind of regression that unit tests cannot catch. You could have a perfectly correct `authenticate()`
function and a perfectly correct `redirect()` function, and they could still fail to work together. The E2E test
exercises the full path.

### How Cypress differs from Jest and Vitest

Jest (used by the dashboard) and Vitest (used by the API) both run in Node.js. They import your modules directly and
call functions. There is no browser, no HTTP requests, no rendered HTML. They are fast and precise — the right tool for
testing pure logic, utility functions, data transformations, and module boundaries.

Cypress runs in a real browser. It cannot import your source code directly; it can only interact with the app the way a
user would. It is slower and requires more infrastructure, but it tests things that are impossible to test otherwise:
rendering, navigation, session state, the interaction between frontend and backend.

The two approaches are complementary. Use Jest and Vitest to keep your logic correct; use Cypress to make sure the
pieces work together from a user's point of view.
