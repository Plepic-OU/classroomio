import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to teacher when a student joins the course waiting list
export async function POST({ fetch, request }) {
	const { to, courseName, studentName, studentEmail } = await request.json();
	console.log('/POST api/email/course/waitlist_teacher_notify', to);

	if (!to || !courseName) {
		return json({ success: false, message: 'Missing required fields' }, { status: 400 });
	}

	const emailData = [
		{
			from: `"ClassroomIO" <notify@mail.classroomio.com>`,
			to,
			subject: `New waiting list entry for ${courseName}`,
			content: `
    <p>Hi there,</p>
      <p><strong>${studentName || 'A student'}</strong> (${studentEmail || 'unknown email'}) has joined the waiting list for <strong>${courseName}</strong>.</p>
      <p>You can review and approve waiting list entries in the People section of your course.</p>
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
