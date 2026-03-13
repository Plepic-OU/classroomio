# Database Schema

_Extracted from local Supabase on 2026-03-13. Re-run `db-schema.sh` to refresh._

## Tables

### `apps_poll`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `authorId` | `uuid` | YES | → `groupmember(id)` |
| `courseId` | `uuid` | YES | → `course(id)` |

### `apps_poll_option`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `poll_id` | `uuid` | YES | → `apps_poll(id)` |
| `label` | `text` | YES | |

### `apps_poll_submission`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `poll_id` | `uuid` | YES | → `apps_poll(id)` |
| `poll_option_id` | `uuid` | YES | → `apps_poll_option(id)` |
| `selected_by_id` | `uuid` | YES | → `groupmember(id)` |

### `community_answer`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `content` | `text` | YES | |
| `author_id` | `uuid` | YES | → `organizationmember(id)` |
| `author_profile_id` | `uuid` | YES | → `profile(id)` |
| `question_id` | `uuid` | YES | → `community_question(id)` |
| `is_correct` | `bool` | YES | |
| `upvotes` | `int4` | YES | |

### `community_question`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `content` | `text` | YES | |
| `author_id` | `uuid` | YES | → `organizationmember(id)` |
| `author_profile_id` | `uuid` | YES | → `profile(id)` |
| `course_id` | `uuid` | YES | → `course(id)` |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `votes` | `int4` | YES | |

### `course`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `description` | `text` | YES | |
| `logo` | `text` | YES | |
| `group_id` | `uuid` | YES | → `group(id)` |
| `type` | `COURSE_TYPE` | YES | |
| `cost` | `float8` | YES | |
| `currency` | `text` | YES | |
| `is_published` | `bool` | YES | |
| `metadata` | `jsonb` | YES | |
| `version` | `COURSE_VERSION` | YES | |

### `course_newsfeed`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `content` | `text` | YES | |
| `author_id` | `uuid` | YES | → `groupmember(id)` |
| `course_id` | `uuid` | YES | → `course(id)` |
| `is_pinned` | `bool` | YES | |

### `course_newsfeed_comment`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `content` | `text` | YES | |
| `author_id` | `uuid` | YES | → `groupmember(id)` |
| `course_newsfeed_id` | `uuid` | YES | → `course_newsfeed(id)` |

### `email_verification_tokens`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `profile_id` | `uuid` | YES | → `profile(id)` |
| `token` | `text` | YES | |
| `expires_at` | `timestamptz` | YES | |

### `exercise`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `description` | `text` | YES | |
| `lesson_id` | `uuid` | YES | → `lesson(id)` |
| `due_by` | `timestamptz` | YES | |
| `is_graded` | `bool` | YES | |
| `metadata` | `jsonb` | YES | |

### `group`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `name` | `text` | YES | |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `description` | `text` | YES | |
| `logo` | `text` | YES | |
| `slug` | `text` | YES | |

### `group_attendance`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `course_id` | `uuid` | YES | → `course(id)` |
| `student_id` | `uuid` | YES | → `groupmember(id)` |
| `is_present` | `bool` | YES | |
| `attended_at` | `timestamptz` | YES | |

### `groupmember`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `group_id` | `uuid` | YES | → `group(id)` |
| `profile_id` | `uuid` | YES | → `profile(id)` |
| `role_id` | `int4` | YES | → `role(id)` |

### `lesson`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `content` | `text` | YES | |
| `course_id` | `uuid` | YES | → `course(id)` |
| `section_id` | `uuid` | YES | → `lesson_section(id)` |
| `teacher_id` | `uuid` | YES | → `profile(id)` |
| `order` | `int4` | YES | |
| `is_visible` | `bool` | YES | |
| `metadata` | `jsonb` | YES | |

### `lesson_comment`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `content` | `text` | YES | |
| `groupmember_id` | `uuid` | YES | → `groupmember(id)` |
| `lesson_id` | `uuid` | YES | → `lesson(id)` |

### `lesson_completion`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `lesson_id` | `uuid` | YES | → `lesson(id)` |
| `profile_id` | `uuid` | YES | → `profile(id)` |

### `lesson_language`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `lesson_id` | `uuid` | YES | → `lesson(id)` |
| `locale` | `LOCALE` | YES | |
| `title` | `text` | YES | |
| `content` | `text` | YES | |

### `lesson_language_history`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `lesson_language_id` | `uuid` | YES | → `lesson_language(id)` |
| `content` | `text` | YES | |

### `lesson_section`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `course_id` | `uuid` | YES | → `course(id)` |
| `order` | `int4` | YES | |

### `option`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `label` | `text` | YES | |
| `question_id` | `uuid` | YES | → `question(id)` |
| `is_correct` | `bool` | YES | |
| `order` | `int4` | YES | |

### `organization`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `name` | `text` | YES | |
| `description` | `text` | YES | |
| `logo` | `text` | YES | |
| `slug` | `text` | YES | |
| `website` | `text` | YES | |
| `metadata` | `jsonb` | YES | |

### `organization_contacts`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `name` | `text` | YES | |
| `email` | `text` | YES | |

### `organization_emaillist`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `email` | `text` | YES | |

### `organization_plan`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `org_id` | `uuid` | YES | → `organization(id)` |
| `plan` | `PLAN` | YES | |
| `is_active` | `bool` | YES | |
| `triggered_by` | `uuid` | YES | → `organizationmember(id)` |
| `expires_at` | `timestamptz` | YES | |

### `organizationmember`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `profile_id` | `uuid` | YES | → `profile(id)` |
| `role_id` | `int4` | YES | → `role(id)` |
| `verified` | `bool` | YES | |

### `profile`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK |
| `created_at` | `timestamptz` | YES | |
| `fullname` | `text` | YES | |
| `email` | `text` | YES | |
| `avatar_url` | `text` | YES | |
| `locale` | `LOCALE` | YES | |

### `question`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `exercise_id` | `uuid` | YES | → `exercise(id)` |
| `question_type_id` | `int4` | YES | → `question_type(id)` |
| `order` | `int4` | YES | |
| `points` | `int4` | YES | |

### `question_answer`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `group_member_id` | `uuid` | YES | → `groupmember(id)` |
| `question_id` | `uuid` | YES | → `question(id)` |
| `submission_id` | `uuid` | YES | → `submission(id)` |
| `answers` | `jsonb` | YES | |
| `point` | `float8` | YES | |

### `question_type`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `int4` | NO | PK |
| `label` | `text` | YES | |

### `quiz`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `title` | `text` | YES | |
| `organization_id` | `uuid` | YES | → `organization(id)` |
| `questions` | `jsonb` | YES | |
| `is_published` | `bool` | YES | |

### `quiz_play`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `quiz_id` | `uuid` | YES | → `quiz(id)` |
| `answers` | `jsonb` | YES | |
| `score` | `float8` | YES | |

### `role`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `int4` | NO | PK |
| `label` | `text` | YES | |

### `submission`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | PK, auto |
| `created_at` | `timestamptz` | YES | |
| `course_id` | `uuid` | YES | → `course(id)` |
| `exercise_id` | `uuid` | YES | → `exercise(id)` |
| `status_id` | `int4` | YES | → `submissionstatus(id)` |
| `submitted_by` | `uuid` | YES | → `groupmember(id)` |
| `metadata` | `jsonb` | YES | |

### `submissionstatus`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `int4` | NO | PK |
| `label` | `text` | YES | |

## Enums

**`COURSE_TYPE`**: `SELF_PACED`, `LIVE_CLASS`
**`COURSE_VERSION`**: `V1`, `V2`
**`LOCALE`**: `en`, `hi`, `fr`, `pt`, `de`, `vi`, `ru`, `es`, `pl`, `da`
**`PLAN`**: `EARLY_ADOPTER`, `ENTERPRISE`, `BASIC`
