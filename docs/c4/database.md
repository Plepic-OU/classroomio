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
  type : USER-DEFINED?
  version : USER-DEFINED
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
  locale : USER-DEFINED?
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
  plan_name : USER-DEFINED?
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
  locale : USER-DEFINED?
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
