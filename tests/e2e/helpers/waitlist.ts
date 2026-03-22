import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

function runSql(sql: string) {
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Set max_capacity and waitlist_enabled on a course's metadata.
 */
export function setCourseCapacity(
  courseTitle: string,
  maxCapacity: number | null,
  waitlistEnabled: boolean
) {
  const sql = `
    UPDATE course
    SET metadata = metadata
      || jsonb_build_object('max_capacity', ${maxCapacity === null ? 'null' : maxCapacity}::int)
      || jsonb_build_object('waitlist_enabled', ${waitlistEnabled})
    WHERE title = '${courseTitle}';
  `;
  runSql(sql);
}

/**
 * Clear capacity settings from a course (reset to unlimited).
 */
export function clearCourseCapacity(courseTitle: string) {
  const sql = `
    UPDATE course
    SET metadata = metadata - 'max_capacity' - 'waitlist_enabled'
    WHERE title = '${courseTitle}';
  `;
  runSql(sql);
}

/**
 * Remove all waitlist entries for a course.
 */
export function clearWaitlist(courseTitle: string) {
  const sql = `
    DELETE FROM course_waitlist
    WHERE course_id = (SELECT id FROM course WHERE title = '${courseTitle}');
  `;
  runSql(sql);
}

/**
 * Add a student to the waitlist for a course.
 */
export function addToWaitlist(studentEmail: string, courseTitle: string) {
  const sql = `
    INSERT INTO course_waitlist (course_id, profile_id)
    VALUES (
      (SELECT id FROM course WHERE title = '${courseTitle}'),
      (SELECT id FROM profile WHERE email = '${studentEmail}')
    )
    ON CONFLICT (course_id, profile_id) DO NOTHING;
  `;
  runSql(sql);
}

/**
 * Remove a student from the waitlist for a course.
 */
export function removeFromWaitlist(studentEmail: string, courseTitle: string) {
  const sql = `
    DELETE FROM course_waitlist
    WHERE course_id = (SELECT id FROM course WHERE title = '${courseTitle}')
      AND profile_id = (SELECT id FROM profile WHERE email = '${studentEmail}');
  `;
  runSql(sql);
}

/**
 * Get the current enrollment count for a course (students only).
 */
export function getEnrollmentCount(courseTitle: string): number {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM groupmember
    WHERE group_id = (SELECT group_id FROM course WHERE title = '${courseTitle}')
      AND role_id = 3;
  `;
  const result = execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres -t -A`, {
    input: sql,
    encoding: 'utf-8',
  });
  return parseInt(result.trim(), 10) || 0;
}

/**
 * Set max_capacity to exactly the current enrollment count (making the course "full").
 * If no students are enrolled, sets capacity to 0 so the course appears full.
 */
export function makeCourseFull(courseTitle: string, waitlistEnabled: boolean) {
  const count = getEnrollmentCount(courseTitle);
  setCourseCapacity(courseTitle, count, waitlistEnabled);
}
