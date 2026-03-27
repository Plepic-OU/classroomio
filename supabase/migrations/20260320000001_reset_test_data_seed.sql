-- Updated reset_test_data: truncate + re-seed a published course for enrollment tests.
create or replace function public.reset_test_data()
returns void
language plpgsql
security definer
as $$
begin
  -- truncate tables that tests create rows in; cascade handles FK children.
  -- group is the parent of course (course.group_id FK), so truncating group
  -- cascades to course, groupmember, lesson, exercise, etc. — one statement
  -- cleans up everything created by NewCourseModal and related test steps.
  truncate table public.group restart identity cascade;

  -- re-seed a stable published course so student-enrollment tests always have
  -- something to enroll in (explore page only shows published + not-yet-enrolled courses).
  insert into public.group (id, name, description, organization_id)
  values ('e2e00000-0000-0000-0000-000000000001', 'E2E Seed Course', 'A published course for E2E enrollment testing', '1a1dcddd-1abc-4f72-b644-0bd18191a289');

  insert into public.course (id, title, description, overview, group_id, is_published, slug, status, cost, currency, is_template, metadata)
  values ('e2e00000-0000-0000-0000-000000000002', 'E2E Seed Course', 'A published course for E2E enrollment testing', '', 'e2e00000-0000-0000-0000-000000000001', true, 'e2e-seed-course', 'ACTIVE', 0, 'USD', false, '{"goals":"","description":"","requirements":"","allowNewStudent":true}');

  -- second seed: student is pre-enrolled, used by My Learning tests.
  insert into public.group (id, name, description, organization_id)
  values ('e2e00000-0000-0000-0000-000000000003', 'E2E My Learning Course', 'Pre-enrolled course for My Learning tests', '1a1dcddd-1abc-4f72-b644-0bd18191a289');

  insert into public.course (id, title, description, overview, group_id, is_published, slug, status, cost, currency, is_template, metadata)
  values ('e2e00000-0000-0000-0000-000000000004', 'E2E My Learning Course', 'Pre-enrolled course for My Learning tests', '', 'e2e00000-0000-0000-0000-000000000003', true, 'e2e-my-learning-course', 'ACTIVE', 0, 'USD', false, '{"goals":"","description":"","requirements":"","allowNewStudent":true}');

  -- pre-enroll the test student (profile 0c256e75-aa40-4f62-8d30-0217ca1c60d9) in the My Learning course
  insert into public.groupmember (profile_id, group_id, role_id)
  values ('0c256e75-aa40-4f62-8d30-0217ca1c60d9', 'e2e00000-0000-0000-0000-000000000003', 3);

  -- ── Waitlist seed data ────────────────────────────────────────────────────
  -- Pending-invite rows (profile_id NULL, role_id=3) fill the max_students cap without
  -- needing a real auth.users entry. enroll_student RPC counts all role_id=3 groupmember
  -- rows regardless of whether profile_id is set.

  -- Course A: for student join/leave flow.
  --   Invite hash (for /invite/s/[hash]): see e2e/steps/course-waitlist.steps.ts
  --   Pending invite fills cap. Test student NOT pre-seeded on waitlist.
  insert into public.group (id, name, description, organization_id)
  values ('e2e00000-0000-0000-0000-000000000005', 'E2E Full Course Group', 'Full course for waitlist join/leave E2E testing', '1a1dcddd-1abc-4f72-b644-0bd18191a289');

  insert into public.course (id, title, description, overview, group_id, is_published, slug, status, cost, currency, is_template, metadata, max_students)
  values ('e2e00000-0000-0000-0000-000000000006', 'E2E Full Course', 'A full course for waitlist E2E testing', '', 'e2e00000-0000-0000-0000-000000000005', true, 'e2e-full-course', 'ACTIVE', 0, 'USD', false, '{"goals":"","description":"","requirements":"","allowNewStudent":true}', 1);

  -- Pending invite (NULL profile_id) fills the student cap of 1
  insert into public.groupmember (group_id, role_id, email)
  values ('e2e00000-0000-0000-0000-000000000005', 3, 'e2e-filler@test.com');

  -- Course B: for admin waitlist management tests (view + remove).
  --   Pending invite fills the student cap.
  --   Admin (7ac00503) enrolled as tutor (role_id=2) so is_course_admin_or_tutor()
  --   returns true and the RLS SELECT policy on course_waitlist passes.
  --   Test student pre-seeded on the waitlist (status='waiting').
  insert into public.group (id, name, description, organization_id)
  values ('e2e00000-0000-0000-0000-000000000007', 'E2E Admin Waitlist Group', 'Full course for admin waitlist E2E testing', '1a1dcddd-1abc-4f72-b644-0bd18191a289');

  insert into public.course (id, title, description, overview, group_id, is_published, slug, status, cost, currency, is_template, metadata, max_students)
  values ('e2e00000-0000-0000-0000-000000000008', 'E2E Admin Waitlist Course', 'A full course for admin waitlist E2E testing', '', 'e2e00000-0000-0000-0000-000000000007', true, 'e2e-admin-waitlist-course', 'ACTIVE', 0, 'USD', false, '{"goals":"","description":"","requirements":"","allowNewStudent":true}', 1);

  insert into public.groupmember (group_id, role_id, email)
  values ('e2e00000-0000-0000-0000-000000000007', 3, 'e2e-filler@test.com');

  insert into public.groupmember (profile_id, group_id, role_id)
  values ('7ac00503-8519-43c8-a5ea-b79aeca900b1', 'e2e00000-0000-0000-0000-000000000007', 2);

  insert into public.course_waitlist (id, course_id, profile_id, status)
  values ('e2efeed0-0000-0000-0000-000000000003', 'e2e00000-0000-0000-0000-000000000008', '0c256e75-aa40-4f62-8d30-0217ca1c60d9', 'waiting');

  -- Course C: for token claim tests (valid + expired tokens).
  --   Pending invite fills cap. Two course_waitlist entries with fixed tokens.
  insert into public.group (id, name, description, organization_id)
  values ('e2e00000-0000-0000-0000-000000000009', 'E2E Claim Course Group', 'Full course for claim token E2E testing', '1a1dcddd-1abc-4f72-b644-0bd18191a289');

  insert into public.course (id, title, description, overview, group_id, is_published, slug, status, cost, currency, is_template, metadata, max_students)
  values ('e2e00000-0000-0000-0000-000000000010', 'E2E Claim Course', 'A full course for claim token E2E testing', '', 'e2e00000-0000-0000-0000-000000000009', true, 'e2e-claim-course', 'ACTIVE', 0, 'USD', false, '{"goals":"","description":"","requirements":"","allowNewStudent":true}', 1);

  insert into public.groupmember (group_id, role_id, email)
  values ('e2e00000-0000-0000-0000-000000000009', 3, 'e2e-filler@test.com');

  -- Valid claim token: 'waiting' entry for the test student; expires_at NULL = no expiry.
  insert into public.course_waitlist (id, course_id, profile_id, status, token)
  values ('e2efeed0-0000-0000-0000-000000000001', 'e2e00000-0000-0000-0000-000000000010', '0c256e75-aa40-4f62-8d30-0217ca1c60d9', 'waiting', 'e2ecafe0-0000-4000-a000-000000000001');

  -- Expired claim token: 'notified' entry for the admin with expires_at in the past.
  insert into public.course_waitlist (id, course_id, profile_id, status, token, notified_at, expires_at)
  values ('e2efeed0-0000-0000-0000-000000000002', 'e2e00000-0000-0000-0000-000000000010', '7ac00503-8519-43c8-a5ea-b79aeca900b1', 'notified', 'e2ecafe0-0000-4000-a000-000000000002', '2020-01-01 00:00:00+00', '2020-01-03 00:00:00+00');
end;
$$;
