import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Reference data from migrations (not in seed.sql) that must be restored after truncation.
// IDs must match what seed.sql expects (role: 1=ADMIN, 2=TUTOR, 3=STUDENT, etc.).
const REFERENCE_DATA_SQL = `
INSERT INTO "public"."role" (id, type, description) VALUES
  (1, 'ADMIN', 'The main controller'),
  (2, 'TUTOR', 'Can make changes to content, courses, but cant control passwords and cant add other tutors'),
  (3, 'STUDENT', 'A student role, can interact with application but cant make changes');
SELECT setval('public.role_id_seq', 3);

INSERT INTO "public"."submissionstatus" (id, label) VALUES
  (1, 'Submitted'), (2, 'In Progress'), (3, 'Graded');
SELECT setval('public.submission_status_id_seq', 3);

INSERT INTO "public"."question_type" (id, label, created_at, updated_at, typename) VALUES
  (1, 'Single answer', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:08.12069+00', 'RADIO'),
  (2, 'Multiple answers', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:27.935478+00', 'CHECKBOX'),
  (3, 'Paragraph', '2021-08-07 18:49:46.246529+00', '2021-08-15 00:57:38.634665+00', 'TEXTAREA');
SELECT setval('public.question_type_id_seq', 3);
`;

export async function resetDatabase(): Promise<void> {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DB_URL });

  try {
    await client.connect();

    // Truncate everything including auth tables, using CASCADE
    await client.query(`
      TRUNCATE
        auth.identities, auth.users,
        storage.buckets,
        public.analytics_login_events,
        public.apps_poll_submission, public.apps_poll_option, public.apps_poll,
        public.community_answer, public.community_question,
        public.course_newsfeed_comment, public.course_newsfeed,
        public.group_attendance,
        public.lesson_comment, public.lesson_completion,
        public.lesson_language_history, public.lesson_language,
        public.question_answer, public.option, public.question,
        public.exercise, public.lesson, public.lesson_section,
        public.submission, public.submissionstatus,
        public.quiz_play, public.quiz,
        public.organization_contacts, public.organization_emaillist,
        public.organization_plan, public.organizationmember,
        public.groupmember, public.course, public.group, public.organization,
        public.email_verification_tokens, public.profile,
        public.video_transcripts, public.waitinglist,
        public.currency, public.test_tenant,
        public.role, public.question_type
      CASCADE
    `);

    // Restore reference data from migrations
    await client.query(REFERENCE_DATA_SQL);

    // Re-seed from seed.sql
    const seedPath = resolve(__dirname, '../../supabase/seed.sql');
    const seedSql = readFileSync(seedPath, 'utf-8');
    await client.query(seedSql);
  } finally {
    await client.end();
  }
}
