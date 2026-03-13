# C4 Layer 2 — Containers

```mermaid
C4Container
  title Container diagram — ClassroomIO

  Person(teacher, "Teacher / Admin", "")
  Person(student, "Student", "")

  System_Boundary(classroomio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / Vite — port 5173",
      "Main LMS web app: org management, student learning, course editor")
    Container(api, "API", "Hono / Node.js — port 3002",
      "PDF/video processing, presigned uploads, email sending")
    Container(marketing, "Marketing Site", "SvelteKit — port 5174",
      "Public-facing landing page and blog")
  }

  System_Ext(supabase_db, "Supabase", "PostgreSQL 15 + Auth (GoTrue) + Edge Functions (Deno) — all application data and authentication")
  System_Ext(r2, "Cloudflare R2", "S3-compatible object store — video files and course attachments")
  System_Ext(openai, "OpenAI", "LLM API")
  System_Ext(smtp, "SMTP", "Email delivery")
  System_Ext(billing, "Polar / LemonSqueezy", "Billing")

  Rel(teacher, dashboard, "Uses", "HTTPS")
  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(teacher, marketing, "Reads", "HTTPS")

  Rel(dashboard, supabase_db, "CRUD data, Auth, Realtime", "REST / WebSocket")
  Rel(dashboard, api, "RPC calls", "Hono RPC / HTTP")
  Rel(dashboard, openai, "Completion requests", "REST")
  Rel(dashboard, billing, "Webhook events", "HTTPS")

  Rel(api, supabase_db, "Reads/writes data", "REST")
  Rel(api, r2, "Upload/presign", "S3 API")
  Rel(api, smtp, "Send email", "SMTP")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```
