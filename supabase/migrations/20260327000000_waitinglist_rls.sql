-- RLS was already enabled on waitinglist in a prior migration (20240717053936_rls.sql).

-- 1. Add org_id column (nullable — landing page entries have no org context)
ALTER TABLE public.waitinglist
  ADD COLUMN org_id uuid REFERENCES public.organization(id) ON DELETE SET NULL;

-- 2. Drop the old email-only unique constraint (poor name, wrong scope)
ALTER TABLE public.waitinglist
  DROP CONSTRAINT "constraint_name";

-- 3. New unique constraint: same email can appear once per org (and once as null-org)
--    Note: NULL != NULL in PostgreSQL, so duplicate null-org entries are theoretically possible;
--    acceptable for MVP since the landing page is not the primary per-org use case.
ALTER TABLE public.waitinglist
  ADD CONSTRAINT waitinglist_email_org_unique UNIQUE (email, org_id);

-- 4. Allow anonymous visitors to insert with email format validation
CREATE POLICY "anon can insert waitinglist"
  ON public.waitinglist
  FOR INSERT
  TO anon
  WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 5. Allow authenticated users to read entries for their orgs (or null-org global entries)
CREATE POLICY "authenticated can select own org waitinglist"
  ON public.waitinglist
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organizationmember om
      JOIN public.profile p ON p.id = om.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND om.organization_id = waitinglist.org_id
    )
  );
