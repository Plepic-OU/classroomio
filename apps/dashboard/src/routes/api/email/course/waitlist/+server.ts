import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

type WaitlistEmailType = 'student_added' | 'teacher_notified' | 'student_approved';

/**
 * POST /api/email/course/waitlist
 *
 * Combined waitlist email endpoint. Routes to the correct template based on `type`.
 *
 * For student_added:   { type, to: string, courseName }
 * For teacher_notified: { type, to: string[], studentName, courseName }
 * For student_approved: { type, to: string, courseName, orgName }
 */
export async function POST({ fetch, request }) {
  const body = await request.json();
  const { type, to, courseName } = body as {
    type: WaitlistEmailType;
    to: string | string[];
    courseName: string;
  };

  if (!type || !to || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  if (type === 'student_added') {
    if (typeof to !== 'string') {
      return json({ success: false, message: 'to must be a string for student_added' }, { status: 400 });
    }
    await sendEmail(fetch)([
      {
        from: '"ClassroomIO" <notify@mail.classroomio.com>',
        to,
        subject: `[${courseName}] You've been added to the waiting list`,
        content: `
          <p>Hi there,</p>
          <p>You've been added to the waiting list for <strong>${courseName}</strong>.</p>
          <p>The teacher will review your request and notify you when you've been approved.</p>
          <p>Cheers,<br>ClassroomIO</p>
        `
      }
    ]);
  } else if (type === 'teacher_notified') {
    const { studentName } = body as { studentName: string };
    if (!studentName) {
      return json({ success: false, message: 'Missing studentName' }, { status: 400 });
    }
    const toList = Array.isArray(to) ? to : [to];
    const emailData = toList.map((email) => ({
      from: '"ClassroomIO" <notify@mail.classroomio.com>',
      to: email,
      subject: `[${courseName}] New student on the waiting list`,
      content: `
        <p>Hi amazing tutor,</p>
        <p><strong>${studentName}</strong> has joined the waiting list for <strong>${courseName}</strong>.</p>
        <p>Log in to review and approve them from the People page of your course.</p>
        <p>ClassroomIO</p>
      `
    }));
    await sendEmail(fetch)(emailData);
  } else if (type === 'student_approved') {
    if (typeof to !== 'string') {
      return json({ success: false, message: 'to must be a string for student_approved' }, { status: 400 });
    }
    const { orgName } = body as { orgName: string };
    await sendEmail(fetch)([
      {
        from: `"${orgName || 'ClassroomIO'} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
        to,
        subject: `${orgName ? orgName + ' - ' : ''}You've been approved! Welcome to ${courseName} 🎉`,
        content: `
          <p>Hi there,</p>
          <p>Great news! You've been approved and enrolled in <strong>${courseName}</strong>.</p>
          <p>Everything has been set up for you to have an amazing learning experience.</p>
          <p>If you run into any issues, don't hesitate to reach out to your instructor(s).</p>
          <p>Cheers,<br>${orgName || 'ClassroomIO'}</p>
        `
      }
    ]);
  } else {
    return json({ success: false, message: 'Unknown type' }, { status: 400 });
  }

  return json({ success: true, message: 'Email sent' });
}
