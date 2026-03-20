import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

export async function POST({ fetch, request }) {
  const { to, courseName, studentName, studentEmail } = await request.json();
  console.log('/POST api/email/course/teacher_waitlist_notification', to, courseName);

  if (!to || !courseName || !studentName || !studentEmail) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `[${courseName}] New student on the waiting list`,
      content: `
      <p>Hi,</p>
      <p><strong>${studentName}</strong> (${studentEmail}) has joined the waiting list for <strong>${courseName}</strong>.</p>
      <p>Review pending requests in the People tab of your course.</p>
    `
    }
  ];
  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
