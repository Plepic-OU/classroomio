# Database schema (local Supabase)

Source: extracted from `supabase_db_classroomio` via `docker exec psql` (no DDL — column types,
nullability, defaults, primary keys and foreign keys only). Internal Supabase
schemas (`auth`, `storage`, `realtime`, `vault`, etc.) are omitted; they
are framework-managed and stable.

Legend:
- `PK` — primary key column
- `FK → schema.table.column` — foreign key reference
- `NN` — NOT NULL
- `(default …)` — column default

## Schema: `public`

### `analytics_login_events`

- `id` uuid NN PK (default uuid_generate_v4())
- `user_id` uuid NN FK → auth.users.id
- `logged_in_at` timestamp with time zone NN

### `apps_poll`

- `id` uuid NN PK (default gen_random_uuid())
- `created_at` timestamp with time zone NN (default now())
- `updated_at` timestamp with time zone NN
- `question` text
- `authorId` uuid FK → public.groupmember.id
- `isPublic` boolean
- `status` character varying NN
- `expiration` timestamp with time zone
- `courseId` uuid FK → public.course.id

### `apps_poll_option`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `updated_at` timestamp with time zone
- `poll_id` uuid FK → public.apps_poll.id
- `label` character varying

### `apps_poll_submission`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `poll_option_id` bigint FK → public.apps_poll_option.id
- `selected_by_id` uuid FK → public.groupmember.id
- `poll_id` uuid FK → public.apps_poll.id

### `community_answer`

- `id` uuid NN PK (default extensions.gen_random_uuid())
- `created_at` timestamp with time zone NN
- `question_id` bigint FK → public.community_question.id
- `body` character varying
- `author_id` bigint FK → public.organizationmember.id
- `votes` bigint
- `author_profile_id` uuid FK → public.profile.id

### `community_question`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN
- `title` character varying
- `body` text
- `author_id` bigint FK → public.organizationmember.id
- `votes` bigint NN
- `organization_id` uuid FK → public.organization.id
- `slug` text
- `author_profile_id` uuid FK → public.profile.id
- `course_id` uuid NN FK → public.course.id

### `course`

- `title` character varying NN
- `description` character varying NN
- `overview` character varying NN
- `id` uuid NN PK (default uuid_generate_v4())
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `group_id` uuid FK → public.group.id
- `is_template` boolean NN
- `logo` text NN (default ''::text)
- `slug` character varying
- `metadata` jsonb NN (default '{"goals": "", "description": "", "requirements": ""}'::jsonb)
- `cost` bigint NN
- `currency` character varying NN (default 'USD'::character varying)
- `banner_image` text
- `is_published` boolean NN
- `is_certificate_downloadable` boolean NN
- `certificate_theme` text
- `status` text NN (default 'ACTIVE'::text)
- `type` "COURSE_TYPE" NN
- `version` "COURSE_VERSION" NN (default 'V1'::"COURSE_VERSION")

### `course_newsfeed`

- `created_at` timestamp with time zone NN (default now())
- `author_id` uuid FK → public.groupmember.id
- `content` text
- `id` uuid NN PK (default gen_random_uuid())
- `course_id` uuid FK → public.course.id
- `reaction` jsonb NN
- `is_pinned` boolean NN (default false)

### `course_newsfeed_comment`

- `created_at` timestamp with time zone NN (default now())
- `author_id` uuid FK → public.groupmember.id
- `content` text
- `id` bigint NN PK
- `course_newsfeed_id` uuid FK → public.course_newsfeed.id

### `currency`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN
- `name` character varying

### `email_verification_tokens`

- `id` uuid NN PK (default gen_random_uuid())
- `profile_id` uuid FK → public.profile.id
- `token` text NN
- `email` text NN
- `created_at` timestamp with time zone NN
- `expires_at` timestamp with time zone NN
- `used_at` timestamp with time zone
- `created_by_ip` inet
- `used_by_ip` inet

### `exercise`

- `title` character varying NN
- `description` character varying
- `lesson_id` uuid FK → public.lesson.id
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `id` uuid NN PK (default uuid_generate_v4())
- `due_by` timestamp without time zone

### `group`

- `id` uuid NN PK (default uuid_generate_v4())
- `name` character varying NN
- `description` text
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `organization_id` uuid FK → public.organization.id

### `group_attendance`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `course_id` uuid FK → public.course.id
- `student_id` uuid FK → public.groupmember.id
- `is_present` boolean NN
- `lesson_id` uuid NN

### `groupmember`

- `id` uuid NN PK (default uuid_generate_v4())
- `group_id` uuid NN FK → public.group.id
- `role_id` bigint NN FK → public.role.id
- `profile_id` uuid FK → public.profile.id
- `email` character varying
- `created_at` timestamp with time zone NN
- `assigned_student_id` character varying

### `lesson`

- `note` character varying
- `video_url` character varying
- `slide_url` character varying
- `course_id` uuid NN FK → public.course.id
- `id` uuid NN PK (default uuid_generate_v4())
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `title` character varying NN
- `public` boolean NN
- `lesson_at` timestamp with time zone NN
- `teacher_id` uuid FK → public.profile.id
- `is_complete` boolean NN
- `call_url` text
- `order` bigint
- `is_unlocked` boolean NN
- `videos` jsonb NN
- `section_id` uuid FK → public.lesson_section.id
- `documents` jsonb NN

### `lesson_comment`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `updated_at` timestamp with time zone NN
- `lesson_id` uuid FK → public.lesson.id
- `groupmember_id` uuid FK → public.groupmember.id
- `comment` text

### `lesson_completion`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `lesson_id` uuid FK → public.lesson.id
- `profile_id` uuid FK → public.profile.id
- `is_complete` boolean NN
- `updated_at` timestamp with time zone NN

### `lesson_language`

- `id` bigint NN PK
- `content` text
- `lesson_id` uuid NN FK → public.lesson.id
- `locale` "LOCALE" NN

### `lesson_language_history`

- `id` integer NN PK (default nextval('lesson_language_history_id_seq'::regclass))
- `lesson_language_id` integer FK → public.lesson_language.id
- `old_content` text
- `new_content` text
- `timestamp` timestamp without time zone NN (default CURRENT_TIMESTAMP)

### `lesson_section`

- `id` uuid NN PK (default gen_random_uuid())
- `created_at` timestamp with time zone NN (default now())
- `updated_at` timestamp with time zone NN
- `title` character varying
- `order` bigint NN
- `course_id` uuid FK → public.course.id

### `option`

- `id` bigint NN PK
- `label` character varying NN
- `is_correct` boolean NN (default false)
- `question_id` bigint NN FK → public.question.id
- `value` uuid NN
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN

### `organization`

- `id` uuid NN PK (default uuid_generate_v4())
- `name` character varying NN
- `siteName` text
- `avatar_url` text
- `settings` jsonb NN
- `landingpage` jsonb NN
- `theme` text
- `created_at` timestamp with time zone NN (default timezone('utc'::text, now()))
- `customization` json NN (default '{"apps":{"poll":true,"comments":true},"course":{"grading":true,"newsfeed":true},"dashboard":{"exercise":true,"community":true,"bannerText":"","bannerImage":""}}'::json)
- `is_restricted` boolean NN (default false)
- `customCode` text
- `customDomain` text
- `favicon` text
- `isCustomDomainVerified` boolean NN

### `organization_contacts`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `email` text
- `phone` text
- `name` text
- `message` text
- `organization_id` uuid FK → public.organization.id

### `organization_emaillist`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `email` text
- `organization_id` uuid FK → public.organization.id

### `organization_plan`

- `id` bigint NN PK
- `activated_at` timestamp with time zone NN (default now())
- `org_id` uuid FK → public.organization.id
- `plan_name` "PLAN"
- `is_active` boolean
- `deactivated_at` timestamp with time zone
- `updated_at` timestamp with time zone NN
- `payload` jsonb
- `triggered_by` bigint FK → public.organizationmember.id
- `provider` text NN
- `subscription_id` text

### `organizationmember`

- `id` bigint NN PK
- `organization_id` uuid NN FK → public.organization.id
- `role_id` bigint NN FK → public.role.id
- `profile_id` uuid FK → public.profile.id
- `email` text
- `verified` boolean NN
- `created_at` timestamp with time zone NN (default timezone('utc'::text, now()))

### `profile`

- `id` uuid NN PK FK → auth.users.id
- `fullname` text NN
- `username` text NN
- `avatar_url` text NN
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `email` character varying
- `can_add_course` boolean NN
- `role` character varying
- `goal` character varying
- `source` character varying
- `metadata` json
- `telegram_chat_id` bigint
- `is_email_verified` boolean NN
- `verified_at` timestamp with time zone
- `locale` "LOCALE" NN
- `is_restricted` boolean NN (default false)

### `question`

- `id` bigint NN PK
- `question_type_id` bigint NN FK → public.question_type.id
- `title` character varying NN
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `exercise_id` uuid NN FK → public.exercise.id
- `name` uuid NN
- `points` double precision
- `order` bigint

### `question_answer`

- `id` bigint NN PK
- `answers` character varying[]
- `question_id` bigint NN FK → public.question.id
- `open_answer` text
- `group_member_id` uuid NN FK → public.groupmember.id
- `submission_id` uuid FK → public.submission.id
- `point` bigint NN

### `question_type`

- `id` bigint NN PK
- `label` character varying NN
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `typename` character varying

### `quiz`

- `id` uuid NN PK (default extensions.gen_random_uuid())
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `title` text
- `questions` json
- `timelimit` character varying NN
- `theme` character varying NN
- `organization_id` uuid NN FK → public.organization.id

### `quiz_play`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `quiz_id` uuid FK → public.quiz.id
- `players` json NN
- `started` boolean NN
- `currentQuestionId` bigint NN
- `showCurrentQuestionAnswer` boolean NN
- `isLastQuestion` boolean
- `step` text NN
- `studentStep` text NN
- `pin` text

### `role`

- `type` character varying NN
- `description` character varying
- `id` bigint NN PK
- `updated_at` timestamp with time zone NN
- `created_at` timestamp with time zone NN

### `submission`

- `id` uuid NN PK (default uuid_generate_v4())
- `reviewer_id` bigint
- `status_id` bigint NN FK → public.submissionstatus.id
- `total` bigint NN
- `created_at` timestamp with time zone NN
- `updated_at` timestamp with time zone NN
- `exercise_id` uuid NN FK → public.exercise.id
- `submitted_by` uuid FK → public.groupmember.id
- `course_id` uuid FK → public.course.id
- `feedback` text

### `submissionstatus`

- `id` bigint NN PK
- `label` character varying NN
- `updated_at` timestamp with time zone NN

### `test_tenant`

- `id` integer NN PK (default nextval('test_tenant_id_seq'::regclass))
- `details` text

### `video_transcripts`

- `id` bigint NN PK
- `created_at` timestamp with time zone NN (default now())
- `muse_svid` text
- `transcript` text
- `downloaded` boolean NN
- `link` text

### `waitinglist`

- `id` bigint NN PK
- `email` character varying NN
- `created_at` timestamp with time zone NN

