# Database Schema
_Generated: 2026-03-13T08:23:26Z | Supabase PostgreSQL 15 | Schema: public_
_41 tables · 55 foreign keys. Format: key columns only, omitting created_at/updated_at unless business-relevant._

---

## Auth / Identity

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| profile | id uuid PK, fullname text, email varchar, role varchar, locale LOCALE, is_email_verified bool, is_restricted bool | id → auth.users.id |
| email_verification_tokens | id uuid PK, profile_id uuid, token text, email text, expires_at ts, used_at ts, created_by_ip inet | profile_id → profile.id |
| analytics_login_events | id uuid PK, user_id uuid, logged_in_at ts | — |
| role | id bigint PK, type varchar, description varchar | — |
| waitinglist | id bigint PK, email varchar | — |

---

## Organization

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| organization | id uuid PK, name varchar, siteName text, customDomain text, isCustomDomainVerified bool, settings jsonb, customization json, is_restricted bool | — |
| organizationmember | id bigint PK, organization_id uuid, profile_id uuid, role_id bigint, email text, verified bool | organization_id → organization.id, profile_id → profile.id, role_id → role.id |
| organization_plan | id bigint PK, org_id uuid, plan_name ENUM, is_active bool, provider text, subscription_id text, payload jsonb | org_id → organization.id, triggered_by → organizationmember.id |
| organization_contacts | id bigint PK, organization_id uuid, email text, name text, message text | organization_id → organization.id |
| organization_emaillist | id bigint PK, organization_id uuid, email text | organization_id → organization.id |
| dash_org_stats | org_id uuid, no_of_courses bigint, enrolled_students bigint | — (view/materialized) |

---

## Groups & Membership

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| group | id uuid PK, name varchar, organization_id uuid | organization_id → organization.id |
| groupmember | id uuid PK, group_id uuid, profile_id uuid, role_id bigint, email varchar, assigned_student_id varchar | group_id → group.id, profile_id → profile.id, role_id → role.id |

---

## Course

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| course | id uuid PK, title varchar, slug varchar, group_id uuid, is_published bool, cost bigint, currency varchar, type COURSE_TYPE, version COURSE_VERSION, is_certificate_downloadable bool, certificate_theme text, metadata jsonb | group_id → group.id |
| lesson_section | id uuid PK, title varchar, order bigint, course_id uuid | course_id → course.id |
| lesson | id uuid PK, title varchar, course_id uuid, section_id uuid, teacher_id uuid, lesson_at ts, order bigint, is_complete bool, is_unlocked bool, public bool, videos jsonb, documents jsonb | course_id → course.id, section_id → lesson_section.id, teacher_id → profile.id |
| lesson_language | id bigint PK, lesson_id uuid, locale LOCALE, content text | lesson_id → lesson.id |
| lesson_language_history | id int PK, lesson_language_id int, old_content text, new_content text | lesson_language_id → lesson_language.id |
| lesson_versions | lesson_id uuid, locale LOCALE, old_content text, new_content text | — |
| exercise | id uuid PK, title varchar, lesson_id uuid, due_by ts | lesson_id → lesson.id |
| group_attendance | id bigint PK, course_id uuid, lesson_id uuid, student_id uuid, is_present bool | course_id → course.id, lesson_id → lesson.id (implicit), student_id → groupmember.id |

---

## Assessment

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| question_type | id bigint PK, typename varchar, label varchar | — |
| question | id bigint PK, exercise_id uuid, question_type_id bigint, title varchar, points float, order bigint | exercise_id → exercise.id, question_type_id → question_type.id |
| option | id bigint PK, question_id bigint, label varchar, is_correct bool | question_id → question.id |
| submission | id uuid PK, exercise_id uuid, course_id uuid, submitted_by uuid, status_id bigint, total bigint, feedback text | exercise_id → exercise.id, course_id → course.id, submitted_by → groupmember.id, status_id → submissionstatus.id |
| submissionstatus | id bigint PK, label varchar | — |
| question_answer | id bigint PK, submission_id uuid, question_id bigint, group_member_id uuid, answers ARRAY, open_answer text, point bigint | submission_id → submission.id, question_id → question.id, group_member_id → groupmember.id |
| lesson_completion | id bigint PK, lesson_id uuid, profile_id uuid, is_complete bool | lesson_id → lesson.id, profile_id → profile.id |

---

## Course Social / Newsfeed

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| course_newsfeed | id uuid PK, course_id uuid, author_id uuid, content text, reaction jsonb, is_pinned bool | course_id → course.id, author_id → groupmember.id |
| course_newsfeed_comment | id bigint PK, course_newsfeed_id uuid, author_id uuid, content text | course_newsfeed_id → course_newsfeed.id, author_id → groupmember.id |
| lesson_comment | id bigint PK, lesson_id uuid, groupmember_id uuid, comment text | lesson_id → lesson.id, groupmember_id → groupmember.id |

---

## Community (Q&A)

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| community_question | id bigint PK, organization_id uuid, course_id uuid, author_id bigint, author_profile_id uuid, title varchar, body text, slug text, votes bigint | organization_id → organization.id, course_id → course.id, author_id → organizationmember.id, author_profile_id → profile.id |
| community_answer | id uuid PK, question_id bigint, author_id bigint, author_profile_id uuid, body varchar, votes bigint | question_id → community_question.id, author_id → organizationmember.id, author_profile_id → profile.id |

---

## Apps (Poll / Quiz)

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| apps_poll | id uuid PK, courseId uuid, authorId uuid, question text, status varchar, isPublic bool, expiration ts | courseId → course.id, authorId → groupmember.id |
| apps_poll_option | id bigint PK, poll_id uuid, label varchar | poll_id → apps_poll.id |
| apps_poll_submission | id bigint PK, poll_id uuid, poll_option_id bigint, selected_by_id bigint | poll_id → apps_poll.id, poll_option_id → apps_poll_option.id, selected_by_id → groupmember.id |
| quiz | id uuid PK, organization_id uuid, title text, questions json, timelimit varchar, theme varchar | organization_id → organization.id |
| quiz_play | id bigint PK, quiz_id uuid, players json, started bool, currentQuestionId bigint, pin text, step text | quiz_id → quiz.id |

---

## Misc

| Table | Key Columns | Notes |
|-------|-------------|-------|
| currency | id bigint PK, name varchar | Lookup table |
| video_transcripts | id bigint PK, muse_svid text, transcript text, downloaded bool | Video transcript storage |
| test_tenant | id int PK, details text | Dev/test only |
