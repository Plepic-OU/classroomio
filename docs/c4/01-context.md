## Level 1 — System Context

ClassroomIO is an open-source learning management system (LMS) that lets organizations create courses, enroll students, grade work, and issue certificates. End users reach it through a single web product; the system delegates payments, AI generation, media storage, mail, and observability to managed third parties.

```mermaid
C4Context
    title System Context — ClassroomIO

    Person(student, "Student", "Enrolls in courses, completes lessons and exercises, receives certificates.")
    Person(instructor, "Instructor", "Authors courses, grades submissions, runs cohorts. Includes course-level admins and tutors.")
    Person(org_admin, "Org admin", "Manages organization, team, billing, custom domain.")

    System(classroomio, "ClassroomIO", "Open-source LMS — course authoring, delivery, grading, certificates.")

    System_Ext(payments, "Payment providers", "Stripe, LemonSqueezy, Polar — subscription billing and course purchases.")
    System_Ext(openai, "OpenAI", "LLM for course generation, exercise authoring, AI-assisted grading.")
    System_Ext(r2, "Cloudflare R2", "S3-compatible object storage for course videos and uploaded media.")
    System_Ext(mail, "Email provider", "Zoho ZeptoMail (primary) / SMTP via Nodemailer (fallback) for transactional mail.")
    System_Ext(unsplash, "Unsplash", "Stock imagery for course banners and assets.")
    System_Ext(vercel, "Vercel platform API", "Custom-domain provisioning for cloud-hosted tenants.")
    System_Ext(observability, "Observability", "Sentry (errors) and PostHog (product analytics).")

    Rel(student, classroomio, "Learns via", "HTTPS")
    Rel(instructor, classroomio, "Authors and grades in", "HTTPS")
    Rel(org_admin, classroomio, "Administers via", "HTTPS")

    Rel(classroomio, payments, "Charges customers, receives webhooks", "JSON/HTTPS")
    Rel(classroomio, openai, "Generates course & exercise content via", "JSON/HTTPS")
    Rel(classroomio, r2, "Stores & serves media via", "S3 API/HTTPS")
    Rel(classroomio, mail, "Sends transactional mail via", "SMTP / JSON/HTTPS")
    Rel(classroomio, unsplash, "Searches stock images via", "JSON/HTTPS")
    Rel(classroomio, vercel, "Provisions custom domains via", "JSON/HTTPS")
    Rel(classroomio, observability, "Reports errors & events to", "JSON/HTTPS")
```

### Notes

- **Roles distinguished.** ClassroomIO has explicit course-level roles (admin / tutor / student, stored in the `role` table) and org-level roles. At Level 1 we collapse "course admin" and "tutor" into a single **Instructor** persona — they share the authoring/grading surface in the UI. **Org admin** is split out because its responsibilities (team, billing, custom domain) sit on a different surface.
- **Anonymous visitors.** The marketing site and public course landing pages are reachable without an account. We don't model anonymous browsers as a person at Level 1 — they're implicit.
- **Supabase is not at Level 1.** Although Supabase is a managed service in cloud deployments, ClassroomIO treats Postgres, Auth, and Edge Functions as a first-class part of the stack (the self-hosted build runs Supabase locally too). They appear as **containers** at Level 2, not external systems here.
- **Payment providers are grouped.** Stripe, LemonSqueezy, and Polar are alternative integrations covering the same conceptual role (billing). They get separate components if you zoom into the dashboard's `/api/*` routes, but at Level 1 they are one external dependency.
