# Database Schema — ClassroomIO (Supabase PostgreSQL)

Token-efficient schema extract for AI context. Public schema only.
Tables: 39

## Enums

- **COURSE_TYPE**: `SELF_PACED`, `LIVE_CLASS`
- **COURSE_VERSION**: `V1`, `V2`
- **LOCALE**: `en`, `hi`, `fr`, `pt`, `de`, `vi`, `ru`, `es`, `pl`, `da`
- **PLAN**: `EARLY_ADOPTER`, `ENTERPRISE`, `BASIC`

## Tables

### analytics_login_events
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **user_id** `uuid` NOT NULL
- **logged_in_at** `timestamp with time zone` default:`now()`

### apps_poll
- **id** `uuid` NOT NULL default:`gen_random_uuid()`
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **question** `text`
- **authorId** `uuid` → `groupmember.id`
- **isPublic** `boolean`
- **status** `character varying` default:`'draft'::character varying`
- **expiration** `timestamp with time zone`
- **courseId** `uuid` → `course.id`

### apps_poll_option
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **updated_at** `timestamp with time zone`
- **poll_id** `uuid` → `apps_poll.id`
- **label** `character varying`

### apps_poll_submission
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **poll_option_id** `bigint` → `apps_poll_option.id`
- **selected_by_id** `uuid` → `groupmember.id`
- **poll_id** `uuid` → `apps_poll.id`

### community_answer
- **id** `uuid` NOT NULL default:`extensions.gen_random_uuid()`
- **created_at** `timestamp with time zone` default:`now()`
- **question_id** `bigint` → `community_question.id`
- **body** `character varying`
- **author_id** `bigint` → `organizationmember.id`
- **votes** `bigint`
- **author_profile_id** `uuid` → `profile.id`

### community_question
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **title** `character varying`
- **body** `text`
- **author_id** `bigint` → `organizationmember.id`
- **votes** `bigint` default:`'0'::bigint`
- **organization_id** `uuid` → `organization.id`
- **slug** `text`
- **author_profile_id** `uuid` → `profile.id`
- **course_id** `uuid` NOT NULL → `course.id`

### course
- **title** `character varying` NOT NULL
- **description** `character varying` NOT NULL
- **overview** `character varying` default:`'Welcome to this amazing course 🚀 '::character varying`
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **group_id** `uuid` → `group.id`
- **is_template** `boolean` default:`true`
- **logo** `text` NOT NULL default:`''::text`
- **slug** `character varying`
- **metadata** `jsonb` NOT NULL default:`'{"goals": "", "description": "", "requirements": ""}'::jsonb`
- **cost** `bigint` default:`'0'::bigint`
- **currency** `character varying` NOT NULL default:`'USD'::character varying`
- **banner_image** `text`
- **is_published** `boolean` default:`false`
- **is_certificate_downloadable** `boolean` default:`false`
- **certificate_theme** `text`
- **status** `text` NOT NULL default:`'ACTIVE'::text`
- **type** `USER-DEFINED` default:`'LIVE_CLASS'::"COURSE_TYPE"`
- **version** `USER-DEFINED` NOT NULL default:`'V1'::"COURSE_VERSION"`

### course_newsfeed
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **author_id** `uuid` → `groupmember.id`
- **content** `text`
- **id** `uuid` NOT NULL default:`gen_random_uuid()`
- **course_id** `uuid` → `course.id`
- **reaction** `jsonb` default:`'{"clap": [], "smile": [], "thumbsup": [], "thumbsdown": []}'::jsonb`
- **is_pinned** `boolean` NOT NULL default:`false`

### course_newsfeed_comment
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **author_id** `uuid` → `groupmember.id`
- **content** `text`
- **id** `bigint` NOT NULL
- **course_newsfeed_id** `uuid` → `course_newsfeed.id`

### currency
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **name** `character varying`

### email_verification_tokens
- **id** `uuid` NOT NULL default:`gen_random_uuid()`
- **profile_id** `uuid` → `profile.id`
- **token** `text` NOT NULL
- **email** `text` NOT NULL
- **created_at** `timestamp with time zone` default:`timezone('utc'::text, now())`
- **expires_at** `timestamp with time zone` NOT NULL
- **used_at** `timestamp with time zone`
- **created_by_ip** `inet`
- **used_by_ip** `inet`

### exercise
- **title** `character varying` NOT NULL
- **description** `character varying`
- **lesson_id** `uuid` → `lesson.id`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **due_by** `timestamp without time zone`

### group
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **name** `character varying` NOT NULL
- **description** `text`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **organization_id** `uuid` → `organization.id`

### group_attendance
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **course_id** `uuid` → `course.id`
- **student_id** `uuid` → `groupmember.id`
- **is_present** `boolean` default:`false`
- **lesson_id** `uuid` NOT NULL

### groupmember
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **group_id** `uuid` NOT NULL → `group.id`
- **role_id** `bigint` NOT NULL → `role.id`
- **profile_id** `uuid` → `profile.id`
- **email** `character varying`
- **created_at** `timestamp with time zone` default:`now()`
- **assigned_student_id** `character varying`

### lesson
- **note** `character varying`
- **video_url** `character varying`
- **slide_url** `character varying`
- **course_id** `uuid` NOT NULL → `course.id`
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **title** `character varying` NOT NULL
- **public** `boolean` default:`false`
- **lesson_at** `timestamp with time zone` default:`now()`
- **teacher_id** `uuid` → `profile.id`
- **is_complete** `boolean` default:`false`
- **call_url** `text`
- **order** `bigint`
- **is_unlocked** `boolean` default:`false`
- **videos** `jsonb` default:`'[]'::jsonb`
- **section_id** `uuid` → `lesson_section.id`
- **documents** `jsonb` default:`'[]'::jsonb`

### lesson_comment
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **lesson_id** `uuid` → `lesson.id`
- **groupmember_id** `uuid` → `groupmember.id`
- **comment** `text`

### lesson_completion
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **lesson_id** `uuid` → `lesson.id`
- **profile_id** `uuid` → `profile.id`
- **is_complete** `boolean` default:`false`
- **updated_at** `timestamp with time zone` default:`now()`

### lesson_language
- **id** `bigint` NOT NULL
- **content** `text`
- **lesson_id** `uuid` → `lesson.id` default:`gen_random_uuid()`
- **locale** `USER-DEFINED` default:`'en'::"LOCALE"`

### lesson_language_history
- **id** `integer` NOT NULL
- **lesson_language_id** `integer` → `lesson_language.id`
- **old_content** `text`
- **new_content** `text`
- **timestamp** `timestamp without time zone` NOT NULL default:`CURRENT_TIMESTAMP`

### lesson_section
- **id** `uuid` NOT NULL default:`gen_random_uuid()`
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **title** `character varying`
- **order** `bigint` default:`'0'::bigint`
- **course_id** `uuid` → `course.id`

### option
- **id** `bigint` NOT NULL
- **label** `character varying` NOT NULL
- **is_correct** `boolean` NOT NULL default:`false`
- **question_id** `bigint` NOT NULL → `question.id`
- **value** `uuid` default:`extensions.gen_random_uuid()`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`

### organization
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **name** `character varying` NOT NULL
- **siteName** `text`
- **avatar_url** `text`
- **settings** `jsonb` default:`'{}'::jsonb`
- **landingpage** `jsonb` default:`'{}'::jsonb`
- **theme** `text`
- **created_at** `timestamp with time zone` NOT NULL default:`timezone('utc'::text, now())`
- **customization** `json` NOT NULL
- **is_restricted** `boolean` NOT NULL default:`false`
- **customCode** `text`
- **customDomain** `text`
- **favicon** `text`
- **isCustomDomainVerified** `boolean` default:`false`

### organization_contacts
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **email** `text`
- **phone** `text`
- **name** `text`
- **message** `text`
- **organization_id** `uuid` → `organization.id`

### organization_emaillist
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **email** `text`
- **organization_id** `uuid` → `organization.id`

### organization_plan
- **id** `bigint` NOT NULL
- **activated_at** `timestamp with time zone` NOT NULL default:`now()`
- **org_id** `uuid` → `organization.id`
- **plan_name** `USER-DEFINED`
- **is_active** `boolean`
- **deactivated_at** `timestamp with time zone`
- **updated_at** `timestamp with time zone` default:`now()`
- **payload** `jsonb`
- **triggered_by** `bigint` → `organizationmember.id`
- **provider** `text` default:`'lmz'::text`
- **subscription_id** `text`

### organizationmember
- **id** `bigint` NOT NULL
- **organization_id** `uuid` NOT NULL → `organization.id`
- **role_id** `bigint` NOT NULL → `role.id`
- **profile_id** `uuid` → `profile.id`
- **email** `text`
- **verified** `boolean` default:`false`
- **created_at** `timestamp with time zone` NOT NULL default:`timezone('utc'::text, now())`

### profile
- **id** `uuid` NOT NULL
- **fullname** `text` NOT NULL
- **username** `text` NOT NULL
- **avatar_url** `text`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **email** `character varying`
- **can_add_course** `boolean` default:`true`
- **role** `character varying`
- **goal** `character varying`
- **source** `character varying`
- **metadata** `json`
- **telegram_chat_id** `bigint`
- **is_email_verified** `boolean` default:`false`
- **verified_at** `timestamp with time zone`
- **locale** `USER-DEFINED` default:`'en'::"LOCALE"`
- **is_restricted** `boolean` NOT NULL default:`false`

### question
- **id** `bigint` NOT NULL
- **question_type_id** `bigint` NOT NULL → `question_type.id`
- **title** `character varying` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **exercise_id** `uuid` NOT NULL → `exercise.id`
- **name** `uuid` default:`extensions.gen_random_uuid()`
- **points** `double precision`
- **order** `bigint`

### question_answer
- **id** `bigint` NOT NULL
- **answers** `ARRAY`
- **question_id** `bigint` NOT NULL → `question.id`
- **open_answer** `text`
- **group_member_id** `uuid` NOT NULL → `groupmember.id`
- **submission_id** `uuid` → `submission.id`
- **point** `bigint` default:`'0'::bigint`

### question_type
- **id** `bigint` NOT NULL
- **label** `character varying` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **typename** `character varying`

### quiz
- **id** `uuid` NOT NULL default:`extensions.gen_random_uuid()`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **title** `text`
- **questions** `json`
- **timelimit** `character varying` default:`'10s'::character varying`
- **theme** `character varying` default:`'standard'::character varying`
- **organization_id** `uuid` NOT NULL → `organization.id`

### quiz_play
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **quiz_id** `uuid` → `quiz.id`
- **players** `json` default:`'[]'::json`
- **started** `boolean` default:`false`
- **currentQuestionId** `bigint` default:`'0'::bigint`
- **showCurrentQuestionAnswer** `boolean` default:`false`
- **isLastQuestion** `boolean`
- **step** `text` default:`'CONNECT_TO_PLAY'::text`
- **studentStep** `text` default:`'PIN_SETUP'::text`
- **pin** `text`

### role
- **type** `character varying` NOT NULL
- **description** `character varying`
- **id** `bigint` NOT NULL
- **updated_at** `timestamp with time zone` default:`now()`
- **created_at** `timestamp with time zone` default:`now()`

### submission
- **id** `uuid` NOT NULL default:`uuid_generate_v4()`
- **reviewer_id** `bigint`
- **status_id** `bigint` → `submissionstatus.id` default:`'1'::bigint`
- **total** `bigint` default:`'0'::bigint`
- **created_at** `timestamp with time zone` default:`now()`
- **updated_at** `timestamp with time zone` default:`now()`
- **exercise_id** `uuid` NOT NULL → `exercise.id`
- **submitted_by** `uuid` → `groupmember.id`
- **course_id** `uuid` → `course.id`
- **feedback** `text`

### submissionstatus
- **id** `bigint` NOT NULL
- **label** `character varying` NOT NULL
- **updated_at** `timestamp with time zone` default:`now()`

### test_tenant
- **id** `integer` NOT NULL
- **details** `text`

### video_transcripts
- **id** `bigint` NOT NULL
- **created_at** `timestamp with time zone` NOT NULL default:`now()`
- **muse_svid** `text`
- **transcript** `text`
- **downloaded** `boolean` default:`false`
- **link** `text`

### waitinglist
- **id** `bigint` NOT NULL
- **email** `character varying` NOT NULL
- **created_at** `timestamp with time zone` default:`now()`
