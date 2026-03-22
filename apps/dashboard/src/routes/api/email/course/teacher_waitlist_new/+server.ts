import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to teacher(s) when a student joins the course waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, studentName, studentEmail } = await request.json();
  console.log('/POST api/email/course/teacher_waitlist_new', to);

  if (!to || !courseName || !studentName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `New Waitlist Entry - ${courseName}`,
      content: `
    <p>Hi,</p>
      <p><strong>${studentName}</strong> (${studentEmail}) has joined the waitlist for <strong>${courseName}</strong>.</p>
      <p>You can review and approve waitlisted students from the People tab in your course dashboard.</p>
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
