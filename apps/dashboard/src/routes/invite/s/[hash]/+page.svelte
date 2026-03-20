<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import AuthUI from '$lib/components/AuthUI/index.svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { setTheme } from '$lib/utils/functions/theme';
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
  let formRef: HTMLFormElement;
  let joinedWaitlist = false;
  let alreadyWaitlisted = false;

  // Derived waitlist state from server load
  $: isFull =
    data.waitlistEnabled && data.maxCapacity != null && data.enrolledCount >= data.maxCapacity;
  $: spotsRemaining =
    data.waitlistEnabled && data.maxCapacity != null
      ? Math.max(0, data.maxCapacity - data.enrolledCount)
      : null;

  async function checkAlreadyWaitlisted(): Promise<boolean> {
    if (!$profile.id || !data.waitlistEnabled) return false;
    const { data: courseData } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();
    if (!courseData?.group_id) return false;
    const { data: existing } = await supabase
      .from('groupmember')
      .select('id, enrollment_status')
      .eq('group_id', courseData.group_id)
      .eq('profile_id', $profile.id)
      .eq('role_id', ROLE.STUDENT)
      .maybeSingle();
    return existing?.enrollment_status === 'waitlisted';
  }

  $: if ($profile.id && data.waitlistEnabled) {
    checkAlreadyWaitlisted().then((v) => {
      alreadyWaitlisted = v;
    });
  }

  async function getTutorEmails(groupId: string): Promise<string[]> {
    const { data: teachers } = await supabase
      .from('groupmember')
      .select('profile(email)')
      .eq('group_id', groupId)
      .eq('role_id', ROLE.TUTOR)
      .returns<{ profile: { email: string } }[]>();
    return (teachers || []).map((t) => t.profile?.email).filter(Boolean) as string[];
  }

  async function getCourseGroupId(): Promise<string | null> {
    const { data: courseData } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();
    return courseData?.group_id ?? null;
  }

  async function handleSubmit() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      console.log('Profile not found', $profile);
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token || '';

      const res = await fetch('/api/courses/waitlist/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken
        },
        body: JSON.stringify({ courseId: data.id, profileId: $profile.id })
      });

      const result = await res.json();

      if (!result.success && result.status !== 'already_member') {
        snackbar.error('snackbar.invite.failed_join');
        loading = false;
        return;
      }

      if (result.status === 'already_member') {
        if (result.enrollment_status === 'waitlisted') {
          alreadyWaitlisted = true;
        } else {
          goto('/lms');
        }
        loading = false;
        return;
      }

      const isWaitlisted =
        result.status === 'waitlisted' || result.status === 'waitlisted_by_trigger';

      if (isWaitlisted) {
        joinedWaitlist = true;

        const groupId = await getCourseGroupId();
        if (groupId) {
          const tutorEmails = await getTutorEmails(groupId);

          triggerSendEmail(NOTIFICATION_NAME.STUDENT_ADDED_TO_WAITLIST, {
            type: 'student_added',
            to: $profile.email,
            courseName: data.name
          });

          if (tutorEmails.length) {
            triggerSendEmail(NOTIFICATION_NAME.TEACHER_STUDENT_WAITLISTED, {
              type: 'teacher_notified',
              to: tutorEmails,
              studentName: $profile.fullname,
              courseName: data.name
            });
          }
        }

        capturePosthogEvent('student_joined_waitlist', {
          course_name: data.name,
          student_id: $profile.id
        });

        loading = false;
        return;
      }

      // Normal enrollment ('active')
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

      const groupId = await getCourseGroupId();
      if (groupId) {
        const tutorEmails = await getTutorEmails(groupId);
        for (const email of tutorEmails) {
          triggerSendEmail(NOTIFICATION_NAME.TEACHER_STUDENT_JOINED, {
            to: email,
            courseName: data.name,
            studentName: $profile.fullname,
            studentEmail: $profile.email
          });
        }
      }

      return goto('/lms');
    } catch (err) {
      console.error('Error joining course', err);
      snackbar.error('snackbar.invite.failed_join');
    }

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
  });

  $: setCurOrg(data.currentOrg as CurrentOrg);
</script>

<svelte:head>
  <title>Join {data.name} on ClassroomIO</title>
</svelte:head>

<AuthUI
  {supabase}
  isLogin={false}
  {handleSubmit}
  isLoading={loading || !$profile.id}
  showOnlyContent={true}
  showLogo={true}
  bind:formRef
>
  <div class="mt-0 w-full">
    <h3 class="mb-4 mt-0 text-center text-lg font-medium dark:text-white">{data.name}</h3>
    <p class="text-center text-sm font-light dark:text-white">{data.description}</p>

    {#if spotsRemaining !== null && !isFull}
      <p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
        {$t('invite.spots_remaining', { count: spotsRemaining })}
      </p>
    {/if}
  </div>

  <div class="my-4 flex w-full flex-col items-center justify-center gap-2">
    {#if joinedWaitlist}
      <p class="text-center text-sm text-green-600 dark:text-green-400">
        {$t('invite.waitlist_joined_confirmation')}
      </p>
    {:else if alreadyWaitlisted}
      <PrimaryButton label={$t('invite.already_on_waitlist')} isDisabled={true} />
    {:else if isFull}
      <PrimaryButton
        label={$t('invite.join_waitlist')}
        type="submit"
        isDisabled={loading}
        isLoading={loading || !$profile.id}
      />
      <p class="text-center text-xs text-gray-500 dark:text-gray-400">
        {$t('invite.course_full_message')}
      </p>
    {:else}
      <PrimaryButton
        label={$t('invite.join_course')}
        type="submit"
        isDisabled={disableSubmit || loading}
        isLoading={loading || !$profile.id}
      />
    {/if}
  </div>
</AuthUI>
