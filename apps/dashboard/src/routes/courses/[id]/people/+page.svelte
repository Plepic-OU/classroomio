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
  import { FILTER_VALUE, ROLE_LABEL, ROLES } from '$lib/utils/constants/roles';
  import { formatDate } from '$lib/utils/functions/routes/dashboard';
  import { t } from '$lib/utils/functions/translations';
  import {
    approveWaitlistStudent,
    deleteGroupMember,
    fetchWaitlistEntries
  } from '$lib/utils/services/courses';
  import {
    triggerSendEmail,
    NOTIFICATION_NAME
  } from '$lib/utils/services/notification/notification';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import type { CourseWaitlistEntry, GroupPerson } from '$lib/utils/types';
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

  let people: Array<GroupPerson> = [];
  let member: { id?: string; email?: string; profile?: { email: string } } = {};
  let filterBy: ProfileRole = ROLES[0];
  let searchValue = '';
  let waitlistEntries: CourseWaitlistEntry[] = [];
  let isApprovingId: number | null = null;

  function filterPeople(_query, people) {
    const query = _query.toLowerCase();
    return people.filter((person) => {
      const { profile, email } = person;
      return profile?.fullname?.toLowerCase()?.includes(query) || email?.includes(query);
    });
  }

  async function deletePerson() {
    if (!member.id) return;

    // Capture teacher emails before mutating the store
    const teacherEmails = ($group.tutors || []).map((t) => t.email).filter(Boolean);

    $group.people = $group.people.filter((person: { id: string }) => person.id !== member.id);
    $group.tutors = $group.tutors.filter((person: GroupPerson) => person.memberId !== member.id);

    await deleteGroupMember(member.id);

    // Notify teachers if there are students waiting on the waitlist
    if ($course.id && $course.max_capacity) {
      // Reuse already-loaded waitlist data if available; otherwise fetch
      const waitlistCount =
        filterBy?.value === FILTER_VALUE.WAITLIST
          ? waitlistEntries.length
          : (await fetchWaitlistEntries($course.id)).data?.length ?? 0;

      if (waitlistCount > 0) {
        const peoplePageUrl = $page.url.href.split('?')[0];
        Promise.all(
          teacherEmails.map((email) =>
            triggerSendEmail(NOTIFICATION_NAME.TEACHER_SPOT_OPENED, {
              to: email,
              courseName: $course.title,
              waitlistCount,
              peoplePageUrl
            })
          )
        );
      }
    }
  }

  function sortAndFilterPeople(_people: Array<GroupPerson>, filterBy: ProfileRole) {
    people = (_people || [])
      .filter((person) => {
        if (filterBy.value === FILTER_VALUE.ALL) return true;

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

  $: sortAndFilterPeople($group.people, filterBy);

  async function loadWaitlist(courseId: string) {
    if (!courseId) return;
    const { data } = await fetchWaitlistEntries(courseId);
    waitlistEntries = data || [];
  }

  async function handleApprove(entry: CourseWaitlistEntry) {
    if (!$profile.id) return;
    isApprovingId = entry.id;
    const { error } = await approveWaitlistStudent(entry.id, $profile.id);
    if (!error) {
      waitlistEntries = waitlistEntries.filter((e) => e.id !== entry.id);

      // Notify the approved student
      if (entry.profile?.email) {
        const origin = $page.url.origin;
        triggerSendEmail(NOTIFICATION_NAME.STUDENT_WAITLIST_APPROVED, {
          to: entry.profile.email,
          orgName: $currentOrg.name,
          courseName: $course.title,
          lmsCourseUrl: `${origin}/lms`
        });
      }
    }
    isApprovingId = null;
  }

  let waitlistLoadedForCourseId: string | null = null;

  $: if (filterBy?.value === FILTER_VALUE.WAITLIST && $course.id && waitlistLoadedForCourseId !== $course.id) {
    waitlistLoadedForCourseId = $course.id;
    loadWaitlist($course.id);
  }
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

  {#if filterBy?.value === FILTER_VALUE.WAITLIST}
    <!-- Waitlist view -->
    {#if !$course.max_capacity}
      <p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {$t('course.navItem.people.waitlist.no_cap')}
      </p>
    {:else if waitlistEntries.length === 0}
      <p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {$t('course.navItem.people.waitlist.empty')}
      </p>
    {:else}
      <StructuredList class="m-0">
        <StructuredListHead
          class="bg-slate-100 dark:border-2 dark:border-neutral-800 dark:bg-neutral-800"
        >
          <StructuredListRow head class="mx-7">
            <StructuredListCell head class="text-primary-700 py-3 dark:text-white">
              {$t('course.navItem.people.waitlist.position')}
            </StructuredListCell>
            <StructuredListCell head class="text-primary-700 py-3 dark:text-white">
              {$t('course.navItem.people.name')}
            </StructuredListCell>
            <StructuredListCell head class="text-primary-700 py-3 dark:text-white">
              {$t('course.navItem.people.waitlist.joined')}
            </StructuredListCell>
            <StructuredListCell head class="text-primary-700 py-3 dark:text-white">
              {$t('course.navItem.people.action')}
            </StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>

        {#each waitlistEntries as entry}
          <StructuredListBody>
            <StructuredListRow class="relative">
              <StructuredListCell class="w-1/6">
                <p class="text-base font-normal dark:text-white">#{entry.position}</p>
              </StructuredListCell>
              <StructuredListCell class="w-3/6">
                {#if entry.profile}
                  <div class="flex items-center">
                    <Avatar
                      src={entry.profile.avatar_url}
                      name={entry.profile.fullname}
                      width="w-8"
                      height="h-8"
                      className="mr-3"
                    />
                    <p class="text-base font-normal dark:text-white">{entry.profile.fullname}</p>
                  </div>
                {:else}
                  <p class="text-base font-normal dark:text-white">{entry.profile_id}</p>
                {/if}
              </StructuredListCell>
              <StructuredListCell class="w-1/6">
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  {formatDate(entry.created_at)}
                </p>
              </StructuredListCell>
              <StructuredListCell class="w-1/6 p-0">
                <PrimaryButton
                  label={$t('course.navItem.people.waitlist.approve')}
                  isLoading={isApprovingId === entry.id}
                  isDisabled={isApprovingId !== null}
                  onClick={() => handleApprove(entry)}
                />
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        {/each}
      </StructuredList>
    {/if}
  {:else}
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
  {/if}
  <!-- <Pagination totalItems={10} pageSizes={[10, 15, 20]} /> -->
</section>
