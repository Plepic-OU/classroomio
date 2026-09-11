# Database Schema (public)

Extracted from the local Supabase Postgres instance (`information_schema`), container `supabase_db_classroomio`.
Not full DDL — name, type, PK/FK/nullability only. Regenerate: `.claude/skills/c4-model/scripts/extract-database.sh` (requires `supabase start`).

Generated: 2026-09-11T08:07:12Z · tables: 39

### analytics_login_events
- id (uuid) PK NOT NULL
- user_id (uuid) NOT NULL
- logged_in_at (timestamptz)

### apps_poll
- id (uuid) PK NOT NULL
- created_at (timestamptz) NOT NULL
- updated_at (timestamptz)
- question (text)
- authorId (uuid) → groupmember.id
- isPublic (bool)
- status (varchar)
- expiration (timestamptz)
- courseId (uuid) → course.id

### apps_poll_option
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- updated_at (timestamptz)
- poll_id (uuid) → apps_poll.id
- label (varchar)

### apps_poll_submission
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- poll_option_id (int8) → apps_poll_option.id
- selected_by_id (uuid) → groupmember.id
- poll_id (uuid) → apps_poll.id

### community_answer
- id (uuid) PK NOT NULL
- created_at (timestamptz)
- question_id (int8) → community_question.id
- body (varchar)
- author_id (int8) → organizationmember.id
- votes (int8)
- author_profile_id (uuid) → profile.id

### community_question
- id (int8) PK NOT NULL
- created_at (timestamptz)
- title (varchar)
- body (text)
- author_id (int8) → organizationmember.id
- votes (int8)
- organization_id (uuid) → organization.id
- slug (text)
- author_profile_id (uuid) → profile.id
- course_id (uuid) → course.id NOT NULL

### course
- title (varchar) NOT NULL
- description (varchar) NOT NULL
- overview (varchar)
- id (uuid) PK NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- group_id (uuid) → group.id
- is_template (bool)
- logo (text) NOT NULL
- slug (varchar)
- metadata (jsonb) NOT NULL
- cost (int8)
- currency (varchar) NOT NULL
- banner_image (text)
- is_published (bool)
- is_certificate_downloadable (bool)
- certificate_theme (text)
- status (text) NOT NULL
- type (COURSE_TYPE)
- version (COURSE_VERSION) NOT NULL

### course_newsfeed
- created_at (timestamptz) NOT NULL
- author_id (uuid) → groupmember.id
- content (text)
- id (uuid) PK NOT NULL
- course_id (uuid) → course.id
- reaction (jsonb)
- is_pinned (bool) NOT NULL

### course_newsfeed_comment
- created_at (timestamptz) NOT NULL
- author_id (uuid) → groupmember.id
- content (text)
- id (int8) PK NOT NULL
- course_newsfeed_id (uuid) → course_newsfeed.id

### currency
- id (int8) PK NOT NULL
- created_at (timestamptz)
- name (varchar)

### email_verification_tokens
- id (uuid) PK NOT NULL
- profile_id (uuid) → profile.id
- token (text) NOT NULL
- email (text) NOT NULL
- created_at (timestamptz)
- expires_at (timestamptz) NOT NULL
- used_at (timestamptz)
- created_by_ip (inet)
- used_by_ip (inet)

### exercise
- title (varchar) NOT NULL
- description (varchar)
- lesson_id (uuid) → lesson.id
- created_at (timestamptz)
- updated_at (timestamptz)
- id (uuid) PK NOT NULL
- due_by (timestamp)

### group
- id (uuid) PK NOT NULL
- name (varchar) NOT NULL
- description (text)
- created_at (timestamptz)
- updated_at (timestamptz)
- organization_id (uuid) → organization.id

### group_attendance
- id (int8) PK NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- course_id (uuid) → course.id
- student_id (uuid) → groupmember.id
- is_present (bool)
- lesson_id (uuid) NOT NULL

### groupmember
- id (uuid) PK NOT NULL
- group_id (uuid) → group.id NOT NULL
- role_id (int8) → role.id NOT NULL
- profile_id (uuid) → profile.id
- email (varchar)
- created_at (timestamptz)
- assigned_student_id (varchar)

### lesson
- note (varchar)
- video_url (varchar)
- slide_url (varchar)
- course_id (uuid) → course.id NOT NULL
- id (uuid) PK NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- title (varchar) NOT NULL
- public (bool)
- lesson_at (timestamptz)
- teacher_id (uuid) → profile.id
- is_complete (bool)
- call_url (text)
- order (int8)
- is_unlocked (bool)
- videos (jsonb)
- section_id (uuid) → lesson_section.id
- documents (jsonb)

### lesson_comment
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- updated_at (timestamptz)
- lesson_id (uuid) → lesson.id
- groupmember_id (uuid) → groupmember.id
- comment (text)

### lesson_completion
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- lesson_id (uuid) → lesson.id
- profile_id (uuid) → profile.id
- is_complete (bool)
- updated_at (timestamptz)

### lesson_language
- id (int8) PK NOT NULL
- content (text)
- lesson_id (uuid) → lesson.id
- locale (LOCALE)

### lesson_language_history
- id (int4) PK NOT NULL
- lesson_language_id (int4) → lesson_language.id
- old_content (text)
- new_content (text)
- timestamp (timestamp) NOT NULL

### lesson_section
- id (uuid) PK NOT NULL
- created_at (timestamptz) NOT NULL
- updated_at (timestamptz)
- title (varchar)
- order (int8)
- course_id (uuid) → course.id

### option
- id (int8) PK NOT NULL
- label (varchar) NOT NULL
- is_correct (bool) NOT NULL
- question_id (int8) → question.id NOT NULL
- value (uuid)
- created_at (timestamptz)
- updated_at (timestamptz)

### organization
- id (uuid) PK NOT NULL
- name (varchar) NOT NULL
- siteName (text)
- avatar_url (text)
- settings (jsonb)
- landingpage (jsonb)
- theme (text)
- created_at (timestamptz) NOT NULL
- customization (json) NOT NULL
- is_restricted (bool) NOT NULL
- customCode (text)
- customDomain (text)
- favicon (text)
- isCustomDomainVerified (bool)

### organization_contacts
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- email (text)
- phone (text)
- name (text)
- message (text)
- organization_id (uuid) → organization.id

### organization_emaillist
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- email (text)
- organization_id (uuid) → organization.id

### organizationmember
- id (int8) PK NOT NULL
- organization_id (uuid) → organization.id NOT NULL
- role_id (int8) → role.id NOT NULL
- profile_id (uuid) → profile.id
- email (text)
- verified (bool)
- created_at (timestamptz) NOT NULL

### organization_plan
- id (int8) PK NOT NULL
- activated_at (timestamptz) NOT NULL
- org_id (uuid) → organization.id
- plan_name (PLAN)
- is_active (bool)
- deactivated_at (timestamptz)
- updated_at (timestamptz)
- payload (jsonb)
- triggered_by (int8) → organizationmember.id
- provider (text)
- subscription_id (text)

### profile
- id (uuid) PK NOT NULL
- fullname (text) NOT NULL
- username (text) NOT NULL
- avatar_url (text)
- created_at (timestamptz)
- updated_at (timestamptz)
- email (varchar)
- can_add_course (bool)
- role (varchar)
- goal (varchar)
- source (varchar)
- metadata (json)
- telegram_chat_id (int8)
- is_email_verified (bool)
- verified_at (timestamptz)
- locale (LOCALE)
- is_restricted (bool) NOT NULL

### question
- id (int8) PK NOT NULL
- question_type_id (int8) → question_type.id NOT NULL
- title (varchar) NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- exercise_id (uuid) → exercise.id NOT NULL
- name (uuid)
- points (float8)
- order (int8)

### question_answer
- id (int8) PK NOT NULL
- answers (_varchar)
- question_id (int8) → question.id NOT NULL
- open_answer (text)
- group_member_id (uuid) → groupmember.id NOT NULL
- submission_id (uuid) → submission.id
- point (int8)

### question_type
- id (int8) PK NOT NULL
- label (varchar) NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- typename (varchar)

### quiz
- id (uuid) PK NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- title (text)
- questions (json)
- timelimit (varchar)
- theme (varchar)
- organization_id (uuid) → organization.id NOT NULL

### quiz_play
- id (int8) PK NOT NULL
- created_at (timestamptz)
- updated_at (timestamptz)
- quiz_id (uuid) → quiz.id
- players (json)
- started (bool)
- currentQuestionId (int8)
- showCurrentQuestionAnswer (bool)
- isLastQuestion (bool)
- step (text)
- studentStep (text)
- pin (text)

### role
- type (varchar) NOT NULL
- description (varchar)
- id (int8) PK NOT NULL
- updated_at (timestamptz)
- created_at (timestamptz)

### submission
- id (uuid) PK NOT NULL
- reviewer_id (int8)
- status_id (int8) → submissionstatus.id
- total (int8)
- created_at (timestamptz)
- updated_at (timestamptz)
- exercise_id (uuid) → exercise.id NOT NULL
- submitted_by (uuid) → groupmember.id
- course_id (uuid) → course.id
- feedback (text)

### submissionstatus
- id (int8) PK NOT NULL
- label (varchar) NOT NULL
- updated_at (timestamptz)

### test_tenant
- id (int4) PK NOT NULL
- details (text)

### video_transcripts
- id (int8) PK NOT NULL
- created_at (timestamptz) NOT NULL
- muse_svid (text)
- transcript (text)
- downloaded (bool)
- link (text)

### waitinglist
- id (int8) PK NOT NULL
- email (varchar) NOT NULL
- created_at (timestamptz)

