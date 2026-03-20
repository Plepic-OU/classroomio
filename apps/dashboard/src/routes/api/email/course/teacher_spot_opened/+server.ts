import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to teacher(s) when a student drops the course and there are students on the waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, waitlistCount, peoplePageUrl } = await request.json();
  console.log('/POST api/email/course/teacher_spot_opened', to, courseName);

  if (!to || !courseName || !waitlistCount || !peoplePageUrl) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `[${courseName}] A spot has opened up`,
      content: `
      <p>Hi amazing tutor,</p>
      <p>A student has left <strong>${courseName}</strong> and a spot is now open.</p>
      <p>There are currently <strong>${waitlistCount}</strong> student(s) waiting to join.</p>
      <p>You can approve a waitlisted student from the <a href="${peoplePageUrl}">people page</a>.</p>
      <p>Cheers,<br>ClassroomIO</p>
    `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
