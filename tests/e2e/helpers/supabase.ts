import { request } from '@playwright/test';

function makeClient() {
  return request.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

/** Creates an unpublished [TEST] course in the admin's tutor group. Returns the new course id. */
export async function createUnpublishedTestCourse(title: string): Promise<string> {
  const ctx = await makeClient();

  // Get admin profile_id
  const profileRes = await ctx.get(
    `/rest/v1/profile?email=eq.${encodeURIComponent(process.env.TEST_EMAIL!)}&select=id&limit=1`
  );
  const profiles = await profileRes.json();
  const profileId = profiles[0]?.id;
  if (!profileId) throw new Error('Admin profile not found');

  // Get admin's tutor group
  const memberRes = await ctx.get(
    `/rest/v1/groupmember?profile_id=eq.${profileId}&role_id=eq.2&select=group_id&limit=1`
  );
  const members = await memberRes.json();
  const groupId = members[0]?.group_id;
  if (!groupId) throw new Error('No tutor group found for admin');

  // Create unpublished course in that group
  const courseRes = await ctx.post('/rest/v1/course', {
    data: {
      title,
      description: 'Test course description',
      group_id: groupId,
      is_published: false,
      status: 'ACTIVE',
      type: 'SELF_PACED',
      metadata: { allowNewStudent: false },
    },
    headers: { Prefer: 'return=representation' },
  });
  const courses = await courseRes.json();
  await ctx.dispose();
  const courseId = courses[0]?.id;
  if (!courseId) throw new Error('Failed to create test course');
  return courseId;
}

/** Returns the ID of a course where the seeded admin user is a tutor. */
export async function getAdminTaughtCourseId(): Promise<string> {
  const ctx = await makeClient();
  // Get the admin profile
  const profileRes = await ctx.get(
    `/rest/v1/profile?email=eq.${encodeURIComponent(process.env.TEST_EMAIL!)}&select=id&limit=1`
  );
  const profiles = await profileRes.json();
  const profileId = profiles[0]?.id;
  if (!profileId) throw new Error('Admin profile not found');

  // Get a group where admin is a tutor (role_id=2)
  const memberRes = await ctx.get(
    `/rest/v1/groupmember?profile_id=eq.${profileId}&role_id=eq.2&select=group_id&limit=1`
  );
  const members = await memberRes.json();
  const groupId = members[0]?.group_id;
  if (!groupId) throw new Error('No tutor group found for admin');

  // Get a course in that group
  const courseRes = await ctx.get(
    `/rest/v1/course?group_id=eq.${groupId}&select=id&limit=1&status=eq.ACTIVE`
  );
  const courses = await courseRes.json();
  await ctx.dispose();
  const courseId = courses[0]?.id;
  if (!courseId) throw new Error('No active course found for admin group');
  return courseId;
}

/** Returns the siteName of the org where the test admin user is an admin. */
export async function getAdminOrgSiteName(): Promise<string> {
  const ctx = await makeClient();
  const profileRes = await ctx.get(
    `/rest/v1/profile?email=eq.${encodeURIComponent(process.env.TEST_EMAIL!)}&select=id&limit=1`
  );
  const profiles = await profileRes.json();
  const profileId = profiles[0]?.id;
  if (!profileId) throw new Error('Admin profile not found');

  const res = await ctx.get(
    `/rest/v1/organizationmember?profile_id=eq.${profileId}&select=organization(siteName)&limit=1`
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.organization?.siteName as string;
}

export async function getOrgSlug(): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get(
    '/rest/v1/organizationmember?select=organization(siteName)&limit=1&order=id.asc'
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.organization?.siteName as string;
}

export async function getCourseId(title: string): Promise<string> {
  const ctx = await makeClient();
  const encoded = encodeURIComponent(title);
  const res = await ctx.get(`/rest/v1/course?title=eq.${encoded}&select=id&limit=1`, {
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}

export async function getCourseSlug(title: string): Promise<string> {
  const ctx = await makeClient();
  const encoded = encodeURIComponent(title);
  const res = await ctx.get(`/rest/v1/course?title=eq.${encoded}&select=slug&limit=1`, {
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.slug as string;
}

/** Returns a published, free course that allows new students. Uses seeded data. */
export async function getEnrollableCourse(): Promise<{
  id: string;
  slug: string;
  title: string;
  description: string;
  orgSiteName: string;
}> {
  const ctx = await makeClient();

  // Get courses with their org site_name via the group → organization chain
  const res = await ctx.get(
    '/rest/v1/course?is_published=eq.true&cost=eq.0&select=id,slug,title,description,metadata,group_id,group(organization(siteName))'
  );
  const rows: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    metadata: { allowNewStudent?: boolean };
    group_id: string;
    group: { organization: { siteName: string } } | null;
  }> = await res.json();

  const course = rows.find((r) => r.metadata?.allowNewStudent === true);
  if (!course) throw new Error('No published free enrollable course found in seed data');

  await ctx.dispose();

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description || '',
    orgSiteName: course.group?.organization?.siteName ?? '',
  };
}

/** Returns the profile_id of the seeded student@test.com account. */
export async function getStudentProfileId(): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.get('/rest/v1/profile?email=eq.student%40test.com&select=id&limit=1', {
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  const id = data[0]?.id as string;
  if (!id) throw new Error('student@test.com profile not found in seed data');
  return id;
}

/**
 * Creates a [TEST] course with waitlist enabled.
 * Returns id, groupId, title, description, and orgSiteName for constructing invite URLs.
 */
export async function createWaitlistTestCourse(
  title: string,
  maxCapacity: number,
): Promise<{ id: string; groupId: string; title: string; description: string; orgSiteName: string }> {
  const ctx = await makeClient();

  const profileRes = await ctx.get(
    `/rest/v1/profile?email=eq.${encodeURIComponent(process.env.TEST_EMAIL!)}&select=id&limit=1`,
  );
  const profiles = await profileRes.json();
  const profileId = profiles[0]?.id;
  if (!profileId) throw new Error('Admin profile not found');

  const memberRes = await ctx.get(
    `/rest/v1/groupmember?profile_id=eq.${profileId}&role_id=eq.2&select=group_id&limit=1`,
  );
  const members = await memberRes.json();
  const groupId = members[0]?.group_id;
  if (!groupId) throw new Error('No tutor group found for admin');

  // Get org siteName for building the invite URL
  const orgRes = await ctx.get(
    `/rest/v1/organizationmember?profile_id=eq.${profileId}&select=organization(siteName)&limit=1`,
  );
  const orgData = await orgRes.json();
  const orgSiteName = orgData[0]?.organization?.siteName as string;

  const description = 'Test waitlist course description';
  const courseRes = await ctx.post('/rest/v1/course', {
    data: {
      title,
      description,
      group_id: groupId,
      is_published: true,
      status: 'ACTIVE',
      type: 'SELF_PACED',
      waitlist_enabled: true,
      max_capacity: maxCapacity,
      metadata: { allowNewStudent: true },
    },
    headers: { Prefer: 'return=representation' },
  });
  const courses = await courseRes.json();
  const courseId = courses[0]?.id;
  if (!courseId) throw new Error('Failed to create waitlist test course');

  await ctx.dispose();
  return { id: courseId, groupId, title, description, orgSiteName };
}

/** Seeds an active student membership in a group. Returns the groupmember id. */
export async function seedActiveMember(groupId: string, profileId: string): Promise<string> {
  const ctx = await makeClient();
  const res = await ctx.post('/rest/v1/groupmember', {
    data: {
      group_id: groupId,
      profile_id: profileId,
      role_id: 3, // STUDENT
      enrollment_status: 'active',
    },
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}

/** Seeds a waitlisted student membership in a group. Returns the groupmember id.
 *  Deletes any existing membership for this profile first to avoid unique-constraint conflicts
 *  when tests share the same group across scenarios. */
export async function seedWaitlistedMember(groupId: string, profileId: string): Promise<string> {
  const ctx = await makeClient();
  // Remove any prior membership so we can insert fresh with the desired status.
  await ctx.delete(`/rest/v1/groupmember?group_id=eq.${groupId}&profile_id=eq.${profileId}`);
  const res = await ctx.post('/rest/v1/groupmember', {
    data: {
      group_id: groupId,
      profile_id: profileId,
      role_id: 3, // STUDENT
      enrollment_status: 'waitlisted',
    },
    headers: { Prefer: 'return=representation' },
  });
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.id as string;
}
