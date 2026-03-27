import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when a tutor approves them from the waitlist.
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, courseUrl } = await request.json();
  console.log('/POST api/email/course/student_waitlist_approved', to, orgName, courseName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - Your waitlist spot has been approved! 🎉`,
      content: `
      <p>Hi there,</p>
      <p>Great news! You've been approved to join <strong>${courseName}</strong>.</p>
      ${courseUrl ? `<p><a href="${courseUrl}">Click here to start learning</a></p>` : '<p>You can now log in and start learning.</p>'}
      <p>Cheers,</p>
      <p>${orgName}</p>
      `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({ success: true, message: 'Email sent' });
}
