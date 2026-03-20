import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they join the waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, studentName } = await request.json();
  console.log('/POST api/email/course/student_waitlisted', to, courseName);

  if (!to || !courseName || !studentName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `You're on the waitlist for ${courseName}`,
      content: `
    <p>Hi ${studentName},</p>
      <p>The course <strong>${courseName}</strong> is currently full. You've been added to the waitlist and will be notified when a teacher approves your enrollment.</p>
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
