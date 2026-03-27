import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they are approved from the waiting list
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, courseUrl } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, orgName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const courseLink = courseUrl ? `<p><a href="${courseUrl}">Click here to access the course.</a></p>` : '';

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - You've been approved!`,
      content: `
    <p>Hi there,</p>
      <p>Great news! You've been approved for <strong>${courseName}</strong> at ${orgName}.</p>
      ${courseLink}
      <p>Everything has been set up for you to have an amazing learning experience.</p>
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
