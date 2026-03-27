import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when teacher approves them from the waitlist
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, enrollLink } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, orgName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const startText = enrollLink
    ? `<a href="${enrollLink}">Start learning now</a>`
    : 'Head over to your dashboard to get started';

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - You've been approved for ${courseName}! 🎉`,
      content: `
    <p>Hi there,</p>
      <p>Great news! You've been approved to join <strong>${courseName}</strong>.</p>
      <p>${startText}.</p>
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
