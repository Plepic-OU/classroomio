# ClassroomIO — Database Schema

_Generated 2026-03-13 from local Supabase (public schema)._
_Format: `column: type [PK] [nullable]  → fk_ref`_

## analytics_login_events
- `id`: uuid  PK
- `user_id`: uuid
- `logged_in_at`: timestamptz  null

## apps_poll
- `id`: uuid  PK
- `created_at`: timestamptz
- `updated_at`: timestamptz  null
- `question`: text  null
- `authorId`: uuid  null  → groupmember.id
- `isPublic`: bool  null
- `status`: varchar  null
- `expiration`: timestamptz  null
- `courseId`: uuid  null  → course.id

## apps_poll_option
- `id`: int8  PK
- `created_at`: timestamptz
- `updated_at`: timestamptz  null
- `poll_id`: uuid  null  → apps_poll.id
- `label`: varchar  null

## apps_poll_submission
- `id`: int8  PK
- `created_at`: timestamptz
- `poll_option_id`: int8  null  → apps_poll_option.id
- `selected_by_id`: uuid  null  → groupmember.id
- `poll_id`: uuid  null  → apps_poll.id

## community_answer
- `id`: uuid  PK
- `created_at`: timestamptz  null
- `question_id`: int8  null  → community_question.id
- `body`: varchar  null
- `author_id`: int8  null  → organizationmember.id
- `votes`: int8  null
- `author_profile_id`: uuid  null  → profile.id

## community_question
- `id`: int8  PK
- `created_at`: timestamptz  null
- `title`: varchar  null
- `body`: text  null
- `author_id`: int8  null  → organizationmember.id
- `votes`: int8  null
- `organization_id`: uuid  null  → organization.id
- `slug`: text  null
- `author_profile_id`: uuid  null  → profile.id
- `course_id`: uuid  → course.id

## course
- `title`: varchar
- `description`: varchar
- `overview`: varchar  null
- `id`: uuid  PK
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `group_id`: uuid  null  → group.id
- `is_template`: bool  null
- `logo`: text
- `slug`: varchar  null
- `metadata`: jsonb
- `cost`: int8  null
- `currency`: varchar
- `banner_image`: text  null
- `is_published`: bool  null
- `is_certificate_downloadable`: bool  null
- `certificate_theme`: text  null
- `status`: text
- `type`: COURSE_TYPE  null
- `version`: COURSE_VERSION

## course_newsfeed
- `created_at`: timestamptz
- `author_id`: uuid  null  → groupmember.id
- `content`: text  null
- `id`: uuid  PK
- `course_id`: uuid  null  → course.id
- `reaction`: jsonb  null
- `is_pinned`: bool

## course_newsfeed_comment
- `created_at`: timestamptz
- `author_id`: uuid  null  → groupmember.id
- `content`: text  null
- `id`: int8  PK
- `course_newsfeed_id`: uuid  null  → course_newsfeed.id

## currency
- `id`: int8  PK
- `created_at`: timestamptz  null
- `name`: varchar  null

## dash_org_stats
- `org_id`: uuid  null
- `no_of_courses`: int8  null
- `enrolled_students`: int8  null

## email_verification_tokens
- `id`: uuid  PK
- `profile_id`: uuid  null  → profile.id
- `token`: text
- `email`: text
- `created_at`: timestamptz  null
- `expires_at`: timestamptz
- `used_at`: timestamptz  null
- `created_by_ip`: inet  null
- `used_by_ip`: inet  null

## exercise
- `title`: varchar
- `description`: varchar  null
- `lesson_id`: uuid  null  → lesson.id
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `id`: uuid  PK
- `due_by`: timestamp  null

## group
- `id`: uuid  PK
- `name`: varchar
- `description`: text  null
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `organization_id`: uuid  null  → organization.id

## group_attendance
- `id`: int8  PK
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `course_id`: uuid  null  → course.id
- `student_id`: uuid  null  → groupmember.id
- `is_present`: bool  null
- `lesson_id`: uuid

## groupmember
- `id`: uuid  PK
- `group_id`: uuid  → group.id
- `role_id`: int8  → role.id
- `profile_id`: uuid  null  → profile.id
- `email`: varchar  null
- `created_at`: timestamptz  null
- `assigned_student_id`: varchar  null

## lesson
- `note`: varchar  null
- `video_url`: varchar  null
- `slide_url`: varchar  null
- `course_id`: uuid  → course.id
- `id`: uuid  PK
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `title`: varchar
- `public`: bool  null
- `lesson_at`: timestamptz  null
- `teacher_id`: uuid  null  → profile.id
- `is_complete`: bool  null
- `call_url`: text  null
- `order`: int8  null
- `is_unlocked`: bool  null
- `videos`: jsonb  null
- `section_id`: uuid  null  → lesson_section.id
- `documents`: jsonb  null

## lesson_comment
- `id`: int8  PK
- `created_at`: timestamptz
- `updated_at`: timestamptz  null
- `lesson_id`: uuid  null  → lesson.id
- `groupmember_id`: uuid  null  → groupmember.id
- `comment`: text  null

## lesson_completion
- `id`: int8  PK
- `created_at`: timestamptz
- `lesson_id`: uuid  null  → lesson.id
- `profile_id`: uuid  null  → profile.id
- `is_complete`: bool  null
- `updated_at`: timestamptz  null

## lesson_language
- `id`: int8  PK
- `content`: text  null
- `lesson_id`: uuid  null  → lesson.id
- `locale`: LOCALE  null

## lesson_language_history
- `id`: int4  PK
- `lesson_language_id`: int4  null  → lesson_language.id
- `old_content`: text  null
- `new_content`: text  null
- `timestamp`: timestamp

## lesson_section
- `id`: uuid  PK
- `created_at`: timestamptz
- `updated_at`: timestamptz  null
- `title`: varchar  null
- `order`: int8  null
- `course_id`: uuid  null  → course.id

## lesson_versions
- `old_content`: text  null
- `new_content`: text  null
- `timestamp`: timestamp  null
- `locale`: LOCALE  null
- `lesson_id`: uuid  null

## option
- `id`: int8  PK
- `label`: varchar
- `is_correct`: bool
- `question_id`: int8  → question.id
- `value`: uuid  null
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null

## organization
- `id`: uuid  PK
- `name`: varchar
- `siteName`: text  null
- `avatar_url`: text  null
- `settings`: jsonb  null
- `landingpage`: jsonb  null
- `theme`: text  null
- `created_at`: timestamptz
- `customization`: json
- `is_restricted`: bool
- `customCode`: text  null
- `customDomain`: text  null
- `favicon`: text  null
- `isCustomDomainVerified`: bool  null

## organization_contacts
- `id`: int8  PK
- `created_at`: timestamptz
- `email`: text  null
- `phone`: text  null
- `name`: text  null
- `message`: text  null
- `organization_id`: uuid  null  → organization.id

## organization_emaillist
- `id`: int8  PK
- `created_at`: timestamptz
- `email`: text  null
- `organization_id`: uuid  null  → organization.id

## organization_plan
- `id`: int8  PK
- `activated_at`: timestamptz
- `org_id`: uuid  null  → organization.id
- `plan_name`: PLAN  null
- `is_active`: bool  null
- `deactivated_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `payload`: jsonb  null
- `triggered_by`: int8  null  → organizationmember.id
- `provider`: text  null
- `subscription_id`: text  null

## organizationmember
- `id`: int8  PK
- `organization_id`: uuid  → organization.id
- `role_id`: int8  → role.id
- `profile_id`: uuid  null  → profile.id
- `email`: text  null
- `verified`: bool  null
- `created_at`: timestamptz

## profile
- `id`: uuid  PK
- `fullname`: text
- `username`: text
- `avatar_url`: text  null
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `email`: varchar  null
- `can_add_course`: bool  null
- `role`: varchar  null
- `goal`: varchar  null
- `source`: varchar  null
- `metadata`: json  null
- `telegram_chat_id`: int8  null
- `is_email_verified`: bool  null
- `verified_at`: timestamptz  null
- `locale`: LOCALE  null
- `is_restricted`: bool

## question
- `id`: int8  PK
- `question_type_id`: int8  → question_type.id
- `title`: varchar
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `exercise_id`: uuid  → exercise.id
- `name`: uuid  null
- `points`: float8  null
- `order`: int8  null

## question_answer
- `id`: int8  PK
- `answers`: _varchar  null
- `question_id`: int8  → question.id
- `open_answer`: text  null
- `group_member_id`: uuid  → groupmember.id
- `submission_id`: uuid  null  → submission.id
- `point`: int8  null

## question_type
- `id`: int8  PK
- `label`: varchar
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `typename`: varchar  null

## quiz
- `id`: uuid  PK
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `title`: text  null
- `questions`: json  null
- `timelimit`: varchar  null
- `theme`: varchar  null
- `organization_id`: uuid  → organization.id

## quiz_play
- `id`: int8  PK
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `quiz_id`: uuid  null  → quiz.id
- `players`: json  null
- `started`: bool  null
- `currentQuestionId`: int8  null
- `showCurrentQuestionAnswer`: bool  null
- `isLastQuestion`: bool  null
- `step`: text  null
- `studentStep`: text  null
- `pin`: text  null

## role
- `type`: varchar
- `description`: varchar  null
- `id`: int8  PK
- `updated_at`: timestamptz  null
- `created_at`: timestamptz  null

## submission
- `id`: uuid  PK
- `reviewer_id`: int8  null
- `status_id`: int8  null  → submissionstatus.id
- `total`: int8  null
- `created_at`: timestamptz  null
- `updated_at`: timestamptz  null
- `exercise_id`: uuid  → exercise.id
- `submitted_by`: uuid  null  → groupmember.id
- `course_id`: uuid  null  → course.id
- `feedback`: text  null

## submissionstatus
- `id`: int8  PK
- `label`: varchar
- `updated_at`: timestamptz  null

## test_tenant
- `id`: int4  PK
- `details`: text  null

## video_transcripts
- `id`: int8  PK
- `created_at`: timestamptz
- `muse_svid`: text  null
- `transcript`: text  null
- `downloaded`: bool  null
- `link`: text  null

## waitinglist
- `id`: int8  PK
- `email`: varchar
- `created_at`: timestamptz  null
