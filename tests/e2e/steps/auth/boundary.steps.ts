import { expect } from '@playwright/test';
import { When, Then } from '../../fixtures/test';
// Source the canonical allowlist at runtime per design §2 Wave 1 — never duplicate it here.
import { PUBLIC_API_ROUTES } from '../../../../apps/dashboard/src/lib/auth/public-api-routes';

const DASHBOARD_BASE = 'http://localhost:5173';

type Captured = { status: number; path: string };
let lastResponse: Captured | undefined;
let allResponses: Captured[] = [];

When('I GET the dashboard path {string} without auth', async ({ request }, pathname: string) => {
  // Playwright's `request` fixture inherits the test's storageState. For these scenarios
  // there is no @persona-* tag, so storageState is `undefined` and no cookies are sent.
  const res = await request.get(`${DASHBOARD_BASE}${pathname}`);
  lastResponse = { status: res.status(), path: pathname };
});

When('I GET each PUBLIC_API_ROUTES entry without auth', async ({ request }) => {
  allResponses = [];
  for (const entry of PUBLIC_API_ROUTES) {
    // Some allowlist entries (e.g. student_prove_payment) have no leading slash; treat them
    // as substrings of an actual probe path so we still hit the dashboard.
    const probe = entry.startsWith('/') ? entry : `/api/${entry}`;
    const res = await request.get(`${DASHBOARD_BASE}${probe}`);
    allResponses.push({ status: res.status(), path: probe });
  }
});

Then('the dashboard response status is {int}', ({}, expected: number) => {
  if (!lastResponse) throw new Error('no captured response');
  expect(lastResponse.status).toBe(expected);
});

Then('the dashboard response status is not {int}', ({}, forbidden: number) => {
  if (!lastResponse) throw new Error('no captured response');
  expect(lastResponse.status, `path=${lastResponse.path}`).not.toBe(forbidden);
});

Then('none of the responses are {int}', ({}, forbidden: number) => {
  for (const r of allResponses) {
    expect(r.status, `path=${r.path}`).not.toBe(forbidden);
  }
});
