# C4 Layer 2 — Container

ClassroomIO is a monorepo with four deployable containers. The Dashboard is the main SvelteKit app serving both teacher and student UIs. The API handles backend processing (PDF, video, email, uploads). Both talk to Supabase directly. The Landing Page and Docs are static marketing/documentation sites.

```mermaid
C4Container
    title Container Diagram — ClassroomIO

    Person(teacher, "Teacher/Admin", "Manages courses and orgs")
    Person(student, "Student", "Enrolls and learns")

    System_Boundary(cio, "ClassroomIO") {
        Container(dashboard, "Dashboard", "SvelteKit + TailwindCSS", "Main LMS app — course management, student learning, org admin")
        Container(api, "API", "Hono.js (Node)", "Backend for PDF/video processing, email, presigned uploads")
        Container(landing, "Landing Page", "SvelteKit", "Marketing site at classroomio.com")
        Container(docs, "Docs", "Vite", "Documentation site")
    }

    ContainerDb(supabase_db, "Supabase PostgreSQL", "PostgreSQL", "Users, orgs, courses, lessons, exercises, grades")
    Container_Ext(supabase_auth, "Supabase Auth", "GoTrue", "Authentication and session management")
    Container_Ext(storage, "Cloudflare R2", "S3-compatible", "File and media storage")
    Container_Ext(redis, "Redis", "In-memory store", "Rate limiting and caching")
    Container_Ext(smtp, "SMTP / ZeptoMail", "Email", "Transactional email delivery")
    Container_Ext(openai, "OpenAI API", "REST", "AI course generation")

    Rel(teacher, dashboard, "Uses", "HTTPS")
    Rel(student, dashboard, "Uses", "HTTPS")
    Rel(teacher, landing, "Discovers", "HTTPS")

    Rel(dashboard, supabase_db, "Reads/writes data", "HTTPS")
    Rel(dashboard, supabase_auth, "Authenticates users", "HTTPS")
    Rel(dashboard, api, "Uploads, PDF/video processing", "HTTPS")
    Rel(dashboard, openai, "AI course generation", "HTTPS")

    Rel(api, supabase_db, "Reads/writes data", "HTTPS")
    Rel(api, supabase_auth, "Validates auth tokens", "HTTPS")
    Rel(api, storage, "Presigned uploads/downloads", "HTTPS")
    Rel(api, redis, "Rate limiting", "TCP")
    Rel(api, smtp, "Sends emails", "SMTP")
```
