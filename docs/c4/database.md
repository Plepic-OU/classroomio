# ClassroomIO Database Schema

_Generated: 2026-03-13T08:35:08Z from local Supabase. Schema: `public`._

## Tables

### analytics_login_events (3 cols)
- id: uuid PK
- user_id: uuid NN
- logged_in_at: timestamp with time zone

### apps_poll (9 cols)
- id: uuid PK
- created_at: timestamp with time zone NN
- updated_at: timestamp with time zone
- question: text
- authorId: uuid FK→groupmember.id
- isPublic: boolean
- status: character varying
- expiration: timestamp with time zone
- courseId: uuid FK→course.id

### apps_poll_option (5 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- updated_at: timestamp with time zone
- poll_id: uuid FK→apps_poll.id
- label: character varying

### apps_poll_submission (5 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- poll_option_id: bigint FK→apps_poll_option.id
- selected_by_id: uuid FK→groupmember.id
- poll_id: uuid FK→apps_poll.id

### community_answer (7 cols)
- id: uuid PK
- created_at: timestamp with time zone
- question_id: bigint FK→community_question.id
- body: character varying
- author_id: bigint FK→organizationmember.id
- votes: bigint
- author_profile_id: uuid FK→profile.id

### community_question (10 cols)
- id: bigint PK
- created_at: timestamp with time zone
- title: character varying
- body: text
- author_id: bigint FK→organizationmember.id
- votes: bigint
- organization_id: uuid FK→organization.id
- slug: text
- author_profile_id: uuid FK→profile.id
- course_id: uuid FK→course.id NN

### course (20 cols)
- title: character varying NN
- description: character varying NN
- overview: character varying
- id: uuid PK
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- group_id: uuid FK→group.id
- is_template: boolean
- logo: text NN
- slug: character varying
- metadata: jsonb NN
- cost: bigint
- currency: character varying NN
- banner_image: text
- is_published: boolean
- is_certificate_downloadable: boolean
- certificate_theme: text
- status: text NN
- type: USER-DEFINED
- version: USER-DEFINED NN

### course_newsfeed (7 cols)
- created_at: timestamp with time zone NN
- author_id: uuid FK→groupmember.id
- content: text
- id: uuid PK
- course_id: uuid FK→course.id
- reaction: jsonb
- is_pinned: boolean NN

### course_newsfeed_comment (5 cols)
- created_at: timestamp with time zone NN
- author_id: uuid FK→groupmember.id
- content: text
- id: bigint PK
- course_newsfeed_id: uuid FK→course_newsfeed.id

### currency (3 cols)
- id: bigint PK
- created_at: timestamp with time zone
- name: character varying

### email_verification_tokens (9 cols)
- id: uuid PK
- profile_id: uuid FK→profile.id
- token: text NN
- email: text NN
- created_at: timestamp with time zone
- expires_at: timestamp with time zone NN
- used_at: timestamp with time zone
- created_by_ip: inet
- used_by_ip: inet

### exercise (7 cols)
- title: character varying NN
- description: character varying
- lesson_id: uuid FK→lesson.id
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- id: uuid PK
- due_by: timestamp without time zone

### group (6 cols)
- id: uuid PK
- name: character varying NN
- description: text
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- organization_id: uuid FK→organization.id

### group_attendance (7 cols)
- id: bigint PK
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- course_id: uuid FK→course.id
- student_id: uuid FK→groupmember.id
- is_present: boolean
- lesson_id: uuid NN

### groupmember (7 cols)
- id: uuid PK
- group_id: uuid FK→group.id NN
- role_id: bigint FK→role.id NN
- profile_id: uuid FK→profile.id
- email: character varying
- created_at: timestamp with time zone
- assigned_student_id: character varying

### lesson (18 cols)
- note: character varying
- video_url: character varying
- slide_url: character varying
- course_id: uuid FK→course.id NN
- id: uuid PK
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- title: character varying NN
- public: boolean
- lesson_at: timestamp with time zone
- teacher_id: uuid FK→profile.id
- is_complete: boolean
- call_url: text
- order: bigint
- is_unlocked: boolean
- videos: jsonb
- section_id: uuid FK→lesson_section.id
- documents: jsonb

### lesson_comment (6 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- updated_at: timestamp with time zone
- lesson_id: uuid FK→lesson.id
- groupmember_id: uuid FK→groupmember.id
- comment: text

### lesson_completion (6 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- lesson_id: uuid FK→lesson.id
- profile_id: uuid FK→profile.id
- is_complete: boolean
- updated_at: timestamp with time zone

### lesson_language (4 cols)
- id: bigint PK
- content: text
- lesson_id: uuid FK→lesson.id
- locale: USER-DEFINED

### lesson_language_history (5 cols)
- id: integer PK
- lesson_language_id: integer FK→lesson_language.id
- old_content: text
- new_content: text
- timestamp: timestamp without time zone NN

### lesson_section (6 cols)
- id: uuid PK
- created_at: timestamp with time zone NN
- updated_at: timestamp with time zone
- title: character varying
- order: bigint
- course_id: uuid FK→course.id

### option (7 cols)
- id: bigint PK
- label: character varying NN
- is_correct: boolean NN
- question_id: bigint FK→question.id NN
- value: uuid
- created_at: timestamp with time zone
- updated_at: timestamp with time zone

### organization (14 cols)
- id: uuid PK
- name: character varying NN
- siteName: text
- avatar_url: text
- settings: jsonb
- landingpage: jsonb
- theme: text
- created_at: timestamp with time zone NN
- customization: json NN
- is_restricted: boolean NN
- customCode: text
- customDomain: text
- favicon: text
- isCustomDomainVerified: boolean

### organization_contacts (7 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- email: text
- phone: text
- name: text
- message: text
- organization_id: uuid FK→organization.id

### organization_emaillist (4 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- email: text
- organization_id: uuid FK→organization.id

### organization_plan (11 cols)
- id: bigint PK
- activated_at: timestamp with time zone NN
- org_id: uuid FK→organization.id
- plan_name: USER-DEFINED
- is_active: boolean
- deactivated_at: timestamp with time zone
- updated_at: timestamp with time zone
- payload: jsonb
- triggered_by: bigint FK→organizationmember.id
- provider: text
- subscription_id: text

### organizationmember (7 cols)
- id: bigint PK
- organization_id: uuid FK→organization.id NN
- role_id: bigint FK→role.id NN
- profile_id: uuid FK→profile.id
- email: text
- verified: boolean
- created_at: timestamp with time zone NN

### profile (17 cols)
- id: uuid PK
- fullname: text NN
- username: text NN
- avatar_url: text
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- email: character varying
- can_add_course: boolean
- role: character varying
- goal: character varying
- source: character varying
- metadata: json
- telegram_chat_id: bigint
- is_email_verified: boolean
- verified_at: timestamp with time zone
- locale: USER-DEFINED
- is_restricted: boolean NN

### question (9 cols)
- id: bigint PK
- question_type_id: bigint FK→question_type.id NN
- title: character varying NN
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- exercise_id: uuid FK→exercise.id NN
- name: uuid
- points: double precision
- order: bigint

### question_answer (7 cols)
- id: bigint PK
- answers: ARRAY
- question_id: bigint FK→question.id NN
- open_answer: text
- group_member_id: uuid FK→groupmember.id NN
- submission_id: uuid FK→submission.id
- point: bigint

### question_type (5 cols)
- id: bigint PK
- label: character varying NN
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- typename: character varying

### quiz (8 cols)
- id: uuid PK
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- title: text
- questions: json
- timelimit: character varying
- theme: character varying
- organization_id: uuid FK→organization.id NN

### quiz_play (12 cols)
- id: bigint PK
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- quiz_id: uuid FK→quiz.id
- players: json
- started: boolean
- currentQuestionId: bigint
- showCurrentQuestionAnswer: boolean
- isLastQuestion: boolean
- step: text
- studentStep: text
- pin: text

### role (5 cols)
- type: character varying NN
- description: character varying
- id: bigint PK
- updated_at: timestamp with time zone
- created_at: timestamp with time zone

### submission (10 cols)
- id: uuid PK
- reviewer_id: bigint
- status_id: bigint FK→submissionstatus.id
- total: bigint
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- exercise_id: uuid FK→exercise.id NN
- submitted_by: uuid FK→groupmember.id
- course_id: uuid FK→course.id
- feedback: text

### submissionstatus (3 cols)
- id: bigint PK
- label: character varying NN
- updated_at: timestamp with time zone

### test_tenant (2 cols)
- id: integer PK
- details: text

### video_transcripts (6 cols)
- id: bigint PK
- created_at: timestamp with time zone NN
- muse_svid: text
- transcript: text
- downloaded: boolean
- link: text

### waitinglist (3 cols)
- id: bigint PK
- email: character varying NN
- created_at: timestamp with time zone

## Enums

- COURSE_TYPE: SELF_PACED, LIVE_CLASS
- COURSE_VERSION: V1, V2
- LOCALE: en, hi, fr, pt, de, vi, ru, es, pl, da
- PLAN: EARLY_ADOPTER, ENTERPRISE, BASIC
