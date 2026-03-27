import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to teacher(s) when a student joins the waitlist
export async function POST({ fetch, request }) {
  const { to, courseName, studentName, studentEmail, link } = await request.json();
  console.log('/POST api/email/course/teacher_student_waitlisted', to, courseName);

  if (!to || !courseName || !studentName || !studentEmail) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const reviewText = link
    ? `<a href="${link}">Review the waitlist</a>`
    : 'Review the waitlist from the People page in your course';

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `[${courseName}] New student on the waitlist`,
      content: `
      <p>Hi,</p>
      <p><strong>${studentName} (${studentEmail})</strong> has joined the waitlist for <strong>${courseName}</strong>.</p>
      <p>${reviewText}.</p>
    `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({
    success: true,
    message: 'Email sent'
  });
}
