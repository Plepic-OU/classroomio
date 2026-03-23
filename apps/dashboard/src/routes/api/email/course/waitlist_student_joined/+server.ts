import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they join a course waiting list
export async function POST({ fetch, request }) {
	const { to, courseName, orgName } = await request.json();
	console.log('/POST api/email/course/waitlist_student_joined', to);

	if (!to || !courseName) {
		return json({ success: false, message: 'Missing required fields' }, { status: 400 });
	}

	const emailData = [
		{
			from: `"${orgName || 'ClassroomIO'} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
			to,
			subject: `You're on the waiting list for ${courseName}`,
			content: `
    <p>Hi there,</p>
      <p>You've been added to the waiting list for <strong>${courseName}</strong>.</p>
      <p>The course is currently at full capacity. You'll be notified as soon as a spot becomes available and you're approved by the instructor.</p>
      <p>Cheers,</p>
      <p>${orgName || 'ClassroomIO'}</p>
    `
		}
	];
	await sendEmail(fetch)(emailData);

	return json({
		success: true,
		message: 'Email sent'
	});
}
