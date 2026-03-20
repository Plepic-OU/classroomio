import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'testuser@classroomio.test';

// Waitlist test student — will be added to the waitlist
const WAITLIST_STUDENT_EMAIL = 'waitlist-student@classroomio.test';
const WAITLIST_STUDENT_PASSWORD = 'TestPass123!';

// Filler student — fills the course to capacity
const FILLER_STUDENT_EMAIL = 'filler-student@classroomio.test';
const FILLER_STUDENT_PASSWORD = 'TestPass123!';

const ORG_SITE_NAME = 'testorg';

// Safety: refuse to run against non-localhost Supabase
if (!SUPABASE_URL.includes('localhost') && !SUPABASE_URL.includes('127.0.0.1')) {
  console.error(`FATAL: SUPABASE_URL (${SUPABASE_URL}) is not localhost. Refusing to seed.`);
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findOrCreateUser(email: string, password: string, fullname: string) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`Failed to create user ${email}:`, error?.message);
      process.exit(1);
    }
    userId = data.user.id;
  }

  // Upsert profile
  await supabase.from('profile').upsert({
    id: userId, email, fullname,
    username: email.split('@')[0],
    is_email_verified: true,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  return userId;
}

export async function seedWaitlistCourses() {
  console.log('Seeding waitlist test data...');

  // Get test user (teacher/admin) — already created by main seed
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const testUser = existingUsers?.users?.find((u) => u.email === TEST_USER_EMAIL);
  if (!testUser) {
    console.error('FATAL: Test user not found. Run the main seed first.');
    process.exit(1);
  }
  const teacherId = testUser.id;

  // Get org
  const { data: org } = await supabase
    .from('organization')
    .select('id')
    .eq('siteName', ORG_SITE_NAME)
    .single();
  if (!org) {
    console.error('FATAL: Test org not found. Run the main seed first.');
    process.exit(1);
  }

  // Create filler student (fills the course to capacity)
  const fillerStudentId = await findOrCreateUser(
    FILLER_STUDENT_EMAIL, FILLER_STUDENT_PASSWORD, 'Filler Student'
  );

  // Create waitlist student (will be waitlisted)
  const waitlistStudentId = await findOrCreateUser(
    WAITLIST_STUDENT_EMAIL, WAITLIST_STUDENT_PASSWORD, 'Waitlist Student'
  );

  // --- Course 1: Full course WITH waitlist enabled ---
  let fullCourseWithWaitlistGroupId: string;
  let fullCourseWithWaitlistId: string;

  // Check if group already exists
  const { data: existingGroup1 } = await supabase
    .from('group')
    .select('id')
    .eq('name', 'E2E Waitlist Course Group')
    .eq('organization_id', org.id)
    .single();

  if (existingGroup1) {
    fullCourseWithWaitlistGroupId = existingGroup1.id;
  } else {
    const { data: group1 } = await supabase
      .from('group')
      .insert({ name: 'E2E Waitlist Course Group', organization_id: org.id })
      .select('id')
      .single();
    fullCourseWithWaitlistGroupId = group1!.id;
  }

  // Find or create the course
  const { data: existingCourse1 } = await supabase
    .from('course')
    .select('id')
    .eq('group_id', fullCourseWithWaitlistGroupId)
    .single();

  if (existingCourse1) {
    fullCourseWithWaitlistId = existingCourse1.id;
  } else {
    const { data: course1, error: course1Error } = await supabase
      .from('course')
      .insert({
        title: 'E2E Waitlist Course',
        description: 'A course for waitlist e2e testing',
        type: 'LIVE_CLASS',
        group_id: fullCourseWithWaitlistGroupId,
        max_capacity: 1,
        waitlist_enabled: true,
        is_published: true,
      })
      .select('id')
      .single();
    if (course1Error || !course1) {
      console.error('Failed to create waitlist course:', course1Error?.message);
      process.exit(1);
    }
    fullCourseWithWaitlistId = course1.id;

    // Add teacher as tutor
    await supabase.from('groupmember').insert({
      group_id: fullCourseWithWaitlistGroupId,
      profile_id: teacherId,
      role_id: 2,
    });
  }

  // Update course to ensure correct settings
  await supabase
    .from('course')
    .update({ max_capacity: 1, waitlist_enabled: true })
    .eq('id', fullCourseWithWaitlistId);

  // Ensure filler student is enrolled (fills the single spot)
  const { data: existingFiller } = await supabase
    .from('groupmember')
    .select('id')
    .eq('group_id', fullCourseWithWaitlistGroupId)
    .eq('profile_id', fillerStudentId)
    .single();

  if (!existingFiller) {
    await supabase.from('groupmember').insert({
      group_id: fullCourseWithWaitlistGroupId,
      profile_id: fillerStudentId,
      role_id: 3,
    });
  }

  // Clean up any existing waitlist entries for this course
  await supabase
    .from('course_waitlist')
    .delete()
    .eq('course_id', fullCourseWithWaitlistId);

  // Add waitlist student to the waitlist (for approval tests)
  await supabase.from('course_waitlist').insert({
    course_id: fullCourseWithWaitlistId,
    profile_id: waitlistStudentId,
  });

  // --- Course 2: Full course WITHOUT waitlist ---
  let fullCourseNoWaitlistGroupId: string;
  let fullCourseNoWaitlistId: string;

  const { data: existingGroup2 } = await supabase
    .from('group')
    .select('id')
    .eq('name', 'E2E No Waitlist Course Group')
    .eq('organization_id', org.id)
    .single();

  if (existingGroup2) {
    fullCourseNoWaitlistGroupId = existingGroup2.id;
  } else {
    const { data: group2 } = await supabase
      .from('group')
      .insert({ name: 'E2E No Waitlist Course Group', organization_id: org.id })
      .select('id')
      .single();
    fullCourseNoWaitlistGroupId = group2!.id;
  }

  const { data: existingCourse2 } = await supabase
    .from('course')
    .select('id')
    .eq('group_id', fullCourseNoWaitlistGroupId)
    .single();

  if (existingCourse2) {
    fullCourseNoWaitlistId = existingCourse2.id;
  } else {
    const { data: course2, error: course2Error } = await supabase
      .from('course')
      .insert({
        title: 'E2E No Waitlist Course',
        description: 'A full course without waitlist',
        type: 'LIVE_CLASS',
        group_id: fullCourseNoWaitlistGroupId,
        max_capacity: 1,
        waitlist_enabled: false,
        is_published: true,
      })
      .select('id')
      .single();
    if (course2Error || !course2) {
      console.error('Failed to create no-waitlist course:', course2Error?.message);
      process.exit(1);
    }
    fullCourseNoWaitlistId = course2.id;

    // Add teacher as tutor
    await supabase.from('groupmember').insert({
      group_id: fullCourseNoWaitlistGroupId,
      profile_id: teacherId,
      role_id: 2,
    });
  }

  // Update course to ensure correct settings
  await supabase
    .from('course')
    .update({ max_capacity: 1, waitlist_enabled: false })
    .eq('id', fullCourseNoWaitlistId);

  // Ensure filler student is enrolled
  const { data: existingFiller2 } = await supabase
    .from('groupmember')
    .select('id')
    .eq('group_id', fullCourseNoWaitlistGroupId)
    .eq('profile_id', fillerStudentId)
    .single();

  if (!existingFiller2) {
    await supabase.from('groupmember').insert({
      group_id: fullCourseNoWaitlistGroupId,
      profile_id: fillerStudentId,
      role_id: 3,
    });
  }

  console.log('Waitlist seed complete!');
  console.log(`  Full course (waitlist ON):  ${fullCourseWithWaitlistId}`);
  console.log(`  Full course (waitlist OFF): ${fullCourseNoWaitlistId}`);

  return {
    fullCourseWithWaitlist: {
      id: fullCourseWithWaitlistId,
      groupId: fullCourseWithWaitlistGroupId,
      title: 'E2E Waitlist Course',
    },
    fullCourseNoWaitlist: {
      id: fullCourseNoWaitlistId,
      groupId: fullCourseNoWaitlistGroupId,
      title: 'E2E No Waitlist Course',
    },
    waitlistStudent: {
      id: waitlistStudentId,
      email: WAITLIST_STUDENT_EMAIL,
      fullname: 'Waitlist Student',
    },
    orgSiteName: ORG_SITE_NAME,
  };
}

// Run directly if executed as a script
seedWaitlistCourses().catch((err) => {
  console.error('Waitlist seed failed:', err);
  process.exit(1);
});
