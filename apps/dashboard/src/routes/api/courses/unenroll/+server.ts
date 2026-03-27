import { json } from '@sveltejs/kit';
import { deleteGroupMember, notifyNextInWaitlist } from '$lib/utils/services/courses';
import {
  triggerSendEmail,
  NOTIFICATION_NAME
} from '$lib/utils/services/notification/notification';

// POST /api/courses/unenroll
// Body: { groupMemberId: string, courseId: string }
// Removes the student from the course and, if the course has a waitlist,
// notifies the next eligible student that a spot has opened.
export async function POST({ request, url }) {
  const { groupMemberId, courseId } = await request.json();

  if (!groupMemberId) {
    return json({ success: false, message: 'Missing groupMemberId' }, { status: 400 });
  }

  const { error: deleteError } = await deleteGroupMember(groupMemberId);

  if (deleteError) {
    console.error('unenroll deleteGroupMember error', deleteError);
    return json({ success: false, message: 'Failed to unenroll student' }, { status: 500 });
  }

  // Trigger waitlist notification if courseId provided
  if (courseId) {
    const { data: notifyData } = await notifyNextInWaitlist(courseId);

    if (notifyData?.email && notifyData?.token) {
      const appUrl = url.origin;
      const claimUrl = `${appUrl}/invite/claim/${notifyData.token}`;

      await triggerSendEmail(NOTIFICATION_NAME.WAITLIST_NOTIFY, {
        to: notifyData.email,
        studentName: notifyData.name,
        courseName: notifyData.course_title,
        claimUrl
      });
    }
  }

  return json({ success: true });
}
