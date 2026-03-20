import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../../support/world';

Given(
	'I am logged in as {string} with password {string}',
	async function (this: PlaywrightWorld, email: string, password: string) {
		await this.page.goto('/login');
		await this.page.locator('button[type="submit"]').waitFor({ state: 'attached' });
		await this.page.locator('input[type="email"]').fill(email);
		await this.page.locator('input[type="password"]').fill(password);
		await this.page.locator('button[type="submit"]').click();
		// After login, the app redirects to /lms, /org/**, or /onboarding depending on user state
		await this.page.waitForURL(/\/(lms|org|onboarding)/, { timeout: 10_000 });
	}
);

When(
	'I visit the invite link for course {string}',
	async function (this: PlaywrightWorld, courseName: string) {
		// Construct the invite hash the same way the app does (base64-encoded JSON)
		// Course data from seed.sql: "Getting started with MVC" in org "udemy-test"
		const courseMap: Record<string, { id: string; description: string; orgSiteName: string }> = {
			'Getting started with MVC': {
				id: '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e',
				description:
					'Embark on a comprehensive journey into the world of Model-View-Controller (MVC) architecture',
				orgSiteName: 'udemy-test',
			},
		};

		const course = courseMap[courseName];
		if (!course) throw new Error(`Unknown course: ${courseName}`);

		const hash = Buffer.from(
			JSON.stringify({
				id: course.id,
				name: courseName,
				description: course.description,
				orgSiteName: course.orgSiteName,
			})
		).toString('base64');

		await this.page.goto(`/invite/s/${encodeURIComponent(hash)}`);
		// Wait for the invite page to fully render (Join Course button appears)
		await this.page.getByRole('button', { name: /join course/i }).waitFor({ state: 'visible' });
	}
);

Then(
	'I should see the course name {string}',
	async function (this: PlaywrightWorld, courseName: string) {
		await expect(this.page.getByText(courseName).first()).toBeVisible();
	}
);

Then(
	'I should see a {string} button',
	async function (this: PlaywrightWorld, buttonName: string) {
		await expect(
			this.page.getByRole('button', { name: new RegExp(buttonName, 'i') }).first()
		).toBeVisible();
	}
);

When('I click the join course button', async function (this: PlaywrightWorld) {
	await this.page.getByRole('button', { name: /join course/i }).click();
});

Then('I should be redirected to the LMS', async function (this: PlaywrightWorld) {
	await this.page.waitForURL(/\/lms/, { timeout: 10_000 });
	expect(this.page.url()).toContain('/lms');
});
