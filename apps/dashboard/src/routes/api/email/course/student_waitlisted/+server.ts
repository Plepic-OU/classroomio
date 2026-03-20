import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they are placed on the waitlist
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, position } = await request.json();
  console.log('/POST api/email/course/student_waitlisted', to, courseName);

  if (!to || !orgName || !courseName || !position) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
      to,
      subject: `${orgName} - You're on the waitlist for ${courseName}`,
      content: `
    <p>Hi there,</p>
    <p>The course <strong>${courseName}</strong> is currently full.</p>
    <p>You have been added to the waitlist at <strong>position #${position}</strong>.</p>
    <p>You will be notified by your instructor when a spot becomes available.</p>
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
