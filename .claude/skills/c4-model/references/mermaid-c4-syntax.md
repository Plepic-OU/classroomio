# Mermaid C4 Syntax — Quick Reference

Source: https://mermaid.js.org/syntax/c4.html

## Diagram types

```
C4Context      — Layer 1: system context
C4Container    — Layer 2: containers
C4Component    — Layer 3: components
C4Dynamic      — dynamic / sequence variant
C4Deployment   — deployment view
```

## Element shapes

```
Person(alias, "Label", "Description")
Person_Ext(alias, "Label", "Description")

System(alias, "Label", "Description")
System_Ext(alias, "Label", "Description")

Container(alias, "Label", "Technology", "Description")
Container_Ext(alias, "Label", "Technology", "Description")
ContainerDb(alias, "Label", "Technology", "Description")
ContainerQueue(alias, "Label", "Technology", "Description")

Component(alias, "Label", "Technology", "Description")
ComponentDb(alias, "Label", "Technology", "Description")
```

## Relationships

```
Rel(from, to, "Label")
Rel(from, to, "Label", "Technology")
Rel_Back(from, to, "Label")           -- dashed arrow reversed
Rel_Neighbor(from, to, "Label")       -- side-by-side layout hint
BiRel(from, to, "Label")              -- bidirectional
```

## Boundaries

```
System_Boundary(alias, "Name") {
  Container(...)
}

Container_Boundary(alias, "Name") {
  Component(...)
}

Enterprise_Boundary(alias, "Name") {
  System(...)
}
```

## Complete Layer 1 example

```mermaid
C4Context
  title System Context — ClassroomIO

  Person(teacher, "Teacher / Admin", "Creates and manages courses")
  Person(student, "Student", "Takes courses, submits work")

  System_Boundary(cio, "ClassroomIO") {
    System(dashboard, "Dashboard App", "SvelteKit LMS frontend")
    System(api, "API Server", "Hono long-running task API")
  }

  System_Ext(supabase, "Supabase", "Auth, PostgreSQL, Storage")
  System_Ext(s3, "AWS S3", "File storage")
  System_Ext(email, "Email Provider", "Nodemailer / ZeptoMail")
  System_Ext(stripe, "Stripe / Polar", "Payment processing")
  System_Ext(redis, "Redis", "Rate limiting cache")

  Rel(teacher, dashboard, "Manages courses via")
  Rel(student, dashboard, "Learns via")
  Rel(dashboard, supabase, "Auth & data")
  Rel(dashboard, api, "Long-running tasks")
  Rel(api, supabase, "Reads / writes data")
  Rel(api, s3, "Presigned URLs")
  Rel(api, email, "Sends email")
  Rel(api, redis, "Rate limits")
  Rel(dashboard, stripe, "Payments")
```

## Complete Layer 3 example (abbreviated)

```mermaid
C4Component
  title Component Diagram — API Container

  Container_Boundary(api, "API Server (Hono)") {
    Component(app, "App Bootstrap", "TypeScript", "Registers middleware and routes")
    Component(course_routes, "Course Routes", "Hono", "Clone, KaTeX, S3 presign, lesson ops")
    Component(mail_routes, "Mail Routes", "Hono", "Email delivery endpoints")
    Component(course_svc, "Course Service", "TypeScript", "Business logic for course cloning")
    Component(mail_svc, "Mail Service", "TypeScript", "Nodemailer / ZeptoMail abstraction")
    Component(utils_auth, "Auth Utils", "TypeScript", "JWT validation helpers")
    Component(utils_s3, "S3 Utils", "AWS SDK", "Presigned URL generation")
    Component(utils_supabase, "Supabase Client", "Supabase JS", "DB access")
  }

  System_Ext(supabase_ext, "Supabase", "PostgreSQL DB")
  System_Ext(s3_ext, "AWS S3", "Object storage")
  System_Ext(email_ext, "Email Provider", "ZeptoMail / Nodemailer")

  Rel(app, course_routes, "Routes /course")
  Rel(app, mail_routes, "Routes /mail")
  Rel(course_routes, course_svc, "Delegates to")
  Rel(mail_routes, mail_svc, "Delegates to")
  Rel(course_svc, utils_supabase, "Reads / writes")
  Rel(course_svc, utils_s3, "Generates URLs")
  Rel(mail_svc, email_ext, "Sends via")
  Rel(utils_supabase, supabase_ext, "Queries")
  Rel(utils_s3, s3_ext, "Calls AWS SDK")
```

## Rendering tips

- Keep aliases to `[a-zA-Z0-9_]` — no slashes, dashes, or dots
- Descriptions are optional but recommended (shown as tooltip in many renderers)
- `title` line is optional but helpful for documentation
- Mermaid C4 supports `UpdateLayoutConfig($c4ShapeInRow, $c4BoundaryInRow)` to control layout
- Aim for ≤ 25 elements per diagram for readability
