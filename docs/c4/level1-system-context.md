# Layer 1 — System Context

Hand-authored from repo inspection (`CLAUDE.md`, `package.json` dependencies across `apps/*`) — there's no AST source of truth at this layer. Re-derive rather than trust blindly if the stack has changed; check `apps/*/package.json` for current integrations.

```mermaid
C4Context
title ClassroomIO — System Context

Person(teacher, "Teacher / Org Admin", "Creates orgs, courses, cohorts; grades submissions; manages billing")
Person(student, "Student", "Enrolls in courses, consumes lessons, submits assignments, joins community")
Person(visitor, "Public Visitor", "Browses the marketing site and public course catalog, not yet signed in")

System(classroomio, "ClassroomIO", "Open-source LMS: teacher dashboard + student-facing LMS + org/course management")

System_Ext(google, "Google OAuth", "Social sign-in")
System_Ext(billing, "LemonSqueezy / Polar", "Subscription billing & checkout")
System_Ext(openai, "OpenAI", "AI-assisted grading & content generation (via openai-edge)")
System_Ext(email, "ZeptoMail / SMTP", "Transactional email (invites, verification, notifications)")
System_Ext(storage, "Cloudflare R2 / AWS S3", "Object storage for video & large files")
System_Ext(unsplash, "Unsplash", "Stock image search for course/lesson covers")
System_Ext(analytics, "PostHog / Umami", "Product analytics")
System_Ext(senja, "Senja", "Testimonial widget embed")
System_Ext(sentry, "Sentry", "Error tracking (API)")
System_Ext(youtube, "YouTube", "Embedded lesson video playback")

Rel(teacher, classroomio, "Manages courses, grades, org settings", "HTTPS")
Rel(student, classroomio, "Learns, submits work, asks questions", "HTTPS")
Rel(visitor, classroomio, "Browses marketing site & public courses", "HTTPS")

Rel(classroomio, google, "Authenticates via", "OAuth 2.0")
Rel(classroomio, billing, "Manages subscriptions via", "HTTPS/webhooks")
Rel(classroomio, openai, "Requests completions from", "HTTPS")
Rel(classroomio, email, "Sends transactional email via", "SMTP/HTTPS")
Rel(classroomio, storage, "Stores/serves video & files via", "S3 API (presigned URLs)")
Rel(classroomio, unsplash, "Searches images via", "HTTPS")
Rel(classroomio, analytics, "Sends usage events to", "HTTPS (client-side)")
Rel(classroomio, senja, "Embeds widget from", "HTTPS (client-side)")
Rel(classroomio, sentry, "Reports errors to", "HTTPS")
Rel(classroomio, youtube, "Embeds player from", "HTTPS (client-side)")
```
