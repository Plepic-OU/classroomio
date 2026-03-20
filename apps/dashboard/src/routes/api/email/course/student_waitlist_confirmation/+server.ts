import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

export async function POST({ fetch, request }) {
  const { to, courseName } = await request.json();
  console.log('/POST api/email/course/student_waitlist_confirmation', to, courseName);

  if (!to || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `You're on the waiting list for ${courseName}`,
      content: `
      <p>Hi there,</p>
      <p>You've been added to the waiting list for <strong>${courseName}</strong>.</p>
      <p>The instructor will review your request and you'll be notified when you're approved.</p>
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
