# Skill: e2e-test-writing

Knowledge distilled from writing and debugging E2E tests for ClassroomIO.

## App-specific selectors

- Login email field: `page.getByLabel('Email')`
- Login password field: `page.getByLabel('Password')`
- Login button: `page.getByRole('button', { name: /log in|sign in/i })`
- Post-login URL pattern: `/org/` (dynamic slug, don't match exact URL)
- Courses nav link: `page.getByRole('link', { name: /courses/i })`
- Create Course button: `page.getByRole('button', { name: 'Create Course' })`
- Course type selection: `page.getByText(courseType)`
- Course name input: `page.getByLabel(/course name/i)`
- Submit/final button in multi-step forms: `.last()` to get the last matching button

## Patterns that work

- Always `await expect(page).toHaveURL(...)` after navigation — confirms page load before next action
- Use regex for button labels (`/log in|sign in/i`) to handle i18n variations
- For multi-step modals, use `.last()` on submit buttons — earlier steps also have "Next"-like buttons
- `process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com'` — always fall back to seed defaults

## Common pitfalls

- Do NOT use `webServer` in playwright.config.ts — tests must fail fast if services are down
- Do NOT hardcode credentials in feature files — always use env vars in step definitions
- Timeout is 10s — keep steps atomic, avoid multi-second waits
- `locale: 'en'` is set globally — English button labels are safe to use

## Debugging tips

- Run one test at a time: `playwright test --grep "Scenario name"`
- Videos + screenshots + traces are always on — check `test-results/` after a failure
- View trace: `npx playwright show-trace test-results/.../trace.zip`
