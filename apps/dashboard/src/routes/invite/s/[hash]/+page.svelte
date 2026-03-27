<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getSupabase, getAccessToken } from '$lib/utils/functions/supabase';
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

  export let data;

  let supabase = getSupabase();
  let loading = false;
  let enrolledStatus: 'ACTIVE' | 'WAITLISTED' | null = null;

  let disableSubmit = false;
  let formRef: HTMLFormElement;

  async function handleSubmit() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      console.log('Profile not found', $profile);
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/courses/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken
        },
        body: JSON.stringify({ courseId: data.id })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error enrolling', result);
        snackbar.error('snackbar.invite.failed_join');
        return;
      }

      if (result.alreadyMember) {
        if (result.status === 'WAITLISTED') {
          enrolledStatus = 'WAITLISTED';
        } else {
          goto('/lms');
        }
        return;
      }

      const status: 'ACTIVE' | 'WAITLISTED' = result.status;
      enrolledStatus = status;

      capturePosthogEvent('student_joined_course', {
        course_name: data.name,
        student_id: $profile.id,
        student_email: $profile.email,
        status
      });

      if (status === 'WAITLISTED') {
        // Send waitlist confirmation emails
        triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLISTED, {
          to: $profile.email,
          orgName: data.currentOrg?.name,
          courseName: data.name
        }).catch(() => snackbar.error());

        // Notify tutors
        const teacherMembers = await supabase
          .from('groupmember')
          .select('id, profile(email)')
          .eq('group_id', result.groupId || '')
          .eq('role_id', ROLE.TUTOR)
          .returns<{ id: string; profile: { email: string } }[]>();

        // Tutor notification is best-effort
        (teacherMembers.data || []).forEach((t) => {
          if (t.profile?.email) {
            triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLISTED, {
              to: t.profile.email,
              orgName: data.currentOrg?.name,
              courseName: data.name,
              studentName: $profile.fullname,
              studentEmail: $profile.email,
              isTeacher: true
            }).catch(() => {});
          }
        });
      } else {
        // Fetch tutors for welcome emails
        const teacherMembers = await supabase
          .from('groupmember')
          .select('id, profile(email)')
          .eq('role_id', ROLE.TUTOR)
          .returns<{ id: string; profile: { email: string } }[]>();

        const teachers: string[] =
          teacherMembers.data?.map((t) => t.profile?.email || '').filter(Boolean) || [];

        triggerSendEmail(NOTIFICATION_NAME.STUDENT_COURSE_WELCOME, {
          to: $profile.email,
          orgName: data.currentOrg?.name,
          courseName: data.name
        }).catch(() => snackbar.error());

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

        goto('/lms');
      }
    } catch (err) {
      console.error('Enroll error', err);
      snackbar.error('snackbar.invite.failed_join');
    } finally {
      loading = false;
    }
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
  </div>

  {#if enrolledStatus === 'WAITLISTED'}
    <div class="my-4 w-full text-center" data-testid="waitlist-confirmation">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        You've been added to the waitlist. You'll receive an email when you're approved.
      </p>
    </div>
  {:else}
    <div class="my-4 flex w-full items-center justify-center">
      {#if data.isFull && !data.waitlistEnabled}
        <PrimaryButton label="Course is Full" isDisabled={true} />
      {:else if data.isFull && data.waitlistEnabled}
        <PrimaryButton
          label="Join Waitlist"
          type="submit"
          isDisabled={disableSubmit || loading}
          isLoading={loading || !$profile.id}
        />
      {:else}
        <PrimaryButton
          label="Join Course"
          type="submit"
          isDisabled={disableSubmit || loading}
          isLoading={loading || !$profile.id}
        />
      {/if}
    </div>
  {/if}
</AuthUI>
