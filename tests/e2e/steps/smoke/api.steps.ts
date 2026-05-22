import { expect } from '@playwright/test';
import { Then } from '../../fixtures/test';

const API_BASE = process.env.PUBLIC_SERVER_URL ?? 'http://localhost:3002';

Then(
  'the Hono API root responds with {int} and a non-empty {string} field',
  async ({ request }, expectedStatus: number, field: string) => {
    const res = await request.get(`${API_BASE}/`);
    expect(res.status()).toBe(expectedStatus);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty(field);
    const value = body[field];
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  }
);
