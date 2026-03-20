async function globalSetup() {
  const checks = [
    {
      name: 'Supabase',
      url: 'http://localhost:54321/rest/v1/',
      hint: 'Run "supabase start" first.',
    },
    {
      name: 'Dashboard dev server',
      url: 'http://localhost:5173/',
      hint: 'Run "pnpm dev --filter=@cio/dashboard" first.',
    },
  ];

  for (const { name, url, hint } of checks) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${name} returned ${res.status}`);
    } catch (e) {
      throw new Error(`${name} is not reachable at ${url}. ${hint}\n${e}`);
    }
  }
}

export default globalSetup;
