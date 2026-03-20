import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when teacher approves them from the waitlist
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, lmsCourseUrl } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, courseName);

  if (!to || !orgName || !courseName || !lmsCourseUrl) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - You've been approved for ${courseName} 🎉`,
      content: `
    <p>Hi there,</p>
    <p>Great news! Your instructor has approved your waitlist request for <strong>${courseName}</strong>.</p>
    <p>You are now enrolled. <a href="${lmsCourseUrl}">Start learning now</a>.</p>
    <p>We hope you have an amazing learning experience!</p>
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
