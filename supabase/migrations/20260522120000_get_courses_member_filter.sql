-- Optimise get_courses for non-admin callers.
--
-- Before: function returned one row per course in the org (e.g. 50), then the
-- client filtered on member_profile_id. The per-course subselects (total_lessons,
-- total_students, progress_rate, member_profile_id) ran for every course in the
-- org even when the caller was a student enrolled in only a handful of them.
--
-- After: a new boolean parameter `member_only_arg` lets the caller (non-admin
-- dashboards) push the membership filter into SQL via EXISTS, so the per-course
-- subselects only run for courses the caller is actually a member of.
-- Admin behaviour (no flag / `false`) is unchanged.

drop function if exists "public"."get_courses"(org_id_arg uuid, profile_id_arg uuid);

create or replace function public.get_courses (
  org_id_arg uuid,
  profile_id_arg uuid,
  member_only_arg boolean default false
) returns table (
  id uuid,
  org_id uuid,
  title character varying,
  slug character varying,
  description character varying,
  logo text,
  banner_image text,
  cost bigint,
  currency character varying,
  is_published boolean,
  total_lessons bigint,
  total_students bigint,
  progress_rate bigint,
  type "COURSE_TYPE",
  member_profile_id uuid
) language plpgsql as $function$
BEGIN
  Return query
  select course.id,
         organization.id AS org_id,
         course.title,
         course.slug,
         course.description,
         course.logo,
         course.banner_image,
         course.cost,
         course.currency,
         course.is_published,
         (select COUNT(*) from lesson as l where l.course_id = course.id) AS total_lessons,
         (select COUNT(*) from groupmember as gm where gm.group_id = course.group_id AND gm.role_id = 3) as total_students,
         (select COUNT(*) from lesson_completion as lc
            join lesson as l on l.id = lc.lesson_id
           where l.course_id = course.id
             and lc.is_complete = true
             and lc.profile_id = profile_id_arg) AS progress_rate,
         course.type as type,
         (select gm.profile_id from groupmember gm
           where gm.group_id = "group".id
             and gm.profile_id = profile_id_arg) as member_profile_id
  from course
  join "group" on "group".id = course.group_id
  join organization on organization.id = "group".organization_id
  where course.status = 'ACTIVE'
    AND organization.id = org_id_arg
    AND (
      NOT member_only_arg
      OR EXISTS (
        select 1 from groupmember gm
        where gm.group_id = course.group_id
          and gm.profile_id = profile_id_arg
      )
    )
  ORDER BY course.created_at DESC;
END;
$function$;

-- Speeds up the total_lessons and progress_rate subselects (lesson.course_id had
-- no index, so each subselect did a seq scan on lesson per course).
create index if not exists lesson_course_id_idx on public.lesson (course_id);
