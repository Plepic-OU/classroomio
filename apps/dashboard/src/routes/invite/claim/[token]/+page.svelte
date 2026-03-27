<script lang="ts">
  import { goto } from '$app/navigation';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { t } from '$lib/utils/functions/translations';

  export let data;

  $: status = data.status; // 'expired' | 'not_found' | 'error'
</script>

<svelte:head>
  <title>Claim your spot — ClassroomIO</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center p-6">
  <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
    {#if status === 'expired' || status === 'not_found'}
      <h2 class="mb-3 text-xl font-semibold dark:text-white" data-testid="claim-expired-title">
        {$t('waitlist.claim.expired_title')}
      </h2>
      <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {$t('waitlist.claim.expired_body')}
      </p>
      <PrimaryButton
        label={$t('waitlist.join_button')}
        onClick={() => goto('/lms')}
      />
    {:else}
      <!-- Generic error fallback (should rarely be seen — enrolled redirects immediately) -->
      <h2 class="mb-3 text-xl font-semibold dark:text-white">
        {$t('waitlist.claim.error_title')}
      </h2>
      <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {$t('waitlist.claim.error_body')}
      </p>
    {/if}
  </div>
</div>
