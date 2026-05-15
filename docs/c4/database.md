# Database Schema

> Extracted 2026-05-15 from local Supabase (`public` schema).
> Format per table: `column : type[?] [PK] [FK→table.col]`

**analytics_login_events**
  id : uuid PK
  user_id : uuid
  logged_in_at : timestamptz?
**apps_poll**
  id : uuid PK
  created_at : timestamptz
  updated_at : timestamptz?
  question : text?
  authorId : uuid? FK→groupmember.id
  isPublic : bool?
  status : text?
  expiration : timestamptz?
  courseId : uuid? FK→course.id
**apps_poll_option**
  id : bigint PK
  created_at : timestamptz
  updated_at : timestamptz?
  poll_id : uuid? FK→apps_poll.id
  label : text?
**apps_poll_submission**
  id : bigint PK
  created_at : timestamptz
  poll_option_id : bigint? FK→apps_poll_option.id
  selected_by_id : uuid? FK→groupmember.id
  poll_id : uuid? FK→apps_poll.id
**community_answer**
  id : uuid PK
  created_at : timestamptz?
  question_id : bigint? FK→community_question.id
  body : text?
  author_id : bigint? FK→organizationmember.id
  votes : bigint?
  author_profile_id : uuid? FK→profile.id
**community_question**
  id : bigint PK
  created_at : timestamptz?
  title : text?
  body : text?
  author_id : bigint? FK→organizationmember.id
  votes : bigint?
  organization_id : uuid? FK→organization.id
  slug : text?
  author_profile_id : uuid? FK→profile.id
  course_id : uuid FK→course.id
**course**
  title : text
  description : text
  overview : text?
  id : uuid PK
  created_at : timestamptz?
  updated_at : timestamptz?
  group_id : uuid? FK→group.id
  is_template : bool?
  logo : text
  slug : text?
  metadata : jsonb
  cost : bigint?
  currency : text
  banner_image : text?
  is_published : bool?
  is_certificate_downloadable : bool?
  certificate_theme : text?
  status : text
  type : COURSE_TYPE?
  version : COURSE_VERSION
**course_newsfeed**
  created_at : timestamptz
  author_id : uuid? FK→groupmember.id
  content : text?
  id : uuid PK
  course_id : uuid? FK→course.id
  reaction : jsonb?
  is_pinned : bool
**course_newsfeed_comment**
  created_at : timestamptz
  author_id : uuid? FK→groupmember.id
  content : text?
  id : bigint PK
  course_newsfeed_id : uuid? FK→course_newsfeed.id
**currency**
  id : bigint PK
  created_at : timestamptz?
  name : text?
**email_verification_tokens**
  id : uuid PK
  profile_id : uuid? FK→profile.id
  token : text
  email : text
  created_at : timestamptz?
  expires_at : timestamptz
  used_at : timestamptz?
  created_by_ip : inet?
  used_by_ip : inet?
**exercise**
  title : text
  description : text?
  lesson_id : uuid? FK→lesson.id
  created_at : timestamptz?
  updated_at : timestamptz?
  id : uuid PK
  due_by : timestamp?
**group**
  id : uuid PK
  name : text
  description : text?
  created_at : timestamptz?
  updated_at : timestamptz?
  organization_id : uuid? FK→organization.id
**group_attendance**
  id : bigint PK
  created_at : timestamptz?
  updated_at : timestamptz?
  course_id : uuid? FK→course.id
  student_id : uuid? FK→groupmember.id
  is_present : bool?
  lesson_id : uuid
**groupmember**
  id : uuid PK
  group_id : uuid FK→group.id
  role_id : bigint FK→role.id
  profile_id : uuid? FK→profile.id
  email : text?
  created_at : timestamptz?
  assigned_student_id : text?
**lesson**
  note : text?
  video_url : text?
  slide_url : text?
  course_id : uuid FK→course.id
  id : uuid PK
  created_at : timestamptz?
  updated_at : timestamptz?
  title : text
  public : bool?
  lesson_at : timestamptz?
  teacher_id : uuid? FK→profile.id
  is_complete : bool?
  call_url : text?
  order : bigint?
  is_unlocked : bool?
  videos : jsonb?
  section_id : uuid? FK→lesson_section.id
  documents : jsonb?
**lesson_comment**
  id : bigint PK
  created_at : timestamptz
  updated_at : timestamptz?
  lesson_id : uuid? FK→lesson.id
  groupmember_id : uuid? FK→groupmember.id
  comment : text?
**lesson_completion**
  id : bigint PK
  created_at : timestamptz
  lesson_id : uuid? FK→lesson.id
  profile_id : uuid? FK→profile.id
  is_complete : bool?
  updated_at : timestamptz?
**lesson_language**
  id : bigint PK
  content : text?
  lesson_id : uuid? FK→lesson.id
  locale : LOCALE?
**lesson_language_history**
  id : int PK
  lesson_language_id : int? FK→lesson_language.id
  old_content : text?
  new_content : text?
  timestamp : timestamp
**lesson_section**
  id : uuid PK
  created_at : timestamptz
  updated_at : timestamptz?
  title : text?
  order : bigint?
  course_id : uuid? FK→course.id
**option**
  id : bigint PK
  label : text
  is_correct : bool
  question_id : bigint FK→question.id
  value : uuid?
  created_at : timestamptz?
  updated_at : timestamptz?
**organization**
  id : uuid PK
  name : text
  siteName : text?
  avatar_url : text?
  settings : jsonb?
  landingpage : jsonb?
  theme : text?
  created_at : timestamptz
  customization : json
  is_restricted : bool
  customCode : text?
  customDomain : text?
  favicon : text?
  isCustomDomainVerified : bool?
**organization_contacts**
  id : bigint PK
  created_at : timestamptz
  email : text?
  phone : text?
  name : text?
  message : text?
  organization_id : uuid? FK→organization.id
**organization_emaillist**
  id : bigint PK
  created_at : timestamptz
  email : text?
  organization_id : uuid? FK→organization.id
**organization_plan**
  id : bigint PK
  activated_at : timestamptz
  org_id : uuid? FK→organization.id
  plan_name : PLAN?
  is_active : bool?
  deactivated_at : timestamptz?
  updated_at : timestamptz?
  payload : jsonb?
  triggered_by : bigint? FK→organizationmember.id
  provider : text?
  subscription_id : text?
**organizationmember**
  id : bigint PK
  organization_id : uuid FK→organization.id
  role_id : bigint FK→role.id
  profile_id : uuid? FK→profile.id
  email : text?
  verified : bool?
  created_at : timestamptz
**profile**
  id : uuid PK
  fullname : text
  username : text
  avatar_url : text?
  created_at : timestamptz?
  updated_at : timestamptz?
  email : text?
  can_add_course : bool?
  role : text?
  goal : text?
  source : text?
  metadata : json?
  telegram_chat_id : bigint?
  is_email_verified : bool?
  verified_at : timestamptz?
  locale : LOCALE?
  is_restricted : bool
**question**
  id : bigint PK
  question_type_id : bigint FK→question_type.id
  title : text
  created_at : timestamptz?
  updated_at : timestamptz?
  exercise_id : uuid FK→exercise.id
  name : uuid?
  points : double precision?
  order : bigint?
**question_answer**
  id : bigint PK
  answers : array?
  question_id : bigint FK→question.id
  open_answer : text?
  group_member_id : uuid FK→groupmember.id
  submission_id : uuid? FK→submission.id
  point : bigint?
**question_type**
  id : bigint PK
  label : text
  created_at : timestamptz?
  updated_at : timestamptz?
  typename : text?
**quiz**
  id : uuid PK
  created_at : timestamptz?
  updated_at : timestamptz?
  title : text?
  questions : json?
  timelimit : text?
  theme : text?
  organization_id : uuid FK→organization.id
**quiz_play**
  id : bigint PK
  created_at : timestamptz?
  updated_at : timestamptz?
  quiz_id : uuid? FK→quiz.id
  players : json?
  started : bool?
  currentQuestionId : bigint?
  showCurrentQuestionAnswer : bool?
  isLastQuestion : bool?
  step : text?
  studentStep : text?
  pin : text?
**role**
  type : text
  description : text?
  id : bigint PK
  updated_at : timestamptz?
  created_at : timestamptz?
**submission**
  id : uuid PK
  reviewer_id : bigint?
  status_id : bigint? FK→submissionstatus.id
  total : bigint?
  created_at : timestamptz?
  updated_at : timestamptz?
  exercise_id : uuid FK→exercise.id
  submitted_by : uuid? FK→groupmember.id
  course_id : uuid? FK→course.id
  feedback : text?
**submissionstatus**
  id : bigint PK
  label : text
  updated_at : timestamptz?
**test_tenant**
  id : int PK
  details : text?
**video_transcripts**
  id : bigint PK
  created_at : timestamptz
  muse_svid : text?
  transcript : text?
  downloaded : bool?
  link : text?
**waitinglist**
  id : bigint PK
  email : text
  created_at : timestamptz?

## Entity-Relationship Diagram

```mermaid
erDiagram
    analytics_login_events {
        uuid id PK
        uuid user_id FK
        timestamp logged_in_at
    }
    apps_poll {
        uuid id PK
        timestamp created_at
        timestamp updated_at
        string question
        uuid authorId FK
        boolean isPublic
        string status
        timestamp expiration
        uuid courseId FK
    }
    apps_poll_option {
        bigint id PK
        timestamp created_at
        timestamp updated_at
        uuid poll_id FK
        string label
    }
    apps_poll_submission {
        bigint id PK
        timestamp created_at
        bigint poll_option_id FK
        uuid selected_by_id FK
        uuid poll_id FK
    }
    community_answer {
        uuid id PK
        timestamp created_at
        bigint question_id FK
        string body
        bigint author_id FK
        bigint votes
        uuid author_profile_id FK
    }
    community_question {
        bigint id PK
        timestamp created_at
        string title
        string body
        bigint author_id FK
        bigint votes
        uuid organization_id FK
        string slug
        uuid author_profile_id FK
        uuid course_id FK
    }
    course {
        string title
        string description
        string overview
        uuid id PK
        timestamp created_at
        timestamp updated_at
        uuid group_id FK
        boolean is_template
        string logo
        string slug
        json metadata
        bigint cost
        string currency
        string banner_image
        boolean is_published
        boolean is_certificate_downloadable
        string certificate_theme
        string status
        COURSE_TYPE type
        COURSE_VERSION version
    }
    course_newsfeed {
        timestamp created_at
        uuid author_id FK
        string content
        uuid id PK
        uuid course_id FK
        json reaction
        boolean is_pinned
    }
    course_newsfeed_comment {
        timestamp created_at
        uuid author_id FK
        string content
        bigint id PK
        uuid course_newsfeed_id FK
    }
    currency {
        bigint id PK
        timestamp created_at
        string name
    }
    email_verification_tokens {
        uuid id PK
        uuid profile_id FK
        string token
        string email
        timestamp created_at
        timestamp expires_at
        timestamp used_at
        string created_by_ip
        string used_by_ip
    }
    exercise {
        string title
        string description
        uuid lesson_id FK
        timestamp created_at
        timestamp updated_at
        uuid id PK
        timestamp due_by
    }
    group {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
        uuid organization_id FK
    }
    group_attendance {
        bigint id PK
        timestamp created_at
        timestamp updated_at
        uuid course_id FK
        uuid student_id FK
        boolean is_present
        uuid lesson_id
    }
    groupmember {
        uuid id PK
        uuid group_id FK
        bigint role_id FK
        uuid profile_id FK
        string email
        timestamp created_at
        string assigned_student_id
    }
    lesson {
        string note
        string video_url
        string slide_url
        uuid course_id FK
        uuid id PK
        timestamp created_at
        timestamp updated_at
        string title
        boolean public
        timestamp lesson_at
        uuid teacher_id FK
        boolean is_complete
        string call_url
        bigint order
        boolean is_unlocked
        json videos
        uuid section_id FK
        json documents
    }
    lesson_comment {
        bigint id PK
        timestamp created_at
        timestamp updated_at
        uuid lesson_id FK
        uuid groupmember_id FK
        string comment
    }
    lesson_completion {
        bigint id PK
        timestamp created_at
        uuid lesson_id FK
        uuid profile_id FK
        boolean is_complete
        timestamp updated_at
    }
    lesson_language {
        bigint id PK
        string content
        uuid lesson_id FK
        LOCALE locale
    }
    lesson_language_history {
        int id PK
        int lesson_language_id FK
        string old_content
        string new_content
        timestamp timestamp
    }
    lesson_section {
        uuid id PK
        timestamp created_at
        timestamp updated_at
        string title
        bigint order
        uuid course_id FK
    }
    option {
        bigint id PK
        string label
        boolean is_correct
        bigint question_id FK
        uuid value
        timestamp created_at
        timestamp updated_at
    }
    organization {
        uuid id PK
        string name
        string siteName
        string avatar_url
        json settings
        json landingpage
        string theme
        timestamp created_at
        json customization
        boolean is_restricted
        string customCode
        string customDomain
        string favicon
        boolean isCustomDomainVerified
    }
    organization_contacts {
        bigint id PK
        timestamp created_at
        string email
        string phone
        string name
        string message
        uuid organization_id FK
    }
    organization_emaillist {
        bigint id PK
        timestamp created_at
        string email
        uuid organization_id FK
    }
    organization_plan {
        bigint id PK
        timestamp activated_at
        uuid org_id FK
        PLAN plan_name
        boolean is_active
        timestamp deactivated_at
        timestamp updated_at
        json payload
        bigint triggered_by FK
        string provider
        string subscription_id
    }
    organizationmember {
        bigint id PK
        uuid organization_id FK
        bigint role_id FK
        uuid profile_id FK
        string email
        boolean verified
        timestamp created_at
    }
    profile {
        uuid id PK FK
        string fullname
        string username
        string avatar_url
        timestamp created_at
        timestamp updated_at
        string email
        boolean can_add_course
        string role
        string goal
        string source
        json metadata
        bigint telegram_chat_id
        boolean is_email_verified
        timestamp verified_at
        LOCALE locale
        boolean is_restricted
    }
    question {
        bigint id PK
        bigint question_type_id FK
        string title
        timestamp created_at
        timestamp updated_at
        uuid exercise_id FK
        uuid name
        float points
        bigint order
    }
    question_answer {
        bigint id PK
        array answers
        bigint question_id FK
        string open_answer
        uuid group_member_id FK
        uuid submission_id FK
        bigint point
    }
    question_type {
        bigint id PK
        string label
        timestamp created_at
        timestamp updated_at
        string typename
    }
    quiz {
        uuid id PK
        timestamp created_at
        timestamp updated_at
        string title
        json questions
        string timelimit
        string theme
        uuid organization_id FK
    }
    quiz_play {
        bigint id PK
        timestamp created_at
        timestamp updated_at
        uuid quiz_id FK
        json players
        boolean started
        bigint currentQuestionId
        boolean showCurrentQuestionAnswer
        boolean isLastQuestion
        string step
        string studentStep
        string pin
    }
    role {
        string type
        string description
        bigint id PK
        timestamp updated_at
        timestamp created_at
    }
    submission {
        uuid id PK
        bigint reviewer_id
        bigint status_id FK
        bigint total
        timestamp created_at
        timestamp updated_at
        uuid exercise_id FK
        uuid submitted_by FK
        uuid course_id FK
        string feedback
    }
    submissionstatus {
        bigint id PK
        string label
        timestamp updated_at
    }
    test_tenant {
        int id PK
        string details
    }
    video_transcripts {
        bigint id PK
        timestamp created_at
        string muse_svid
        string transcript
        boolean downloaded
        string link
    }
    waitinglist {
        bigint id PK
        string email
        timestamp created_at
    }

    apps_poll ||--o{ apps_poll_option : "poll_id"
    apps_poll ||--o{ apps_poll_submission : "poll_id"
    apps_poll_option ||--o{ apps_poll_submission : "poll_option_id"
    community_question ||--o{ community_answer : "question_id"
    course ||--o{ apps_poll : "courseId"
    course ||--o{ community_question : "course_id"
    course ||--o{ course_newsfeed : "course_id"
    course ||--o{ group_attendance : "course_id"
    course ||--o{ lesson : "course_id"
    course ||--o{ lesson_section : "course_id"
    course ||--o{ submission : "course_id"
    course_newsfeed ||--o{ course_newsfeed_comment : "course_newsfeed_id"
    exercise ||--o{ question : "exercise_id"
    exercise ||--o{ submission : "exercise_id"
    group ||--o{ course : "group_id"
    group ||--o{ groupmember : "group_id"
    groupmember ||--o{ apps_poll : "authorId"
    groupmember ||--o{ apps_poll_submission : "selected_by_id"
    groupmember ||--o{ course_newsfeed : "author_id"
    groupmember ||--o{ course_newsfeed_comment : "author_id"
    groupmember ||--o{ group_attendance : "student_id"
    groupmember ||--o{ lesson_comment : "groupmember_id"
    groupmember ||--o{ question_answer : "group_member_id"
    groupmember ||--o{ submission : "submitted_by"
    lesson ||--o{ exercise : "lesson_id"
    lesson ||--o{ lesson_comment : "lesson_id"
    lesson ||--o{ lesson_completion : "lesson_id"
    lesson ||--o{ lesson_language : "lesson_id"
    lesson_language ||--o{ lesson_language_history : "lesson_language_id"
    lesson_section ||--o{ lesson : "section_id"
    organization ||--o{ community_question : "organization_id"
    organization ||--o{ group : "organization_id"
    organization ||--o{ organization_contacts : "organization_id"
    organization ||--o{ organization_emaillist : "organization_id"
    organization ||--o{ organization_plan : "org_id"
    organization ||--o{ organizationmember : "organization_id"
    organization ||--o{ quiz : "organization_id"
    organizationmember ||--o{ community_answer : "author_id"
    organizationmember ||--o{ community_question : "author_id"
    organizationmember ||--o{ organization_plan : "triggered_by"
    profile ||--o{ community_answer : "author_profile_id"
    profile ||--o{ community_question : "author_profile_id"
    profile ||--o{ email_verification_tokens : "profile_id"
    profile ||--o{ groupmember : "profile_id"
    profile ||--o{ lesson : "teacher_id"
    profile ||--o{ lesson_completion : "profile_id"
    profile ||--o{ organizationmember : "profile_id"
    question ||--o{ option : "question_id"
    question ||--o{ question_answer : "question_id"
    question_type ||--o{ question : "question_type_id"
    quiz ||--o{ quiz_play : "quiz_id"
    role ||--o{ groupmember : "role_id"
    role ||--o{ organizationmember : "role_id"
    submission ||--o{ question_answer : "submission_id"
    submissionstatus ||--o{ submission : "status_id"
```
