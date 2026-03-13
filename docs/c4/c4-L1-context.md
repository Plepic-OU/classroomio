# C4 Layer 1 — System Context

ClassroomIO is an open-source LMS platform. Teachers create and manage courses; students enroll and learn. The system depends on Supabase (auth + DB), object storage (S3/R2), email delivery (SMTP), and optionally OpenAI for AI-assisted course generation.

```mermaid
C4Context
    title System Context — ClassroomIO

    Person(teacher, "Teacher/Admin", "Creates courses, manages org, tracks students")
    Person(student, "Student", "Enrolls in courses, completes exercises")

    System(classroomio, "ClassroomIO", "Open-source LMS for creating and delivering courses")

    System_Ext(supabase, "Supabase", "Auth, PostgreSQL database, realtime")
    System_Ext(storage, "Cloudflare R2 / AWS S3", "File and media storage")
    System_Ext(smtp, "SMTP / ZeptoMail", "Transactional email delivery")
    System_Ext(openai, "OpenAI API", "AI course generation (optional)")
    System_Ext(redis, "Redis", "Rate limiting and caching")

    Rel(teacher, classroomio, "Manages courses, orgs, students")
    Rel(student, classroomio, "Enrolls, learns, submits exercises")
    Rel(classroomio, supabase, "Auth, CRUD, realtime", "HTTPS")
    Rel(classroomio, storage, "Upload/download files", "HTTPS")
    Rel(classroomio, smtp, "Sends emails", "SMTP/API")
    Rel(classroomio, openai, "Generates course content", "HTTPS")
    Rel(classroomio, redis, "Rate limiting", "TCP")
```
