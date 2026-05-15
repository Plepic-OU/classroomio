# C4 Level 1 — System Context

```mermaid
C4Context
  title System Context for ClassroomIO

  Person(educator, "Educator", "Creates courses, tracks students, manages org")
  Person(student, "Student", "Enrols in courses, submits exercises")
  Person(admin, "Platform Admin", "Self-hosts or manages cloud instance")

  System(classroomio, "ClassroomIO", "Open-source LMS for bootcamps, educators, and companies")

  System_Ext(supabase, "Supabase", "Auth, PostgreSQL, Realtime subscriptions")
  System_Ext(openai, "OpenAI", "AI-assisted content generation")
  System_Ext(r2, "Cloudflare R2", "Video file storage (S3-compatible)")
  System_Ext(muse_ai, "Muse.ai", "Video transcription")
  System_Ext(stripe, "Stripe / Polar", "Payment processing")
  System_Ext(email_svc, "Email Provider", "Nodemailer / ZeptoMail")

  Rel(educator, classroomio, "Creates courses, manages students")
  Rel(student, classroomio, "Takes courses, submits exercises")
  Rel(admin, classroomio, "Configures and self-hosts")
  Rel(classroomio, supabase, "Stores all data, authenticates users")
  Rel(classroomio, openai, "AI content generation")
  Rel(classroomio, r2, "Stores and streams video")
  Rel(classroomio, muse_ai, "Transcribes video")
  Rel(classroomio, stripe, "Processes payments")
  Rel(classroomio, email_svc, "Sends notifications and invites")
```
