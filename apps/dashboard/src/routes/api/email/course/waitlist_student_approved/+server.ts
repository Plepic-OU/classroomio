import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends email to student when they're approved from the waiting list
export async function POST({ fetch, request }) {
	const { to, courseName, orgName } = await request.json();
	console.log('/POST api/email/course/waitlist_student_approved', to);

	if (!to || !courseName) {
		return json({ success: false, message: 'Missing required fields' }, { status: 400 });
	}

	const emailData = [
		{
			from: `"${orgName || 'ClassroomIO'} (via ClassroomIO.com)" <notify@mail.classroomio.com>`,
			to,
			subject: `You've been approved for ${courseName}! 🎉`,
			content: `
    <p>Hi there,</p>
      <p>Great news! You've been approved from the waiting list for <strong>${courseName}</strong>.</p>
      <p>You now have full access to the course. Head to your dashboard to start learning!</p>
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
