import { FullConfig, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// global-setup runs before Playwright's native .env loading kicks in — load manually
// Node 20.12+ has process.loadEnvFile() built-in
(process as any).loadEnvFile(path.resolve(__dirname, '.env'));

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;

  // --- Fast service health check ---
  // Fail immediately if the dashboard isn't reachable instead of waiting
  // for Playwright's default navigation timeout.
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(baseURL!, { timeout: 5_000 });
    if (!res.ok()) {
      throw new Error(`Dashboard returned HTTP ${res.status()}`);
    }
  } catch (e) {
    await ctx.dispose();
    throw new Error(
      `Dashboard not reachable at ${baseURL}. ` +
        `Start services first with: pnpm dev --filter=@cio/dashboard\n${e}`
    );
  }
  await ctx.dispose();

  // --- Authenticate via Supabase REST API and persist session ---
  // We bypass the browser UI to avoid SvelteKit's form interception.
  const authCtx = await request.newContext({ baseURL: supabaseUrl });
  const res = await authCtx.post('/auth/v1/token?grant_type=password', {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Content-Type': 'application/json',
    },
    data: {
      email: process.env.TEST_EMAIL!,
      password: process.env.TEST_PASSWORD!,
    },
  });

  if (!res.ok()) {
    await authCtx.dispose();
    throw new Error(`Supabase auth failed: ${res.status()} ${await res.text()}`);
  }

  const session = await res.json();
  await authCtx.dispose();

  // Build the storageState that Supabase JS client expects in localStorage.
  // The key format mirrors SupabaseClient: `sb-${hostname.split('.')[0]}-auth-token`
  // For http://localhost:54321, hostname is 'localhost', so key is 'sb-localhost-auth-token'.
  const supabaseHostname = new URL(supabaseUrl).hostname;
  const storageKey = `sb-${supabaseHostname.split('.')[0]}-auth-token`;
  const storageValue = JSON.stringify({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });

  const authDir = path.resolve(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL!,
        localStorage: [{ name: storageKey, value: storageValue }],
      },
    ],
  };

  fs.writeFileSync(path.join(authDir, 'state.json'), JSON.stringify(storageState, null, 2));
  console.log('✅ Auth session saved to .auth/state.json');
}
