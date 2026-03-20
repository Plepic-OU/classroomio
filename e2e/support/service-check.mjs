/**
 * Fail-fast check: verify required services are running before tests start.
 * Exits with code 1 if any service is unreachable.
 */

const services = [
  { name: 'Dashboard', url: 'http://localhost:5173' },
  { name: 'Supabase API', url: 'http://localhost:54321' },
  { name: 'Supabase DB', url: 'http://localhost:54322', tcp: true },
];

async function checkService({ name, url, tcp }) {
  try {
    if (tcp) {
      // For TCP-only services (like PostgreSQL), just check if the port accepts connections
      const { createConnection } = await import('net');
      const urlObj = new URL(url);
      return new Promise((resolve) => {
        const socket = createConnection(
          { host: urlObj.hostname, port: Number(urlObj.port), timeout: 3000 },
          () => {
            socket.destroy();
            resolve({ name, url, ok: true });
          }
        );
        socket.on('error', () => resolve({ name, url, ok: false }));
        socket.on('timeout', () => {
          socket.destroy();
          resolve({ name, url, ok: false });
        });
      });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { name, url, ok: res.ok || res.status < 500 };
  } catch {
    return { name, url, ok: false };
  }
}

const results = await Promise.all(services.map(checkService));
const allOk = results.every((r) => r.ok);

if (!allOk) {
  console.error('\nERROR: Required services are not running.\n');
  for (const r of results) {
    const status = r.ok ? 'OK' : 'NOT REACHABLE';
    console.error(`  - ${r.name} (${r.url}): ${status}`);
  }
  console.error('\nStart services first: pnpm dev:container\n');
  process.exit(1);
}

console.log('All required services are running.');
