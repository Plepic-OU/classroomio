# Database Schema — ClassroomIO

> **Source:** `public` schema of the local Supabase instance (`supabase_db_classroomio`).  
> **Extracted:** 2026-05-15 via `information_schema.columns` + `information_schema.table_constraints`.  
> **Format:** compact — short type names, FK shown as `→ table.col`. Nullable = `?`.

Type abbreviations: `timestamptz` = timestamp with time zone, `varchar` = character varying, `bool` = boolean, `int8` =
bigint, `int4` = integer, `float8` = double precision, `enum` = USER-DEFINED enum, `jsonb`/`json` = JSON.

---

## analytics_login_events

| Column       | Type        | Nullable | FK |
|--------------|-------------|----------|----|
| id           | uuid        | NO       |    |
| user_id      | uuid        | NO       |    |
| logged_in_at | timestamptz | ?        |    |

---

## apps_poll

| Column     | Type        | Nullable | FK               |
|------------|-------------|----------|------------------|
| id         | uuid        | NO       |                  |
| created_at | timestamptz | NO       |                  |
| updated_at | timestamptz | ?        |                  |
| question   | text        | ?        |                  |
| authorId   | uuid        | ?        | → groupmember.id |
| isPublic   | bool        | ?        |                  |
| status     | varchar     | ?        |                  |
| expiration | timestamptz | ?        |                  |
| courseId   | uuid        | ?        | → course.id      |

---

## apps_poll_option

| Column     | Type        | Nullable | FK             |
|------------|-------------|----------|----------------|
| id         | int8        | NO       |                |
| created_at | timestamptz | NO       |                |
| updated_at | timestamptz | ?        |                |
| poll_id    | uuid        | ?        | → apps_poll.id |
| label      | varchar     | ?        |                |

---

## apps_poll_submission

| Column         | Type        | Nullable | FK                    |
|----------------|-------------|----------|-----------------------|
| id             | int8        | NO       |                       |
| created_at     | timestamptz | NO       |                       |
| poll_option_id | int8        | ?        | → apps_poll_option.id |
| selected_by_id | uuid        | ?        | → groupmember.id      |
| poll_id        | uuid        | ?        | → apps_poll.id        |

---

## community_question

| Column            | Type        | Nullable | FK                      |
|-------------------|-------------|----------|-------------------------|
| id                | int8        | NO       |                         |
| created_at        | timestamptz | ?        |                         |
| title             | varchar     | ?        |                         |
| body              | text        | ?        |                         |
| author_id         | int8        | ?        | → organizationmember.id |
| votes             | int8        | ?        |                         |
| organization_id   | uuid        | ?        | → organization.id       |
| slug              | text        | ?        |                         |
| author_profile_id | uuid        | ?        | → profile.id            |
| course_id         | uuid        | NO       | → course.id             |

---

## community_answer

| Column            | Type        | Nullable | FK                      |
|-------------------|-------------|----------|-------------------------|
| id                | uuid        | NO       |                         |
| created_at        | timestamptz | ?        |                         |
| question_id       | int8        | ?        | → community_question.id |
| body              | varchar     | ?        |                         |
| author_id         | int8        | ?        | → organizationmember.id |
| votes             | int8        | ?        |                         |
| author_profile_id | uuid        | ?        | → profile.id            |

---

## organization

| Column                 | Type        | Nullable | FK |
|------------------------|-------------|----------|----|
| id                     | uuid        | NO       |    |
| name                   | varchar     | NO       |    |
| siteName               | text        | ?        |    |
| avatar_url             | text        | ?        |    |
| settings               | jsonb       | ?        |    |
| landingpage            | jsonb       | ?        |    |
| theme                  | text        | ?        |    |
| created_at             | timestamptz | NO       |    |
| customization          | json        | NO       |    |
| is_restricted          | bool        | NO       |    |
| customCode             | text        | ?        |    |
| customDomain           | text        | ?        |    |
| favicon                | text        | ?        |    |
| isCustomDomainVerified | bool        | ?        |    |

---

## organizationmember

| Column          | Type        | Nullable | FK                |
|-----------------|-------------|----------|-------------------|
| id              | int8        | NO       |                   |
| organization_id | uuid        | NO       | → organization.id |
| role_id         | int8        | NO       | → role.id         |
| profile_id      | uuid        | ?        | → profile.id      |
| email           | text        | ?        |                   |
| verified        | bool        | ?        |                   |
| created_at      | timestamptz | NO       |                   |

---

## organization_plan

| Column          | Type        | Nullable | FK                      |
|-----------------|-------------|----------|-------------------------|
| id              | int8        | NO       |                         |
| activated_at    | timestamptz | NO       |                         |
| org_id          | uuid        | ?        | → organization.id       |
| plan_name       | enum        | ?        |                         |
| is_active       | bool        | ?        |                         |
| deactivated_at  | timestamptz | ?        |                         |
| updated_at      | timestamptz | ?        |                         |
| payload         | jsonb       | ?        |                         |
| triggered_by    | int8        | ?        | → organizationmember.id |
| provider        | text        | ?        |                         |
| subscription_id | text        | ?        |                         |

---

## organization_contacts

| Column          | Type        | Nullable | FK                |
|-----------------|-------------|----------|-------------------|
| id              | int8        | NO       |                   |
| created_at      | timestamptz | NO       |                   |
| email           | text        | ?        |                   |
| phone           | text        | ?        |                   |
| name            | text        | ?        |                   |
| message         | text        | ?        |                   |
| organization_id | uuid        | ?        | → organization.id |

---

## organization_emaillist

| Column          | Type        | Nullable | FK                |
|-----------------|-------------|----------|-------------------|
| id              | int8        | NO       |                   |
| created_at      | timestamptz | NO       |                   |
| email           | text        | ?        |                   |
| organization_id | uuid        | ?        | → organization.id |

---

## profile

| Column            | Type        | Nullable | FK |
|-------------------|-------------|----------|----|
| id                | uuid        | NO       |    |
| fullname          | text        | NO       |    |
| username          | text        | NO       |    |
| avatar_url        | text        | ?        |    |
| created_at        | timestamptz | ?        |    |
| updated_at        | timestamptz | ?        |    |
| email             | varchar     | ?        |    |
| can_add_course    | bool        | ?        |    |
| role              | varchar     | ?        |    |
| goal              | varchar     | ?        |    |
| source            | varchar     | ?        |    |
| metadata          | json        | ?        |    |
| telegram_chat_id  | int8        | ?        |    |
| is_email_verified | bool        | ?        |    |
| verified_at       | timestamptz | ?        |    |
| locale            | enum        | ?        |    |
| is_restricted     | bool        | NO       |    |

---

## email_verification_tokens

| Column        | Type        | Nullable | FK           |
|---------------|-------------|----------|--------------|
| id            | uuid        | NO       |              |
| profile_id    | uuid        | ?        | → profile.id |
| token         | text        | NO       |              |
| email         | text        | NO       |              |
| created_at    | timestamptz | ?        |              |
| expires_at    | timestamptz | NO       |              |
| used_at       | timestamptz | ?        |              |
| created_by_ip | inet        | ?        |              |
| used_by_ip    | inet        | ?        |              |

---

## role

| Column      | Type        | Nullable | FK |
|-------------|-------------|----------|----|
| id          | int8        | NO       |    |
| type        | varchar     | NO       |    |
| description | varchar     | ?        |    |
| updated_at  | timestamptz | ?        |    |
| created_at  | timestamptz | ?        |    |

---

## group

| Column          | Type        | Nullable | FK                |
|-----------------|-------------|----------|-------------------|
| id              | uuid        | NO       |                   |
| name            | varchar     | NO       |                   |
| description     | text        | ?        |                   |
| created_at      | timestamptz | ?        |                   |
| updated_at      | timestamptz | ?        |                   |
| organization_id | uuid        | ?        | → organization.id |

---

## groupmember

| Column              | Type        | Nullable | FK           |
|---------------------|-------------|----------|--------------|
| id                  | uuid        | NO       |              |
| group_id            | uuid        | NO       | → group.id   |
| role_id             | int8        | NO       | → role.id    |
| profile_id          | uuid        | ?        | → profile.id |
| email               | varchar     | ?        |              |
| created_at          | timestamptz | ?        |              |
| assigned_student_id | varchar     | ?        |              |

---

## course

| Column                      | Type        | Nullable | FK         |
|-----------------------------|-------------|----------|------------|
| id                          | uuid        | NO       |            |
| title                       | varchar     | NO       |            |
| description                 | varchar     | NO       |            |
| overview                    | varchar     | ?        |            |
| created_at                  | timestamptz | ?        |            |
| updated_at                  | timestamptz | ?        |            |
| group_id                    | uuid        | ?        | → group.id |
| is_template                 | bool        | ?        |            |
| logo                        | text        | NO       |            |
| slug                        | varchar     | ?        |            |
| metadata                    | jsonb       | NO       |            |
| cost                        | int8        | ?        |            |
| currency                    | varchar     | NO       |            |
| banner_image                | text        | ?        |            |
| is_published                | bool        | ?        |            |
| is_certificate_downloadable | bool        | ?        |            |
| certificate_theme           | text        | ?        |            |
| status                      | text        | NO       |            |
| type                        | enum        | ?        |            |
| version                     | enum        | NO       |            |

---

## lesson_section

| Column     | Type        | Nullable | FK          |
|------------|-------------|----------|-------------|
| id         | uuid        | NO       |             |
| created_at | timestamptz | NO       |             |
| updated_at | timestamptz | ?        |             |
| title      | varchar     | ?        |             |
| order      | int8        | ?        |             |
| course_id  | uuid        | ?        | → course.id |

---

## lesson

| Column      | Type        | Nullable | FK                  |
|-------------|-------------|----------|---------------------|
| id          | uuid        | NO       |                     |
| title       | varchar     | NO       |                     |
| note        | varchar     | ?        |                     |
| video_url   | varchar     | ?        |                     |
| slide_url   | varchar     | ?        |                     |
| course_id   | uuid        | NO       | → course.id         |
| created_at  | timestamptz | ?        |                     |
| updated_at  | timestamptz | ?        |                     |
| public      | bool        | ?        |                     |
| lesson_at   | timestamptz | ?        |                     |
| teacher_id  | uuid        | ?        | → profile.id        |
| is_complete | bool        | ?        |                     |
| call_url    | text        | ?        |                     |
| order       | int8        | ?        |                     |
| is_unlocked | bool        | ?        |                     |
| videos      | jsonb       | ?        |                     |
| section_id  | uuid        | ?        | → lesson_section.id |
| documents   | jsonb       | ?        |                     |

---

## lesson_completion

| Column      | Type        | Nullable | FK           |
|-------------|-------------|----------|--------------|
| id          | int8        | NO       |              |
| created_at  | timestamptz | NO       |              |
| lesson_id   | uuid        | ?        | → lesson.id  |
| profile_id  | uuid        | ?        | → profile.id |
| is_complete | bool        | ?        |              |
| updated_at  | timestamptz | ?        |              |

---

## lesson_comment

| Column         | Type        | Nullable | FK               |
|----------------|-------------|----------|------------------|
| id             | int8        | NO       |                  |
| created_at     | timestamptz | NO       |                  |
| updated_at     | timestamptz | ?        |                  |
| lesson_id      | uuid        | ?        | → lesson.id      |
| groupmember_id | uuid        | ?        | → groupmember.id |
| comment        | text        | ?        |                  |

---

## lesson_language

| Column    | Type | Nullable | FK          |
|-----------|------|----------|-------------|
| id        | int8 | NO       |             |
| content   | text | ?        |             |
| lesson_id | uuid | ?        | → lesson.id |
| locale    | enum | ?        |             |

---

## lesson_language_history

| Column             | Type      | Nullable | FK                   |
|--------------------|-----------|----------|----------------------|
| id                 | int4      | NO       |                      |
| lesson_language_id | int4      | ?        | → lesson_language.id |
| old_content        | text      | ?        |                      |
| new_content        | text      | ?        |                      |
| timestamp          | timestamp | NO       |                      |

---

## exercise

| Column      | Type        | Nullable | FK          |
|-------------|-------------|----------|-------------|
| id          | uuid        | NO       |             |
| title       | varchar     | NO       |             |
| description | varchar     | ?        |             |
| lesson_id   | uuid        | ?        | → lesson.id |
| created_at  | timestamptz | ?        |             |
| updated_at  | timestamptz | ?        |             |
| due_by      | timestamp   | ?        |             |

---

## question_type

| Column     | Type        | Nullable | FK |
|------------|-------------|----------|----|
| id         | int8        | NO       |    |
| label      | varchar     | NO       |    |
| typename   | varchar     | ?        |    |
| created_at | timestamptz | ?        |    |
| updated_at | timestamptz | ?        |    |

---

## question

| Column           | Type        | Nullable | FK                 |
|------------------|-------------|----------|--------------------|
| id               | int8        | NO       |                    |
| title            | varchar     | NO       |                    |
| question_type_id | int8        | NO       | → question_type.id |
| exercise_id      | uuid        | NO       | → exercise.id      |
| name             | uuid        | ?        |                    |
| points           | float8      | ?        |                    |
| order            | int8        | ?        |                    |
| created_at       | timestamptz | ?        |                    |
| updated_at       | timestamptz | ?        |                    |

---

## option

| Column      | Type        | Nullable | FK            |
|-------------|-------------|----------|---------------|
| id          | int8        | NO       |               |
| label       | varchar     | NO       |               |
| is_correct  | bool        | NO       |               |
| question_id | int8        | NO       | → question.id |
| value       | uuid        | ?        |               |
| created_at  | timestamptz | ?        |               |
| updated_at  | timestamptz | ?        |               |

---

## submissionstatus

| Column     | Type        | Nullable | FK |
|------------|-------------|----------|----|
| id         | int8        | NO       |    |
| label      | varchar     | NO       |    |
| updated_at | timestamptz | ?        |    |

---

## submission

| Column       | Type        | Nullable | FK                    |
|--------------|-------------|----------|-----------------------|
| id           | uuid        | NO       |                       |
| exercise_id  | uuid        | NO       | → exercise.id         |
| submitted_by | uuid        | ?        | → groupmember.id      |
| course_id    | uuid        | ?        | → course.id           |
| status_id    | int8        | ?        | → submissionstatus.id |
| reviewer_id  | int8        | ?        |                       |
| total        | int8        | ?        |                       |
| feedback     | text        | ?        |                       |
| created_at   | timestamptz | ?        |                       |
| updated_at   | timestamptz | ?        |                       |

---

## question_answer

| Column          | Type  | Nullable | FK               |
|-----------------|-------|----------|------------------|
| id              | int8  | NO       |                  |
| answers         | array | ?        |                  |
| question_id     | int8  | NO       | → question.id    |
| open_answer     | text  | ?        |                  |
| group_member_id | uuid  | NO       | → groupmember.id |
| submission_id   | uuid  | ?        | → submission.id  |
| point           | int8  | ?        |                  |

---

## group_attendance

| Column     | Type        | Nullable | FK               |
|------------|-------------|----------|------------------|
| id         | int8        | NO       |                  |
| created_at | timestamptz | ?        |                  |
| updated_at | timestamptz | ?        |                  |
| course_id  | uuid        | ?        | → course.id      |
| student_id | uuid        | ?        | → groupmember.id |
| is_present | bool        | ?        |                  |
| lesson_id  | uuid        | NO       |                  |

---

## course_newsfeed

| Column     | Type        | Nullable | FK               |
|------------|-------------|----------|------------------|
| id         | uuid        | NO       |                  |
| created_at | timestamptz | NO       |                  |
| author_id  | uuid        | ?        | → groupmember.id |
| content    | text        | ?        |                  |
| course_id  | uuid        | ?        | → course.id      |
| reaction   | jsonb       | ?        |                  |
| is_pinned  | bool        | NO       |                  |

---

## course_newsfeed_comment

| Column             | Type        | Nullable | FK                   |
|--------------------|-------------|----------|----------------------|
| id                 | int8        | NO       |                      |
| created_at         | timestamptz | NO       |                      |
| author_id          | uuid        | ?        | → groupmember.id     |
| content            | text        | ?        |                      |
| course_newsfeed_id | uuid        | ?        | → course_newsfeed.id |

---

## quiz

| Column          | Type        | Nullable | FK                |
|-----------------|-------------|----------|-------------------|
| id              | uuid        | NO       |                   |
| created_at      | timestamptz | ?        |                   |
| updated_at      | timestamptz | ?        |                   |
| title           | text        | ?        |                   |
| questions       | json        | ?        |                   |
| timelimit       | varchar     | ?        |                   |
| theme           | varchar     | ?        |                   |
| organization_id | uuid        | NO       | → organization.id |

---

## quiz_play

| Column                    | Type        | Nullable | FK        |
|---------------------------|-------------|----------|-----------|
| id                        | int8        | NO       |           |
| created_at                | timestamptz | ?        |           |
| updated_at                | timestamptz | ?        |           |
| quiz_id                   | uuid        | ?        | → quiz.id |
| players                   | json        | ?        |           |
| started                   | bool        | ?        |           |
| currentQuestionId         | int8        | ?        |           |
| showCurrentQuestionAnswer | bool        | ?        |           |
| isLastQuestion            | bool        | ?        |           |
| step                      | text        | ?        |           |
| studentStep               | text        | ?        |           |
| pin                       | text        | ?        |           |

---

## currency

| Column     | Type        | Nullable | FK |
|------------|-------------|----------|----|
| id         | int8        | NO       |    |
| created_at | timestamptz | ?        |    |
| name       | varchar     | ?        |    |

---

## video_transcripts

| Column     | Type        | Nullable | FK |
|------------|-------------|----------|----|
| id         | int8        | NO       |    |
| created_at | timestamptz | NO       |    |
| muse_svid  | text        | ?        |    |
| transcript | text        | ?        |    |
| downloaded | bool        | ?        |    |
| link       | text        | ?        |    |

---

## waitinglist

| Column     | Type        | Nullable | FK |
|------------|-------------|----------|----|
| id         | int8        | NO       |    |
| email      | varchar     | NO       |    |
| created_at | timestamptz | ?        |    |

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
