# C4 L2 — Containers (DOT)

_DOT (Graphviz) version. See [Mermaid version](../l2-containers.md) for the elements table and description._

Render with: `dot -Tsvg file.dot.md -o out.svg` (after extracting the code block) or paste into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/).

## Diagram

```dot
digraph L2 {
  graph [label="ClassroomIO — Containers", labelloc=t, fontsize=14, fontname="Helvetica", rankdir=TB, splines=ortho, pad=0.6, nodesep=0.8, ranksep=1.2, compound=true]
  edge [fontname="Helvetica", fontsize=9, color="#555555"]

  // Users
  teacher [label="[Person]\nTeacher / Admin\nManages courses", shape=box, style="filled,rounded", fillcolor="#08427B", fontcolor="white", fontname="Helvetica", fontsize=10]
  student [label="[Person]\nStudent\nTakes courses", shape=box, style="filled,rounded", fillcolor="#08427B", fontcolor="white", fontname="Helvetica", fontsize=10]

  subgraph cluster_cio {
    label="ClassroomIO"
    style=dashed
    color="#1168BD"
    fontcolor="#1168BD"
    fontname="Helvetica"
    fontsize=12

    dashboard [label="[Container: SvelteKit 2]\nDashboard\nMain LMS UI. Port 5173.", shape=box, style="filled,rounded", fillcolor="#1168BD", fontcolor="white", fontname="Helvetica", fontsize=10]
    api [label="[Container: Hono/Node.js]\nAPI\nAsync ops: certs, video, email. Port 3002.", shape=box, style="filled,rounded", fillcolor="#1168BD", fontcolor="white", fontname="Helvetica", fontsize=10]
    courseapp [label="[Container: Svelte 5]\nCourse App\nEmbeddable course viewer (npm)", shape=box, style="filled,rounded", fillcolor="#1168BD", fontcolor="white", fontname="Helvetica", fontsize=10]
  }

  // Data & Auth
  db [label="[Database: Supabase Postgres]\nPostgreSQL\nAll LMS data", shape=cylinder, style="filled,rounded", fillcolor="#438DD5", fontcolor="white", fontname="Helvetica", fontsize=10]
  auth [label="[Container: GoTrue]\nSupabase Auth\nJWT auth & RLS enforcement", shape=box, style="filled,rounded", fillcolor="#999999", fontcolor="white", fontname="Helvetica", fontsize=10]
  redis [label="[Container: Redis 7]\nRedis\nRate limiting", shape=box, style="filled,rounded", fillcolor="#999999", fontcolor="white", fontname="Helvetica", fontsize=10]

  // External Services
  cloudflare [label="[External System]\nCloudflare Stream\nVideo streaming", shape=box, style="filled,rounded", fillcolor="#999999", fontcolor="white", fontname="Helvetica", fontsize=10]
  s3 [label="[External System]\nAWS S3\nFile storage", shape=box, style="filled,rounded", fillcolor="#999999", fontcolor="white", fontname="Helvetica", fontsize=10]
  email [label="[External System]\nZeptoMail / SMTP\nEmail delivery", shape=box, style="filled,rounded", fillcolor="#999999", fontcolor="white", fontname="Helvetica", fontsize=10]

  // Relationships
  teacher   -> dashboard [label="Uses [HTTPS]"]
  student   -> dashboard [label="Uses [HTTPS]"]
  dashboard -> db        [label="Reads/writes via RLS [Supabase SDK]"]
  dashboard -> auth      [label="Authenticates users [Supabase SDK]"]
  dashboard -> api       [label="Delegates async tasks [RPC/REST]"]
  api       -> db        [label="Service-level DB ops [Supabase SDK]"]
  api       -> redis     [label="Rate limiting [ioredis]"]
  api       -> cloudflare [label="Presigns video uploads [HTTP]"]
  api       -> s3        [label="Stores course assets [AWS SDK]"]
  api       -> email     [label="Sends emails [Nodemailer]"]
}
```
