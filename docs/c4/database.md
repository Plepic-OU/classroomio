# Database Schema

> Auto-generated 2026-05-15. Source: public schema. Requires `supabase start`.

**Tables:** 39

## analytics_login_events
- `id` uuid  `NOT NULL`
- `user_id` uuid  `NOT NULL`
- `logged_in_at` timestamp with time zone

## apps_poll
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `updated_at` timestamp with time zone
- `question` text
- `authorId` uuid  → `groupmember.id`
- `isPublic` boolean
- `status` character varying
- `expiration` timestamp with time zone
- `courseId` uuid  → `course.id`

## apps_poll_option
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `updated_at` timestamp with time zone
- `poll_id` uuid  → `apps_poll.id`
- `label` character varying

## apps_poll_submission
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `poll_option_id` bigint  → `apps_poll_option.id`
- `selected_by_id` uuid  → `groupmember.id`
- `poll_id` uuid  → `apps_poll.id`

## community_answer
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone
- `question_id` bigint  → `community_question.id`
- `body` character varying
- `author_id` bigint  → `organizationmember.id`
- `votes` bigint
- `author_profile_id` uuid  → `profile.id`

## community_question
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone
- `title` character varying
- `body` text
- `author_id` bigint  → `organizationmember.id`
- `votes` bigint
- `organization_id` uuid  → `organization.id`
- `slug` text
- `author_profile_id` uuid  → `profile.id`
- `course_id` uuid  `NOT NULL`  → `course.id`

## course
- `title` character varying  `NOT NULL`
- `description` character varying  `NOT NULL`
- `overview` character varying
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `group_id` uuid  → `group.id`
- `is_template` boolean
- `logo` text  `NOT NULL`
- `slug` character varying
- `metadata` jsonb  `NOT NULL`
- `cost` bigint
- `currency` character varying  `NOT NULL`
- `banner_image` text
- `is_published` boolean
- `is_certificate_downloadable` boolean
- `certificate_theme` text
- `status` text  `NOT NULL`
- `type` USER-DEFINED
- `version` USER-DEFINED  `NOT NULL`

## course_newsfeed
- `created_at` timestamp with time zone  `NOT NULL`
- `author_id` uuid  → `groupmember.id`
- `content` text
- `id` uuid  `NOT NULL`
- `course_id` uuid  → `course.id`
- `reaction` jsonb
- `is_pinned` boolean  `NOT NULL`

## course_newsfeed_comment
- `created_at` timestamp with time zone  `NOT NULL`
- `author_id` uuid  → `groupmember.id`
- `content` text
- `id` bigint  `NOT NULL`
- `course_newsfeed_id` uuid  → `course_newsfeed.id`

## currency
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone
- `name` character varying

## email_verification_tokens
- `id` uuid  `NOT NULL`
- `profile_id` uuid  → `profile.id`
- `token` text  `NOT NULL`
- `email` text  `NOT NULL`
- `created_at` timestamp with time zone
- `expires_at` timestamp with time zone  `NOT NULL`
- `used_at` timestamp with time zone
- `created_by_ip` inet
- `used_by_ip` inet

## exercise
- `title` character varying  `NOT NULL`
- `description` character varying
- `lesson_id` uuid  → `lesson.id`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `id` uuid  `NOT NULL`
- `due_by` timestamp without time zone

## group
- `id` uuid  `NOT NULL`
- `name` character varying  `NOT NULL`
- `description` text
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `organization_id` uuid  → `organization.id`

## group_attendance
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `course_id` uuid  → `course.id`
- `student_id` uuid  → `groupmember.id`
- `is_present` boolean
- `lesson_id` uuid  `NOT NULL`

## groupmember
- `id` uuid  `NOT NULL`
- `group_id` uuid  `NOT NULL`  → `group.id`
- `role_id` bigint  `NOT NULL`  → `role.id`
- `profile_id` uuid  → `profile.id`
- `email` character varying
- `created_at` timestamp with time zone
- `assigned_student_id` character varying

## lesson
- `note` character varying
- `video_url` character varying
- `slide_url` character varying
- `course_id` uuid  `NOT NULL`  → `course.id`
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `title` character varying  `NOT NULL`
- `public` boolean
- `lesson_at` timestamp with time zone
- `teacher_id` uuid  → `profile.id`
- `is_complete` boolean
- `call_url` text
- `order` bigint
- `is_unlocked` boolean
- `videos` jsonb
- `section_id` uuid  → `lesson_section.id`
- `documents` jsonb

## lesson_comment
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `updated_at` timestamp with time zone
- `lesson_id` uuid  → `lesson.id`
- `groupmember_id` uuid  → `groupmember.id`
- `comment` text

## lesson_completion
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `lesson_id` uuid  → `lesson.id`
- `profile_id` uuid  → `profile.id`
- `is_complete` boolean
- `updated_at` timestamp with time zone

## lesson_language
- `id` bigint  `NOT NULL`
- `content` text
- `lesson_id` uuid  → `lesson.id`
- `locale` USER-DEFINED

## lesson_language_history
- `id` integer  `NOT NULL`
- `lesson_language_id` integer  → `lesson_language.id`
- `old_content` text
- `new_content` text
- `timestamp` timestamp without time zone  `NOT NULL`

## lesson_section
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `updated_at` timestamp with time zone
- `title` character varying
- `order` bigint
- `course_id` uuid  → `course.id`

## option
- `id` bigint  `NOT NULL`
- `label` character varying  `NOT NULL`
- `is_correct` boolean  `NOT NULL`
- `question_id` bigint  `NOT NULL`  → `question.id`
- `value` uuid
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone

## organization
- `id` uuid  `NOT NULL`
- `name` character varying  `NOT NULL`
- `siteName` text
- `avatar_url` text
- `settings` jsonb
- `landingpage` jsonb
- `theme` text
- `created_at` timestamp with time zone  `NOT NULL`
- `customization` json  `NOT NULL`
- `is_restricted` boolean  `NOT NULL`
- `customCode` text
- `customDomain` text
- `favicon` text
- `isCustomDomainVerified` boolean

## organization_contacts
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `email` text
- `phone` text
- `name` text
- `message` text
- `organization_id` uuid  → `organization.id`

## organization_emaillist
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `email` text
- `organization_id` uuid  → `organization.id`

## organization_plan
- `id` bigint  `NOT NULL`
- `activated_at` timestamp with time zone  `NOT NULL`
- `org_id` uuid  → `organization.id`
- `plan_name` USER-DEFINED
- `is_active` boolean
- `deactivated_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `payload` jsonb
- `triggered_by` bigint  → `organizationmember.id`
- `provider` text
- `subscription_id` text

## organizationmember
- `id` bigint  `NOT NULL`
- `organization_id` uuid  `NOT NULL`  → `organization.id`
- `role_id` bigint  `NOT NULL`  → `role.id`
- `profile_id` uuid  → `profile.id`
- `email` text
- `verified` boolean
- `created_at` timestamp with time zone  `NOT NULL`

## profile
- `id` uuid  `NOT NULL`
- `fullname` text  `NOT NULL`
- `username` text  `NOT NULL`
- `avatar_url` text
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `email` character varying
- `can_add_course` boolean
- `role` character varying
- `goal` character varying
- `source` character varying
- `metadata` json
- `telegram_chat_id` bigint
- `is_email_verified` boolean
- `verified_at` timestamp with time zone
- `locale` USER-DEFINED
- `is_restricted` boolean  `NOT NULL`

## question
- `id` bigint  `NOT NULL`
- `question_type_id` bigint  `NOT NULL`  → `question_type.id`
- `title` character varying  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `exercise_id` uuid  `NOT NULL`  → `exercise.id`
- `name` uuid
- `points` double precision
- `order` bigint

## question_answer
- `id` bigint  `NOT NULL`
- `answers` ARRAY
- `question_id` bigint  `NOT NULL`  → `question.id`
- `open_answer` text
- `group_member_id` uuid  `NOT NULL`  → `groupmember.id`
- `submission_id` uuid  → `submission.id`
- `point` bigint

## question_type
- `id` bigint  `NOT NULL`
- `label` character varying  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `typename` character varying

## quiz
- `id` uuid  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `title` text
- `questions` json
- `timelimit` character varying
- `theme` character varying
- `organization_id` uuid  `NOT NULL`  → `organization.id`

## quiz_play
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `quiz_id` uuid  → `quiz.id`
- `players` json
- `started` boolean
- `currentQuestionId` bigint
- `showCurrentQuestionAnswer` boolean
- `isLastQuestion` boolean
- `step` text
- `studentStep` text
- `pin` text

## role
- `type` character varying  `NOT NULL`
- `description` character varying
- `id` bigint  `NOT NULL`
- `updated_at` timestamp with time zone
- `created_at` timestamp with time zone

## submission
- `id` uuid  `NOT NULL`
- `reviewer_id` bigint
- `status_id` bigint  → `submissionstatus.id`
- `total` bigint
- `created_at` timestamp with time zone
- `updated_at` timestamp with time zone
- `exercise_id` uuid  `NOT NULL`  → `exercise.id`
- `submitted_by` uuid  → `groupmember.id`
- `course_id` uuid  → `course.id`
- `feedback` text

## submissionstatus
- `id` bigint  `NOT NULL`
- `label` character varying  `NOT NULL`
- `updated_at` timestamp with time zone

## test_tenant
- `id` integer  `NOT NULL`
- `details` text

## video_transcripts
- `id` bigint  `NOT NULL`
- `created_at` timestamp with time zone  `NOT NULL`
- `muse_svid` text
- `transcript` text
- `downloaded` boolean
- `link` text

## waitinglist
- `id` bigint  `NOT NULL`
- `email` character varying  `NOT NULL`
- `created_at` timestamp with time zone

