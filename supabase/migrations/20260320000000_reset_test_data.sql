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
end;
$$;
