# Database Schema

Reference document for the ClassroomIO Supabase PostgreSQL schema, extracted from local Supabase.

## Logical Groupings

### Authentication & Profiles

| Table | Purpose |
|-------|---------|
| `profile` | User profiles (name, email, avatar, locale, role) |
| `role` | Role definitions (admin, teacher, student) |
| `email_verification_tokens` | Email verification token tracking |
| `analytics_login_events` | Login event audit log |

### Organizations

| Table | Purpose |
|-------|---------|
| `organization` | Organizations with settings, theme, custom domain, landing page config |
| `organizationmember` | Maps profiles to organizations with roles |
| `organization_plan` | Subscription/billing plans per org (Polar/LemonSqueezy) |
| `organization_contacts` | Contact form submissions |
| `organization_emaillist` | Email list subscriptions |

### Courses

| Table | Purpose |
|-------|---------|
| `course` | Courses with title, description, metadata, pricing, certificate config |
| `group` | Course groups within an organization |
| `groupmember` | Maps profiles to groups (course enrollment) with roles |
| `course_newsfeed` | Course announcements/newsfeed posts |
| `course_newsfeed_comment` | Comments on newsfeed posts |

### Lessons

| Table | Purpose |
|-------|---------|
| `lesson` | Lessons within courses — notes, video, slides, documents, ordering |
| `lesson_section` | Lesson sections for organizing lessons within a course |
| `lesson_comment` | Comments on lessons by group members |
| `lesson_completion` | Tracks per-user lesson completion |
| `lesson_language` | Lesson content translations (i18n) |
| `lesson_language_history` | Version history for lesson translations |

### Exercises & Grading

| Table | Purpose |
|-------|---------|
| `exercise` | Exercises linked to lessons |
| `question` | Questions within exercises (multiple types) |
| `question_type` | Question type definitions (checkbox, radio, textarea) |
| `option` | Answer options for questions |
| `question_answer` | Student answers to questions |
| `submission` | Exercise submissions with status, total score, feedback |
| `submissionstatus` | Submission status labels |

### Attendance

| Table | Purpose |
|-------|---------|
| `group_attendance` | Per-lesson attendance records for students |

### Community

| Table | Purpose |
|-------|---------|
| `community_question` | Community forum questions |
| `community_answer` | Answers to community questions |

### Interactive Apps

| Table | Purpose |
|-------|---------|
| `apps_poll` | In-course polls |
| `apps_poll_option` | Poll answer options |
| `apps_poll_submission` | Poll votes |

### Quizzes

| Table | Purpose |
|-------|---------|
| `quiz` | Organization-level quizzes with questions JSON and themes |
| `quiz_play` | Live quiz play sessions with player state |

### Media

| Table | Purpose |
|-------|---------|
| `video_transcripts` | Video transcript storage and download tracking |

### Other

| Table | Purpose |
|-------|---------|
| `currency` | Currency reference data |
| `waitinglist` | Waitlist email signups |
| `test_tenant` | Test/dev tenant data |

## Key Foreign Key Relationships

```
organization ──< group ──< groupmember >── profile
     │                         │
     │                    ┌────┴────┐
     │                    │         │
organization ──< organizationmember >── profile
     │
     ├──< organization_plan
     ├──< organization_contacts
     ├──< organization_emaillist
     ├──< community_question ──< community_answer
     └──< quiz ──< quiz_play

course ──< lesson ──< exercise ──< question ──< option
  │           │           │             │
  │           │           │             └──< question_answer >── groupmember
  │           │           │
  │           │           └──< submission >── groupmember
  │           │
  │           ├──< lesson_comment >── groupmember
  │           ├──< lesson_completion >── profile
  │           ├──< lesson_section
  │           └──< lesson_language ──< lesson_language_history
  │
  ├──< course_newsfeed ──< course_newsfeed_comment
  ├──< group_attendance >── groupmember
  ├──< community_question
  └──< apps_poll ──< apps_poll_option ──< apps_poll_submission
```

## Table Details

### profile
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | — |
| fullname | text | NO | — |
| username | text | NO | — |
| avatar_url | text | YES | default avatar URL |
| email | varchar | YES | — |
| role | varchar | YES | — |
| locale | LOCALE enum | YES | 'en' |
| is_email_verified | boolean | YES | false |
| is_restricted | boolean | NO | false |
| telegram_chat_id | bigint | YES | — |
| created_at / updated_at | timestamptz | YES | now() |

### organization
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | varchar | NO | — |
| siteName | text | YES | — |
| avatar_url | text | YES | — |
| settings | jsonb | YES | '{}' |
| landingpage | jsonb | YES | '{}' |
| theme | text | YES | — |
| customization | json | NO | apps/poll/comments config |
| customDomain | text | YES | — |
| isCustomDomainVerified | boolean | YES | false |
| is_restricted | boolean | NO | false |

### course
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| title | varchar | NO | — |
| description | varchar | NO | — |
| overview | varchar | YES | welcome text |
| slug | varchar | YES | — |
| metadata | jsonb | NO | goals/description/requirements |
| cost | bigint | YES | 0 |
| currency | varchar | NO | 'USD' |
| is_published | boolean | YES | false |
| is_certificate_downloadable | boolean | YES | false |
| certificate_theme | text | YES | — |
| status | text | NO | 'ACTIVE' |
| type | COURSE_TYPE enum | YES | 'LIVE_CLASS' |
| version | COURSE_VERSION enum | NO | 'V1' |
| group_id | uuid (FK → group) | YES | — |

### lesson
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| title | varchar | NO | — |
| note | varchar | YES | — |
| video_url | varchar | YES | — |
| slide_url | varchar | YES | — |
| videos | jsonb | YES | '[]' |
| documents | jsonb | YES | '[]' |
| course_id | uuid (FK → course) | NO | — |
| section_id | uuid (FK → lesson_section) | YES | — |
| teacher_id | uuid (FK → profile) | YES | — |
| order | bigint | YES | — |
| is_unlocked | boolean | YES | false |
| is_complete | boolean | YES | false |
| public | boolean | YES | false |
| lesson_at | timestamptz | YES | now() |

### exercise
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| title | varchar | NO | — |
| description | varchar | YES | — |
| lesson_id | uuid (FK → lesson) | YES | — |
| due_by | timestamp | YES | — |

### submission
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| exercise_id | uuid (FK → exercise) | NO | — |
| submitted_by | uuid (FK → groupmember) | YES | — |
| course_id | uuid (FK → course) | YES | — |
| status_id | bigint (FK → submissionstatus) | YES | 1 |
| total | bigint | YES | 0 |
| feedback | text | YES | — |
| reviewer_id | bigint | YES | — |

## Row-Level Security

All tables have RLS policies enforcing:
- **Profile isolation**: Users can only view/edit their own profile
- **Organization membership**: Most write operations require org membership
- **Course membership**: Newsfeed, attendance, polls, and submissions require course group membership
- **Role-based access**: Admin-only operations for org updates, member management, and deletions
- **Public read access**: Courses (if published), lessons, roles, and question types are publicly readable
