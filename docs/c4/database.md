# Database Schema (Supabase/PostgreSQL)

Token-efficient schema reference extracted from local Supabase instance.
Format: `table(column:type, ...)` with FK references noted.

## Tables

### analytics_login_events
PK: id
`analytics_login_events(id:uuid!, user_id:uuid!, logged_in_at:timestamp with time zone)`

### apps_poll
PK: id
`apps_poll(id:uuid!, created_at:timestamp with time zone!, updated_at:timestamp with time zone, question:text, authorId:uuid, isPublic:boolean, expiration:timestamp with time zone, courseId:uuid)`
FK: authorId->groupmember.id, courseId->course.id

### apps_poll_option
PK: id
`apps_poll_option(id:bigint!, created_at:timestamp with time zone!, updated_at:timestamp with time zone, poll_id:uuid)`
FK: poll_id->apps_poll.id

### apps_poll_submission
PK: id
`apps_poll_submission(id:bigint!, created_at:timestamp with time zone!, poll_option_id:bigint, selected_by_id:uuid, poll_id:uuid)`
FK: poll_id->apps_poll.id, poll_option_id->apps_poll_option.id, selected_by_id->groupmember.id

### community_answer
PK: id
`community_answer(id:uuid!, created_at:timestamp with time zone, question_id:bigint, author_id:bigint, votes:bigint, author_profile_id:uuid)`
FK: author_id->organizationmember.id, question_id->community_question.id, author_profile_id->profile.id

### community_question
PK: id
`community_question(id:bigint!, created_at:timestamp with time zone, body:text, author_id:bigint, votes:bigint, organization_id:uuid, slug:text, author_profile_id:uuid, course_id:uuid!)`
FK: author_id->organizationmember.id, organization_id->organization.id, author_profile_id->profile.id, course_id->course.id

### course
PK: id
`course(id:uuid!, created_at:timestamp with time zone, updated_at:timestamp with time zone, group_id:uuid, is_template:boolean, logo:text!, metadata:jsonb!, cost:bigint, banner_image:text, is_published:boolean, is_certificate_downloadable:boolean, certificate_theme:text, status:text!, type:COURSE_TYPE, version:COURSE_VERSION!)`
FK: group_id->group.id

### course_newsfeed
PK: id
`course_newsfeed(created_at:timestamp with time zone!, author_id:uuid, content:text, id:uuid!, course_id:uuid, reaction:jsonb, is_pinned:boolean!)`
FK: author_id->groupmember.id, course_id->course.id

### course_newsfeed_comment
PK: id
`course_newsfeed_comment(created_at:timestamp with time zone!, author_id:uuid, content:text, id:bigint!, course_newsfeed_id:uuid)`
FK: author_id->groupmember.id, course_newsfeed_id->course_newsfeed.id

### currency
PK: id
`currency(id:bigint!, created_at:timestamp with time zone)`

### email_verification_tokens
PK: id
`email_verification_tokens(id:uuid!, profile_id:uuid, token:text!, email:text!, created_at:timestamp with time zone, expires_at:timestamp with time zone!, used_at:timestamp with time zone, created_by_ip:inet, used_by_ip:inet)`
FK: profile_id->profile.id

### exercise
PK: id
`exercise(lesson_id:uuid, created_at:timestamp with time zone, updated_at:timestamp with time zone, id:uuid!, due_by:timestamp without time zone)`
FK: lesson_id->lesson.id

### group
PK: id
`group(id:uuid!, description:text, created_at:timestamp with time zone, updated_at:timestamp with time zone, organization_id:uuid)`
FK: organization_id->organization.id

### group_attendance
PK: id
`group_attendance(id:bigint!, created_at:timestamp with time zone, updated_at:timestamp with time zone, course_id:uuid, student_id:uuid, is_present:boolean, lesson_id:uuid!)`
FK: course_id->course.id, student_id->groupmember.id

### groupmember
PK: id
`groupmember(id:uuid!, group_id:uuid!, role_id:bigint!, profile_id:uuid, created_at:timestamp with time zone)`
FK: group_id->group.id, profile_id->profile.id, role_id->role.id

### lesson
PK: id
`lesson(course_id:uuid!, id:uuid!, created_at:timestamp with time zone, updated_at:timestamp with time zone, public:boolean, lesson_at:timestamp with time zone, teacher_id:uuid, is_complete:boolean, call_url:text, order:bigint, is_unlocked:boolean, videos:jsonb, section_id:uuid, documents:jsonb)`
FK: course_id->course.id, teacher_id->profile.id, section_id->lesson_section.id

### lesson_comment
PK: id
`lesson_comment(id:bigint!, created_at:timestamp with time zone!, updated_at:timestamp with time zone, lesson_id:uuid, groupmember_id:uuid, comment:text)`
FK: groupmember_id->groupmember.id, lesson_id->lesson.id

### lesson_completion
PK: id
`lesson_completion(id:bigint!, created_at:timestamp with time zone!, lesson_id:uuid, profile_id:uuid, is_complete:boolean, updated_at:timestamp with time zone)`
FK: profile_id->profile.id, lesson_id->lesson.id

### lesson_language
PK: id
`lesson_language(id:bigint!, content:text, lesson_id:uuid, locale:LOCALE)`
FK: lesson_id->lesson.id

### lesson_language_history
PK: id
`lesson_language_history(id:integer!, lesson_language_id:integer, old_content:text, new_content:text, timestamp:timestamp without time zone!)`
FK: lesson_language_id->lesson_language.id

### lesson_section
PK: id
`lesson_section(id:uuid!, created_at:timestamp with time zone!, updated_at:timestamp with time zone, order:bigint, course_id:uuid)`
FK: course_id->course.id

### option
PK: id
`option(id:bigint!, is_correct:boolean!, question_id:bigint!, value:uuid, created_at:timestamp with time zone, updated_at:timestamp with time zone)`
FK: question_id->question.id

### organization
PK: id
`organization(id:uuid!, siteName:text, avatar_url:text, settings:jsonb, landingpage:jsonb, theme:text, created_at:timestamp with time zone!, customization:json!, is_restricted:boolean!, customCode:text, customDomain:text, favicon:text, isCustomDomainVerified:boolean)`

### organization_contacts
PK: id
`organization_contacts(id:bigint!, created_at:timestamp with time zone!, email:text, phone:text, name:text, message:text, organization_id:uuid)`
FK: organization_id->organization.id

### organization_emaillist
PK: id
`organization_emaillist(id:bigint!, created_at:timestamp with time zone!, email:text, organization_id:uuid)`
FK: organization_id->organization.id

### organization_plan
PK: id
`organization_plan(id:bigint!, activated_at:timestamp with time zone!, org_id:uuid, plan_name:PLAN, is_active:boolean, deactivated_at:timestamp with time zone, updated_at:timestamp with time zone, payload:jsonb, triggered_by:bigint, provider:text, subscription_id:text)`
FK: org_id->organization.id, triggered_by->organizationmember.id

### organizationmember
PK: id
`organizationmember(id:bigint!, organization_id:uuid!, role_id:bigint!, profile_id:uuid, email:text, verified:boolean, created_at:timestamp with time zone!)`
FK: organization_id->organization.id, profile_id->profile.id, role_id->role.id

### profile
PK: id
`profile(id:uuid!, fullname:text!, username:text!, avatar_url:text, created_at:timestamp with time zone, updated_at:timestamp with time zone, can_add_course:boolean, metadata:json, telegram_chat_id:bigint, is_email_verified:boolean, verified_at:timestamp with time zone, locale:LOCALE, is_restricted:boolean!)`

### question
PK: id
`question(id:bigint!, question_type_id:bigint!, created_at:timestamp with time zone, updated_at:timestamp with time zone, exercise_id:uuid!, name:uuid, points:double precision, order:bigint)`
FK: question_type_id->question_type.id, exercise_id->exercise.id

### question_answer
PK: id
`question_answer(id:bigint!, answers:ARRAY, question_id:bigint!, open_answer:text, group_member_id:uuid!, submission_id:uuid, point:bigint)`
FK: group_member_id->groupmember.id, question_id->question.id, submission_id->submission.id

### question_type
PK: id
`question_type(id:bigint!, created_at:timestamp with time zone, updated_at:timestamp with time zone)`

### quiz
PK: id
`quiz(id:uuid!, created_at:timestamp with time zone, updated_at:timestamp with time zone, title:text, questions:json, organization_id:uuid!)`
FK: organization_id->organization.id

### quiz_play
PK: id
`quiz_play(id:bigint!, created_at:timestamp with time zone, updated_at:timestamp with time zone, quiz_id:uuid, players:json, started:boolean, currentQuestionId:bigint, showCurrentQuestionAnswer:boolean, isLastQuestion:boolean, step:text, studentStep:text, pin:text)`
FK: quiz_id->quiz.id

### role
PK: id
`role(id:bigint!, updated_at:timestamp with time zone, created_at:timestamp with time zone)`

### submission
PK: id
`submission(id:uuid!, reviewer_id:bigint, status_id:bigint, total:bigint, created_at:timestamp with time zone, updated_at:timestamp with time zone, exercise_id:uuid!, submitted_by:uuid, course_id:uuid, feedback:text)`
FK: status_id->submissionstatus.id, submitted_by->groupmember.id, exercise_id->exercise.id, course_id->course.id

### submissionstatus
PK: id
`submissionstatus(id:bigint!, updated_at:timestamp with time zone)`

### test_tenant
PK: id
`test_tenant(id:integer!, details:text)`

### video_transcripts
PK: id
`video_transcripts(id:bigint!, created_at:timestamp with time zone!, muse_svid:text, transcript:text, downloaded:boolean, link:text)`

### waitinglist
PK: id
`waitinglist(id:bigint!, created_at:timestamp with time zone)`

## Row-Level Security

- analytics_login_events: 2 policies
- apps_poll: 4 policies
- apps_poll_option: 4 policies
- apps_poll_submission: 4 policies
- community_answer: 4 policies
- community_question: 4 policies
- course: 4 policies
- course_newsfeed: 4 policies
- course_newsfeed_comment: 4 policies
- email_verification_tokens: 1 policies
- exercise: 4 policies
- group: 4 policies
- group_attendance: 4 policies
- groupmember: 4 policies
- lesson: 4 policies
- lesson_comment: 4 policies
- lesson_completion: 4 policies
- lesson_language: 4 policies
- lesson_language_history: 4 policies
- lesson_section: 4 policies
- option: 4 policies
- organization: 4 policies
- organization_contacts: 1 policies
- organization_emaillist: 1 policies
- organization_plan: 4 policies
- organizationmember: 6 policies
- profile: 4 policies
- question: 4 policies
- question_answer: 4 policies
- question_type: 1 policies
- quiz: 1 policies
- quiz_play: 1 policies
- role: 1 policies
- submission: 4 policies
- submissionstatus: 1 policies

---
*Extracted from local Supabase on 2026-03-13*
