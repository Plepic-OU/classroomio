<script lang="ts">
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
  import TextField from '$lib/Input/TextField.svelte';
  import Button from '$lib/Button/Button.svelte';

  let email = '';
  let isLoading = false;
  let submitted = false;
  let errorMessage = '';

  const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  async function handleSubmit() {
    errorMessage = '';

    if (!email || !EMAIL_REGEX.test(email)) {
      errorMessage = 'Please enter a valid email.';
      return;
    }

    isLoading = true;
    try {
      const res = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/waitinglist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        submitted = true;
        return;
      }

      // Check for duplicate (Postgres unique violation code 23505)
      if (res.status === 409) {
        errorMessage = "You're already signed up!";
        return;
      }

      // Try to extract Postgres error code from body for other status codes
      try {
        const body = await res.json();
        if (body?.code === '23505') {
          errorMessage = "You're already signed up!";
          return;
        }
      } catch {
        // ignore parse error
      }

      errorMessage = 'Something went wrong, please try again.';
    } catch {
      errorMessage = 'Something went wrong, please try again.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center mt-6 w-full px-4">
  {#if submitted}
    <p class="text-green-600 font-medium text-base">You're on the list!</p>
  {:else}
    <div class="flex flex-col items-center gap-2 w-full md:w-[400px]">
      <TextField
        label="Join the waitinglist"
        placeholder="your@email.com"
        bind:value={email}
        inputClassName="w-full"
        className="w-full"
      />
      {#if errorMessage}
        <p class="text-sm text-red-500 w-full text-left">{errorMessage}</p>
      {/if}
      <Button
        label="Join Waitinglist"
        className="w-full px-6"
        onClick={handleSubmit}
        isDisabled={isLoading}
        {isLoading}
      />
    </div>
  {/if}
</div>
