import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when teacher removes them from the waitlist
export async function POST({ fetch, request }) {
  const { to, orgName, courseName } = await request.json();
  console.log('/POST api/email/course/student_waitlist_removed', to, orgName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - Waitlist update for ${courseName}`,
      content: `
    <p>Hi there,</p>
      <p>You've been removed from the waitlist for <strong>${courseName}</strong>.</p>
      <p>If you have any questions, please reach out to your instructor.</p>
      <p>Cheers,</p>
      <p>${orgName}</p>
    `
    }
  ];
  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
