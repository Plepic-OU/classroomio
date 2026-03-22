import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

/**
 * Remove a student's enrollment from a course by title.
 * Used to ensure clean state before enrollment tests.
 */
export function removeEnrollment(studentEmail: string, courseTitle: string) {
  const sql = `
    DELETE FROM groupmember
    WHERE profile_id = (SELECT id FROM profile WHERE email = '${studentEmail}')
      AND group_id = (SELECT group_id FROM course WHERE title = '${courseTitle}')
      AND role_id = 3;
  `;
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
