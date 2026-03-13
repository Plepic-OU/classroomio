# C4 Layer 1 — System Context

```mermaid
C4Context
  title System Context — ClassroomIO

  Person(teacher, "Teacher / Org Admin", "Creates courses, manages students, reviews submissions")
  Person(student, "Student", "Accesses lessons, submits exercises, joins community")

  System(classroomio, "ClassroomIO", "Open-source LMS — course management, student learning, community forum")

  System_Ext(supabase, "Supabase", "Postgres database, Auth (JWT), Realtime, Storage")
  System_Ext(openai, "OpenAI", "AI content & exercise generation, auto-grading")
  System_Ext(email, "SMTP / ZeptoMail", "Transactional email delivery")
  System_Ext(s3, "Cloudflare R2 / S3-compatible", "Video and document storage")
  System_Ext(polar, "Polar.sh", "Subscription billing and webhooks")
  System_Ext(sentry, "Sentry", "Error monitoring and performance tracing")
  System_Ext(posthog, "PostHog", "Product analytics and feature flags")

  Rel(teacher, classroomio, "Manages courses via", "HTTPS")
  Rel(student, classroomio, "Learns via", "HTTPS")
  Rel(classroomio, supabase, "Persists all data and auth")
  Rel(classroomio, openai, "Generates course content and grades")
  Rel(classroomio, email, "Sends welcome, submission, invite emails")
  Rel(classroomio, s3, "Stores and pre-signs media")
  Rel(classroomio, polar, "Handles billing events")
  Rel(classroomio, sentry, "Reports errors and traces")
  Rel(classroomio, posthog, "Tracks product usage")
```
