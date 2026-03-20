<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import AuthUI from '$lib/components/AuthUI/index.svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { setTheme } from '$lib/utils/functions/theme';
  import { addGroupMember } from '$lib/utils/services/courses';
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
  import { t } from '$lib/utils/functions/translations';

  export let data;

  let supabase = getSupabase();
  let loading = false;
  let disableSubmit = false;
  let isWaitlisted = false;
  let formRef: HTMLFormElement;

  async function getGroupId(): Promise<string | null> {
    const { data: courseData, error } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();

    if (!courseData?.group_id) {
      console.error('error getting group', error);
      return null;
    }
    return courseData.group_id;
  }

  async function getTeacherEmails(groupId: string): Promise<string[]> {
    const { data: teacherMembers } = await supabase
      .from('groupmember')
      .select('id, profile(email)')
      .eq('group_id', groupId)
      .eq('role_id', ROLE.TUTOR)
      .returns<{ id: string; profile: { email: string } }[]>();

    return teacherMembers?.map((t) => t.profile?.email || '').filter(Boolean) || [];
  }

  async function handleJoinCourse() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      loading = false;
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    const groupId = await getGroupId();
    if (!groupId) {
      loading = false;
      return;
    }

    const teachers = await getTeacherEmails(groupId);

    const member = {
      profile_id: $profile.id,
      group_id: groupId,
      role_id: ROLE.STUDENT
    };

    const addedMember = await addGroupMember(member);
    if (addedMember.error) {
      console.error('Error adding student to group', groupId, addedMember.error);
      snackbar.error('snackbar.invite.failed_join');
      loading = false;
      window.location.href = '/lms';
      return;
    }

    capturePosthogEvent('student_joined_course', {
      course_name: data.name,
      student_id: $profile.id,
      student_email: $profile.email
    });

    triggerSendEmail(NOTIFICATION_NAME.STUDENT_COURSE_WELCOME, {
      to: $profile.email,
      orgName: data.currentOrg?.name,
      courseName: data.name
    });

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

    loading = false;
    return goto('/lms');
  }

  async function handleJoinWaitlist() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      loading = false;
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    const groupId = await getGroupId();
    if (!groupId) {
      loading = false;
      return;
    }

    const teachers = await getTeacherEmails(groupId);

    const member = {
      profile_id: $profile.id,
      group_id: groupId,
      role_id: ROLE.STUDENT,
      status: 'waitlisted'
    };

    const addedMember = await addGroupMember(member);
    if (addedMember.error) {
      console.error('Error adding student to waitlist', groupId, addedMember.error);
      snackbar.error('snackbar.invite.failed_join');
      loading = false;
      return;
    }

    triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLISTED, {
      to: $profile.email,
      orgName: data.currentOrg?.name,
      courseName: data.name
    });

    Promise.all(
      teachers.map((email) =>
        triggerSendEmail(NOTIFICATION_NAME.TEACHER_STUDENT_WAITLISTED, {
          to: email,
          courseName: data.name,
          studentName: $profile.fullname,
          studentEmail: $profile.email
        })
      )
    );

    isWaitlisted = true;
    loading = false;
  }

  function setCurOrg(cOrg: CurrentOrg) {
    if (!cOrg) return;
    currentOrg.set(cOrg);
  }

  onMount(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      return goto(`/login?redirect=${$page.url?.pathname || ''}`);
    }

    setTheme(data.currentOrg?.theme || '');

    // Client-side check: is this student already waitlisted?
    if ($profile.id) {
      const { data: courseData } = await supabase
        .from('course')
        .select('group_id')
        .eq('id', data.id)
        .single();

      if (courseData?.group_id) {
        const { data: existingMember } = await supabase
          .from('groupmember')
          .select('id, status')
          .eq('group_id', courseData.group_id)
          .eq('profile_id', $profile.id)
          .single();

        if (existingMember?.status === 'waitlisted') {
          isWaitlisted = true;
        } else if (existingMember?.status === 'enrolled') {
          goto('/lms');
        }
      }
    }
  });

  $: setCurOrg(data.currentOrg as CurrentOrg);
</script>

<svelte:head>
  <title>Join {data.name} on ClassroomIO</title>
</svelte:head>

<AuthUI
  {supabase}
  isLogin={false}
  handleSubmit={data.isFull ? (data.waitlistEnabled ? handleJoinWaitlist : () => {}) : handleJoinCourse}
  isLoading={loading || !$profile.id}
  showOnlyContent={true}
  showLogo={true}
  bind:formRef
>
  <div class="mt-0 w-full">
    <h3 class="mb-4 mt-0 text-center text-lg font-medium dark:text-white" data-testid="invite-course-title">{data.name}</h3>
    <p class="text-center text-sm font-light dark:text-white">{data.description}</p>
  </div>

  <div class="my-4 flex w-full items-center justify-center">
    {#if isWaitlisted}
      <p class="text-center text-sm text-gray-500 dark:text-gray-400" data-testid="invite-waitlisted-msg">
        {$t('course.invite.already_waitlisted')}
      </p>
    {:else if data.isFull && !data.waitlistEnabled}
      <p class="text-center text-sm text-gray-500 dark:text-gray-400" data-testid="invite-course-full-msg">
        {$t('course.invite.course_full')}
      </p>
    {:else if data.isFull && data.waitlistEnabled}
      <PrimaryButton
        label={$t('course.invite.join_waitlist')}
        type="submit"
        isDisabled={disableSubmit || loading}
        isLoading={loading || !$profile.id}
        testId="invite-waitlist-btn"
      />
    {:else}
      <PrimaryButton
        label="Join Course"
        type="submit"
        isDisabled={disableSubmit || loading}
        isLoading={loading || !$profile.id}
        testId="invite-join-btn"
      />
    {/if}
  </div>
</AuthUI>
