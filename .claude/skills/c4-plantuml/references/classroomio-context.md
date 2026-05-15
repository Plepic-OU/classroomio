# ClassroomIO — L1+L2 architectural facts

Stable facts to use when drawing Layer 1 and Layer 2. Verify against `apps/`, `package.json` files, and `CLAUDE.md` before drawing — if any of this has changed in the repo, **trust the repo, not this file**, and update the file.

## People (L1 actors)

- **Teacher / Admin** — creates and manages courses, lessons, assessments, organisations. Primary user of the dashboard.
- **Student** — takes courses, submits work, joins via invite links. Uses the dashboard LMS section and the public course view.
- **Org Owner** — manages billing, team members, settings for an organisation (a subset of teacher/admin).

Treat teacher and student as separate `Person()` nodes. Org owner can be implicit unless explicitly relevant.

## ClassroomIO containers (L2)

| Alias | App | Tech | Purpose |
|---|---|---|---|
| `dashboard` | `apps/dashboard` | SvelteKit 4 | Main LMS UI. Talks to Supabase directly for most reads/writes; delegates long-running work to the API. |
| `api` | `apps/api` | Hono 4 on Node | Async tasks: certificate PDF, content PDF, file upload presigning, KaTeX rendering, course cloning, email delivery. |
| `marketing` | `apps/classroomio-com` | SvelteKit 2 | Landing/marketing site. |
| `docs` | `apps/docs` | React Start (TanStack Router) | Documentation site. |
| `course_app` | `apps/course-app` | SvelteKit 5 | Standalone public course viewer. |
| `db` | Supabase Postgres | Postgres + RLS | Core data store. RLS-protected. ~38 migrations. |
| `edge_fns` | `supabase/functions/*` | Deno (Supabase Edge) | Supabase edge functions (if present in repo). |

## External systems (L1 + L2 perimeter)

| Alias | System | Used by | Purpose |
|---|---|---|---|
| `supabase_auth` | Supabase Auth | dashboard, api | Session tokens, user auth. |
| `r2` | Cloudflare R2 | api | Object storage (S3 API) for uploads. |
| `smtp` | SMTP / Zeptomail | api | Transactional email. |
| `openai` | OpenAI | dashboard, api | AI completions (lesson generation, etc). |
| `stripe` | Stripe | dashboard | Legacy subscription billing. |
| `polar` | Polar | dashboard | Current subscription billing. |
| `posthog` | PostHog | dashboard | Product analytics. |
| `redis` | Redis | api | Rate limiting. |
| `sentry` | Sentry | api (+dashboard?) | Error monitoring. |
| `senja` | Senja | dashboard | Testimonials widget. |

Before drawing, grep for each external system in `apps/*/package.json` + `.env.example` to confirm it's still wired up. If any of these are gone (or new ones appear like Resend, Plunk, etc.), update this file.

## Key data-flow facts

- The **dashboard talks to Supabase directly** for most operations (Supabase JS client). It is *not* a thin client over the API.
- The **API uses service-role Supabase access** and is reserved for long-running / privileged / external-service work.
- The API exports `./rpc-types` so the dashboard can use **typed Hono RPC** for those API calls.
- Auth: Bearer tokens validated by Hono auth middleware against Supabase.
- Rate limiting on the API uses Redis.
- Deployment adapter is conditional on `PUBLIC_IS_SELFHOSTED`: Node (self-host) vs Vercel (cloud).
