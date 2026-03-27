<script lang="ts">
  import { onMount } from 'svelte';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import { currentOrg } from '$lib/utils/store/org';

  let entries: { email: string; created_at: string }[] = [];
  let isLoading = true;

  onMount(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('waitinglist')
      .select('email, created_at')
      .eq('org_id', $currentOrg.id)
      .order('created_at', { ascending: false });
    entries = data ?? [];
    isLoading = false;
  });
</script>

<svelte:head>
  <title>Waitinglist - ClassroomIO</title>
</svelte:head>

<section class="w-full md:max-w-4xl mx-auto">
  <div class="py-10 px-5">
    <h1 class="dark:text-white text-3xl font-bold mb-2">Waitinglist</h1>

    {#if isLoading}
      <p class="text-gray-500 dark:text-gray-400">Loading...</p>
    {:else}
      <p class="text-gray-500 dark:text-gray-400 mb-6">
        {entries.length} {entries.length === 1 ? 'person' : 'people'} signed up
      </p>

      {#if entries.length === 0}
        <p class="text-gray-400 dark:text-gray-500">No one on the waitinglist yet.</p>
      {:else}
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b dark:border-gray-700">
              <th class="py-2 pr-6 text-sm font-semibold text-gray-600 dark:text-gray-300">Email</th>
              <th class="py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {#each entries as entry}
              <tr class="border-b dark:border-gray-700">
                <td class="py-2 pr-6 text-sm dark:text-white">{entry.email}</td>
                <td class="py-2 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </div>
</section>
