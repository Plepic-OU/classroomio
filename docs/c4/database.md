# Database schema

_Generated from running Supabase Postgres (container `supabase_db_classroomio`, schema `public`)._

**39 tables**, 55 foreign keys, 25 functions.

## Tables

| Table | PK | Cols | FK references |
|---|---|---|---|
| `analytics_login_events` | id | 3 | — |
| `apps_poll` | id | 9 | authorId→groupmember.id; courseId→course.id |
| `apps_poll_option` | id | 5 | poll_id→apps_poll.id |
| `apps_poll_submission` | id | 5 | poll_id→apps_poll.id; poll_option_id→apps_poll_option.id; selected_by_id→groupmember.id |
| `community_answer` | id | 7 | author_id→organizationmember.id; author_profile_id→profile.id; question_id→community_question.id |
| `community_question` | id | 10 | author_id→organizationmember.id; author_profile_id→profile.id; course_id→course.id; organization_id→organization.id |
| `course` | id | 20 | group_id→group.id |
| `course_newsfeed` | id | 7 | author_id→groupmember.id; course_id→course.id |
| `course_newsfeed_comment` | id | 5 | author_id→groupmember.id; course_newsfeed_id→course_newsfeed.id |
| `currency` | id | 3 | — |
| `email_verification_tokens` | id | 9 | profile_id→profile.id |
| `exercise` | id | 7 | lesson_id→lesson.id |
| `group` | id | 6 | organization_id→organization.id |
| `group_attendance` | id | 7 | course_id→course.id; student_id→groupmember.id |
| `groupmember` | id | 7 | group_id→group.id; profile_id→profile.id; role_id→role.id |
| `lesson` | id | 18 | course_id→course.id; section_id→lesson_section.id; teacher_id→profile.id |
| `lesson_comment` | id | 6 | groupmember_id→groupmember.id; lesson_id→lesson.id |
| `lesson_completion` | id | 6 | lesson_id→lesson.id; profile_id→profile.id |
| `lesson_language` | id | 4 | lesson_id→lesson.id |
| `lesson_language_history` | id | 5 | lesson_language_id→lesson_language.id |
| `lesson_section` | id | 6 | course_id→course.id |
| `option` | id | 7 | question_id→question.id |
| `organization` | id | 14 | — |
| `organization_contacts` | id | 7 | organization_id→organization.id |
| `organization_emaillist` | id | 4 | organization_id→organization.id |
| `organization_plan` | id | 11 | org_id→organization.id; triggered_by→organizationmember.id |
| `organizationmember` | id | 7 | organization_id→organization.id; profile_id→profile.id; role_id→role.id |
| `profile` | id | 17 | — |
| `question` | id | 9 | exercise_id→exercise.id; question_type_id→question_type.id |
| `question_answer` | id | 7 | group_member_id→groupmember.id; question_id→question.id; submission_id→submission.id |
| `question_type` | id | 5 | — |
| `quiz` | id | 8 | organization_id→organization.id |
| `quiz_play` | id | 12 | quiz_id→quiz.id |
| `role` | id | 5 | — |
| `submission` | id | 10 | course_id→course.id; exercise_id→exercise.id; status_id→submissionstatus.id; submitted_by→groupmember.id |
| `submissionstatus` | id | 3 | — |
| `test_tenant` | id | 2 | — |
| `video_transcripts` | id | 6 | — |
| `waitinglist` | id | 3 | — |

## Functions

- `add_them` → integer
- `check_if_student_completed_exercises` → boolean
- `cleanup_expired_verification_tokens` → integer
- `convert_course_to_v2` → void
- `create_email_verification_token` → jsonb
- `get_course_progress` → TABLE(lessons_count bigint, lessons_completed bigint, exercises_count bigint, exercises_completed bigint)
- `get_courses` → TABLE(id uuid, org_id uuid, title character varying, slug character varying, description character varying, logo text, banner_image text, cost bigint, currency character varying, is_published boolean, total_lessons bigint, total_students bigint, progress_rate bigint, type "COURSE_TYPE", member_profile_id uuid)
- `get_dash_org_recent_enrollments` → TABLE(profile_id uuid, avatar_url text, fullname text, course_id uuid, course_title character varying, enrolled_at timestamp with time zone)
- `get_dash_org_top_courses` → TABLE(course_id uuid, course_title character varying, total_students integer, completion_percentage integer)
- `get_exercises` → TABLE(course_id uuid, lesson_id uuid, exercise_id uuid, exercise_title character varying, points integer)
- `get_explore_courses` → TABLE(id uuid, org_id uuid, title character varying, slug character varying, description character varying, logo text, banner_image text, cost bigint, currency character varying, is_published boolean, total_lessons bigint, total_students bigint, progress_rate bigint, type "COURSE_TYPE", other_profile_id uuid)
- `get_marks` → TABLE(course_id uuid, exercise_id uuid, exercise_title character varying, exercise_points integer, lesson_id uuid, lesson_title character varying, status_id bigint, total_points_gotten bigint, groupmember_id uuid, fullname text, assigned_student_id character varying, avatar_url text)
- `get_student_exercises` → TABLE(exercise_id uuid, exercise_title character varying, lesson_id uuid, lesson_title character varying, status_id integer, total integer)
- `get_user_upcoming_lessons` → TABLE(course_id uuid, course_title character varying, lesson_id uuid, lesson_title character varying, call_url text, lesson_at timestamp with time zone, is_complete boolean)
- `insert_login_event_on_user_login` → trigger
- `insert_login_event_on_user_session_update` → trigger
- `is_org_admin` → boolean
- `is_org_admin` → boolean
- `is_org_member` → boolean
- `is_user_in_course_group` → boolean
- `is_user_in_course_group_or_admin` → boolean
- `is_user_in_group_with_role` → boolean
- `prevent_email_verification_manipulation` → trigger
- `update_lesson_language_history` → trigger
- `verify_email_with_token` → jsonb
