<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import AuthUI from '$lib/components/AuthUI/index.svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { setTheme } from '$lib/utils/functions/theme';
  import {
    addGroupMember,
    getCourseEnrollmentStatus,
    joinCourseWaitlist
  } from '$lib/utils/services/courses';
  import type { CurrentOrg } from '$lib/utils/types/org.js';
  import { ROLE } from '$lib/utils/constants/roles';
  import { profile } from '$lib/utils/store/user';
  import {
    triggerSendEmail,
    NOTIFICATION_NAME
  } from '$lib/utils/services/notification/notification';
  import { snackbar } from '$lib/components/Snackbar/store.js';
  import { capturePosthogEvent } from '$lib/utils/services/posthog';
  import { page } from '$app/stores';

  export let data;

  let supabase = getSupabase();
  let loading = false;

  let disableSubmit = false;
  let formRef: HTMLFormElement;

  // Waitlist state
  let enrollmentStatus: {
    max_capacity: number | null;
    waitlist_enabled: boolean;
    enrolled_count: number;
    is_on_waitlist: boolean;
    is_enrolled: boolean;
  } | null = null;
  let statusLoading = true;

  $: isFull =
    enrollmentStatus != null &&
    enrollmentStatus.max_capacity != null &&
    enrollmentStatus.enrolled_count >= enrollmentStatus.max_capacity;
  $: showWaitlistButton = isFull && enrollmentStatus?.waitlist_enabled && !enrollmentStatus?.is_on_waitlist && !enrollmentStatus?.is_enrolled;
  $: showFullMessage = isFull && !enrollmentStatus?.waitlist_enabled && !enrollmentStatus?.is_enrolled;
  $: showAlreadyOnWaitlist = enrollmentStatus?.is_on_waitlist && !enrollmentStatus?.is_enrolled;
  $: showJoinCourse = !isFull && !enrollmentStatus?.is_enrolled;

  async function fetchEnrollmentStatus() {
    if (!data.id) return;
    const { data: status } = await getCourseEnrollmentStatus(data.id);
    enrollmentStatus = status;
    statusLoading = false;
  }

  async function handleWaitlistJoin() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    const { error } = await joinCourseWaitlist(data.id, $profile.id);
    if (error) {
      console.error('Error joining waitlist', error);
      snackbar.error('snackbar.invite.failed_join');
      loading = false;
      return;
    }

    // Fetch teachers for notification
    const { data: courseData } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();

    if (courseData?.group_id) {
      const teacherMembers = await supabase
        .from('groupmember')
        .select('id, profile(email)')
        .eq('group_id', courseData.group_id)
        .eq('role_id', ROLE.TUTOR)
        .returns<{ id: string; profile: { email: string } }[]>();

      const teachers = teacherMembers.data?.map((t) => t.profile?.email || '') || [];

      // Send notification to teachers
      Promise.all(
        teachers.map((email) =>
          triggerSendEmail(NOTIFICATION_NAME.TEACHER_WAITLIST_NOTIFICATION, {
            to: email,
            courseName: data.name,
            studentName: $profile.fullname,
            studentEmail: $profile.email
          })
        )
      );
    }

    // Send confirmation to student
    triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLIST_CONFIRMATION, {
      to: $profile.email,
      courseName: data.name
    });

    capturePosthogEvent('student_joined_waitlist', {
      course_name: data.name,
      student_id: $profile.id,
      student_email: $profile.email
    });

    // Refresh status to show "already on waitlist"
    await fetchEnrollmentStatus();
    loading = false;
  }

  async function handleSubmit() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      console.log('Profile not found', $profile);
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    const { data: courseData, error } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();

    console.log({ courseData });
    if (!courseData?.group_id) {
      console.error('error getting group', error);
      return;
    }

    const member = {
      profile_id: $profile.id,
      group_id: courseData.group_id,
      role_id: ROLE.STUDENT
    };

    const teacherMembers = await supabase
      .from('groupmember')
      .select('id, profile(email)')
      .eq('group_id', courseData.group_id)
      .eq('role_id', ROLE.TUTOR)
      .returns<
        {
          id: string;
          profile: {
            email: string;
          };
        }[]
      >();

    const teachers: Array<string> =
      teacherMembers.data?.map((teacher) => {
        return teacher.profile?.email || '';
      }) || [];

    addGroupMember(member).then((addedMember) => {
      if (addedMember.error) {
        console.error('Error adding student to group', courseData.group_id, addedMember.error);
        snackbar.error('snackbar.invite.failed_join');

        // Full page load to lms if error joining, probably user already joined
        window.location.href = '/lms';
        return;
      }

      capturePosthogEvent('student_joined_course', {
        course_name: data.name,
        student_id: $profile.id,
        student_email: $profile.email
      });

      // Send email welcoming student to the course
      triggerSendEmail(NOTIFICATION_NAME.STUDENT_COURSE_WELCOME, {
        to: $profile.email,
        orgName: data.currentOrg?.name,
        courseName: data.name
      });

      // Send notification to all teacher(s) that a student has joined the course.
      Promise.all(
        teachers.map((email) =>
          triggerSendEmail(NOTIFICATION_NAME.TEACHER_STUDENT_JOINED, {
            to: email,
            courseName: data.name,
            studentName: $profile.fullname,
            studentEmail: $profile.email
          })
        )
      );

      // go to lms
      return goto('/lms');
    });
  }

  function setCurOrg(cOrg: CurrentOrg) {
    if (!cOrg) return;
    currentOrg.set(cOrg);
  }

  onMount(async () => {
    // check if user has session, if not redirect to sign up with redirect back to this page
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      return goto(`/login?redirect=${$page.url?.pathname || ''}`);
    }

    setTheme(data.currentOrg?.theme || '');
    fetchEnrollmentStatus();
  });

  $: setCurOrg(data.currentOrg as CurrentOrg);
</script>

<svelte:head>
  <title>Join {data.name} on ClassroomIO</title>
</svelte:head>

<AuthUI
  {supabase}
  isLogin={false}
  handleSubmit={showWaitlistButton ? handleWaitlistJoin : handleSubmit}
  isLoading={loading || !$profile.id || statusLoading}
  showOnlyContent={true}
  showLogo={true}
  bind:formRef
>
  <div class="mt-0 w-full">
    <h3 class="mb-4 mt-0 text-center text-lg font-medium dark:text-white">{data.name}</h3>
    <p class="text-center text-sm font-light dark:text-white">{data.description}</p>
  </div>

  {#if showAlreadyOnWaitlist}
    <p class="my-4 text-center text-sm text-gray-600 dark:text-gray-300">
      You're on the waiting list. You'll be notified when you're approved.
    </p>
  {:else if showFullMessage}
    <p class="my-4 text-center text-sm text-gray-600 dark:text-gray-300">
      This course is currently full.
    </p>
  {:else if showWaitlistButton}
    <p class="my-2 text-center text-sm text-gray-600 dark:text-gray-300">
      This course is currently full. You'll be notified when you're approved.
    </p>
  {/if}

  <div class="my-4 flex w-full items-center justify-center">
    {#if showWaitlistButton}
      <PrimaryButton
        label="Join Waiting List"
        type="submit"
        isDisabled={disableSubmit || loading}
        isLoading={loading || !$profile.id}
      />
    {:else if showJoinCourse}
      <PrimaryButton
        label="Join Course"
        type="submit"
        isDisabled={disableSubmit || loading || statusLoading}
        isLoading={loading || !$profile.id || statusLoading}
      />
    {:else}
      <PrimaryButton
        label={enrollmentStatus?.is_enrolled ? 'Already Enrolled' : 'Join Course'}
        type="button"
        isDisabled={true}
        isLoading={statusLoading}
      />
    {/if}
  </div>
</AuthUI>
