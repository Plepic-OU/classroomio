import * as net from 'net';

const SERVICES = [
  { name: 'Dashboard', port: 5173 },
  { name: 'API', port: 3002 },
  { name: 'Supabase', port: 54321 },
];

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket
      .on('connect', () => {
        socket.destroy();
        resolve(true);
      })
      .on('timeout', () => {
        socket.destroy();
        resolve(false);
      })
      .on('error', () => resolve(false))
      .connect(port, 'localhost');
  });
}

export default async function globalSetup() {
  const missing: string[] = [];

  for (const service of SERVICES) {
    const ok = await checkPort(service.port);
    if (!ok) {
      missing.push(`  - ${service.name} (port ${service.port})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `E2E tests require the following services to be running:\n${missing.join('\n')}\n\n` +
        'Start them before running tests:\n' +
        '  supabase start\n' +
        '  pnpm dev:container   (or pnpm dev --filter=@cio/dashboard & pnpm dev --filter=@cio/api)',
    );
  }
}
