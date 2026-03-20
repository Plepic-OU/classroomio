-- Fix: the old policy compared organizationmember_1.organization_id to itself
-- (always true), so NOT EXISTS was always false, blocking all inserts for
-- non-admin users.  The correct check: allow insert when no existing member
-- row exists for the NEW row's organization_id.

drop policy "User must be an admin to INSERT or allow if no existing member"
on "public"."organizationmember";

create policy "User must be an admin to INSERT or allow if no existing member"
on "public"."organizationmember"
as permissive
for insert
to public
with check (
  is_org_admin()
  OR (NOT EXISTS (
    SELECT 1
    FROM organizationmember existing
    WHERE existing.organization_id = organizationmember.organization_id
  ))
);
