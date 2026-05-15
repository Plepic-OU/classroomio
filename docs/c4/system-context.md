# C4 Layer 1 — System Context

```mermaid
C4Context
title System Context — ClassroomIO LMS

Person(student, "Student", "Enrolled learner taking courses and submitting work")
Person(teacher, "Teacher / Tutor", "Creates content, manages courses, grades submissions")
Person(admin, "Org Admin", "Manages organization, members, and settings")

System(classroomio, "ClassroomIO", "Open-source LMS for companies and bootcamps. Course management, assessments, grading, community forums.")

System_Ext(supabase, "Supabase", "Managed PostgreSQL + Auth with row-level security and realtime subscriptions")
System_Ext(storage, "Object Storage", "Cloudflare R2 / S3-compatible for file uploads and course media")
System_Ext(email, "Email Service", "ZeptoMail / SMTP for transactional email")
System_Ext(posthog, "PostHog", "Product analytics and feature flags")
System_Ext(sentry, "Sentry", "Error monitoring and performance tracking")

Rel(student, classroomio, "Takes courses, submits work, joins community")
Rel(teacher, classroomio, "Creates content, grades submissions")
Rel(admin, classroomio, "Manages org, invites members, configures settings")
Rel(classroomio, supabase, "Stores all data, authenticates users", "Supabase SDK")
Rel(classroomio, storage, "Stores uploads and media", "S3 API")
Rel(classroomio, email, "Sends invitations and notifications", "SMTP / API")
Rel(classroomio, posthog, "Tracks usage", "JS SDK")
Rel(classroomio, sentry, "Reports errors and performance", "JS SDK")
```
