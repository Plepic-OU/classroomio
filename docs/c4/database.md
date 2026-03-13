# Database Schema

Token-efficient schema reference extracted from local Supabase.

## Tables

### analytics_login_events

```
  id uuid =uuid_generate_v4()
  user_id uuid
  logged_in_at timestamp with time zone ? =now()
```

### apps_poll

```
  id uuid =gen_random_uuid()
  created_at timestamp with time zone =now()
  updated_at timestamp with time zone ? =now()
  question text ?
  authorId uuid ?
  isPublic boolean ?
  status  ? ='draft'::character varying
  expiration timestamp with time zone ?
  courseId uuid ?
```

### apps_poll_option

```
  id bigint
  created_at timestamp with time zone =now()
  updated_at timestamp with time zone ?
  poll_id uuid ?
  label  ?
```

### apps_poll_submission

```
  id bigint
  created_at timestamp with time zone =now()
  poll_option_id bigint ?
  selected_by_id uuid ?
  poll_id uuid ?
```

### community_answer

```
  id uuid =extensions.gen_random_uuid()
  created_at timestamp with time zone ? =now()
  question_id bigint ?
  body  ?
  author_id bigint ?
  votes bigint ?
  author_profile_id uuid ?
```

### community_question

```
  id bigint
  created_at timestamp with time zone ? =now()
  title  ?
  body text ?
  author_id bigint ?
  votes bigint ? ='0'::bigint
  organization_id uuid ?
  slug text ?
  author_profile_id uuid ?
  course_id uuid
```

### course

```
  title 
  description 
  overview  ? ='Welcome to this amazing cours...
  id uuid =uuid_generate_v4()
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  group_id uuid ?
  is_template boolean ? =true
  logo text =''::text
  slug  ?
  metadata jsonb ='{"goals": "", "description": ...
  cost bigint ? ='0'::bigint
  currency  ='USD'::character varying
  banner_image text ?
  is_published boolean ? =false
  is_certificate_downloadable boolean ? =false
  certificate_theme text ?
  status text ='ACTIVE'::text
  type COURSE_TYPE ? ='LIVE_CLASS'::"COURSE_TYPE"
  version COURSE_VERSION ='V1'::"COURSE_VERSION"
```

### course_newsfeed

```
  created_at timestamp with time zone =now()
  author_id uuid ?
  content text ?
  id uuid =gen_random_uuid()
  course_id uuid ?
  reaction jsonb ? ='{"clap": [], "smile": [], "th...
  is_pinned boolean =false
```

### course_newsfeed_comment

```
  created_at timestamp with time zone =now()
  author_id uuid ?
  content text ?
  id bigint
  course_newsfeed_id uuid ?
```

### currency

```
  id bigint
  created_at timestamp with time zone ? =now()
  name  ?
```

### email_verification_tokens

```
  id uuid =gen_random_uuid()
  profile_id uuid ?
  token text
  email text
  created_at timestamp with time zone ? =timezone('utc'::text, now())
  expires_at timestamp with time zone
  used_at timestamp with time zone ?
  created_by_ip inet ?
  used_by_ip inet ?
```

### exercise

```
  title 
  description  ?
  lesson_id uuid ?
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  id uuid =uuid_generate_v4()
  due_by timestamp without time zone ?
```

### group

```
  id uuid =uuid_generate_v4()
  name 
  description text ?
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  organization_id uuid ?
```

### group_attendance

```
  id bigint
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  course_id uuid ?
  student_id uuid ?
  is_present boolean ? =false
  lesson_id uuid
```

### groupmember

```
  id uuid =uuid_generate_v4()
  group_id uuid
  role_id bigint
  profile_id uuid ?
  email  ?
  created_at timestamp with time zone ? =now()
  assigned_student_id  ?
```

### lesson

```
  note  ?
  video_url  ?
  slide_url  ?
  course_id uuid
  id uuid =uuid_generate_v4()
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  title 
  public boolean ? =false
  lesson_at timestamp with time zone ? =now()
  teacher_id uuid ?
  is_complete boolean ? =false
  call_url text ?
  order bigint ?
  is_unlocked boolean ? =false
  videos jsonb ? ='[]'::jsonb
  section_id uuid ?
  documents jsonb ? ='[]'::jsonb
```

### lesson_comment

```
  id bigint
  created_at timestamp with time zone =now()
  updated_at timestamp with time zone ? =now()
  lesson_id uuid ?
  groupmember_id uuid ?
  comment text ?
```

### lesson_completion

```
  id bigint
  created_at timestamp with time zone =now()
  lesson_id uuid ?
  profile_id uuid ?
  is_complete boolean ? =false
  updated_at timestamp with time zone ? =now()
```

### lesson_language

```
  id bigint
  content text ?
  lesson_id uuid ? =gen_random_uuid()
  locale LOCALE ? ='en'::"LOCALE"
```

### lesson_language_history

```
  id integer =serial
  lesson_language_id integer ?
  old_content text ?
  new_content text ?
  timestamp timestamp without time zone =CURRENT_TIMESTAMP
```

### lesson_section

```
  id uuid =gen_random_uuid()
  created_at timestamp with time zone =now()
  updated_at timestamp with time zone ? =now()
  title  ?
  order bigint ? ='0'::bigint
  course_id uuid ?
```

### option

```
  id bigint
  label 
  is_correct boolean =false
  question_id bigint
  value uuid ? =extensions.gen_random_uuid()
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
```

### organization

```
  id uuid =uuid_generate_v4()
  name 
  siteName text ?
  avatar_url text ?
  settings jsonb ? ='{}'::jsonb
  landingpage jsonb ? ='{}'::jsonb
  theme text ?
  created_at timestamp with time zone =timezone('utc'::text, now())
  customization json ='{"apps":{"poll":true,"comment...
  is_restricted boolean =false
  customCode text ?
  customDomain text ?
  favicon text ?
  isCustomDomainVerified boolean ? =false
```

### organization_contacts

```
  id bigint
  created_at timestamp with time zone =now()
  email text ?
  phone text ?
  name text ?
  message text ?
  organization_id uuid ?
```

### organization_emaillist

```
  id bigint
  created_at timestamp with time zone =now()
  email text ?
  organization_id uuid ?
```

### organization_plan

```
  id bigint
  activated_at timestamp with time zone =now()
  org_id uuid ?
  plan_name PLAN ?
  is_active boolean ?
  deactivated_at timestamp with time zone ?
  updated_at timestamp with time zone ? =now()
  payload jsonb ?
  triggered_by bigint ?
  provider text ? ='lmz'::text
  subscription_id text ?
```

### organizationmember

```
  id bigint
  organization_id uuid
  role_id bigint
  profile_id uuid ?
  email text ?
  verified boolean ? =false
  created_at timestamp with time zone =timezone('utc'::text, now())
```

### profile

```
  id uuid
  fullname text
  username text
  avatar_url text ? ='https://pgrest.classroomio.co...
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  email  ?
  can_add_course boolean ? =true
  role  ?
  goal  ?
  source  ?
  metadata json ?
  telegram_chat_id bigint ?
  is_email_verified boolean ? =false
  verified_at timestamp with time zone ?
  locale LOCALE ? ='en'::"LOCALE"
  is_restricted boolean =false
```

### question

```
  id bigint
  question_type_id bigint
  title 
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  exercise_id uuid
  name uuid ? =extensions.gen_random_uuid()
  points double precision ?
  order bigint ?
```

### question_answer

```
  id bigint
  answers ARRAY ?
  question_id bigint
  open_answer text ?
  group_member_id uuid
  submission_id uuid ?
  point bigint ? ='0'::bigint
```

### question_type

```
  id bigint
  label 
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  typename  ?
```

### quiz

```
  id uuid =extensions.gen_random_uuid()
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  title text ?
  questions json ?
  timelimit  ? ='10s'::character varying
  theme  ? ='standard'::character varying
  organization_id uuid
```

### quiz_play

```
  id bigint
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  quiz_id uuid ?
  players json ? ='[]'::json
  started boolean ? =false
  currentQuestionId bigint ? ='0'::bigint
  showCurrentQuestionAnswer boolean ? =false
  isLastQuestion boolean ?
  step text ? ='CONNECT_TO_PLAY'::text
  studentStep text ? ='PIN_SETUP'::text
  pin text ?
```

### role

```
  type 
  description  ?
  id bigint
  updated_at timestamp with time zone ? =now()
  created_at timestamp with time zone ? =now()
```

### submission

```
  id uuid =uuid_generate_v4()
  reviewer_id bigint ?
  status_id bigint ? ='1'::bigint
  total bigint ? ='0'::bigint
  created_at timestamp with time zone ? =now()
  updated_at timestamp with time zone ? =now()
  exercise_id uuid
  submitted_by uuid ?
  course_id uuid ?
  feedback text ?
```

### submissionstatus

```
  id bigint
  label 
  updated_at timestamp with time zone ? =now()
```

### test_tenant

```
  id integer =serial
  details text ?
```

### video_transcripts

```
  id bigint
  created_at timestamp with time zone =now()
  muse_svid text ?
  transcript text ?
  downloaded boolean ? =false
  link text ?
```

### waitinglist

```
  id bigint
  email 
  created_at timestamp with time zone ? =now()
```

## Foreign Keys

```
apps_poll.authorId -> groupmember.id
apps_poll.courseId -> course.id
apps_poll_option.poll_id -> apps_poll.id
apps_poll_submission.poll_id -> apps_poll.id
apps_poll_submission.poll_option_id -> apps_poll_option.id
apps_poll_submission.selected_by_id -> groupmember.id
community_answer.author_id -> organizationmember.id
community_answer.author_profile_id -> profile.id
community_answer.question_id -> community_question.id
community_question.author_id -> organizationmember.id
community_question.author_profile_id -> profile.id
community_question.course_id -> course.id
community_question.organization_id -> organization.id
course.group_id -> group.id
course_newsfeed.author_id -> groupmember.id
course_newsfeed.course_id -> course.id
course_newsfeed_comment.author_id -> groupmember.id
course_newsfeed_comment.course_newsfeed_id -> course_newsfeed.id
email_verification_tokens.profile_id -> profile.id
exercise.lesson_id -> lesson.id
group.organization_id -> organization.id
group_attendance.course_id -> course.id
group_attendance.student_id -> groupmember.id
groupmember.group_id -> group.id
groupmember.profile_id -> profile.id
groupmember.role_id -> role.id
lesson.course_id -> course.id
lesson.section_id -> lesson_section.id
lesson.teacher_id -> profile.id
lesson_comment.groupmember_id -> groupmember.id
lesson_comment.lesson_id -> lesson.id
lesson_completion.lesson_id -> lesson.id
lesson_completion.profile_id -> profile.id
lesson_language.lesson_id -> lesson.id
lesson_language_history.lesson_language_id -> lesson_language.id
lesson_section.course_id -> course.id
option.question_id -> question.id
organization_contacts.organization_id -> organization.id
organization_emaillist.organization_id -> organization.id
organization_plan.org_id -> organization.id
organization_plan.triggered_by -> organizationmember.id
organizationmember.organization_id -> organization.id
organizationmember.profile_id -> profile.id
organizationmember.role_id -> role.id
question.exercise_id -> exercise.id
question.question_type_id -> question_type.id
question_answer.group_member_id -> groupmember.id
question_answer.question_id -> question.id
question_answer.submission_id -> submission.id
quiz.organization_id -> organization.id
quiz_play.quiz_id -> quiz.id
submission.course_id -> course.id
submission.exercise_id -> exercise.id
submission.status_id -> submissionstatus.id
submission.submitted_by -> groupmember.id
```

## Enums

```
COURSE_TYPE: SELF_PACED, LIVE_CLASS
COURSE_VERSION: V1, V2
LOCALE: en, hi, fr, pt, de, vi, ru, es, pl, da
PLAN: EARLY_ADOPTER, ENTERPRISE, BASIC
```
