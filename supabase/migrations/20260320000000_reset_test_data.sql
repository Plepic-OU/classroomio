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
end;
$$;
