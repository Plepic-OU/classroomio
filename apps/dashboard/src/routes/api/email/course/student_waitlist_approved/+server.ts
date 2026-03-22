import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they are approved from the waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, studentName, paymentLink } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to);

  if (!to || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `You've been approved - ${courseName}`,
      content: `
    <p>Hi${studentName ? ` ${studentName}` : ''},</p>
      <p>Great news! You've been approved for <strong>${courseName}</strong>.</p>
      ${paymentLink
        ? `<p>To complete your enrollment, please proceed with payment: <a href="${paymentLink}">${paymentLink}</a></p>`
        : '<p>You can now access the course from your dashboard.</p>'}
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
