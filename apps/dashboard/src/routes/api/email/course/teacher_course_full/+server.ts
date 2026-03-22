import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to teacher(s) when a course reaches max capacity
export async function POST({ fetch, request }) {
  const { to, courseName, maxCapacity, waitlistEnabled } = await request.json();
  console.log('/POST api/email/course/teacher_course_full', to);

  if (!to || !courseName || !maxCapacity) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const waitlistMessage = waitlistEnabled
    ? 'New students will be added to the waitlist for your review.'
    : 'New students will see "Course Full" until you increase the capacity or enable the waitlist.';

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `Course Full - ${courseName}`,
      content: `
    <p>Hi,</p>
      <p><strong>${courseName}</strong> has reached its maximum capacity of <strong>${maxCapacity}</strong> students.</p>
      <p>${waitlistMessage}</p>
      <p>Cheers,</p>
      <p>ClassroomIO</p>
    `
    }
  ];
  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
