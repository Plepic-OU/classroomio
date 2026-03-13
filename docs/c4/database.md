# ClassroomIO Database Schema

> Auto-generated from local Supabase. Token-efficient format for AI context.

### analytics_login_events

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | - |
| logged_in_at | timestamp with time zone | YES | now() |

### apps_poll

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | YES | now() |
| question | text | YES | - |
| authorId | uuid | YES | - |
| isPublic | boolean | YES | - |
| status | character varying | YES | 'draft'::character varying |
| expiration | timestamp with time zone | YES | - |
| courseId | uuid | YES | - |

### apps_poll_option

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | YES | - |
| poll_id | uuid | YES | - |
| label | character varying | YES | - |

### apps_poll_submission

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| poll_option_id | bigint | YES | - |
| selected_by_id | uuid | YES | - |
| poll_id | uuid | YES | - |

### community_answer

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | extensions.gen_random_uuid() |
| created_at | timestamp with time zone | YES | now() |
| question_id | bigint | YES | - |
| body | character varying | YES | - |
| author_id | bigint | YES | - |
| votes | bigint | YES | - |
| author_profile_id | uuid | YES | - |

### community_question

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | YES | now() |
| title | character varying | YES | - |
| body | text | YES | - |
| author_id | bigint | YES | - |
| votes | bigint | YES | '0'::bigint |
| organization_id | uuid | YES | - |
| slug | text | YES | - |
| author_profile_id | uuid | YES | - |
| course_id | uuid | NO | - |

### course

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| title | character varying | NO | - |
| description | character varying | NO | - |
| overview | character varying | YES | 'Welcome to this amazing course 🚀 '::character varying |
| id | uuid | NO | uuid_generate_v4() |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| group_id | uuid | YES | - |
| is_template | boolean | YES | true |
| logo | text | NO | ''::text |
| slug | character varying | YES | - |
| metadata | jsonb | NO | '{"goals": "", "description": "", "requirements": ""}'::json |
| cost | bigint | YES | '0'::bigint |
| currency | character varying | NO | 'USD'::character varying |
| banner_image | text | YES | - |
| is_published | boolean | YES | false |
| is_certificate_downloadable | boolean | YES | false |
| certificate_theme | text | YES | - |
| status | text | NO | 'ACTIVE'::text |
| type | USER-DEFINED | YES | 'LIVE_CLASS'::"COURSE_TYPE" |
| version | USER-DEFINED | NO | 'V1'::"COURSE_VERSION" |

### course_newsfeed

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| created_at | timestamp with time zone | NO | now() |
| author_id | uuid | YES | - |
| content | text | YES | - |
| id | uuid | NO | gen_random_uuid() |
| course_id | uuid | YES | - |
| reaction | jsonb | YES | '{"clap": [], "smile": [], "thumbsup": [], "thumbsdown": []} |
| is_pinned | boolean | NO | false |

### course_newsfeed_comment

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| created_at | timestamp with time zone | NO | now() |
| author_id | uuid | YES | - |
| content | text | YES | - |
| id | bigint | NO | - |
| course_newsfeed_id | uuid | YES | - |

### currency

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | YES | now() |
| name | character varying | YES | - |

### email_verification_tokens

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| profile_id | uuid | YES | - |
| token | text | NO | - |
| email | text | NO | - |
| created_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| expires_at | timestamp with time zone | NO | - |
| used_at | timestamp with time zone | YES | - |
| created_by_ip | inet | YES | - |
| used_by_ip | inet | YES | - |

### exercise

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| title | character varying | NO | - |
| description | character varying | YES | - |
| lesson_id | uuid | YES | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| id | uuid | NO | uuid_generate_v4() |
| due_by | timestamp without time zone | YES | - |

### group

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | character varying | NO | - |
| description | text | YES | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| organization_id | uuid | YES | - |

### group_attendance

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| course_id | uuid | YES | - |
| student_id | uuid | YES | - |
| is_present | boolean | YES | false |
| lesson_id | uuid | NO | - |

### groupmember

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| group_id | uuid | NO | - |
| role_id | bigint | NO | - |
| profile_id | uuid | YES | - |
| email | character varying | YES | - |
| created_at | timestamp with time zone | YES | now() |
| assigned_student_id | character varying | YES | - |

### lesson

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| note | character varying | YES | - |
| video_url | character varying | YES | - |
| slide_url | character varying | YES | - |
| course_id | uuid | NO | - |
| id | uuid | NO | uuid_generate_v4() |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| title | character varying | NO | - |
| public | boolean | YES | false |
| lesson_at | timestamp with time zone | YES | now() |
| teacher_id | uuid | YES | - |
| is_complete | boolean | YES | false |
| call_url | text | YES | - |
| order | bigint | YES | - |
| is_unlocked | boolean | YES | false |
| videos | jsonb | YES | '[]'::jsonb |
| section_id | uuid | YES | - |
| documents | jsonb | YES | '[]'::jsonb |

### lesson_comment

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | YES | now() |
| lesson_id | uuid | YES | - |
| groupmember_id | uuid | YES | - |
| comment | text | YES | - |

### lesson_completion

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| lesson_id | uuid | YES | - |
| profile_id | uuid | YES | - |
| is_complete | boolean | YES | false |
| updated_at | timestamp with time zone | YES | now() |

### lesson_language

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| content | text | YES | - |
| lesson_id | uuid | YES | gen_random_uuid() |
| locale | USER-DEFINED | YES | 'en'::"LOCALE" |

### lesson_language_history

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | nextval('lesson_language_history_id_seq'::regclass) |
| lesson_language_id | integer | YES | - |
| old_content | text | YES | - |
| new_content | text | YES | - |
| timestamp | timestamp without time zone | NO | CURRENT_TIMESTAMP |

### lesson_section

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | YES | now() |
| title | character varying | YES | - |
| order | bigint | YES | '0'::bigint |
| course_id | uuid | YES | - |

### option

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| label | character varying | NO | - |
| is_correct | boolean | NO | false |
| question_id | bigint | NO | - |
| value | uuid | YES | extensions.gen_random_uuid() |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |

### organization

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| name | character varying | NO | - |
| siteName | text | YES | - |
| avatar_url | text | YES | - |
| settings | jsonb | YES | '{}'::jsonb |
| landingpage | jsonb | YES | '{}'::jsonb |
| theme | text | YES | - |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| customization | json | NO | '{"apps":{"poll":true,"comments":true},"course":{"grading":t |
| is_restricted | boolean | NO | false |
| customCode | text | YES | - |
| customDomain | text | YES | - |
| favicon | text | YES | - |
| isCustomDomainVerified | boolean | YES | false |

### organization_contacts

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| email | text | YES | - |
| phone | text | YES | - |
| name | text | YES | - |
| message | text | YES | - |
| organization_id | uuid | YES | - |

### organization_emaillist

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| email | text | YES | - |
| organization_id | uuid | YES | - |

### organization_plan

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| activated_at | timestamp with time zone | NO | now() |
| org_id | uuid | YES | - |
| plan_name | USER-DEFINED | YES | - |
| is_active | boolean | YES | - |
| deactivated_at | timestamp with time zone | YES | - |
| updated_at | timestamp with time zone | YES | now() |
| payload | jsonb | YES | - |
| triggered_by | bigint | YES | - |
| provider | text | YES | 'lmz'::text |
| subscription_id | text | YES | - |

### organizationmember

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| organization_id | uuid | NO | - |
| role_id | bigint | NO | - |
| profile_id | uuid | YES | - |
| email | text | YES | - |
| verified | boolean | YES | false |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |

### profile

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | - |
| fullname | text | NO | - |
| username | text | NO | - |
| avatar_url | text | YES | 'https://pgrest.classroomio.com/storage/v1/object/public/ava |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| email | character varying | YES | - |
| can_add_course | boolean | YES | true |
| role | character varying | YES | - |
| goal | character varying | YES | - |
| source | character varying | YES | - |
| metadata | json | YES | - |
| telegram_chat_id | bigint | YES | - |
| is_email_verified | boolean | YES | false |
| verified_at | timestamp with time zone | YES | - |
| locale | USER-DEFINED | YES | 'en'::"LOCALE" |
| is_restricted | boolean | NO | false |

### question

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| question_type_id | bigint | NO | - |
| title | character varying | NO | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| exercise_id | uuid | NO | - |
| name | uuid | YES | extensions.gen_random_uuid() |
| points | double precision | YES | - |
| order | bigint | YES | - |

### question_answer

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| answers | ARRAY | YES | - |
| question_id | bigint | NO | - |
| open_answer | text | YES | - |
| group_member_id | uuid | NO | - |
| submission_id | uuid | YES | - |
| point | bigint | YES | '0'::bigint |

### question_type

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| label | character varying | NO | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| typename | character varying | YES | - |

### quiz

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | extensions.gen_random_uuid() |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| title | text | YES | - |
| questions | json | YES | - |
| timelimit | character varying | YES | '10s'::character varying |
| theme | character varying | YES | 'standard'::character varying |
| organization_id | uuid | NO | - |

### quiz_play

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| quiz_id | uuid | YES | - |
| players | json | YES | '[]'::json |
| started | boolean | YES | false |
| currentQuestionId | bigint | YES | '0'::bigint |
| showCurrentQuestionAnswer | boolean | YES | false |
| isLastQuestion | boolean | YES | - |
| step | text | YES | 'CONNECT_TO_PLAY'::text |
| studentStep | text | YES | 'PIN_SETUP'::text |
| pin | text | YES | - |

### role

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| type | character varying | NO | - |
| description | character varying | YES | - |
| id | bigint | NO | - |
| updated_at | timestamp with time zone | YES | now() |
| created_at | timestamp with time zone | YES | now() |

### submission

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | uuid_generate_v4() |
| reviewer_id | bigint | YES | - |
| status_id | bigint | YES | '1'::bigint |
| total | bigint | YES | '0'::bigint |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |
| exercise_id | uuid | NO | - |
| submitted_by | uuid | YES | - |
| course_id | uuid | YES | - |
| feedback | text | YES | - |

### submissionstatus

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| label | character varying | NO | - |
| updated_at | timestamp with time zone | YES | now() |

### test_tenant

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | nextval('test_tenant_id_seq'::regclass) |
| details | text | YES | - |

### video_transcripts

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| created_at | timestamp with time zone | NO | now() |
| muse_svid | text | YES | - |
| transcript | text | YES | - |
| downloaded | boolean | YES | false |
| link | text | YES | - |

### waitinglist

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | bigint | NO | - |
| email | character varying | NO | - |
| created_at | timestamp with time zone | YES | now() |

## Foreign Keys

| Table | Column | References |
|-------|--------|------------|
| apps_poll | authorId | groupmember(id) |
| apps_poll | courseId | course(id) |
| apps_poll_option | poll_id | apps_poll(id) |
| apps_poll_submission | poll_id | apps_poll(id) |
| apps_poll_submission | poll_option_id | apps_poll_option(id) |
| apps_poll_submission | selected_by_id | groupmember(id) |
| community_answer | author_id | organizationmember(id) |
| community_answer | author_profile_id | profile(id) |
| community_answer | question_id | community_question(id) |
| community_question | author_id | organizationmember(id) |
| community_question | author_profile_id | profile(id) |
| community_question | course_id | course(id) |
| community_question | organization_id | organization(id) |
| course | group_id | group(id) |
| course_newsfeed | author_id | groupmember(id) |
| course_newsfeed | course_id | course(id) |
| course_newsfeed_comment | author_id | groupmember(id) |
| course_newsfeed_comment | course_newsfeed_id | course_newsfeed(id) |
| email_verification_tokens | profile_id | profile(id) |
| exercise | lesson_id | lesson(id) |
| group | organization_id | organization(id) |
| group_attendance | course_id | course(id) |
| group_attendance | student_id | groupmember(id) |
| groupmember | group_id | group(id) |
| groupmember | profile_id | profile(id) |
| groupmember | role_id | role(id) |
| lesson | course_id | course(id) |
| lesson | section_id | lesson_section(id) |
| lesson | teacher_id | profile(id) |
| lesson_comment | groupmember_id | groupmember(id) |
| lesson_comment | lesson_id | lesson(id) |
| lesson_completion | lesson_id | lesson(id) |
| lesson_completion | profile_id | profile(id) |
| lesson_language | lesson_id | lesson(id) |
| lesson_language_history | lesson_language_id | lesson_language(id) |
| lesson_section | course_id | course(id) |
| option | question_id | question(id) |
| organization_contacts | organization_id | organization(id) |
| organization_emaillist | organization_id | organization(id) |
| organization_plan | org_id | organization(id) |
| organization_plan | triggered_by | organizationmember(id) |
| organizationmember | organization_id | organization(id) |
| organizationmember | profile_id | profile(id) |
| organizationmember | role_id | role(id) |
| question | exercise_id | exercise(id) |
| question | question_type_id | question_type(id) |
| question_answer | group_member_id | groupmember(id) |
| question_answer | question_id | question(id) |
| question_answer | submission_id | submission(id) |
| quiz | organization_id | organization(id) |
| quiz_play | quiz_id | quiz(id) |
| submission | course_id | course(id) |
| submission | exercise_id | exercise(id) |
| submission | status_id | submissionstatus(id) |
| submission | submitted_by | groupmember(id) |

---
*Generated on 2026-03-13T07:49:23Z*
