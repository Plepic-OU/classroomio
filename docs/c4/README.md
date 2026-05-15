## C4 architecture model — ClassroomIO

This folder contains a [C4 model](https://c4model.com/) of ClassroomIO at three levels of zoom.
[C4](https://c4model.com/) describes software architecture in four levels (Context → Container → Component → Code); this model covers the first three. Level 4 (Code) is intentionally out of scope — the source is the source of truth at that resolution.

### Diagrams

| Level | File | Scope |
| --- | --- | --- |
| 1 — System Context | [`01-context.md`](./01-context.md) | ClassroomIO as a black box, its users, and the third-party systems it talks to. |
| 2 — Containers | [`02-container.md`](./02-container.md) | Deployable units inside ClassroomIO (dashboard, API, marketing site, docs, Supabase, Redis) and how they communicate. |
| 3 — Components (Dashboard) | [`03-component-dashboard.md`](./03-component-dashboard.md) | Inside the SvelteKit dashboard — route groups, service modules, auth boundary. |
| 3 — Components (API) | [`03-component-api.md`](./03-component-api.md) | Inside the Hono API — routers, middleware stack, downstream integrations. |

Level 3 is omitted for the marketing site (`apps/classroomio-com`) and docs site (`apps/docs`) — both are thin SvelteKit / Tanstack Start surfaces without significant internal structure to diagram. The Supabase containers (Postgres, Auth, Edge Functions) and Redis are intentionally not drilled into — they're managed/stock infrastructure.

### Diagram format

Diagrams are written in [Mermaid C4](https://mermaid.js.org/syntax/c4.html) so they render natively on GitHub. View any `*.md` file on github.com (or in a Markdown previewer that supports Mermaid) to see the rendered diagram.

### How to update

Run `/c4-model` in Claude Code, or ask Claude to update the C4 model. Re-running re-discovers containers and external systems from the current repo state and edits these files in place rather than rewriting them.
