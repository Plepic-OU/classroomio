import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

export async function POST({ fetch, request }) {
  const { to, courseName, studentName } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, courseName);

  if (!to || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `You've been approved to join ${courseName}!`,
      content: `
      <p>Hi${studentName ? ` ${studentName}` : ''},</p>
      <p>You've been approved to join <strong>${courseName}</strong>!</p>
      <p>You can now access the course content. Head to your dashboard to get started.</p>
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
