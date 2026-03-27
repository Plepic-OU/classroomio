import { json } from '@sveltejs/kit';
import sendEmail from '$mail/sendEmail';

// Sends claim-spot email to a waitlisted student when a seat opens up.
export async function POST({ fetch, request }) {
  const { to, studentName, courseName, claimUrl } = await request.json();

  if (!to || !courseName || !claimUrl) {
    return json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  const emailData = [
    {
      from: `"ClassroomIO" <notify@mail.classroomio.com>`,
      to,
      subject: `A spot opened in ${courseName}`,
      content: `
        <p>Hi${studentName ? ` ${studentName}` : ''},</p>
        <p>Good news! A seat has opened up in <strong>${courseName}</strong>.</p>
        <p>You have <strong>48 hours</strong> to claim your spot before it's offered to the next person on the waitlist.</p>
        <p>
          <a href="${claimUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:4px;">
            Claim My Spot
          </a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${claimUrl}</p>
        <p>If you no longer wish to join this course, simply ignore this email.</p>
        <p>Cheers,<br>The ClassroomIO Team</p>
      `
    }
  ];

  await sendEmail(fetch)(emailData);

  return json({ success: true, message: 'Email sent' });
}
