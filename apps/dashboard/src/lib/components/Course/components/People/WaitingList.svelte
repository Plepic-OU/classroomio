<script lang="ts">
	import { onMount } from 'svelte';
	import Avatar from '$lib/components/Avatar/index.svelte';
	import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
	import { VARIANTS } from '$lib/components/PrimaryButton/constants';
	import { snackbar } from '$lib/components/Snackbar/store';
	import { course, group } from '$lib/components/Course/store';
	import { getSupabase } from '$lib/utils/functions/supabase';
	import { addGroupMember } from '$lib/utils/services/courses';
	import { ROLE } from '$lib/utils/constants/roles';
	import {
		triggerSendEmail,
		NOTIFICATION_NAME
	} from '$lib/utils/services/notification/notification';
	import { currentOrg } from '$lib/utils/store/org';
	import type { CourseWaitlistEntry } from '$lib/utils/types';

	let supabase = getSupabase();
	let entries: CourseWaitlistEntry[] = [];
	let loading = true;

	async function fetchWaitlist() {
		if (!$course.id) return;
		loading = true;

		const { data, error } = await supabase
			.from('course_waitlist')
			.select('*, profile(id, fullname, email, avatar_url)')
			.eq('course_id', $course.id)
			.eq('status', 'pending')
			.order('created_at', { ascending: true });

		if (error) {
			console.error('Error fetching waitlist', error);
		} else {
			entries = data || [];
		}
		loading = false;
	}

	async function approveStudent(entry: CourseWaitlistEntry) {
		if (!$group.id) return;

		// Add to group as student
		const result = await addGroupMember({
			profile_id: entry.profile_id,
			group_id: $group.id,
			role_id: ROLE.STUDENT
		});

		if (result.error) {
			console.error('Error approving student', result.error);
			snackbar.error('Failed to approve student');
			return;
		}

		// Update waitlist status
		await supabase
			.from('course_waitlist')
			.update({ status: 'approved', updated_at: new Date().toISOString() })
			.eq('id', entry.id);

		// Send approval email
		if (entry.profile?.email && NOTIFICATION_NAME.WAITLIST_STUDENT_APPROVED) {
			triggerSendEmail(NOTIFICATION_NAME.WAITLIST_STUDENT_APPROVED, {
				to: entry.profile.email,
				courseName: $course.title,
				orgName: $currentOrg.name
			});
		}

		snackbar.success('Student approved and enrolled');

		// Remove from local list
		entries = entries.filter((e) => e.id !== entry.id);
	}

	async function rejectStudent(entry: CourseWaitlistEntry) {
		await supabase
			.from('course_waitlist')
			.update({ status: 'rejected', updated_at: new Date().toISOString() })
			.eq('id', entry.id);

		entries = entries.filter((e) => e.id !== entry.id);
		snackbar.success('Student removed from waiting list');
	}

	onMount(fetchWaitlist);
	$: $course.id && fetchWaitlist();
</script>

{#if loading}
	<p class="py-4 text-center text-sm text-gray-500">Loading waiting list...</p>
{:else if entries.length === 0}
	<p class="py-4 text-center text-sm text-gray-500">No students on the waiting list.</p>
{:else}
	<div class="flex flex-col gap-2">
		{#each entries as entry}
			<div
				class="flex items-center justify-between rounded-md border p-3 dark:border-neutral-700"
			>
				<div class="flex items-center gap-3">
					<Avatar
						src={entry.profile?.avatar_url}
						name={entry.profile?.fullname || ''}
						width="w-8"
						height="h-8"
					/>
					<div>
						<p class="text-sm font-medium dark:text-white">
							{entry.profile?.fullname || 'Unknown'}
						</p>
						<p class="text-xs text-gray-500">{entry.profile?.email || ''}</p>
					</div>
				</div>
				<div class="flex gap-2">
					<PrimaryButton
						label="Approve"
						variant={VARIANTS.CONTAINED}
						onClick={() => approveStudent(entry)}
					/>
					<PrimaryButton
						label="Reject"
						variant={VARIANTS.CONTAINED_DANGER}
						onClick={() => rejectStudent(entry)}
					/>
				</div>
			</div>
		{/each}
	</div>
{/if}
