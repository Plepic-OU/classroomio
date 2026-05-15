# Database Schema — ClassroomIO

> Source: `public` schema. `?` = nullable. Types: uuid, text/varchar, bool, int8/int4, float8, timestamptz, jsonb/json,
> enum, array.  
> `created_at`/`updated_at` columns omitted (present in nearly every table).

## Tables

**analytics_login_events**: id(uuid), user_id(uuid), logged_in_at?(timestamptz)

**apps_poll**: id(uuid), question?(text), authorId?(uuid→groupmember), isPublic?(bool), status?(varchar), expiration?(
timestamptz), courseId?(uuid→course)

**apps_poll_option**: id(int8), poll_id?(uuid→apps_poll), label?(varchar)

**apps_poll_submission**: id(int8), poll_option_id?(int8→apps_poll_option), selected_by_id?(uuid→groupmember), poll_id?(
uuid→apps_poll)

**community_question**: id(int8), title?(varchar), body?(text), author_id?(int8→organizationmember), votes?(int8),
organization_id?(uuid→organization), slug?(text), author_profile_id?(uuid→profile), course_id(uuid→course)

**community_answer**: id(uuid), question_id?(int8→community_question), body?(varchar), author_id?(
int8→organizationmember), votes?(int8), author_profile_id?(uuid→profile)

**organization**: id(uuid), name(varchar), siteName?(text), avatar_url?(text), settings?(jsonb), landingpage?(jsonb),
theme?(text), customization(json), is_restricted(bool), customCode?(text), customDomain?(text), favicon?(text),
isCustomDomainVerified?(bool)

**organizationmember**: id(int8), organization_id(uuid→organization), role_id(int8→role), profile_id?(uuid→profile),
email?(text), verified?(bool)

**organization_plan**: id(int8), activated_at(timestamptz), org_id?(uuid→organization), plan_name?(enum), is_active?(
bool), deactivated_at?(timestamptz), payload?(jsonb), triggered_by?(int8→organizationmember), provider?(text),
subscription_id?(text)

**organization_contacts**: id(int8), email?(text), phone?(text), name?(text), message?(text), organization_id?(
uuid→organization)

**organization_emaillist**: id(int8), email?(text), organization_id?(uuid→organization)

**profile**: id(uuid), fullname(text), username(text), avatar_url?(text), email?(varchar), can_add_course?(bool), role?(
varchar), goal?(varchar), source?(varchar), metadata?(json), telegram_chat_id?(int8), is_email_verified?(bool),
verified_at?(timestamptz), locale?(enum), is_restricted(bool)

**email_verification_tokens**: id(uuid), profile_id?(uuid→profile), token(text), email(text), expires_at(timestamptz),
used_at?(timestamptz), created_by_ip?(inet), used_by_ip?(inet)

**role**: id(int8), type(varchar), description?(varchar)

**group**: id(uuid), name(varchar), description?(text), organization_id?(uuid→organization)

**groupmember**: id(uuid), group_id(uuid→group), role_id(int8→role), profile_id?(uuid→profile), email?(varchar),
assigned_student_id?(varchar)

**course**: id(uuid), title(varchar), description(varchar), overview?(varchar), group_id?(uuid→group), is_template?(
bool), logo(text), slug?(varchar), metadata(jsonb), cost?(int8), currency(varchar), banner_image?(text), is_published?(
bool), is_certificate_downloadable?(bool), certificate_theme?(text), status(text), type?(enum), version(enum)

**lesson_section**: id(uuid), title?(varchar), order?(int8), course_id?(uuid→course)

**lesson**: id(uuid), title(varchar), note?(varchar), video_url?(varchar), slide_url?(varchar), course_id(uuid→course),
public?(bool), lesson_at?(timestamptz), teacher_id?(uuid→profile), is_complete?(bool), call_url?(text), order?(int8),
is_unlocked?(bool), videos?(jsonb), section_id?(uuid→lesson_section), documents?(jsonb)

**lesson_completion**: id(int8), lesson_id?(uuid→lesson), profile_id?(uuid→profile), is_complete?(bool)

**lesson_comment**: id(int8), lesson_id?(uuid→lesson), groupmember_id?(uuid→groupmember), comment?(text)

**lesson_language**: id(int8), content?(text), lesson_id?(uuid→lesson), locale?(enum)

**lesson_language_history**: id(int4), lesson_language_id?(int4→lesson_language), old_content?(text), new_content?(
text), timestamp(timestamp)

**exercise**: id(uuid), title(varchar), description?(varchar), lesson_id?(uuid→lesson), due_by?(timestamp)

**question_type**: id(int8), label(varchar), typename?(varchar)

**question**: id(int8), title(varchar), question_type_id(int8→question_type), exercise_id(uuid→exercise), name?(uuid),
points?(float8), order?(int8)

**option**: id(int8), label(varchar), is_correct(bool), question_id(int8→question), value?(uuid)

**submissionstatus**: id(int8), label(varchar)

**submission**: id(uuid), exercise_id(uuid→exercise), submitted_by?(uuid→groupmember), course_id?(uuid→course),
status_id?(int8→submissionstatus), reviewer_id?(int8), total?(int8), feedback?(text)

**question_answer**: id(int8), answers?(array), question_id(int8→question), open_answer?(text), group_member_id(
uuid→groupmember), submission_id?(uuid→submission), point?(int8)

**group_attendance**: id(int8), course_id?(uuid→course), student_id?(uuid→groupmember), is_present?(bool), lesson_id(
uuid)

**course_newsfeed**: id(uuid), author_id?(uuid→groupmember), content?(text), course_id?(uuid→course), reaction?(jsonb),
is_pinned(bool)

**course_newsfeed_comment**: id(int8), author_id?(uuid→groupmember), content?(text), course_newsfeed_id?(
uuid→course_newsfeed)

**quiz**: id(uuid), title?(text), questions?(json), timelimit?(varchar), theme?(varchar), organization_id(
uuid→organization)

**quiz_play**: id(int8), quiz_id?(uuid→quiz), players?(json), started?(bool), currentQuestionId?(int8),
showCurrentQuestionAnswer?(bool), isLastQuestion?(bool), step?(text), studentStep?(text), pin?(text)

**currency**: id(int8), name?(varchar)

**video_transcripts**: id(int8), muse_svid?(text), transcript?(text), downloaded?(bool), link?(text)

**waitinglist**: id(int8), email(varchar)

---

## Entity Relationship Summary

```
organization
  ├─ organizationmember (profile_id → profile, role_id → role)
  ├─ organization_plan (triggered_by → organizationmember)
  ├─ organization_contacts
  ├─ organization_emaillist
  ├─ group
  │    └─ groupmember (profile_id → profile, role_id → role)
  │         └─ apps_poll (authorId → groupmember)
  ├─ community_question (author_id → organizationmember, course_id → course)
  │    └─ community_answer (author_id → organizationmember)
  └─ quiz
       └─ quiz_play

course (group_id → group)
  ├─ lesson_section
  │    └─ lesson (teacher_id → profile)
  │         ├─ lesson_completion (profile_id → profile)
  │         ├─ lesson_comment (groupmember_id → groupmember)
  │         ├─ lesson_language
  │         │    └─ lesson_language_history
  │         └─ exercise
  │              └─ question (question_type_id → question_type)
  │                   ├─ option
  │                   └─ question_answer (group_member_id → groupmember, submission_id → submission)
  ├─ submission (submitted_by → groupmember, status_id → submissionstatus, exercise_id → exercise)
  ├─ group_attendance (student_id → groupmember)
  ├─ course_newsfeed (author_id → groupmember)
  │    └─ course_newsfeed_comment (author_id → groupmember)
  └─ apps_poll (courseId → course)
       ├─ apps_poll_option
       └─ apps_poll_submission (selected_by_id → groupmember, poll_option_id → apps_poll_option)

profile (auth.users mirror)
  └─ email_verification_tokens
```
