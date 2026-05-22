-- tests/e2e/fixtures/test-fixtures.sql
--
-- Re-applied after every @mutating BeforeScenario reset (see fixtures/hooks.ts)
-- and verified by globalSetup. Contains the minimal rows that BDD scenarios
-- depend on but that aren't preserved by reset-db.ts's PRESERVE_TABLES.
--
-- Phase 1 dependencies only:
--   - Pin profile.locale='en' for admin@test.com and student@test.com so
--     accessible-name selectors don't race the dashboard's mid-page locale
--     flip in getProfile(). See design §2 and §5.
--
-- Phase 3 will add: group + course + lesson + exercise + question + option
-- rows, and the student's groupmember enrolment row. Until then S-01..S-05
-- are blocked.

UPDATE "public"."profile" SET "locale" = 'en' WHERE "email" = 'admin@test.com';
UPDATE "public"."profile" SET "locale" = 'en' WHERE "email" = 'student@test.com';
