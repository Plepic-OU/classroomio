<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import TextChip from '$lib/components/Chip/Text.svelte';
  import ComingSoon from '$lib/components/ComingSoon/index.svelte';
  import DeleteConfirmation from '$lib/components/Course/components/People/DeleteConfirmation.svelte';
  import InvitationModal from '$lib/components/Course/components/People/InvitationModal.svelte';
  import { deleteMemberModal } from '$lib/components/Course/components/People/store';
  import type { ProfileRole } from '$lib/components/Course/components/People/types';
  import { course, group } from '$lib/components/Course/store';
  import Select from '$lib/components/Form/Select.svelte';
  import IconButton from '$lib/components/IconButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import RoleBasedSecurity from '$lib/components/RoleBasedSecurity/index.svelte';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { ROLE_LABEL, ROLES } from '$lib/utils/constants/roles';
  import { t } from '$lib/utils/functions/translations';
  import { deleteGroupMember, getWaitlistMembers, approveFromWaitlist } from '$lib/utils/services/courses';
  import {
    triggerSendEmail,
    NOTIFICATION_NAME
  } from '$lib/utils/services/notification/notification';
  import { profile } from '$lib/utils/store/user';
  import type { GroupPerson } from '$lib/utils/types';
  import {
    CopyButton,
    Search,
    StructuredList,
    StructuredListBody,
    StructuredListCell,
    StructuredListHead,
    StructuredListRow
  } from 'carbon-components-svelte';
  import TrashCanIcon from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import { onMount } from 'svelte';

  let people: Array<GroupPerson> = [];
  let member: { id?: string; email?: string; profile?: { email: string } } = {};
  let filterBy: ProfileRole = ROLES[0];
  let searchValue = '';
  let waitlistMembers: Array<{ id: string; created_at: string; profile_id: string; profile: { fullname: string; email: string } }> = [];
  let approvingId: string | null = null;

  function filterPeople(_query, people) {
    const query = _query.toLowerCase();
    return people.filter((person) => {
      const { profile, email } = person;
      return profile?.fullname?.toLowerCase()?.includes(query) || email?.includes(query);
    });
  }

  async function deletePerson() {
    if (!member.id) return;
    $group.people = $group.people.filter((person: { id: string }) => person.id !== member.id);
    $group.tutors = $group.tutors.filter((person: GroupPerson) => person.memberId !== member.id);

    await deleteGroupMember(member.id);
  }

  function sortAndFilterPeople(_people: Array<GroupPerson>, filterBy: ProfileRole) {
    people = (_people || [])
      .filter((person) => {
        if (filterBy.value === 'all') return true;

        return person.role_id === filterBy.value;
      })
      .sort(
        (a: GroupPerson, b: GroupPerson) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .sort((a: GroupPerson, b: GroupPerson) => a.role_id - b.role_id);
  }

  function getEmail(person) {
    const { profile, email } = person;

    return profile ? profile.email : email;
  }

  function obscureEmail(email) {
    const [username, domain] = email.split('@');
    const obscuredUsername =
      username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);

    return `${obscuredUsername}@${domain}`;
  }

  function gotoPerson(person) {
    goto(`${$page.url.href}/${person.profile_id}`);
  }

  async function loadWaitlist() {
    if (!$course.id || !$course.waitlist_enabled) return;
    const { data } = await getWaitlistMembers($course.id);
    waitlistMembers = data || [];
  }

  async function handleApprove(waitlistMember: typeof waitlistMembers[0]) {
    if (!$course.id || !$course.group_id) return;
    approvingId = waitlistMember.id;

    try {
      await approveFromWaitlist({
        courseId: $course.id,
        profileId: waitlistMember.profile_id,
        groupId: $course.group_id
      });

      triggerSendEmail(NOTIFICATION_NAME.WAITLIST_APPROVED, {
        to: waitlistMember.profile.email,
        courseName: $course.title,
        studentName: waitlistMember.profile.fullname,
        courseLink: `${window.location.origin}/lms`
      });

      waitlistMembers = waitlistMembers.filter((m) => m.id !== waitlistMember.id);
      snackbar.success('snackbar.course_settings.success.update_successful');
    } catch (error) {
      console.error('Error approving waitlist member', error);
      snackbar.error('snackbar.course_settings.error.went_wrong');
    }

    approvingId = null;
  }

  onMount(() => {
    loadWaitlist();
  });

  $: sortAndFilterPeople($group.people, filterBy);
</script>

<InvitationModal />

<DeleteConfirmation
  email={member.email || (member.profile && member.profile.email)}
  {deletePerson}
/>

<section class="mx-2 my-5 md:mx-9">
  <div
    class="flex-end mb-7 flex flex-col items-start justify-end gap-2 md:flex-row md:items-center"
  >
    <div class="max-w-[320px]">
      <Search
        class="w-full border-0 bg-zinc-100 dark:text-slate-950"
        placeholder={$t('course.navItem.people.search')}
        bind:value={searchValue}
      />
    </div>
    <div class="mb-3">
      <Select
        bind:value={filterBy}
        options={ROLES.map((role) => ({ label: $t(role.label), value: role.value }))}
        className="dark:text-black mt-3 max-w-[80px]"
      />
      <!-- <select bind:value={filterBy} class="mt-3">
        {#each ROLES as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select> -->
    </div>
    <RoleBasedSecurity allowedRoles={[1, 2]}>
      <p class="hidden w-20 text-lg lg:block dark:text-white" />
    </RoleBasedSecurity>
  </div>

  {#if $course.waitlist_enabled && waitlistMembers.length > 0}
    <RoleBasedSecurity allowedRoles={[1, 2]}>
      <div class="mb-8">
        <h3 class="mb-4 text-lg font-medium dark:text-white">
          {$t('course.navItem.settings.waitlist_section_header')} ({waitlistMembers.length})
        </h3>
        <StructuredList class="m-0">
          <StructuredListHead
            class="bg-slate-100 dark:border-2 dark:border-neutral-800 dark:bg-neutral-800"
          >
            <StructuredListRow head class="mx-7">
              <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
                >{$t('course.navItem.people.name')}</StructuredListCell
              >
              <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
                >Email</StructuredListCell
              >
              <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
                >Date Joined</StructuredListCell
              >
              <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
                >{$t('course.navItem.people.action')}</StructuredListCell
              >
            </StructuredListRow>
          </StructuredListHead>

          {#each waitlistMembers as waitlistMember}
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell class="w-3/12">
                  <p class="text-base font-normal dark:text-white">
                    {waitlistMember.profile.fullname}
                  </p>
                </StructuredListCell>
                <StructuredListCell class="w-3/12">
                  <p class="text-sm dark:text-white">
                    {waitlistMember.profile.email}
                  </p>
                </StructuredListCell>
                <StructuredListCell class="w-3/12">
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(waitlistMember.created_at).toLocaleDateString()}
                  </p>
                </StructuredListCell>
                <StructuredListCell class="w-3/12">
                  <PrimaryButton
                    variant={VARIANTS.CONTAINED_DARK}
                    label={$t('course.navItem.settings.waitlist_approve_button')}
                    onClick={() => handleApprove(waitlistMember)}
                    isLoading={approvingId === waitlistMember.id}
                    isDisabled={approvingId === waitlistMember.id}
                  />
                </StructuredListCell>
              </StructuredListRow>
            </StructuredListBody>
          {/each}
        </StructuredList>
      </div>
    </RoleBasedSecurity>
  {/if}

  <StructuredList class="m-0">
    <StructuredListHead
      class="bg-slate-100 dark:border-2 dark:border-neutral-800 dark:bg-neutral-800"
    >
      <StructuredListRow head class="mx-7">
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.name')}</StructuredListCell
        >
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.role')}</StructuredListCell
        >
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.action')}</StructuredListCell
        >
        <RoleBasedSecurity allowedRoles={[1, 2]}>
          <p class="hidden w-20 text-lg lg:block dark:text-white" />
        </RoleBasedSecurity>
      </StructuredListRow>
    </StructuredListHead>

    {#each filterPeople(searchValue, people) as person}
      <StructuredListBody>
        <StructuredListRow class="relative">
          <!-- first column -->
          <StructuredListCell class="w-4/6 md:w-3/6">
            {#if person.profile}
              <div class="flex items-start lg:items-center">
                <Avatar
                  src={person.profile.avatar_url}
                  name={person.profile.fullname}
                  width="w-8"
                  height="h-8"
                  className="mr-3"
                />
                <div class="flex flex-col items-start lg:flex-row lg:items-center">
                  <div class="mr-2">
                    <p class="text-base font-normal dark:text-white">
                      {person.profile.fullname}
                    </p>
                    <p class="text-primary-600 line-clamp-1 text-xs">
                      {obscureEmail(getEmail(person))}
                    </p>
                  </div>
                  <div class="flex items-center">
                    <RoleBasedSecurity allowedRoles={[1, 2]}>
                      <CopyButton text={getEmail(person)} feedback="Copied Email to clipboard" />
                    </RoleBasedSecurity>
                    {#if person.profile_id == $profile.id}
                      <ComingSoon label={$t('course.navItem.people.you')} />
                    {/if}
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex w-2/4 items-start lg:items-center">
                <TextChip
                  value={person.email.substring(0, 2).toUpperCase()}
                  className="bg-primary-200 text-black font-semibold text-xs mr-3"
                  shape="rounded-full"
                />
                <a
                  href="mailto:{person.email}"
                  class="text-md text-primary-600 mr-2 dark:text-white"
                >
                  {person.email}
                </a>
                <div class="flex items-center justify-between">
                  <RoleBasedSecurity allowedRoles={[1, 2]}>
                    <CopyButton
                      text={getEmail(person)}
                      feedback={$t('course.navItem.people.feedback')}
                    />
                  </RoleBasedSecurity>

                  <TextChip
                    value={$t('course.navItem.people.pending')}
                    className="text-xs bg-yellow-200 text-yellow-700 h-fit"
                    size="sm"
                  />
                </div>
              </div>
            {/if}
          </StructuredListCell>

          <!-- second column -->
          <StructuredListCell class="w-1/4">
            <p class=" w-1/4 text-center text-base font-normal dark:text-white">
              {$t(ROLE_LABEL[person.role_id])}
            </p>
          </StructuredListCell>

          <!-- third column -->
          <StructuredListCell class="w-1/4 p-0">
            <RoleBasedSecurity allowedRoles={[1, 2]}>
              <div class="hidden space-x-2 sm:flex sm:items-center">
                {#if person.profile_id !== $profile.id}
                  <IconButton
                    onClick={() => {
                      member = person;
                      $deleteMemberModal.open = true;
                    }}
                  >
                    <TrashCanIcon size={16} class="carbon-icon dark:text-white" />
                  </IconButton>
                  <!-- <IconButton
                    onClick={() => gotoPerson(person)}
                  >
                    <TrashCanIcon size={16} class="carbon-icon dark:text-white" />
                  </IconButton> -->

                  <PrimaryButton
                    variant={VARIANTS.OUTLINED}
                    label={$t('course.navItem.people.view')}
                    onClick={() => gotoPerson(person)}
                  />
                {/if}
              </div>
            </RoleBasedSecurity>
          </StructuredListCell>
        </StructuredListRow>
      </StructuredListBody>
    {/each}
  </StructuredList>
  <!-- <Pagination totalItems={10} pageSizes={[10, 15, 20]} /> -->
</section>
