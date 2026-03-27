import { supabase } from '$lib/utils/functions/supabase';
import type { Course } from '../types';

export const isCourseFree = (cost: number) => !(Number(cost) > 0);

export const getStudentInviteLink = (_course: Course, orgSiteName: string, origin: string) => {
  const hash = encodeURIComponent(
    btoa(
      JSON.stringify({
        id: _course.id,
        name: _course.title,
        description: _course.description,
        orgSiteName
      })
    )
  );

  return `${origin}/invite/s/${hash}`;
};

const tagsToReplace: { [k: string]: string } = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
};

export function replaceHTMLTag(text: string) {
  return text
    .split('')
    .map((char) => tagsToReplace[char] || char)
    .join('');
}

export function calcCourseDiscount(percent = 0, cost: number, showDiscount: boolean) {
  if (!percent || !showDiscount) return cost;
  const discountAmount = (percent / 100) * cost;
  const discountedPrice = cost - discountAmount;
  return Math.round(discountedPrice);
}

export interface CourseCapacityStatus {
  isFull: boolean;
  hasWaitlist: boolean;
  enrolledCount: number;
  maxCapacity: number | null;
  isOnWaitlist: boolean;
}

// Checks whether a course is at capacity and whether the user is on the waitlist.
// Takes groupId and maxCapacity as parameters to avoid a redundant DB fetch — the
// caller (landing page, invite page) already has these from the course query.
export async function getCourseCapacityStatus(
  courseId: string,
  groupId: string,
  maxCapacity: number | null,
  profileId?: string
): Promise<CourseCapacityStatus> {
  const hasWaitlist = maxCapacity !== null;

  if (!hasWaitlist) {
    // No capacity set — skip DB queries. enrolledCount is 0 because callers
    // only display it when hasWaitlist is true.
    return {
      isFull: false,
      hasWaitlist: false,
      enrolledCount: 0,
      maxCapacity: null,
      isOnWaitlist: false
    };
  }

  // Count enrolled students (role_id = 3)
  const { count: enrolledCount } = await supabase
    .from('groupmember')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('role_id', 3);

  const enrolled = enrolledCount ?? 0;
  const isFull = enrolled >= maxCapacity;

  // Check if current user is already on the waitlist
  let isOnWaitlist = false;
  if (profileId) {
    const { data } = await supabase
      .from('course_waitlist')
      .select('id')
      .eq('course_id', courseId)
      .eq('profile_id', profileId)
      .maybeSingle();

    isOnWaitlist = !!data;
  }

  return {
    isFull,
    hasWaitlist: true,
    enrolledCount: enrolled,
    maxCapacity,
    isOnWaitlist
  };
}
