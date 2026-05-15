# Database Schema

Source: local Supabase Postgres. Generated: 2026-05-15T07:42:37Z

## Internal Supabase schemas

`_realtime`, `auth`, `extensions`, `graphql`, `graphql_public`, `net`, `pgbouncer`, `realtime`, `storage`, `supabase_functions`, `supabase_migrations`, `vault` — managed by Supabase; not modified by ClassroomIO migrations. Key external reference: `auth.users(id)` is the identity anchor for `public.profile(id)`.

## Schema: public

Core hierarchy: `organization` → `group` → `course` → `lesson` → `exercise` → `question`. Users exist as `profile` (auth identity) and as role-scoped members via `organizationmember` (org-level) and `groupmember` (course-level).

**Timestamps key:** `c+u` = created_at + updated_at · `c` = created_at only · `u` = updated_at only · `—` = neither

### Reference tables

| Table | PK | Key columns | Timestamps |
|-------|----|-------------|:----------:|
| `role` | id (int8) | type ('TEACHER', 'STUDENT', 'TUTOR'), description | c+u |
| `question_type` | id (int8) | label, typename | c+u |
| `submissionstatus` | id (int8) | label | u |
| `currency` | id (int8) | name | c |

### Core entities

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `profile` | id (uuid) | fullname, email, is_email_verified, locale (LOCALE), is_restricted | — | c+u |
| `organization` | id (uuid) | name, siteName, customDomain, is_restricted, customization (json) | — | c |
| `group` | id (uuid) | name | organization_id → organization | c+u |
| `course` | id (uuid) | title, description, is_published, status, type (COURSE_TYPE), version (COURSE_VERSION), cost, currency | group_id → group | c+u |
| `lesson_section` | id (uuid) | title, order | course_id → course | c+u |
| `lesson` | id (uuid) | title, is_complete, is_unlocked, order, lesson_at, videos (jsonb), documents (jsonb), call_url | course_id → course, section_id → lesson_section, teacher_id → profile | c+u |
| `exercise` | id (uuid) | title, description, due_by | lesson_id → lesson | c+u |
| `question` | id (int8) | title, points, order | exercise_id → exercise, question_type_id → question_type | c+u |
| `option` | id (int8) | label, is_correct, value (uuid) | question_id → question | c+u |

### Membership & access

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `organizationmember` | id (int8) | email, verified | organization_id → organization, profile_id → profile, role_id → role | c |
| `groupmember` | id (uuid) | email, assigned_student_id | group_id → group, profile_id → profile, role_id → role | c |
| `organization_plan` | id (int8) | plan_name (PLAN), is_active, provider, subscription_id, activated_at, deactivated_at | org_id → organization, triggered_by → organizationmember | u |

### Learning activity

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `submission` | id (uuid) | total, feedback | exercise_id → exercise, submitted_by → groupmember, course_id → course, status_id → submissionstatus | c+u |
| `question_answer` | id (int8) | answers (_varchar), open_answer, point | question_id → question, group_member_id → groupmember, submission_id → submission | — |
| `lesson_completion` | id (int8) | is_complete | lesson_id → lesson, profile_id → profile | c+u |
| `lesson_comment` | id (int8) | comment | lesson_id → lesson, groupmember_id → groupmember | c+u |
| `lesson_language` | id (int8) | content, locale (LOCALE) | lesson_id → lesson | — |
| `lesson_language_history` | id (int4) | old_content, new_content, timestamp | lesson_language_id → lesson_language | — |
| `group_attendance` | id (int8) | is_present, lesson_id | course_id → course, student_id → groupmember | c+u |

### Community & feeds

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `community_question` | id (int8) | title, body, votes, slug | organization_id → organization, course_id → course, author_id → organizationmember, author_profile_id → profile | c |
| `community_answer` | id (uuid) | body, votes | question_id → community_question, author_id → organizationmember, author_profile_id → profile | c |
| `course_newsfeed` | id (uuid) | content, is_pinned, reaction (jsonb) | course_id → course, author_id → groupmember | c |
| `course_newsfeed_comment` | id (int8) | content | course_newsfeed_id → course_newsfeed, author_id → groupmember | c+u |
| `apps_poll` | id (uuid) | question, status, expiration | courseId → course, authorId → groupmember | c+u |
| `apps_poll_option` | id (int8) | label | poll_id → apps_poll | c |
| `apps_poll_submission` | id (int8) | — | poll_id → apps_poll, poll_option_id → apps_poll_option, selected_by_id → groupmember | c |

### Quiz

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `quiz` | id (uuid) | title, questions (json), timelimit, theme | organization_id → organization | c+u |
| `quiz_play` | id (int8) | started, currentQuestionId, step, studentStep, pin | quiz_id → quiz | c+u |

### Auth & misc

| Table | PK | Key columns | Foreign keys | Timestamps |
|-------|----|-------------|--------------|:----------:|
| `email_verification_tokens` | id (uuid) | token, email, expires_at, used_at | profile_id → profile | c |
| `analytics_login_events` | id (uuid) | user_id, logged_in_at | — | — |
| `organization_contacts` | id (int8) | email, phone, name, message | organization_id → organization | c |
| `organization_emaillist` | id (int8) | email | organization_id → organization | c |
| `video_transcripts` | id (int8) | muse_svid, transcript, downloaded, link | — | c |
| `waitinglist` | id (int8) | email | — | c |
