# C4 conventions for ClassroomIO

Reference for what each C4 layer should and shouldn't contain. See <https://c4model.com/> for the model itself.

## Layer 1 — System Context

**Purpose.** A single picture showing ClassroomIO as one box, the kinds of users that interact with it, and the external systems it talks to.

**Show:**
- Person actors with their role (e.g. "Org admin", "Tutor", "Student", "Anonymous learner").
- The ClassroomIO **system** (one box).
- External systems ClassroomIO calls or is called by (Supabase Auth/Storage/DB, Stripe, Polar, OpenAI, Zeptomail/Nodemailer SMTP, S3, Sentry, PostHog, etc.).
- A short verb on every relationship — "enrolls in courses via", "sends transactional email through", "stores video uploads in".

**Don't show:** internal containers, individual apps, technologies inside ClassroomIO.

## Layer 2 — Container

**Purpose.** Open the ClassroomIO box and show the deployable units.

**Show:**
- `apps/dashboard` — SvelteKit LMS, browser-rendered, port 5173 in dev. The thin client.
- `apps/api` — Hono Node service, port 3002. Side-effect operations only.
- `apps/classroomio-com` — marketing SvelteKit site.
- `apps/docs` — public docs.
- `supabase/` — Postgres + Auth + Storage + Realtime + Edge Functions (treat as one container labeled "Supabase").
- External systems carried over from L1, where relevant for the dependency story.

**Relationship rules:**
- The dashboard reads/writes Supabase **directly** with the anon key. Authorization is in Postgres RLS, not in any middleware.
- The dashboard calls `apps/api` only for things the browser cannot safely do (mail, presigned URLs, processing). Mark these calls explicitly so it's visible that `apps/api` is not a CRUD layer.
- The API also talks to Supabase (service role) and external mail/storage.

**Don't show:** components inside a container (Layer 3), individual route paths.

## Layer 3 — Component

**Purpose.** Open a single container and show its internal components and how they depend on each other. Produced from `extraction.json`.

### What counts as a component

A component is a **named grouping of code that has a single responsibility**, deployed as part of the parent container. In this repo we approximate that by truncating each file's directory path to a configurable depth:

- Dashboard, depth 3: things like `lib/components/Course`, `lib/utils/services`, `routes/api/admin`.
- API, depth 2: things like `routes/course`, `services`, `utils/auth`, `middlewares`.

That heuristic isn't perfect, but it's deterministic and rerunnable. If a component balloons past 50 files, the depth is wrong — bump it in `config.json`.

### How to lay out a Layer 3 diagram

- Group related components inside `Boundary` blocks. For the dashboard, useful boundaries are **UI Components** (`lib/components`), **Shared Utilities** (`lib/utils`), **Routes** (`routes`), **Mail Templates** (`mail`). For the API, useful boundaries are **HTTP Routes** (`routes`), **Services** (`services`), **Middlewares** (`middlewares`), **Infrastructure** (`utils`, `config`, `constants`).
- Keep the rendered diagram readable. The extraction may produce 90+ components for the dashboard; the diagram should not. Show:
  - Every boundary.
  - The largest / most-connected components inside each boundary (use file count and incoming-edge count as signals).
  - Every cross-boundary relationship with `count >= 3`, plus any architecturally meaningful low-count edges (e.g. anything touching `lib/utils/services` since that's where Supabase access lives).
- Below the diagram, include a **component roster** — a plain Markdown table or list with every component's key, file count, and a one-line responsibility. This is what AI consumers will read; the diagram is for humans.

### What to write next to each component

- A 3–6 word **technology hint** (e.g. "Svelte 4 + Carbon", "Hono router", "Supabase RPC client").
- A one-line **responsibility** that isn't obvious from the path. If the path already tells you everything (`routes/login`), leave it as just the path.

### What not to do

- Don't hand-edit component lists or edges. Rerun extraction.
- Don't draw every external library — extraction reports them, but Layer 3 is about *internal* structure. Mention notable externals only inline in component descriptions.
- Don't show file-level granularity. If a single file's role matters, that's a job for Layer 4 (code), which we deliberately don't produce.

## Layout-specific rules for ClassroomIO

- **Roles are numeric.** When describing actors, say "tutor (role_id=2)" not "tutor". This is a recurring footgun.
- **Authorization lives in RLS**, not in any container's middleware. If a Layer 3 description sounds like "validates permissions", it's almost always wrong — the JS check is UX, the RLS policy is security.
- **The `course` ↔ `group` ↔ `groupmember` triangle** is the backbone of the data model. Make it visible wherever it's relevant. See `database.md` for column-level detail.
- **Email is fire-and-forget** from the dashboard to the API. Mark those edges as async in any diagram that depicts request flow.
