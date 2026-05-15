# C4 Level 1 — System Context

```mermaid
C4Context
  title System Context — ClassroomIO LMS

  Person(p_teacher, "Teacher / Admin", "Creates and manages courses, tracks student progress")
  Person(p_student, "Student", "Enrols in courses, completes lessons and exercises")

  System_Boundary(sb, "ClassroomIO") {
    System(sys_dashboard, "ClassroomIO Platform", "SvelteKit + Hono LMS — course authoring, delivery, community, analytics")
  }

  System_Ext(ext_supabase, "Supabase", "Database, auth, row-level security, storage metadata")
  System_Ext(ext_r2, "Cloudflare R2", "File/media uploads")
  System_Ext(ext_smtp, "ZeptoMail / SMTP", "Transactional email delivery")
  System_Ext(ext_openai, "OpenAI", "AI completions for exercises and grading")
  System_Ext(ext_polar, "Polar", "Subscription and payment management")

  Rel(p_teacher, sys_dashboard, "Authors courses, manages org")
  Rel(p_student, sys_dashboard, "Learns, submits exercises")
  Rel(sys_dashboard, ext_supabase, "Auth + all data persistence", "Supabase SDK / REST")
  Rel(sys_dashboard, ext_r2, "Stores uploaded files", "S3 API / presigned URLs")
  Rel(sys_dashboard, ext_smtp, "Sends invites, welcome emails", "SMTP / HTTP")
  Rel(sys_dashboard, ext_openai, "AI-generated exercises and grading", "REST")
  Rel(sys_dashboard, ext_polar, "Billing and subscriptions", "REST / webhooks")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```
