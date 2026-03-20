import http from 'node:http';

const SERVICES = [
  { name: 'Dashboard', url: 'http://localhost:5173' },
  { name: 'API', url: 'http://127.0.0.1:3002' },
  { name: 'Supabase', url: 'http://127.0.0.1:54321/rest/v1/' },
];

function httpGet(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

export async function healthCheck(): Promise<void> {
  const down: string[] = [];

  for (const svc of SERVICES) {
    try {
      const status = await httpGet(svc.url, 30_000);
      if (status < 200 || status >= 400) {
        down.push(`${svc.name} (${svc.url}) — HTTP ${status}`);
      }
    } catch {
      down.push(`${svc.name} (${svc.url}) — unreachable`);
    }
  }

  if (down.length > 0) {
    throw new Error(
      [
        'E2E health check failed. These services are down:',
        ...down.map((d) => `  - ${d}`),
        '',
        'Start them with: supabase start && pnpm dev:container',
      ].join('\n')
    );
  }
}
