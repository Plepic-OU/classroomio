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

  export let data;

  let supabase = getSupabase();
  let loading = false;

  let disableSubmit = false;
  let formRef: HTMLFormElement;

  async function handleSubmit() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      console.log('Profile not found', $profile);
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    // Get course group_id for the RPC call
    const { data: courseData, error } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', data.id)
      .single();

    if (!courseData?.group_id) {
      console.error('error getting group', error);
      loading = false;
      return;
    }

    // Atomic enroll-or-waitlist via RPC (enforces capacity + allowNewStudent server-side)
    const { data: result, error: rpcError } = await supabase.rpc('try_enroll_or_waitlist', {
      p_course_id: data.id,
      p_group_id: courseData.group_id
    });

    if (rpcError) {
      console.error('Enrollment RPC error', rpcError);
      snackbar.error('snackbar.invite.failed_join');
      window.location.href = '/lms';
      return;
    }

    if (result === 'closed') {
      snackbar.error('snackbar.invite.closed');
      loading = false;
      return;
    }

    if (result === 'waitlisted') {
      capturePosthogEvent('student_waitlisted', {
        course_name: data.name,
        student_id: $profile.id,
        student_email: $profile.email
      });

      snackbar.success('snackbar.waitlist.added');
      return goto('/lms');
    }

    // result === 'enrolled'
    capturePosthogEvent('student_joined_course', {
      course_name: data.name,
      student_id: $profile.id,
      student_email: $profile.email
    });

    // Fetch teachers for notification
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
      teacherMembers.data?.map((teacher) => teacher.profile?.email || '') || [];

    // Send welcome email
    triggerSendEmail(NOTIFICATION_NAME.STUDENT_COURSE_WELCOME, {
      to: $profile.email,
      orgName: data.currentOrg?.name,
      courseName: data.name
    });

    // Notify teachers
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

    return goto('/lms');
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

  <div class="my-4 flex w-full items-center justify-center">
    <PrimaryButton
      label="Join Course"
      type="submit"
      isDisabled={disableSubmit || loading}
      isLoading={loading || !$profile.id}
    />
  </div>
</AuthUI>
