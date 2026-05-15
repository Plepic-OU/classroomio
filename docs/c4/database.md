# ClassroomIO Database Schema

_Extracted from local Supabase on 2026-05-15_

## Tables

### `analytics_login_events`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `user_id` | `uuid` | NO | `` |
| `logged_in_at` | `timestamptz` | YES | `now()` |

### `apps_poll`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `question` | `text` | YES | `` |
| `authorId` | `uuid` | YES | `` |
| `isPublic` | `boolean` | YES | `` |
| `status` | `varchar` | YES | `'draft'::character varying` |
| `expiration` | `timestamptz` | YES | `` |
| `courseId` | `uuid` | YES | `` |

### `apps_poll_option`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | YES | `` |
| `poll_id` | `uuid` | YES | `` |
| `label` | `varchar` | YES | `` |

### `apps_poll_submission`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `poll_option_id` | `bigint` | YES | `` |
| `selected_by_id` | `uuid` | YES | `` |
| `poll_id` | `uuid` | YES | `` |

### `community_answer`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `extensions.gen_random_uuid()` |
| `created_at` | `timestamptz` | YES | `now()` |
| `question_id` | `bigint` | YES | `` |
| `body` | `varchar` | YES | `` |
| `author_id` | `bigint` | YES | `` |
| `votes` | `bigint` | YES | `` |
| `author_profile_id` | `uuid` | YES | `` |

### `community_question`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `title` | `varchar` | YES | `` |
| `body` | `text` | YES | `` |
| `author_id` | `bigint` | YES | `` |
| `votes` | `bigint` | YES | `'0'::bigint` |
| `organization_id` | `uuid` | YES | `` |
| `slug` | `text` | YES | `` |
| `author_profile_id` | `uuid` | YES | `` |
| `course_id` | `uuid` | NO | `` |

### `course`

| column | type | null | default |
|--------|------|------|---------|
| `title` | `varchar` | NO | `` |
| `description` | `varchar` | NO | `` |
| `overview` | `varchar` | YES | `'Welcome to this amazing course 🚀 '::ch...` |
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `group_id` | `uuid` | YES | `` |
| `is_template` | `boolean` | YES | `true` |
| `logo` | `text` | NO | `''::text` |
| `slug` | `varchar` | YES | `` |
| `metadata` | `jsonb` | NO | `'{"goals": "", "description": "", "require...` |
| `cost` | `bigint` | YES | `'0'::bigint` |
| `currency` | `varchar` | NO | `'USD'::character varying` |
| `banner_image` | `text` | YES | `` |
| `is_published` | `boolean` | YES | `false` |
| `is_certificate_downloadable` | `boolean` | YES | `false` |
| `certificate_theme` | `text` | YES | `` |
| `status` | `text` | NO | `'ACTIVE'::text` |
| `type` | `USER-DEFINED` | YES | `'LIVE_CLASS'::"COURSE_TYPE"` |
| `version` | `USER-DEFINED` | NO | `'V1'::"COURSE_VERSION"` |

### `course_newsfeed`

| column | type | null | default |
|--------|------|------|---------|
| `created_at` | `timestamptz` | NO | `now()` |
| `author_id` | `uuid` | YES | `` |
| `content` | `text` | YES | `` |
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `course_id` | `uuid` | YES | `` |
| `reaction` | `jsonb` | YES | `'{"clap": [], "smile": [], "thumbsup": [],...` |
| `is_pinned` | `boolean` | NO | `false` |

### `course_newsfeed_comment`

| column | type | null | default |
|--------|------|------|---------|
| `created_at` | `timestamptz` | NO | `now()` |
| `author_id` | `uuid` | YES | `` |
| `content` | `text` | YES | `` |
| `id` | `bigint` | NO | `` |
| `course_newsfeed_id` | `uuid` | YES | `` |

### `currency`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `name` | `varchar` | YES | `` |

### `email_verification_tokens`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `profile_id` | `uuid` | YES | `` |
| `token` | `text` | NO | `` |
| `email` | `text` | NO | `` |
| `created_at` | `timestamptz` | YES | `timezone('utc'::text, now())` |
| `expires_at` | `timestamptz` | NO | `` |
| `used_at` | `timestamptz` | YES | `` |
| `created_by_ip` | `inet` | YES | `` |
| `used_by_ip` | `inet` | YES | `` |

### `exercise`

| column | type | null | default |
|--------|------|------|---------|
| `title` | `varchar` | NO | `` |
| `description` | `varchar` | YES | `` |
| `lesson_id` | `uuid` | YES | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `due_by` | `timestamp` | YES | `` |

### `group`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `name` | `varchar` | NO | `` |
| `description` | `text` | YES | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `organization_id` | `uuid` | YES | `` |

### `group_attendance`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `course_id` | `uuid` | YES | `` |
| `student_id` | `uuid` | YES | `` |
| `is_present` | `boolean` | YES | `false` |
| `lesson_id` | `uuid` | NO | `` |

### `groupmember`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `group_id` | `uuid` | NO | `` |
| `role_id` | `bigint` | NO | `` |
| `profile_id` | `uuid` | YES | `` |
| `email` | `varchar` | YES | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `assigned_student_id` | `varchar` | YES | `` |

### `lesson`

| column | type | null | default |
|--------|------|------|---------|
| `note` | `varchar` | YES | `` |
| `video_url` | `varchar` | YES | `` |
| `slide_url` | `varchar` | YES | `` |
| `course_id` | `uuid` | NO | `` |
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `title` | `varchar` | NO | `` |
| `public` | `boolean` | YES | `false` |
| `lesson_at` | `timestamptz` | YES | `now()` |
| `teacher_id` | `uuid` | YES | `` |
| `is_complete` | `boolean` | YES | `false` |
| `call_url` | `text` | YES | `` |
| `order` | `bigint` | YES | `` |
| `is_unlocked` | `boolean` | YES | `false` |
| `videos` | `jsonb` | YES | `'[]'::jsonb` |
| `section_id` | `uuid` | YES | `` |
| `documents` | `jsonb` | YES | `'[]'::jsonb` |

### `lesson_comment`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `lesson_id` | `uuid` | YES | `` |
| `groupmember_id` | `uuid` | YES | `` |
| `comment` | `text` | YES | `` |

### `lesson_completion`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `lesson_id` | `uuid` | YES | `` |
| `profile_id` | `uuid` | YES | `` |
| `is_complete` | `boolean` | YES | `false` |
| `updated_at` | `timestamptz` | YES | `now()` |

### `lesson_language`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `content` | `text` | YES | `` |
| `lesson_id` | `uuid` | YES | `gen_random_uuid()` |
| `locale` | `USER-DEFINED` | YES | `'en'::"LOCALE"` |

### `lesson_language_history`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `integer` | NO | `nextval('lesson_language_history_id_seq'::...` |
| `lesson_language_id` | `integer` | YES | `` |
| `old_content` | `text` | YES | `` |
| `new_content` | `text` | YES | `` |
| `timestamp` | `timestamp` | NO | `CURRENT_TIMESTAMP` |

### `lesson_section`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `title` | `varchar` | YES | `` |
| `order` | `bigint` | YES | `'0'::bigint` |
| `course_id` | `uuid` | YES | `` |

### `option`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `label` | `varchar` | NO | `` |
| `is_correct` | `boolean` | NO | `false` |
| `question_id` | `bigint` | NO | `` |
| `value` | `uuid` | YES | `extensions.gen_random_uuid()` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |

### `organization`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `name` | `varchar` | NO | `` |
| `siteName` | `text` | YES | `` |
| `avatar_url` | `text` | YES | `` |
| `settings` | `jsonb` | YES | `'{}'::jsonb` |
| `landingpage` | `jsonb` | YES | `'{}'::jsonb` |
| `theme` | `text` | YES | `` |
| `created_at` | `timestamptz` | NO | `timezone('utc'::text, now())` |
| `customization` | `json` | NO | `'{"apps":{"poll":true,"comments":true},"co...` |
| `is_restricted` | `boolean` | NO | `false` |
| `customCode` | `text` | YES | `` |
| `customDomain` | `text` | YES | `` |
| `favicon` | `text` | YES | `` |
| `isCustomDomainVerified` | `boolean` | YES | `false` |

### `organization_contacts`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `email` | `text` | YES | `` |
| `phone` | `text` | YES | `` |
| `name` | `text` | YES | `` |
| `message` | `text` | YES | `` |
| `organization_id` | `uuid` | YES | `` |

### `organization_emaillist`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `email` | `text` | YES | `` |
| `organization_id` | `uuid` | YES | `` |

### `organization_plan`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `activated_at` | `timestamptz` | NO | `now()` |
| `org_id` | `uuid` | YES | `` |
| `plan_name` | `USER-DEFINED` | YES | `` |
| `is_active` | `boolean` | YES | `` |
| `deactivated_at` | `timestamptz` | YES | `` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `payload` | `jsonb` | YES | `` |
| `triggered_by` | `bigint` | YES | `` |
| `provider` | `text` | YES | `'lmz'::text` |
| `subscription_id` | `text` | YES | `` |

### `organizationmember`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `organization_id` | `uuid` | NO | `` |
| `role_id` | `bigint` | NO | `` |
| `profile_id` | `uuid` | YES | `` |
| `email` | `text` | YES | `` |
| `verified` | `boolean` | YES | `false` |
| `created_at` | `timestamptz` | NO | `timezone('utc'::text, now())` |

### `profile`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `` |
| `fullname` | `text` | NO | `` |
| `username` | `text` | NO | `` |
| `avatar_url` | `text` | YES | `'https://pgrest.classroomio.com/storage/v1...` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `email` | `varchar` | YES | `` |
| `can_add_course` | `boolean` | YES | `true` |
| `role` | `varchar` | YES | `` |
| `goal` | `varchar` | YES | `` |
| `source` | `varchar` | YES | `` |
| `metadata` | `json` | YES | `` |
| `telegram_chat_id` | `bigint` | YES | `` |
| `is_email_verified` | `boolean` | YES | `false` |
| `verified_at` | `timestamptz` | YES | `` |
| `locale` | `USER-DEFINED` | YES | `'en'::"LOCALE"` |
| `is_restricted` | `boolean` | NO | `false` |

### `question`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `question_type_id` | `bigint` | NO | `` |
| `title` | `varchar` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `exercise_id` | `uuid` | NO | `` |
| `name` | `uuid` | YES | `extensions.gen_random_uuid()` |
| `points` | `float8` | YES | `` |
| `order` | `bigint` | YES | `` |

### `question_answer`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `answers` | `ARRAY` | YES | `` |
| `question_id` | `bigint` | NO | `` |
| `open_answer` | `text` | YES | `` |
| `group_member_id` | `uuid` | NO | `` |
| `submission_id` | `uuid` | YES | `` |
| `point` | `bigint` | YES | `'0'::bigint` |

### `question_type`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `label` | `varchar` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `typename` | `varchar` | YES | `` |

### `quiz`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `extensions.gen_random_uuid()` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `title` | `text` | YES | `` |
| `questions` | `json` | YES | `` |
| `timelimit` | `varchar` | YES | `'10s'::character varying` |
| `theme` | `varchar` | YES | `'standard'::character varying` |
| `organization_id` | `uuid` | NO | `` |

### `quiz_play`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `quiz_id` | `uuid` | YES | `` |
| `players` | `json` | YES | `'[]'::json` |
| `started` | `boolean` | YES | `false` |
| `currentQuestionId` | `bigint` | YES | `'0'::bigint` |
| `showCurrentQuestionAnswer` | `boolean` | YES | `false` |
| `isLastQuestion` | `boolean` | YES | `` |
| `step` | `text` | YES | `'CONNECT_TO_PLAY'::text` |
| `studentStep` | `text` | YES | `'PIN_SETUP'::text` |
| `pin` | `text` | YES | `` |

### `role`

| column | type | null | default |
|--------|------|------|---------|
| `type` | `varchar` | NO | `` |
| `description` | `varchar` | YES | `` |
| `id` | `bigint` | NO | `` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `created_at` | `timestamptz` | YES | `now()` |

### `submission`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `uuid` | NO | `uuid_generate_v4()` |
| `reviewer_id` | `bigint` | YES | `` |
| `status_id` | `bigint` | YES | `'1'::bigint` |
| `total` | `bigint` | YES | `'0'::bigint` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `exercise_id` | `uuid` | NO | `` |
| `submitted_by` | `uuid` | YES | `` |
| `course_id` | `uuid` | YES | `` |
| `feedback` | `text` | YES | `` |

### `submissionstatus`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `label` | `varchar` | NO | `` |
| `updated_at` | `timestamptz` | YES | `now()` |

### `test_tenant`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `integer` | NO | `nextval('test_tenant_id_seq'::regclass)` |
| `details` | `text` | YES | `` |

### `video_transcripts`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `created_at` | `timestamptz` | NO | `now()` |
| `muse_svid` | `text` | YES | `` |
| `transcript` | `text` | YES | `` |
| `downloaded` | `boolean` | YES | `false` |
| `link` | `text` | YES | `` |

### `waitinglist`

| column | type | null | default |
|--------|------|------|---------|
| `id` | `bigint` | NO | `` |
| `email` | `varchar` | NO | `` |
| `created_at` | `timestamptz` | YES | `now()` |

## Foreign Keys

| table | column | → table |
|-------|--------|---------|
| `apps_poll` | `authorId` | `groupmember` |
| `apps_poll` | `courseId` | `course` |
| `apps_poll_option` | `poll_id` | `apps_poll` |
| `apps_poll_submission` | `poll_id` | `apps_poll` |
| `apps_poll_submission` | `poll_option_id` | `apps_poll_option` |
| `apps_poll_submission` | `selected_by_id` | `groupmember` |
| `community_answer` | `author_id` | `organizationmember` |
| `community_answer` | `author_profile_id` | `profile` |
| `community_answer` | `question_id` | `community_question` |
| `community_question` | `author_id` | `organizationmember` |
| `community_question` | `author_profile_id` | `profile` |
| `community_question` | `course_id` | `course` |
| `community_question` | `organization_id` | `organization` |
| `course` | `group_id` | `group` |
| `course_newsfeed` | `author_id` | `groupmember` |
| `course_newsfeed` | `course_id` | `course` |
| `course_newsfeed_comment` | `author_id` | `groupmember` |
| `course_newsfeed_comment` | `course_newsfeed_id` | `course_newsfeed` |
| `email_verification_tokens` | `profile_id` | `profile` |
| `exercise` | `lesson_id` | `lesson` |
| `group` | `organization_id` | `organization` |
| `group_attendance` | `course_id` | `course` |
| `group_attendance` | `student_id` | `groupmember` |
| `groupmember` | `group_id` | `group` |
| `groupmember` | `profile_id` | `profile` |
| `groupmember` | `role_id` | `role` |
| `lesson` | `course_id` | `course` |
| `lesson` | `section_id` | `lesson_section` |
| `lesson` | `teacher_id` | `profile` |
| `lesson_comment` | `groupmember_id` | `groupmember` |
| `lesson_comment` | `lesson_id` | `lesson` |
| `lesson_completion` | `lesson_id` | `lesson` |
| `lesson_completion` | `profile_id` | `profile` |
| `lesson_language` | `lesson_id` | `lesson` |
| `lesson_language_history` | `lesson_language_id` | `lesson_language` |
| `lesson_section` | `course_id` | `course` |
| `option` | `question_id` | `question` |
| `organization_contacts` | `organization_id` | `organization` |
| `organization_emaillist` | `organization_id` | `organization` |
| `organization_plan` | `org_id` | `organization` |
| `organization_plan` | `triggered_by` | `organizationmember` |
| `organizationmember` | `organization_id` | `organization` |
| `organizationmember` | `profile_id` | `profile` |
| `organizationmember` | `role_id` | `role` |
| `question` | `exercise_id` | `exercise` |
| `question` | `question_type_id` | `question_type` |
| `question_answer` | `group_member_id` | `groupmember` |
| `question_answer` | `question_id` | `question` |
| `question_answer` | `submission_id` | `submission` |
| `quiz` | `organization_id` | `organization` |
| `quiz_play` | `quiz_id` | `quiz` |
| `submission` | `course_id` | `course` |
| `submission` | `exercise_id` | `exercise` |
| `submission` | `status_id` | `submissionstatus` |
| `submission` | `submitted_by` | `groupmember` |

## Enum Types

| type | values |
|------|--------|
| `COURSE_TYPE` | SELF_PACED, LIVE_CLASS |
| `COURSE_VERSION` | V1, V2 |
| `LOCALE` | en, hi, fr, pt, de, vi, ru, es, pl, da |
| `PLAN` | EARLY_ADOPTER, ENTERPRISE, BASIC |

