# Database schema — `public` (derived from migrations)

This reference was rebuilt by replaying every file in `supabase/migrations/*.sql` (in filename order) because the canonical live extractor — `.claude/skills/c4-model/scripts/extract-db.sh`, which `docker exec`s into the running Supabase Postgres container — could not start in this WSL devcontainer due to an arch mismatch in the Postgres image. Re-run the canonical generator when `supabase start` works again to refresh this file from the live database. Only `public` is documented; FKs into `auth.*` are noted inline.

## analytics_login_events
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `user_id` : uuid  (→ auth.users.id, UNIQUE, NOT NULL)
- `logged_in_at` : timestamptz  (default `now()`)

## apps_poll
- `id` : uuid  (PK, default `gen_random_uuid()`, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `question` : text
- `authorId` : uuid  (→ groupmember.id)
- `isPublic` : boolean
- `status` : varchar  (default `'draft'`)
- `expiration` : timestamptz
- `courseId` : uuid  (→ course.id)

## apps_poll_option
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `updated_at` : timestamptz
- `poll_id` : uuid  (→ apps_poll.id)
- `label` : varchar

## apps_poll_submission
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `poll_option_id` : bigint  (→ apps_poll_option.id)
- `selected_by_id` : uuid  (→ groupmember.id)
- `poll_id` : uuid  (→ apps_poll.id)

## community_answer
- `id` : uuid  (PK, default `gen_random_uuid()`, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `question_id` : bigint  (→ community_question.id)
- `body` : varchar
- `author_id` : bigint  (→ organizationmember.id)
- `votes` : bigint
- `author_profile_id` : uuid  (→ profile.id)

## community_question
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `title` : varchar
- `body` : text
- `author_id` : bigint  (→ organizationmember.id)
- `votes` : bigint  (default `0`)
- `organization_id` : uuid  (→ organization.id)
- `slug` : text
- `author_profile_id` : uuid  (→ profile.id)
- `course_id` : uuid  (→ course.id, NOT NULL)

## course
- `title` : varchar  (NOT NULL)
- `description` : varchar  (NOT NULL)
- `overview` : varchar  (default `'Welcome to this amazing course ...'`)
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `group_id` : uuid  (→ group.id)
- `is_template` : boolean  (default `true`)
- `logo` : text  (NOT NULL, default `''`)
- `slug` : varchar  (UNIQUE)
- `metadata` : jsonb  (NOT NULL, default `'{"goals":"","description":"","requirements":""}'`)
- `cost` : bigint  (default `0`)
- `currency` : varchar  (NOT NULL, default `'USD'`)
- `banner_image` : text
- `is_published` : boolean  (default `false`)
- `is_certificate_downloadable` : boolean  (default `false`)
- `certificate_theme` : text
- `status` : text  (NOT NULL, default `'ACTIVE'`)
- `type` : COURSE_TYPE  (enum: `SELF_PACED`,`LIVE_CLASS`; default `'LIVE_CLASS'`)
- `version` : COURSE_VERSION  (enum: `V1`,`V2`; NOT NULL, default `'V1'`)

## course_newsfeed
- `id` : uuid  (PK, default `gen_random_uuid()`, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `author_id` : uuid  (→ groupmember.id)
- `content` : text
- `course_id` : uuid  (→ course.id)
- `reaction` : jsonb  (default `'{"clap":[],"smile":[],"thumbsup":[],"thumbsdown":[]}'`)
- `is_pinned` : boolean  (NOT NULL, default `false`)

## course_newsfeed_comment
- `id` : bigint  (PK, identity, UNIQUE, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `author_id` : uuid  (→ groupmember.id)
- `content` : text
- `course_newsfeed_id` : uuid  (→ course_newsfeed.id)

## currency
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `name` : varchar

## email_verification_tokens
- `id` : uuid  (PK, default `gen_random_uuid()`)
- `profile_id` : uuid  (→ profile.id, ON DELETE CASCADE)
- `token` : text  (UNIQUE, NOT NULL)
- `email` : text  (NOT NULL)
- `created_at` : timestamptz  (default `timezone('utc', now())`)
- `expires_at` : timestamptz  (NOT NULL)
- `used_at` : timestamptz
- `created_by_ip` : inet
- `used_by_ip` : inet

## exercise
- `title` : varchar  (NOT NULL)
- `description` : varchar
- `lesson_id` : uuid  (→ lesson.id, ON DELETE CASCADE)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `due_by` : timestamp

## group
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `name` : varchar  (NOT NULL)
- `description` : text
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `organization_id` : uuid  (→ organization.id)

## group_attendance
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `course_id` : uuid  (→ course.id)
- `student_id` : uuid  (→ groupmember.id)
- `is_present` : boolean  (default `false`)
- `lesson_id` : uuid  (NOT NULL)

## groupmember
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `group_id` : uuid  (→ group.id, NOT NULL)
- `role_id` : bigint  (→ role.id, NOT NULL)
- `profile_id` : uuid  (→ profile.id)
- `email` : varchar
- `created_at` : timestamptz  (default `now()`)
- `assigned_student_id` : varchar
- UNIQUE: `(group_id, profile_id, email)`, `(group_id, email)`, `(group_id, profile_id)`

## lesson
- `note` : varchar
- `video_url` : varchar
- `slide_url` : varchar
- `course_id` : uuid  (→ course.id, NOT NULL)
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `title` : varchar  (NOT NULL)
- `public` : boolean  (default `false`)
- `lesson_at` : timestamptz  (default `now()`)
- `teacher_id` : uuid  (→ profile.id)
- `is_complete` : boolean  (default `false`)
- `call_url` : text
- `order` : bigint
- `is_unlocked` : boolean  (default `false`)
- `videos` : jsonb  (default `'[]'`)
- `section_id` : uuid  (→ lesson_section.id, ON UPDATE CASCADE ON DELETE CASCADE)
- `documents` : jsonb  (default `'[]'`)

## lesson_comment
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `lesson_id` : uuid  (→ lesson.id, ON DELETE CASCADE)
- `groupmember_id` : uuid  (→ groupmember.id)
- `comment` : text

## lesson_completion
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `lesson_id` : uuid  (→ lesson.id, ON DELETE CASCADE)
- `profile_id` : uuid  (→ profile.id)
- `is_complete` : boolean  (default `false`)
- `updated_at` : timestamptz  (default `now()`)
- UNIQUE: `(lesson_id, profile_id)`

## lesson_language
- `id` : bigint  (PK, identity, NOT NULL)
- `content` : text
- `lesson_id` : uuid  (→ lesson.id, ON UPDATE CASCADE ON DELETE CASCADE, default `gen_random_uuid()`)
- `locale` : LOCALE  (enum: `en`,`hi`,`fr`,`pt`,`de`,`vi`,`ru`,`es`,`pl`,`da`; default `'en'`)

## lesson_language_history
- `id` : serial  (PK, NOT NULL)
- `lesson_language_id` : integer  (→ lesson_language.id, ON UPDATE CASCADE ON DELETE CASCADE)
- `old_content` : text
- `new_content` : text
- `timestamp` : timestamp  (NOT NULL, default `CURRENT_TIMESTAMP`)

## lesson_section
- `id` : uuid  (PK, default `gen_random_uuid()`, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `title` : varchar
- `order` : bigint  (default `0`)
- `course_id` : uuid  (→ course.id, ON UPDATE CASCADE ON DELETE CASCADE)

## option
- `id` : bigint  (PK, identity, NOT NULL)
- `label` : varchar  (NOT NULL)
- `is_correct` : boolean  (NOT NULL, default `false`)
- `question_id` : bigint  (→ question.id, ON DELETE CASCADE, NOT NULL)
- `value` : uuid  (default `gen_random_uuid()`)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)

## organization
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `name` : varchar  (NOT NULL)
- `siteName` : text  (UNIQUE)
- `avatar_url` : text
- `settings` : jsonb  (default `'{}'`)
- `landingpage` : jsonb  (default `'{}'`)
- `theme` : text
- `created_at` : timestamptz  (NOT NULL, default `timezone('utc', now())`)
- `customization` : json  (NOT NULL, default `'{"apps":{...},"course":{...},...}'`)
- `is_restricted` : boolean  (NOT NULL, default `false`)
- `customCode` : text
- `customDomain` : text  (UNIQUE)
- `favicon` : text
- `isCustomDomainVerified` : boolean  (default `false`)

## organization_contacts
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `email` : text
- `phone` : text
- `name` : text
- `message` : text
- `organization_id` : uuid  (→ organization.id)

## organization_emaillist
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `email` : text
- `organization_id` : uuid  (→ organization.id)

## organization_plan
- `id` : bigint  (PK, identity, NOT NULL)
- `activated_at` : timestamptz  (NOT NULL, default `now()`)
- `org_id` : uuid  (→ organization.id)
- `plan_name` : PLAN  (enum: `EARLY_ADOPTER`,`ENTERPRISE`,`BASIC`)
- `is_active` : boolean
- `deactivated_at` : timestamptz
- `updated_at` : timestamptz  (default `now()`)
- `payload` : jsonb
- `triggered_by` : bigint  (→ organizationmember.id)
- `provider` : text  (default `'lmz'`)
- `subscription_id` : text  (UNIQUE)

## organizationmember
- `id` : bigint  (PK, identity, NOT NULL)
- `organization_id` : uuid  (→ organization.id, NOT NULL)
- `role_id` : bigint  (→ role.id, NOT NULL)
- `profile_id` : uuid  (→ profile.id)
- `email` : text
- `verified` : boolean  (default `false`)
- `created_at` : timestamptz  (NOT NULL, default `timezone('utc', now())`)

## profile
- `id` : uuid  (PK, → auth.users.id, NOT NULL)
- `fullname` : text  (NOT NULL)
- `username` : text  (UNIQUE, NOT NULL)
- `avatar_url` : text  (default `'https://pgrest.classroomio.com/...avatar.png'`)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `email` : varchar  (UNIQUE)
- `can_add_course` : boolean  (default `true`)
- `role` : varchar
- `goal` : varchar
- `source` : varchar
- `metadata` : json
- `telegram_chat_id` : bigint
- `is_email_verified` : boolean  (default `false`)
- `verified_at` : timestamptz
- `locale` : LOCALE  (default `'en'`)
- `is_restricted` : boolean  (NOT NULL, default `false`)

## question
- `id` : bigint  (PK, identity, NOT NULL)
- `question_type_id` : bigint  (→ question_type.id, NOT NULL)
- `title` : varchar  (NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `exercise_id` : uuid  (→ exercise.id, ON DELETE CASCADE, NOT NULL)
- `name` : uuid  (default `gen_random_uuid()`)
- `points` : double precision
- `order` : bigint

## question_answer
- `id` : bigint  (PK, identity, NOT NULL)
- `answers` : varchar[]
- `question_id` : bigint  (→ question.id, ON DELETE CASCADE, NOT NULL)
- `open_answer` : text
- `group_member_id` : uuid  (→ groupmember.id, NOT NULL)
- `submission_id` : uuid  (→ submission.id, ON DELETE CASCADE)
- `point` : bigint  (default `0`)

## question_type
- `id` : bigint  (PK, identity, NOT NULL)
- `label` : varchar  (NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `typename` : varchar

## quiz
- `id` : uuid  (PK, default `gen_random_uuid()`, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `title` : text
- `questions` : json
- `timelimit` : varchar  (default `'10s'`)
- `theme` : varchar  (default `'standard'`)
- `organization_id` : uuid  (→ organization.id, NOT NULL)

## quiz_play
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `quiz_id` : uuid  (→ quiz.id)
- `players` : json  (default `'[]'`)
- `started` : boolean  (default `false`)
- `currentQuestionId` : bigint  (default `0`)
- `showCurrentQuestionAnswer` : boolean  (default `false`)
- `isLastQuestion` : boolean
- `step` : text  (default `'CONNECT_TO_PLAY'`)
- `studentStep` : text  (default `'PIN_SETUP'`)
- `pin` : text  (UNIQUE)

## role
- `type` : varchar  (NOT NULL)
- `description` : varchar
- `id` : bigint  (PK, identity, NOT NULL)
- `updated_at` : timestamptz  (default `now()`)
- `created_at` : timestamptz  (default `now()`)

## submission
- `id` : uuid  (PK, default `uuid_generate_v4()`, NOT NULL)
- `reviewer_id` : bigint
- `status_id` : bigint  (→ submissionstatus.id, default `1`)
- `total` : bigint  (default `0`)
- `created_at` : timestamptz  (default `now()`)
- `updated_at` : timestamptz  (default `now()`)
- `exercise_id` : uuid  (→ exercise.id, ON DELETE CASCADE, NOT NULL)
- `submitted_by` : uuid  (→ groupmember.id)
- `course_id` : uuid  (→ course.id, ON DELETE CASCADE)
- `feedback` : text

## submissionstatus
- `id` : bigint  (PK, identity, NOT NULL)
- `label` : varchar  (NOT NULL)
- `updated_at` : timestamptz  (default `now()`)

## test_tenant
- `id` : integer  (PK, default `nextval('test_tenant_id_seq')`, NOT NULL)
- `details` : text

## video_transcripts
- `id` : bigint  (PK, identity, NOT NULL)
- `created_at` : timestamptz  (NOT NULL, default `now()`)
- `muse_svid` : text
- `transcript` : text
- `downloaded` : boolean  (default `false`)
- `link` : text

## waitinglist
- `id` : bigint  (PK, identity, NOT NULL)
- `email` : varchar  (UNIQUE, NOT NULL)
- `created_at` : timestamptz  (default `now()`)
