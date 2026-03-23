import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../../support/world';
import { execSync } from 'child_process';

const DB_URL =
	process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

Given(
	'the course {string} has waiting list enabled with max capacity {int}',
	async function (this: PlaywrightWorld, courseName: string, maxCapacity: number) {
		// Update course metadata to enable waitlist via direct SQL
		const sql = `
      UPDATE public.course
      SET metadata = jsonb_set(
        jsonb_set(metadata, '{waitlistEnabled}', 'true'),
        '{maxCapacity}', '${maxCapacity}'
      )
      WHERE title = '${courseName.replace(/'/g, "''")}'
    `;
		execSync(`psql "${DB_URL}" -c "${sql}"`, { timeout: 10_000, stdio: 'pipe' });
	}
);

Then('I should see a waiting list confirmation message', async function (this: PlaywrightWorld) {
	await this.page
		.getByText(/waiting list/i)
		.first()
		.waitFor({ state: 'visible', timeout: 10_000 });
	const text = await this.page.getByText(/waiting list/i).first().textContent();
	expect(text).toBeTruthy();
});
