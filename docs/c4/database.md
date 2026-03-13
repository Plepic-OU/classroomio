# Database Schema

> Extracted from local Supabase (PostgreSQL). Format: `table: col:type, ... | FK: col→table.col`

## Core Entities

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| `profile` | id:uuid, fullname, email, avatar_url, role, locale, is_email_verified | — |
| `organization` | id:uuid, name, siteName, settings:jsonb, landingpage:jsonb, theme, is_restricted | — |
| `organizationmember` | id:bigint, organization_id, profile_id, role_id, email, verified | organization_id→organization, profile_id→profile, role_id→role |
| `role` | id:bigint, type, description | — |
| `group` | id:uuid, name, organization_id | organization_id→organization |
| `groupmember` | id:uuid, group_id, profile_id, role_id, email, assigned_student_id | group_id→group, profile_id→profile, role_id→role |

## Courses & Learning

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| `course` | id:uuid, title, description, group_id, slug, is_published, cost, status, type | group_id→group |
| `lesson` | id:uuid, title, course_id, section_id, teacher_id, order, is_complete, is_unlocked, videos:jsonb | course_id→course, section_id→lesson_section, teacher_id→profile |
| `lesson_section` | id:uuid, title, order, course_id | course_id→course |
| `lesson_completion` | id:bigint, lesson_id, profile_id, is_complete | lesson_id→lesson, profile_id→profile |
| `lesson_comment` | id:bigint, lesson_id, groupmember_id, comment | lesson_id→lesson, groupmember_id→groupmember |
| `lesson_language` | id:bigint, lesson_id, content, locale | lesson_id→lesson |
| `lesson_language_history` | id:int, lesson_language_id, old_content, new_content | lesson_language_id→lesson_language |

## Exercises & Submissions

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| `exercise` | id:uuid, title, lesson_id, due_by | lesson_id→lesson |
| `question` | id:bigint, title, exercise_id, question_type_id, points, order | exercise_id→exercise, question_type_id→question_type |
| `question_type` | id:bigint, label, typename | — |
| `option` | id:bigint, label, is_correct, question_id | question_id→question |
| `submission` | id:uuid, exercise_id, submitted_by, course_id, status_id, total, feedback | exercise_id→exercise, submitted_by→groupmember, course_id→course, status_id→submissionstatus |
| `submissionstatus` | id:bigint, label | — |
| `question_answer` | id:bigint, question_id, group_member_id, submission_id, answers:ARRAY, open_answer, point | question_id→question, group_member_id→groupmember, submission_id→submission |

## Community & Feeds

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| `course_newsfeed` | id:uuid, course_id, author_id, content, reaction:jsonb, is_pinned | course_id→course, author_id→groupmember |
| `course_newsfeed_comment` | id:bigint, course_newsfeed_id, author_id, content | course_newsfeed_id→course_newsfeed, author_id→groupmember |
| `community_question` | id:bigint, title, body, organization_id, course_id, author_profile_id | organization_id→organization, course_id→course, author_profile_id→profile |
| `community_answer` | id:uuid, question_id, body, author_profile_id | question_id→community_question, author_profile_id→profile |

## Apps & Misc

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| `apps_poll` | id:uuid, question, courseId, authorId, status, expiration | courseId→course, authorId→groupmember |
| `apps_poll_option` | id:bigint, poll_id, label | poll_id→apps_poll |
| `apps_poll_submission` | id:bigint, poll_id, poll_option_id, selected_by_id | poll_id→apps_poll, poll_option_id→apps_poll_option, selected_by_id→groupmember |
| `quiz` | id:uuid, title, questions:json, organization_id, timelimit, theme | organization_id→organization |
| `quiz_play` | id:bigint, quiz_id, players:json, pin, step, started | quiz_id→quiz |
| `group_attendance` | id:bigint, course_id, lesson_id, student_id, is_present | course_id→course, student_id→groupmember |
| `organization_plan` | id:bigint, org_id, plan_name, is_active, provider, subscription_id | org_id→organization |
| `organization_contacts` | id:bigint, organization_id, email, name, message | organization_id→organization |
| `organization_emaillist` | id:bigint, organization_id, email | organization_id→organization |
| `email_verification_tokens` | id:uuid, profile_id, token, email, expires_at | profile_id→profile |
| `analytics_login_events` | id:uuid, user_id, logged_in_at | — |
| `waitinglist` | id:bigint, email | — |
| `video_transcripts` | id:bigint, muse_svid, transcript, downloaded | — |
| `currency` | id:bigint, name | — |
