import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they join the waitlist.
// Also used to notify the tutor when isTeacher=true.
export async function POST({ fetch, request }) {
  const { to, orgName, courseName, studentName, studentEmail, isTeacher } = await request.json();
  console.log('/POST api/email/course/student_waitlisted', to, orgName, courseName);

  if (!to || !orgName || !courseName) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  if (isTeacher && (!studentName || !studentEmail)) {
    return json({ success: false, message: 'Missing student fields for teacher notification' }, { status: 400 });
  }

  let emailData;

  if (isTeacher) {
    emailData = [
      {
        from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
        to,
        subject: `[${courseName}] New student on the waitlist`,
        content: `
        <p>Hi,</p>
        <p>A new student <strong>${studentName} (${studentEmail})</strong> has joined the waitlist for <strong>${courseName}</strong>.</p>
        <p>You can review and approve them from the People page of your course.</p>
        <p>${orgName}</p>
        `
      }
    ];
  } else {
    emailData = [
      {
        from: `"${orgName} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
        to,
        subject: `${orgName} - You've been added to the waitlist`,
        content: `
        <p>Hi there,</p>
        <p>You've been added to the waitlist for <strong>${courseName}</strong>.</p>
        <p>You'll receive an email as soon as a spot opens up and you're approved.</p>
        <p>Cheers,</p>
        <p>${orgName}</p>
        `
      }
    ];
  }

  await sendEmail(fetch)(emailData);

  return json({ success: true, message: 'Email sent' });
}
