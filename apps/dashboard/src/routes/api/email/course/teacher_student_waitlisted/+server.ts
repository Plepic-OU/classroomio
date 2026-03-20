import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Notifies teacher(s) when a student joins the course waiting list
export async function POST({ fetch, request }) {
  const { to, courseName, studentName, studentEmail } = await request.json();
  console.log('/POST api/email/course/teacher_student_waitlisted', to, courseName);

  if (!to || !courseName || !studentName || !studentEmail) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO.com" <notify@mail.classroomio.com>`,
      to,
      subject: `[${courseName}] New student on waiting list`,
      content: `
    <p>Hi there,</p>
      <p>A new student has joined the waiting list for: <strong>${courseName}</strong></p>
      <p><strong>Student name:</strong> ${studentName}</p>
      <p><strong>Student email:</strong> ${studentEmail}</p>
      <p>You can approve them from the People tab in your course dashboard.</p>
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
