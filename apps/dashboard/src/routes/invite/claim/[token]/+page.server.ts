import { redirect } from '@sveltejs/kit';
import { claimWaitlistSpot } from '$lib/utils/services/courses';

export const load = async ({ params }) => {
  const { token } = params;

  const { data, error } = await claimWaitlistSpot(token);

  if (error) {
    console.error('claim_waitlist_spot error', error);
    return { status: 'error' };
  }

  if (data?.enrolled) {
    // Spot claimed — redirect straight to LMS
    throw redirect(303, '/lms');
  }

  if (data?.expired) {
    return { status: 'expired', token };
  }

  // not_found or unexpected
  return { status: 'not_found', token };
};
