# Database Schema

39 tables, 55 FKs. PostgreSQL via Supabase.

Key: `*`=PK, `→`=FK, `?`=nullable. Types: `u`=uuid, `b`=bigint, `i`=int, `t`=text, `v`=varchar, `j`=jsonb, `js`=json, `bl`=bool, `f`=float, `tz`=timestamptz, `ts`=timestamp, `e`=enum, `a`=array, `in`=inet.

## Tables

**profile** — `id u*, fullname t, username t, avatar_url t, email v, can_add_course bl, role v, goal v, source v, metadata js, telegram_chat_id b, is_email_verified bl, verified_at tz, locale e, is_restricted bl, created_at tz, updated_at tz`

**organization** — `id u*, name v, siteName t, avatar_url t, settings j, landingpage j, theme t, customization js, is_restricted bl, customCode t, customDomain t, favicon t, isCustomDomainVerified bl, created_at tz`

**organizationmember** — `id b*, organization_id u→organization, role_id b→role, profile_id u→profile, email t, verified bl, created_at tz`

**organization_plan** — `id b*, activated_at tz, org_id u→organization, plan_name e, is_active bl, deactivated_at tz, updated_at tz, payload j, triggered_by b→organizationmember, provider t, subscription_id t`

**organization_contacts** — `id b*, email t, phone t, name t, message t, organization_id u→organization, created_at tz`

**organization_emaillist** — `id b*, email t, organization_id u→organization, created_at tz`

**role** — `id b*, type v, description v, created_at tz, updated_at tz`

**group** — `id u*, name v, description t, organization_id u→organization, created_at tz, updated_at tz`

**groupmember** — `id u*, group_id u→group, role_id b→role, profile_id u→profile, email v, assigned_student_id v, created_at tz`

**course** — `id u*, title v, description v, overview v, group_id u→group, is_template bl, logo t, slug v, metadata j, cost b, currency v, banner_image t, is_published bl, is_certificate_downloadable bl, certificate_theme t, status t, type e, version e, created_at tz, updated_at tz`

**lesson_section** — `id u*, title v, order b, course_id u→course, created_at tz, updated_at tz`

**lesson** — `id u*, title v, note v, video_url v, slide_url v, course_id u→course, section_id u→lesson_section, teacher_id u→profile, public bl, lesson_at tz, is_complete bl, call_url t, order b, is_unlocked bl, videos j, documents j, created_at tz, updated_at tz`

**lesson_comment** — `id b*, lesson_id u→lesson, groupmember_id u→groupmember, comment t, created_at tz, updated_at tz`

**lesson_completion** — `id b*, lesson_id u→lesson, profile_id u→profile, is_complete bl, created_at tz, updated_at tz`

**lesson_language** — `id b*, content t, lesson_id u→lesson, locale e`

**lesson_language_history** — `id i*, lesson_language_id i→lesson_language, old_content t, new_content t, timestamp ts`

**exercise** — `id u*, title v, description v, lesson_id u→lesson, due_by ts, created_at tz, updated_at tz`

**question_type** — `id b*, label v, typename v, created_at tz, updated_at tz`

**question** — `id b*, title v, question_type_id b→question_type, exercise_id u→exercise, name u, points f, order b, created_at tz, updated_at tz`

**option** — `id b*, label v, is_correct bl, question_id b→question, value u, created_at tz, updated_at tz`

**submission** — `id u*, exercise_id u→exercise, submitted_by u→groupmember, course_id u→course, reviewer_id b, status_id b→submissionstatus, total b, feedback t, created_at tz, updated_at tz`

**submissionstatus** — `id b*, label v, updated_at tz`

**question_answer** — `id b*, question_id b→question, group_member_id u→groupmember, submission_id u→submission, answers a, open_answer t, point b`

**group_attendance** — `id b*, course_id u→course, student_id u→groupmember, lesson_id u, is_present bl, created_at tz, updated_at tz`

**course_newsfeed** — `id u*, course_id u→course, author_id u→groupmember, content t, reaction j, is_pinned bl, created_at tz`

**course_newsfeed_comment** — `id b*, course_newsfeed_id u→course_newsfeed, author_id u→groupmember, content t, created_at tz`

**community_question** — `id b*, title v, body t, organization_id u→organization, course_id u→course, author_id b→organizationmember, author_profile_id u→profile, votes b, slug t, created_at tz`

**community_answer** — `id u*, question_id b→community_question, body v, author_id b→organizationmember, author_profile_id u→profile, votes b, created_at tz`

**apps_poll** — `id u*, question t, authorId u→groupmember, courseId u→course, isPublic bl, status v, expiration tz, created_at tz, updated_at tz`

**apps_poll_option** — `id b*, poll_id u→apps_poll, label v, created_at tz, updated_at tz`

**apps_poll_submission** — `id b*, poll_id u→apps_poll, poll_option_id b→apps_poll_option, selected_by_id u→groupmember, created_at tz`

**quiz** — `id u*, title t, questions js, timelimit v, theme v, organization_id u→organization, created_at tz, updated_at tz`

**quiz_play** — `id b*, quiz_id u→quiz, players js, started bl, currentQuestionId b, showCurrentQuestionAnswer bl, isLastQuestion bl, step t, studentStep t, pin t, created_at tz, updated_at tz`

**email_verification_tokens** — `id u*, profile_id u→profile, token t, email t, expires_at tz, used_at tz, created_by_ip in, used_by_ip in, created_at tz`

**analytics_login_events** — `id u*, user_id u, logged_in_at tz`

**currency** — `id b*, name v, created_at tz`

**video_transcripts** — `id b*, muse_svid t, transcript t, downloaded bl, link t, created_at tz`

**waitinglist** — `id b*, email v, created_at tz`

**test_tenant** — `id i*, details t`
