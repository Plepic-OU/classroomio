import { supabase } from '$lib/utils/functions/supabase';
import type { Course, CourseWaitlistEntry } from '$lib/utils/types';

/**
 * Enroll a student or place them on the waitlist if the course is at capacity.
 * Returns 'enrolled' | 'waitlisted'.
 */
export async function enrollOrWaitlist(
  courseId: Course['id'],
  profileId: string
): Promise<{ result: 'enrolled' | 'waitlisted' | null; error: unknown }> {
  const { data, error } = await supabase.rpc('enroll_or_waitlist', {
    course_id_arg: courseId,
    profile_id_arg: profileId
  });
  return { result: data as 'enrolled' | 'waitlisted' | null, error };
}

/**
 * Fetch waitlist entries for a course, ordered by position (FIFO).
 * Uses a SECURITY DEFINER RPC to bypass profile RLS and include student names.
 */
export async function fetchWaitlistEntries(
  courseId: Course['id']
): Promise<{ data: CourseWaitlistEntry[] | null; error: unknown }> {
  const { data, error } = await supabase.rpc('get_waitlist_entries', {
    course_id_arg: courseId
  });

  const entries = data
    ? data.map((row: any) => ({
        id: row.id,
        course_id: row.course_id,
        profile_id: row.profile_id,
        created_at: row.created_at,
        position: row.position,
        profile: {
          fullname: row.fullname,
          avatar_url: row.avatar_url,
          email: row.email
        }
      }))
    : null;

  return { data: entries, error };
}

/**
 * Fetch a student's waitlist position for a specific course.
 * Returns null if the student is not on the waitlist.
 */
export async function fetchStudentWaitlistPosition(
  courseId: Course['id'],
  profileId: string
): Promise<{ position: number | null; error: unknown }> {
  const { data: entries, error } = await supabase
    .from('course_waitlist')
    .select('profile_id, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });

  if (error || !entries) return { position: null, error };

  const index = entries.findIndex((e) => e.profile_id === profileId);
  return { position: index === -1 ? null : index + 1, error: null };
}

/**
 * Teacher approves a waitlisted student — atomically enrolls and removes from waitlist.
 * Returns the approved student's profile_id.
 */
export async function approveWaitlistStudent(
  waitlistId: CourseWaitlistEntry['id'],
  approvedByProfileId: string
): Promise<{ profileId: string | null; error: unknown }> {
  const { data, error } = await supabase.rpc('approve_waitlist_student', {
    waitlist_id_arg: waitlistId,
    approved_by_profile_id_arg: approvedByProfileId
  });
  return { profileId: data as string | null, error };
}
