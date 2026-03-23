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

  export let data;

  let supabase = getSupabase();
  let loading = false;

  let disableSubmit = false;
  let formRef: HTMLFormElement;
  let addedToWaitlist = false;

  async function handleSubmit() {
    loading = true;

    if (!$profile.id || !$profile.email) {
      console.log('Profile not found', $profile);
      return goto(`/signup?redirect=${$page.url?.pathname || ''}`);
    }

    const { data: courseData, error } = await supabase
      .from('course')
      .select('group_id, metadata')
      .eq('id', data.id)
      .single();

    console.log({ courseData });
    if (!courseData?.group_id) {
      console.error('error getting group', error);
      return;
    }

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

    // Check if waitlist is enabled and course is full
    const metadata = courseData.metadata || {};
    if (metadata.waitlistEnabled && metadata.maxCapacity != null) {
      const { count } = await supabase
        .from('groupmember')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', courseData.group_id)
        .eq('role_id', ROLE.STUDENT);

      if (count != null && count >= metadata.maxCapacity) {
        // Course is full — add to waiting list
        const { error: waitlistError } = await supabase
          .from('course_waitlist')
          .insert({
            course_id: data.id,
            profile_id: $profile.id,
            status: 'pending'
          });

        if (waitlistError) {
          console.error('Error adding to waitlist', waitlistError);
          snackbar.error('Could not join waiting list. You may already be on it.');
          loading = false;
          return;
        }

        addedToWaitlist = true;
        loading = false;

        // Send waitlist emails
        triggerSendEmail(NOTIFICATION_NAME.WAITLIST_STUDENT_JOINED, {
          to: $profile.email,
          courseName: data.name,
          orgName: data.currentOrg?.name
        });

        Promise.all(
          teachers.map((email) =>
            triggerSendEmail(NOTIFICATION_NAME.WAITLIST_TEACHER_NOTIFICATION, {
              to: email,
              courseName: data.name,
              studentName: $profile.fullname,
              studentEmail: $profile.email
              })
            )
          );

        return;
      }
    }

    // Normal enrollment flow
    const member = {
      profile_id: $profile.id,
      group_id: courseData.group_id,
      role_id: ROLE.STUDENT
    };

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

  {#if addedToWaitlist}
    <div class="my-4 flex w-full flex-col items-center justify-center gap-2">
      <p class="text-center text-sm font-medium text-green-600">
        You've been added to the waiting list! You'll be notified when a spot opens up.
      </p>
      <PrimaryButton
        label="Go to Dashboard"
        onClick={() => goto('/lms')}
      />
    </div>
  {:else}
    <div class="my-4 flex w-full items-center justify-center">
      <PrimaryButton
        label="Join Course"
        type="submit"
        isDisabled={disableSubmit || loading}
        isLoading={loading || !$profile.id}
      />
    </div>
  {/if}
</AuthUI>
