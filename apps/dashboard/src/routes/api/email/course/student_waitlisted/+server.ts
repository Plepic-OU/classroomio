import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they join a course waiting list
export async function POST({ fetch, request }) {
  const { to, orgName, courseName } = await request.json();
  console.log('/POST api/email/course/student_waitlisted', to, orgName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - You're on the waiting list`,
      content: `
    <p>Hi there,</p>
      <p>You've been added to the waiting list for: <strong>${courseName}</strong></p>
      <p>The course instructor will review your request and notify you when you're approved.</p>
      <p>If you have any questions, feel free to reach out to your instructor(s).</p>
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
