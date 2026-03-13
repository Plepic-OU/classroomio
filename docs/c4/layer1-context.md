# C4 Layer 1 — System Context

```mermaid
C4Context
  title ClassroomIO — System Context

  Person(admin, "Organization Admin", "Creates courses, manages students and tutors")
  Person(tutor, "Tutor", "Delivers lessons, grades submissions")
  Person(student, "Student", "Takes courses, submits exercises")

  System(classroomio, "ClassroomIO", "Open-source LMS for companies and bootcamps")

  System_Ext(supabase, "Supabase", "Postgres database + auth + realtime")
  System_Ext(s3, "S3-compatible Storage", "Video and file uploads")
  System_Ext(email, "Email Provider", "Transactional email delivery")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error monitoring")

  Rel(admin, classroomio, "Manages org, courses, audience")
  Rel(tutor, classroomio, "Creates content, grades work")
  Rel(student, classroomio, "Learns, submits exercises")
  Rel(classroomio, supabase, "Persists all data, auth tokens", "Supabase SDK / REST")
  Rel(classroomio, s3, "Stores and retrieves media", "S3 API")
  Rel(classroomio, email, "Sends notifications and invites", "SMTP / Resend")
  Rel(classroomio, posthog, "Tracks usage events", "JS SDK")
  Rel(classroomio, sentry, "Reports runtime errors", "JS SDK")
```
