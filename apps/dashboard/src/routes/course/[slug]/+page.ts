import type { MetaTagsProps } from 'svelte-meta-tags';
import { fetchCourse, getEnrollmentCount, getWaitlistEntry } from '$lib/utils/services/courses';
import { supabase, getSupabase } from '$lib/utils/functions/supabase';

if (!supabase) {
  getSupabase();
}

export const load = async ({ params = { slug: '' } }) => {
  const { data } = await fetchCourse(undefined, params.slug);

  let enrollmentCount = 0;
  let isOnWaitlist = false;

  const maxCapacity = data?.metadata?.max_capacity;

  if (maxCapacity && data?.group?.id) {
    // Only fetch enrollment data when course has a capacity limit
    const sessionPromise = supabase ? supabase.auth.getSession() : null;
    const countPromise = getEnrollmentCount(data.group.id);

    const [countResult, sessionResult] = await Promise.all([
      countPromise,
      sessionPromise
    ]);

    enrollmentCount = countResult.count;

    // Check if current user is on the waitlist
    const userId = sessionResult?.data?.session?.user?.id;
    if (userId && data.id) {
      const { data: entry } = await getWaitlistEntry(data.id, userId);
      isOnWaitlist = !!entry;
    }
  }

  const pageMetaTags = Object.freeze({
    title: data?.title,
    description: data?.description,
    openGraph: {
      title: data?.title,
      description: data?.description,
      images: [
        {
          url: data?.logo || '',
          alt: data?.title,
          width: 280,
          height: 200,
          secureUrl: data?.logo,
          type: 'image/jpeg'
        }
      ]
    },
    twitter: {
      handle: '@classroomio',
      site: '@classroomio',
      cardType: 'summary_large_image' as const,
      title: data?.title,
      description: data?.description,
      image: data?.logo,
      imageAlt: 'ClassroomIO OG Image'
    }
  }) satisfies MetaTagsProps;

  return {
    slug: params.slug,
    course: data,
    enrollmentCount,
    isOnWaitlist,
    pageMetaTags
  };
};
