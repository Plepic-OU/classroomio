import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they are approved from the waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, studentName, courseLink } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, courseName);

  if (!to || !courseName || !studentName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `You've been approved for ${courseName}!`,
      content: `
    <p>Hi ${studentName},</p>
      <p>You've been approved to join <strong>${courseName}</strong>.</p>
      ${courseLink ? `<p><a href="${courseLink}">Click here to access the course</a></p>` : ''}
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
