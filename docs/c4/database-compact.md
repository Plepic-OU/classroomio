# ClassroomIO Database Schema

> Auto-generated from local Supabase. Token-efficient format for AI context.
>
> **Conventions** (omitted from definitions below):
> - `created_at`/`updated_at` default to `now()` unless noted
> - `uuid` primary keys are auto-generated
> - `?` = nullable, `→table` = foreign key
> - Types: `tstz`=timestamp with time zone, `ts`=timestamp without time zone, `varchar`=character varying

## Tables

### analytics_login_events
id:uuid, user_id:uuid, logged_in_at?:tstz

### apps_poll
id:uuid, created_at:tstz, updated_at?:tstz, question?:text, authorId?:uuid→groupmember, isPublic?:bool, status?:varchar='draft', expiration?:tstz, courseId?:uuid→course

### apps_poll_option
id:bigint, created_at:tstz, updated_at?:tstz, poll_id?:uuid→apps_poll, label?:varchar

### apps_poll_submission
id:bigint, created_at:tstz, poll_option_id?:bigint→apps_poll_option, selected_by_id?:uuid→groupmember, poll_id?:uuid→apps_poll

### community_answer
id:uuid, created_at?:tstz, question_id?:bigint→community_question, body?:varchar, author_id?:bigint→organizationmember, votes?:bigint, author_profile_id?:uuid→profile

### community_question
id:bigint, created_at?:tstz, title?:varchar, body?:text, author_id?:bigint→organizationmember, votes?:bigint=0, organization_id?:uuid→organization, slug?:text, author_profile_id?:uuid→profile, course_id:uuid→course

### course
id:uuid, title:varchar, description:varchar, overview?:varchar='Welcome to this amazing course', created_at?:tstz, updated_at?:tstz, group_id?:uuid→group, is_template?:bool=true, logo:text='', slug?:varchar, metadata:jsonb='{"goals":"","description":"","requirements":""}', cost?:bigint=0, currency:varchar='USD', banner_image?:text, is_published?:bool=false, is_certificate_downloadable?:bool=false, certificate_theme?:text, status:text='ACTIVE', type?:COURSE_TYPE='LIVE_CLASS', version:COURSE_VERSION='V1'

### course_newsfeed
created_at:tstz, author_id?:uuid→groupmember, content?:text, id:uuid, course_id?:uuid→course, reaction?:jsonb='{"clap":[],"smile":[],"thumbsup":[],"thumbsdown":[]}', is_pinned:bool=false

### course_newsfeed_comment
created_at:tstz, author_id?:uuid→groupmember, content?:text, id:bigint, course_newsfeed_id?:uuid→course_newsfeed

### currency
id:bigint, created_at?:tstz, name?:varchar

### email_verification_tokens
id:uuid, profile_id?:uuid→profile, token:text, email:text, created_at?:tstz, expires_at:tstz, used_at?:tstz, created_by_ip?:inet, used_by_ip?:inet

### exercise
title:varchar, description?:varchar, lesson_id?:uuid→lesson, created_at?:tstz, updated_at?:tstz, id:uuid, due_by?:ts

### group
id:uuid, name:varchar, description?:text, created_at?:tstz, updated_at?:tstz, organization_id?:uuid→organization

### group_attendance
id:bigint, created_at?:tstz, updated_at?:tstz, course_id?:uuid→course, student_id?:uuid→groupmember, is_present?:bool=false, lesson_id:uuid

### groupmember
id:uuid, group_id:uuid→group, role_id:bigint→role, profile_id?:uuid→profile, email?:varchar, created_at?:tstz, assigned_student_id?:varchar

### lesson
note?:varchar, video_url?:varchar, slide_url?:varchar, course_id:uuid→course, id:uuid, created_at?:tstz, updated_at?:tstz, title:varchar, public?:bool=false, lesson_at?:tstz, teacher_id?:uuid→profile, is_complete?:bool=false, call_url?:text, order?:bigint, is_unlocked?:bool=false, videos?:jsonb='[]', section_id?:uuid→lesson_section, documents?:jsonb='[]'

### lesson_comment
id:bigint, created_at:tstz, updated_at?:tstz, lesson_id?:uuid→lesson, groupmember_id?:uuid→groupmember, comment?:text

### lesson_completion
id:bigint, created_at:tstz, lesson_id?:uuid→lesson, profile_id?:uuid→profile, is_complete?:bool=false, updated_at?:tstz

### lesson_language
id:bigint, content?:text, lesson_id?:uuid→lesson, locale?:LOCALE='en'

### lesson_language_history
id:int=seq, lesson_language_id?:int→lesson_language, old_content?:text, new_content?:text, timestamp:ts=CURRENT_TIMESTAMP

### lesson_section
id:uuid, created_at:tstz, updated_at?:tstz, title?:varchar, order?:bigint=0, course_id?:uuid→course

### option
id:bigint, label:varchar, is_correct:bool=false, question_id:bigint→question, value?:uuid, created_at?:tstz, updated_at?:tstz

### organization
id:uuid, name:varchar, siteName?:text, avatar_url?:text, settings?:jsonb='{}', landingpage?:jsonb='{}', theme?:text, created_at:tstz, customization:json='{"apps":{"poll":true,"comments":true},"course":{"grading":true,"newsfeed":true},"dashboard":{"exercise":true,"community":true,"bannerText":"","bannerImage":""}}', is_restricted:bool=false, customCode?:text, customDomain?:text, favicon?:text, isCustomDomainVerified?:bool=false

### organization_contacts
id:bigint, created_at:tstz, email?:text, phone?:text, name?:text, message?:text, organization_id?:uuid→organization

### organization_emaillist
id:bigint, created_at:tstz, email?:text, organization_id?:uuid→organization

### organization_plan
id:bigint, activated_at:tstz, org_id?:uuid→organization, plan_name?:PLAN, is_active?:bool, deactivated_at?:tstz, updated_at?:tstz, payload?:jsonb, triggered_by?:bigint→organizationmember, provider?:text='lmz', subscription_id?:text

### organizationmember
id:bigint, organization_id:uuid→organization, role_id:bigint→role, profile_id?:uuid→profile, email?:text, verified?:bool=false, created_at:tstz

### profile
id:uuid, fullname:text, username:text, avatar_url?:text, created_at?:tstz, updated_at?:tstz, email?:varchar, can_add_course?:bool=true, role?:varchar, goal?:varchar, source?:varchar, metadata?:json, telegram_chat_id?:bigint, is_email_verified?:bool=false, verified_at?:tstz, locale?:LOCALE='en', is_restricted:bool=false

### question
id:bigint, question_type_id:bigint→question_type, title:varchar, created_at?:tstz, updated_at?:tstz, exercise_id:uuid→exercise, name?:uuid, points?:float8, order?:bigint

### question_answer
id:bigint, answers?:ARRAY, question_id:bigint→question, open_answer?:text, group_member_id:uuid→groupmember, submission_id?:uuid→submission, point?:bigint=0

### question_type
id:bigint, label:varchar, created_at?:tstz, updated_at?:tstz, typename?:varchar

### quiz
id:uuid, created_at?:tstz, updated_at?:tstz, title?:text, questions?:json, timelimit?:varchar='10s', theme?:varchar='standard', organization_id:uuid→organization

### quiz_play
id:bigint, created_at?:tstz, updated_at?:tstz, quiz_id?:uuid→quiz, players?:json='[]', started?:bool=false, currentQuestionId?:bigint=0, showCurrentQuestionAnswer?:bool=false, isLastQuestion?:bool, step?:text='CONNECT_TO_PLAY', studentStep?:text='PIN_SETUP', pin?:text

### role
type:varchar, description?:varchar, id:bigint, updated_at?:tstz, created_at?:tstz

### submission
id:uuid, reviewer_id?:bigint, status_id?:bigint→submissionstatus=1, total?:bigint=0, created_at?:tstz, updated_at?:tstz, exercise_id:uuid→exercise, submitted_by?:uuid→groupmember, course_id?:uuid→course, feedback?:text

### submissionstatus
id:bigint, label:varchar, updated_at?:tstz

### test_tenant
id:int=seq, details?:text

### video_transcripts
id:bigint, created_at:tstz, muse_svid?:text, transcript?:text, downloaded?:bool=false, link?:text

### waitinglist
id:bigint, email:varchar, created_at?:tstz

## Enums
```
COURSE_TYPE: SELF_PACED, LIVE_CLASS
COURSE_VERSION: V1, V2
LOCALE: en, hi, fr, pt, de, vi, ru, es, pl, da
PLAN: EARLY_ADOPTER, ENTERPRISE, BASIC
```
