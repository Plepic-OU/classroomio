# ClassroomIO — Project Overview & Paid Enrollment Development Plan

> For a developer new to the stack. Covers architecture, tech choices, data model, and a step-by-step plan for adding charge-on-enroll functionality for students.

---

## 1. What Is ClassroomIO?

ClassroomIO is an open-source Learning Management System (LMS). It lets organisations create courses, enroll students, track progress, run quizzes, issue certificates, and manage subscriptions. It can be deployed to the cloud or self-hosted.

---

## 2. Monorepo Layout

The project is a **pnpm + Turborepo monorepo** — one Git repo that holds multiple independent apps and shared libraries that can depend on each other.

```
classroomio/
├── apps/
│   ├── dashboard/        ← Teacher / admin UI  (SvelteKit v1)
│   ├── course-app/       ← Student learning UI (SvelteKit v2)
│   ├── api/              ← Background API      (Hono / Node)
│   ├── classroomio-com/  ← Marketing website   (SvelteKit)
│   └── docs/             ← Documentation site  (React / Fumadocs)
├── packages/
│   ├── shared/           ← Plan constants, shared types
│   ├── course-app/       ← CLI for generating course sites
│   └── tsconfig/         ← Shared TypeScript configs
├── supabase/             ← DB migrations, seed data
├── ai/                   ← AI prompt templates
└── cypress/ / tests/     ← E2E test suites
```

### How the apps relate

```mermaid
graph LR
    Teacher["Teacher / Admin\n(browser)"]
    Student["Student\n(browser)"]
    Dashboard["apps/dashboard\nSvelteKit v1"]
    CourseApp["apps/course-app\nSvelteKit v2"]
    API["apps/api\nHono (Node)"]
    Supabase[("Supabase\nPostgres + Auth + Storage")]
    S3[("AWS S3\nFile storage")]
    Polar["Polar\nPayment provider"]

    Teacher --> Dashboard
    Student --> CourseApp
    Dashboard -->|"REST / RPC"| Supabase
    CourseApp -->|"REST / RPC"| Supabase
    Dashboard -->|"long-running jobs"| API
    API --> Supabase
    API --> S3
    Dashboard -->|"subscribe / webhook"| Polar
```

---

## 3. Technology Stack — Quick Reference

| What | Tool | Why it's used |
|------|------|---------------|
| Frontend framework | **SvelteKit** | Full-stack framework (routing, SSR, API routes) built on Svelte — a compile-time UI framework with no virtual DOM |
| Styling | **TailwindCSS** | Utility-first CSS — write classes directly in HTML |
| UI components | **Carbon Components / bits-ui** | Pre-built accessible components |
| Database | **Supabase (PostgreSQL)** | Postgres with a built-in REST API, Auth, Storage, and Row-Level Security |
| Auth | **Supabase Auth** | Email/password + Google OAuth, session tokens handled automatically |
| Background API | **Hono** | Lightweight Node HTTP framework, similar to Express but faster and TypeScript-first |
| Monorepo tooling | **pnpm workspaces + Turborepo** | pnpm links packages together; Turbo parallelises builds and caches outputs |
| Payments (org plans) | **Polar** | Subscription billing for org-level plans (BASIC / EARLY_ADOPTER / ENTERPRISE) |
| Payments (legacy) | **Lemon Squeezy** | Being phased out |
| Email | **Nodemailer / ZeptoMail** | Transactional email |
| Analytics | **PostHog** | Product analytics (page views, events) |
| Error tracking | **Sentry** | Runtime error capture |
| File uploads | **AWS S3** (presigned URLs) | Teachers upload videos/slides directly from browser to S3 |
| Testing | **Playwright + Cypress** | End-to-end browser tests |
| CI | **GitHub Actions** | Automated test & deploy pipelines |

---

## 4. Database Model (Simplified)

Below are the core tables relevant to courses and enrollment.

```mermaid
erDiagram
    profile {
        uuid id PK
        text fullname
        text avatar_url
        text email
    }

    organization {
        uuid id PK
        text name
        text siteName
    }

    organization_plan {
        uuid id PK
        uuid org_id FK
        text plan_name
        bool is_active
        text provider
        text subscription_id
    }

    group {
        uuid id PK
        uuid organization_id FK
        text name
    }

    groupmember {
        uuid id PK
        uuid group_id FK
        uuid profile_id FK
        text email
        int role_id FK
    }

    course {
        uuid id PK
        uuid group_id FK
        text title
        bigint cost
        text currency
        bool is_published
    }

    lesson {
        uuid id PK
        uuid course_id FK
        text title
        int order
    }

    lesson_completion {
        uuid id PK
        uuid lesson_id FK
        uuid profile_id FK
        bool is_complete
    }

    organization ||--o{ organization_plan : "has plan"
    organization ||--o{ group : "owns"
    group ||--o{ course : "contains"
    group ||--o{ groupmember : "has members"
    profile ||--o{ groupmember : "enrolled as"
    course ||--o{ lesson : "has lessons"
    lesson ||--o{ lesson_completion : "completed by"
    profile ||--o{ lesson_completion : "tracks progress"
```

**Key insight for paid enrollment:**
- A student is enrolled by adding a row to `groupmember` (linking their `profile_id` to the course's `group_id`).
- The `course` table already has `cost` (bigint) and `currency` columns — the price data is already there.
- Right now there is no payment verification gate before inserting a `groupmember` row.

---

## 5. Existing Enrollment Flow (Free)

```mermaid
sequenceDiagram
    actor Student
    participant CourseApp as course-app (UI)
    participant Supabase

    Student->>CourseApp: Opens course page
    CourseApp->>Supabase: Check groupmember row
    alt Not enrolled
        Student->>CourseApp: Clicks "Enroll"
        CourseApp->>Supabase: INSERT groupmember
        Supabase-->>CourseApp: OK
        CourseApp-->>Student: Access granted
    else Already enrolled
        CourseApp-->>Student: Show course content
    end
```

---

## 6. Existing Payment Infrastructure (Org Plans)

ClassroomIO already bills **organisations** for platform subscriptions via Polar:

```mermaid
graph TD
    OrgAdmin["Org Admin"]
    Dashboard["dashboard/\nBilling UI"]
    PolarAPI["Polar API\n(external)"]
    Webhook["dashboard/api/polar/webhook"]
    DB[("organization_plan\ntable")]

    OrgAdmin -->|"clicks Subscribe"| Dashboard
    Dashboard -->|"redirect to checkout"| PolarAPI
    PolarAPI -->|"payment success"| Webhook
    Webhook -->|"UPSERT plan row"| DB
```

This is **organisation-level billing** (who can use the platform). The new feature is **course-level billing** (students paying per course).

---

## 7. Proposed Feature: Charge Students on Enroll

### 7.1 Goal

When a course has `cost > 0`, a student must successfully pay before a `groupmember` row is created and they gain access to lessons.

### 7.2 High-Level Architecture

```mermaid
graph LR
    Student["Student (browser)"]
    CourseApp["course-app\n(SvelteKit)"]
    DashAPI["dashboard\n/api/course-payment/*"]
    Polar["Polar\n(one-time payment)"]
    Webhook["dashboard\n/api/polar/course-webhook"]
    DB[("Supabase\ngroupmember\ncourse_payment")]

    Student -->|"Enroll click"| CourseApp
    CourseApp -->|"POST create-checkout"| DashAPI
    DashAPI -->|"create one-time product"| Polar
    Polar -->|"redirect to checkout URL"| Student
    Student -->|"pays on Polar"| Polar
    Polar -->|"payment.success webhook"| Webhook
    Webhook -->|"INSERT groupmember"| DB
    Webhook -->|"INSERT course_payment"| DB
    CourseApp -->|"poll / redirect back"| CourseApp
    CourseApp -->|"check enrollment"| DB
```

### 7.3 New Database Table

A new migration will add a `course_payment` table to record what was paid, by whom, and when.

```mermaid
erDiagram
    course_payment {
        uuid id PK
        uuid course_id FK
        uuid profile_id FK
        bigint amount_paid
        text currency
        text provider
        text provider_payment_id
        text status
        timestamptz created_at
    }

    course ||--o{ course_payment : "paid for by"
    profile ||--o{ course_payment : "made payment"
```

---

## 8. Development Plan

### Phase 1 — Database Migration

**Goal:** Add `course_payment` table and tighten the `groupmember` insert RLS policy for paid courses.

| Step | File to create / edit | What to do |
|------|-----------------------|------------|
| 1.1 | `supabase/migrations/<timestamp>_course_payment.sql` | Create `course_payment` table with columns above |
| 1.2 | Same migration | Add RLS: only the paying user or org admins can read their own payment rows |
| 1.3 | `supabase/migrations/<timestamp>_course_payment.sql` | Tighten `groupmember` insert policy: block direct inserts for paid courses (enrollment must go through webhook) |

```mermaid
flowchart TD
    A["Write SQL migration file"] --> B["supabase db push / supabase migration up"]
    B --> C["Verify table in Supabase Studio"]
    C --> D["Write RLS policies"]
    D --> E["Test with supabase test helpers"]
```

---

### Phase 2 — Polar One-Time Payment Integration

**Goal:** Allow a teacher to set a price on a course and generate a Polar one-time checkout for students.

| Step | File to create / edit | What to do |
|------|-----------------------|------------|
| 2.1 | `apps/dashboard/src/routes/api/course-payment/checkout/+server.ts` | New SvelteKit server route. Accepts `course_id` + `student_email`. Calls Polar API to create a one-time product/checkout. Returns `checkout_url`. |
| 2.2 | `apps/course-app/src/routes/[course]/+page.svelte` | On "Enroll" click for paid courses, POST to the checkout route, then redirect student to `checkout_url`. |
| 2.3 | `apps/dashboard/src/routes/api/polar/course-webhook/+server.ts` | New webhook handler. Validates Polar signature. On `payment.succeeded`: insert `course_payment` row, then insert `groupmember` row to enroll the student. |

```mermaid
sequenceDiagram
    actor Student
    participant CourseApp as course-app
    participant DashAPI as dashboard API
    participant Polar
    participant Webhook as polar webhook handler
    participant DB as Supabase

    Student->>CourseApp: Click "Enroll" (course has cost > 0)
    CourseApp->>DashAPI: POST /api/course-payment/checkout\n{course_id, student_email}
    DashAPI->>Polar: Create one-time checkout\n(price, metadata: course_id + profile_id)
    Polar-->>DashAPI: { checkout_url }
    DashAPI-->>CourseApp: { checkout_url }
    CourseApp->>Student: Redirect to Polar checkout page
    Student->>Polar: Fills card, pays
    Polar->>Webhook: POST payment.succeeded\n(metadata: course_id, profile_id)
    Webhook->>Webhook: Verify Polar signature
    Webhook->>DB: INSERT course_payment
    Webhook->>DB: INSERT groupmember
    Webhook-->>Polar: 200 OK
    Student->>CourseApp: Redirected back (success URL)
    CourseApp->>DB: Check groupmember
    DB-->>CourseApp: Row found → enrolled
    CourseApp-->>Student: Show course content
```

---

### Phase 3 — Teacher UI (Course Pricing)

**Goal:** Let teachers set a price on a course from the dashboard.

| Step | File to create / edit | What to do |
|------|-----------------------|------------|
| 3.1 | `apps/dashboard/src/lib/components/Course/Settings/Pricing.svelte` | New component: currency dropdown + price input. Validates non-negative integer. |
| 3.2 | `apps/dashboard/src/routes/courses/[courseId]/settings/+page.svelte` | Add the Pricing component to the settings page. |
| 3.3 | `apps/dashboard/src/lib/utils/services/courses/index.ts` | Add `updateCoursePrice(courseId, cost, currency)` service function that does a Supabase `update` on the `course` table. |

---

### Phase 4 — Student UI (Enroll Gate)

**Goal:** Show price to student and gate access behind payment.

| Step | File to create / edit | What to do |
|------|-----------------------|------------|
| 4.1 | `apps/course-app/src/lib/components/EnrollButton.svelte` | New component. If `course.cost === 0` → free enroll (existing flow). If `cost > 0` → show price + "Buy & Enroll" button that triggers checkout. |
| 4.2 | `apps/course-app/src/routes/[course]/+page.server.ts` | Load `course.cost` and check `course_payment` status for the current user; pass to page. |
| 4.3 | `apps/course-app/src/routes/[course]/enroll-success/+page.svelte` | Landing page after Polar redirects back. Shows "Enrollment confirmed" and links to first lesson. |

---

### Phase 5 — Teacher Earnings Dashboard

**Goal:** Show teachers how much revenue each course has generated.

| Step | File to create / edit | What to do |
|------|-----------------------|------------|
| 5.1 | `supabase/migrations/<timestamp>_course_payment_rpc.sql` | Add Postgres RPC function `get_course_revenue(org_id)` that returns aggregated totals per course. |
| 5.2 | `apps/dashboard/src/routes/courses/[courseId]/analytics/+page.svelte` | Add a "Revenue" section that calls the RPC and renders a summary table. |

---

## 9. Files to Touch — Summary

```mermaid
graph TD
    subgraph "Phase 1 · DB"
        M1["supabase/migrations/\n*_course_payment.sql"]
    end
    subgraph "Phase 2 · Payment API"
        A1["dashboard/api/course-payment/\ncheckout/+server.ts"]
        A2["dashboard/api/polar/\ncourse-webhook/+server.ts"]
        A3["course-app/routes/course/\n+page.svelte  ← trigger checkout"]
    end
    subgraph "Phase 3 · Teacher UI"
        B1["dashboard/components/Course/\nSettings/Pricing.svelte"]
        B2["dashboard/services/courses/\nindex.ts  ← updateCoursePrice"]
    end
    subgraph "Phase 4 · Student UI"
        C1["course-app/components/\nEnrollButton.svelte"]
        C2["course-app/routes/course/\n+page.server.ts"]
        C3["course-app/routes/course/\nenroll-success/+page.svelte"]
    end
    subgraph "Phase 5 · Analytics"
        D1["supabase/migrations/\n*_course_payment_rpc.sql"]
        D2["dashboard/routes/courses/\n[id]/analytics/+page.svelte"]
    end

    M1 --> A1
    M1 --> A2
    A1 --> A3
    A2 --> C1
    B2 --> B1
    B1 --> B2
    C2 --> C1
    D1 --> D2
```

---

## 10. Recommended Implementation Order

```mermaid
gantt
    title Paid Enrollment — Implementation Phases
    dateFormat  YYYY-MM-DD
    section Phase 1 · DB
    Migration: course_payment table   :p1, 2026-05-15, 2d
    RLS policies                      :p1b, after p1, 1d
    section Phase 2 · Payment API
    Checkout server route             :p2a, after p1b, 2d
    Polar webhook handler             :p2b, after p2a, 2d
    section Phase 3 · Teacher UI
    Pricing component + service fn    :p3, after p2b, 2d
    section Phase 4 · Student UI
    EnrollButton + page.server.ts     :p4, after p3, 2d
    Enroll-success page               :p4b, after p4, 1d
    section Phase 5 · Analytics
    RPC + dashboard widget            :p5, after p4b, 2d
```

---

## 11. Key Things to Know Before You Start

1. **SvelteKit routing** — files named `+page.svelte` are UI pages; `+page.server.ts` runs only on the server (safe for DB calls); `+server.ts` files are REST API endpoints.
2. **Supabase RLS** — Row-Level Security policies run inside Postgres. Always test that a student can't bypass payment by calling the Supabase client directly.
3. **Polar webhooks** — Polar sends signed HTTP POSTs to your webhook URL. You must verify the `polar-signature` header before trusting the payload. The existing `/api/polar/webhook` handler shows how to do this.
4. **Environment variables** — Polar API keys and webhook secrets live in `.env` files (never commit these). Look at existing `/api/polar/*` routes for the variable names already in use.
5. **`course.cost`** — stored as a **bigint in minor currency units** (cents, not dollars). A course priced at $29.99 is stored as `2999`.
