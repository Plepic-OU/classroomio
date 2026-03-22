import { execSync } from 'node:child_process';

const CONTAINER = 'supabase_db_classroomio';

/**
 * Delete a course by title (and its associated group/members).
 * Used to ensure clean state before course creation tests.
 */
export function deleteCourseByTitle(title: string) {
  // Course has a deep FK dependency tree (course_newsfeed, groupmember, lesson, etc.)
  // Use a DO block to temporarily drop the FK on group, cascade-delete, then restore.
  // Simpler: just delete all dependents in order.
  const sql = `
    DO $$
    DECLARE
      cid UUID;
      gid UUID;
    BEGIN
      FOR cid, gid IN SELECT id, group_id FROM course WHERE title = '${title}'
      LOOP
        -- Tables referencing groupmember
        DELETE FROM apps_poll_submission WHERE selected_by_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM course_newsfeed_comment WHERE author_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM lesson_comment WHERE groupmember_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM question_answer WHERE group_member_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM submission WHERE submitted_by IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM group_attendance WHERE student_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM apps_poll WHERE "authorId" IN (SELECT id FROM groupmember WHERE group_id = gid);
        DELETE FROM course_newsfeed WHERE author_id IN (SELECT id FROM groupmember WHERE group_id = gid);
        -- Tables referencing course directly
        DELETE FROM course_newsfeed WHERE course_id = cid;
        DELETE FROM course_waitlist WHERE course_id = cid;
        DELETE FROM community_question WHERE course_id = cid;
        DELETE FROM apps_poll WHERE "courseId" = cid;
        DELETE FROM group_attendance WHERE course_id = cid;
        DELETE FROM submission WHERE course_id = cid;
        DELETE FROM lesson_section WHERE course_id = cid;
        DELETE FROM lesson WHERE course_id = cid;
        -- Now groupmember, group, course
        DELETE FROM groupmember WHERE group_id = gid;
        DELETE FROM course WHERE id = cid;
        DELETE FROM "group" WHERE id = gid;
      END LOOP;
    END $$;
  `;
  execSync(`docker exec -i ${CONTAINER} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
