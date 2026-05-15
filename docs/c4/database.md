# ClassroomIO Database Schema

> Extracted from local Supabase. Re-run `extract-database.ts` after migrations.

| table | columns | pk | foreign keys |
|-------|---------|----|--------------|
| analytics_login_events | id:uuid, user_id:uuid, logged_in_at:timestamptz | id | — |
| apps_poll | id:uuid, created_at:timestamptz, updated_at:timestamptz, question:text, authorId:uuid, isPublic:bool, status:varchar, expiration:timestamptz, courseId:uuid | id | authorId → groupmember.id, courseId → course.id |
| apps_poll_option | id:int8, created_at:timestamptz, updated_at:timestamptz, poll_id:uuid, label:varchar | id | poll_id → apps_poll.id |
| apps_poll_submission | id:int8, created_at:timestamptz, poll_option_id:int8, selected_by_id:uuid, poll_id:uuid | id | poll_id → apps_poll.id, poll_option_id → apps_poll_option.id, selected_by_id → groupmember.id |
| community_answer | id:uuid, created_at:timestamptz, question_id:int8, body:varchar, author_id:int8, votes:int8, author_profile_id:uuid | id | author_id → organizationmember.id, author_profile_id → profile.id, question_id → community_question.id |
| community_question | id:int8, created_at:timestamptz, title:varchar, body:text, author_id:int8, votes:int8, organization_id:uuid, slug:text, author_profile_id:uuid, course_id:uuid | id | author_id → organizationmember.id, author_profile_id → profile.id, course_id → course.id, organization_id → organization.id |
| course | title:varchar, description:varchar, overview:varchar, id:uuid, created_at:timestamptz, updated_at:timestamptz, group_id:uuid, is_template:bool, logo:text, slug:varchar, metadata:jsonb, cost:int8, currency:varchar, banner_image:text, is_published:bool, is_certificate_downloadable:bool, certificate_theme:text, status:text, type:COURSE_TYPE, version:COURSE_VERSION | id | group_id → group.id |
| course_newsfeed | created_at:timestamptz, author_id:uuid, content:text, id:uuid, course_id:uuid, reaction:jsonb, is_pinned:bool | id | author_id → groupmember.id, course_id → course.id |
| course_newsfeed_comment | created_at:timestamptz, author_id:uuid, content:text, id:int8, course_newsfeed_id:uuid | id | author_id → groupmember.id, course_newsfeed_id → course_newsfeed.id |
| currency | id:int8, created_at:timestamptz, name:varchar | id | — |
| email_verification_tokens | id:uuid, profile_id:uuid, token:text, email:text, created_at:timestamptz, expires_at:timestamptz, used_at:timestamptz, created_by_ip:inet, used_by_ip:inet | id | profile_id → profile.id |
| exercise | title:varchar, description:varchar, lesson_id:uuid, created_at:timestamptz, updated_at:timestamptz, id:uuid, due_by:timestamp | id | lesson_id → lesson.id |
| group | id:uuid, name:varchar, description:text, created_at:timestamptz, updated_at:timestamptz, organization_id:uuid | id | organization_id → organization.id |
| group_attendance | id:int8, created_at:timestamptz, updated_at:timestamptz, course_id:uuid, student_id:uuid, is_present:bool, lesson_id:uuid | id | course_id → course.id, student_id → groupmember.id |
| groupmember | id:uuid, group_id:uuid, role_id:int8, profile_id:uuid, email:varchar, created_at:timestamptz, assigned_student_id:varchar | id | group_id → group.id, profile_id → profile.id, role_id → role.id |
| lesson | note:varchar, video_url:varchar, slide_url:varchar, course_id:uuid, id:uuid, created_at:timestamptz, updated_at:timestamptz, title:varchar, public:bool, lesson_at:timestamptz, teacher_id:uuid, is_complete:bool, call_url:text, order:int8, is_unlocked:bool, videos:jsonb, section_id:uuid, documents:jsonb | id | course_id → course.id, section_id → lesson_section.id, teacher_id → profile.id |
| lesson_comment | id:int8, created_at:timestamptz, updated_at:timestamptz, lesson_id:uuid, groupmember_id:uuid, comment:text | id | groupmember_id → groupmember.id, lesson_id → lesson.id |
| lesson_completion | id:int8, created_at:timestamptz, lesson_id:uuid, profile_id:uuid, is_complete:bool, updated_at:timestamptz | id | lesson_id → lesson.id, profile_id → profile.id |
| lesson_language | id:int8, content:text, lesson_id:uuid, locale:LOCALE | id | lesson_id → lesson.id |
| lesson_language_history | id:int4, lesson_language_id:int4, old_content:text, new_content:text, timestamp:timestamp | id | lesson_language_id → lesson_language.id |
| lesson_section | id:uuid, created_at:timestamptz, updated_at:timestamptz, title:varchar, order:int8, course_id:uuid | id | course_id → course.id |
| option | id:int8, label:varchar, is_correct:bool, question_id:int8, value:uuid, created_at:timestamptz, updated_at:timestamptz | id | question_id → question.id |
| organization | id:uuid, name:varchar, siteName:text, avatar_url:text, settings:jsonb, landingpage:jsonb, theme:text, created_at:timestamptz, customization:json, is_restricted:bool, customCode:text, customDomain:text, favicon:text, isCustomDomainVerified:bool | id | — |
| organization_contacts | id:int8, created_at:timestamptz, email:text, phone:text, name:text, message:text, organization_id:uuid | id | organization_id → organization.id |
| organization_emaillist | id:int8, created_at:timestamptz, email:text, organization_id:uuid | id | organization_id → organization.id |
| organization_plan | id:int8, activated_at:timestamptz, org_id:uuid, plan_name:PLAN, is_active:bool, deactivated_at:timestamptz, updated_at:timestamptz, payload:jsonb, triggered_by:int8, provider:text, subscription_id:text | id | org_id → organization.id, triggered_by → organizationmember.id |
| organizationmember | id:int8, organization_id:uuid, role_id:int8, profile_id:uuid, email:text, verified:bool, created_at:timestamptz | id | organization_id → organization.id, profile_id → profile.id, role_id → role.id |
| profile | id:uuid, fullname:text, username:text, avatar_url:text, created_at:timestamptz, updated_at:timestamptz, email:varchar, can_add_course:bool, role:varchar, goal:varchar, source:varchar, metadata:json, telegram_chat_id:int8, is_email_verified:bool, verified_at:timestamptz, locale:LOCALE, is_restricted:bool | id | — |
| question | id:int8, question_type_id:int8, title:varchar, created_at:timestamptz, updated_at:timestamptz, exercise_id:uuid, name:uuid, points:float8, order:int8 | id | exercise_id → exercise.id, question_type_id → question_type.id |
| question_answer | id:int8, answers:_varchar, question_id:int8, open_answer:text, group_member_id:uuid, submission_id:uuid, point:int8 | id | group_member_id → groupmember.id, question_id → question.id, submission_id → submission.id |
| question_type | id:int8, label:varchar, created_at:timestamptz, updated_at:timestamptz, typename:varchar | id | — |
| quiz | id:uuid, created_at:timestamptz, updated_at:timestamptz, title:text, questions:json, timelimit:varchar, theme:varchar, organization_id:uuid | id | organization_id → organization.id |
| quiz_play | id:int8, created_at:timestamptz, updated_at:timestamptz, quiz_id:uuid, players:json, started:bool, currentQuestionId:int8, showCurrentQuestionAnswer:bool, isLastQuestion:bool, step:text, studentStep:text, pin:text | id | quiz_id → quiz.id |
| role | type:varchar, description:varchar, id:int8, updated_at:timestamptz, created_at:timestamptz | id | — |
| submission | id:uuid, reviewer_id:int8, status_id:int8, total:int8, created_at:timestamptz, updated_at:timestamptz, exercise_id:uuid, submitted_by:uuid, course_id:uuid, feedback:text | id | course_id → course.id, exercise_id → exercise.id, status_id → submissionstatus.id, submitted_by → groupmember.id |
| submissionstatus | id:int8, label:varchar, updated_at:timestamptz | id | — |
| test_tenant | id:int4, details:text | id | — |
| video_transcripts | id:int8, created_at:timestamptz, muse_svid:text, transcript:text, downloaded:bool, link:text | id | — |
| waitinglist | id:int8, email:varchar, created_at:timestamptz | id | — |

_39 tables_
