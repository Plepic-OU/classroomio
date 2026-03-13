# Database Schema

Token-efficient schema extract from local Supabase. Auto-generated — do not edit.

## Tables

### analytics_login_events
```
id uuid NOT NULL
user_id uuid NOT NULL
logged_in_at timestamptz
```

### apps_poll
```
id uuid NOT NULL
created_at timestamptz NOT NULL
updated_at timestamptz
question text
authorId uuid
isPublic bool
status varchar default='draft'
expiration timestamptz
courseId uuid
```

### apps_poll_option
```
id bigint NOT NULL
created_at timestamptz NOT NULL
updated_at timestamptz
poll_id uuid
label varchar
```

### apps_poll_submission
```
id bigint NOT NULL
created_at timestamptz NOT NULL
poll_option_id bigint
selected_by_id uuid
poll_id uuid
```

### community_answer
```
id uuid NOT NULL
created_at timestamptz
question_id bigint
body varchar
author_id bigint
votes bigint
author_profile_id uuid
```

### community_question
```
id bigint NOT NULL
created_at timestamptz
title varchar
body text
author_id bigint
votes bigint default=0
organization_id uuid
slug text
author_profile_id uuid
course_id uuid NOT NULL
```

### course
```
id uuid NOT NULL
title varchar NOT NULL
description varchar NOT NULL
overview varchar
created_at timestamptz
updated_at timestamptz
group_id uuid
is_template bool default=true
logo text NOT NULL default=''
slug varchar
metadata jsonb NOT NULL
cost bigint default=0
currency varchar NOT NULL default='USD'
banner_image text
is_published bool default=false
is_certificate_downloadable bool default=false
certificate_theme text
status text NOT NULL default='ACTIVE'
type COURSE_TYPE default='LIVE_CLASS'
version COURSE_VERSION NOT NULL default='V1'
```

### course_newsfeed
```
id uuid NOT NULL
created_at timestamptz NOT NULL
author_id uuid
content text
course_id uuid
reaction jsonb
is_pinned bool NOT NULL default=false
```

### course_newsfeed_comment
```
id bigint NOT NULL
created_at timestamptz NOT NULL
author_id uuid
content text
course_newsfeed_id uuid
```

### currency
```
id bigint NOT NULL
created_at timestamptz
name varchar
```

### email_verification_tokens
```
id uuid NOT NULL
profile_id uuid
token text NOT NULL
email text NOT NULL
created_at timestamptz
expires_at timestamptz NOT NULL
used_at timestamptz
created_by_ip inet
used_by_ip inet
```

### exercise
```
id uuid NOT NULL
title varchar NOT NULL
description varchar
lesson_id uuid
created_at timestamptz
updated_at timestamptz
due_by timestamp
```

### group
```
id uuid NOT NULL
name varchar NOT NULL
description text
created_at timestamptz
updated_at timestamptz
organization_id uuid
```

### group_attendance
```
id bigint NOT NULL
created_at timestamptz
updated_at timestamptz
course_id uuid
student_id uuid
is_present bool default=false
lesson_id uuid NOT NULL
```

### groupmember
```
id uuid NOT NULL
group_id uuid NOT NULL
role_id bigint NOT NULL
profile_id uuid
email varchar
created_at timestamptz
assigned_student_id varchar
```

### lesson
```
id uuid NOT NULL
title varchar NOT NULL
note varchar
video_url varchar
slide_url varchar
course_id uuid NOT NULL
created_at timestamptz
updated_at timestamptz
public bool default=false
lesson_at timestamptz
teacher_id uuid
is_complete bool default=false
call_url text
order bigint
is_unlocked bool default=false
videos jsonb default=[]
section_id uuid
documents jsonb default=[]
```

### lesson_comment
```
id bigint NOT NULL
created_at timestamptz NOT NULL
updated_at timestamptz
lesson_id uuid
groupmember_id uuid
comment text
```

### lesson_completion
```
id bigint NOT NULL
created_at timestamptz NOT NULL
lesson_id uuid
profile_id uuid
is_complete bool default=false
updated_at timestamptz
```

### lesson_language
```
id bigint NOT NULL
content text
lesson_id uuid
locale LOCALE default='en'
```

### lesson_language_history
```
id serial NOT NULL
lesson_language_id integer
old_content text
new_content text
timestamp timestamp NOT NULL
```

### lesson_section
```
id uuid NOT NULL
created_at timestamptz NOT NULL
updated_at timestamptz
title varchar
order bigint default=0
course_id uuid
```

### option
```
id bigint NOT NULL
label varchar NOT NULL
is_correct bool NOT NULL default=false
question_id bigint NOT NULL
value uuid
created_at timestamptz
updated_at timestamptz
```

### organization
```
id uuid NOT NULL
name varchar NOT NULL
siteName text
avatar_url text
settings jsonb default={}
landingpage jsonb default={}
theme text
created_at timestamptz NOT NULL
customization json NOT NULL
is_restricted bool NOT NULL default=false
customCode text
customDomain text
favicon text
isCustomDomainVerified bool default=false
```

### organization_contacts
```
id bigint NOT NULL
created_at timestamptz NOT NULL
email text
phone text
name text
message text
organization_id uuid
```

### organization_emaillist
```
id bigint NOT NULL
created_at timestamptz NOT NULL
email text
organization_id uuid
```

### organization_plan
```
id bigint NOT NULL
activated_at timestamptz NOT NULL
org_id uuid
plan_name USER-DEFINED
is_active bool
deactivated_at timestamptz
updated_at timestamptz
payload jsonb
triggered_by bigint
provider text default='lmz'
subscription_id text
```

### organizationmember
```
id bigint NOT NULL
organization_id uuid NOT NULL
role_id bigint NOT NULL
profile_id uuid
email text
verified bool default=false
created_at timestamptz NOT NULL
```

### profile
```
id uuid NOT NULL
fullname text NOT NULL
username text NOT NULL
avatar_url text
created_at timestamptz
updated_at timestamptz
email varchar
can_add_course bool default=true
role varchar
goal varchar
source varchar
metadata json
telegram_chat_id bigint
is_email_verified bool default=false
verified_at timestamptz
locale LOCALE default='en'
is_restricted bool NOT NULL default=false
```

### question
```
id bigint NOT NULL
question_type_id bigint NOT NULL
title varchar NOT NULL
created_at timestamptz
updated_at timestamptz
exercise_id uuid NOT NULL
name uuid
points double precision
order bigint
```

### question_answer
```
id bigint NOT NULL
answers ARRAY
question_id bigint NOT NULL
open_answer text
group_member_id uuid NOT NULL
submission_id uuid
point bigint default=0
```

### question_type
```
id bigint NOT NULL
label varchar NOT NULL
created_at timestamptz
updated_at timestamptz
typename varchar
```

### quiz
```
id uuid NOT NULL
created_at timestamptz
updated_at timestamptz
title text
questions json
timelimit varchar default='10s'
theme varchar default='standard'
organization_id uuid NOT NULL
```

### quiz_play
```
id bigint NOT NULL
created_at timestamptz
updated_at timestamptz
quiz_id uuid
players json default=[]
started bool default=false
currentQuestionId bigint default=0
showCurrentQuestionAnswer bool default=false
isLastQuestion bool
step text default='CONNECT_TO_PLAY'
studentStep text default='PIN_SETUP'
pin text
```

### role
```
id bigint NOT NULL
type varchar NOT NULL
description varchar
updated_at timestamptz
created_at timestamptz
```

### submission
```
id uuid NOT NULL
reviewer_id bigint
status_id bigint default=1
total bigint default=0
created_at timestamptz
updated_at timestamptz
exercise_id uuid NOT NULL
submitted_by uuid
course_id uuid
feedback text
```

### submissionstatus
```
id bigint NOT NULL
label varchar NOT NULL
updated_at timestamptz
```

### video_transcripts
```
id bigint NOT NULL
created_at timestamptz NOT NULL
muse_svid text
transcript text
downloaded bool default=false
link text
```

### waitinglist
```
id bigint NOT NULL
email varchar NOT NULL
created_at timestamptz
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
