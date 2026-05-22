# Known Selectors

Verified selectors from existing step files. Excludes CSS class selectors and `.first()` calls.

---

## /login

- Email input: `getByPlaceholder('you@domain.com')` ✓ — placeholder text visible in source
- Password input: `getByPlaceholder('************')` ✓ — placeholder text visible in source
- Login button: `page.locator('button[type="submit"]')` ✓ — use `type="submit"` to avoid matching "Login with Google" button
- Error message: `page.locator('p.text-red-500')` ✓ — errors render as `<p class="text-red-500">`, NOT `role="alert"`

**Caveats:**
- SvelteKit SSR renders email input as `type="text"`; Svelte's `use:typeAction` changes it to `type="email"` after hydration. Wait for `input[type="email"]` before interacting.
- `waitForHydration` (from `helpers/hydration.ts`) handles this wait on the `/login` page.

**Caveats:**
- `waitForHydration` (from `helpers/hydration.ts`) only works on the `/login` page.
- For authenticated dashboard pages, use `page.waitForSelector('aside', { state: 'visible' })` instead.

---

## /org/[slug]/courses

- Create course button: `getByRole('button', { name: /create course/i })` ✓
- Course type "Next" button: `getByRole('button', { name: /next/i })` ✓
- Course name input: `getByPlaceholder(/course name/i)` ✓
- Course description input: `getByPlaceholder(/a little description/i)` ✓
- Finish/submit button: `getByRole('button', { name: /finish/i })` ✓

---

## /courses/[id]/lessons

- Add lesson button: `getByRole('button', { name: /^add$/i })` ✓ — label from translation `add_lesson.button_title = "Add"`
- Lesson title input: `getByLabel(/lesson title/i)` ✓ — works in V1 course modal
- Save lesson button: `getByRole('button', { name: /^save$/i })` ✓ — label from translation `add_lesson.save = "Save"`
- Course loaded signal (V1): `getByRole('button', { name: /enable sections/i })` ✓ — only visible once server data loads

**Caveats:**
- `defaultCourse.version = COURSE_VERSION.V2` in `Course/store.ts` — if "Add" is clicked before course data loads from server, the **Section modal** opens instead of the Lesson modal. Wait for "Enable Sections" button before clicking "Add".
- TextField component uses `<p>` for label text, NOT `<label>` element. Use `getByPlaceholder` if `getByLabel` fails.
- Lesson title appears in BOTH sidebar and page body after save — use `.first()` to avoid strict mode violation.
- Modal component uses `role="presentation"`, NOT `role="dialog"`.

---

## /courses/[id]/settings

- Course title input: `getByPlaceholder('Write the course title here')` ✓ — TextField hardcoded placeholder (label `<p>` is not a real `<label>`)
- Save button: `getByRole('button', { name: /save changes/i })` ✓ — translation `course.navItem.settings.save`
- Publish toggle: Carbon Design System component — `<input type="checkbox">` + `<label class="bx--toggle-input__label">` that intercepts clicks

**Carbon Toggle interaction:**
```typescript
const publishRow = page.getByText(/publish course/i).locator('xpath=ancestor::div[contains(@class,"bx--row")][1]');
await publishRow.locator('label.bx--toggle-input__label').click({ force: true });
```
Use `{ force: true }` because the label visually covers the hidden checkbox input.

---

## /courses/[id]/people

- Add people button: `getByRole('button', { name: /^add$/i })` ✓ — opens modal via URL `?add=true`
- Invitation modal heading: `getByText(/invite people/i)` ✓
- Copy link button: `getByRole('button', { name: /copy link/i })` — **TODO: verify**
- Copy confirmation: `getByText(/copied successfully/i)` — **TODO: verify**

---

## /org/[slug] sidebar (authenticated)

- Profile menu trigger: `getByRole('button', { name: /elon gates/i })` — **TODO: verify** — button visible text is user's fullname; value is data-dependent
- Log out button (inside profile menu): `getByRole('button', { name: /log out/i })` ✓ — translation `settings.profile.logout = "Log out"`

---

## /lms/explore

- Learn more button: `getByRole('button', { name: /learn more/i }).first()` ✓ — translation `courses.course_card.learn_more = "Learn more"`; use `.first()` for multiple courses; use `click({ timeout: 30_000 })` — page shows skeleton loaders while `get_explore_courses` RPC runs
- After click: `waitForURL(/\/course\//)` 

---

## /course/[slug] (course landing page)

- Enroll Now button: `getByRole('button', { name: /enroll now/i })` — **TODO: verify** — translation `course.navItem.landing_page.pricing_section.enroll = "Enroll Now"`
- After click: `waitForURL(/\/invite\/s\//)`

---

## /invite/s/[hash]

- Join Course button: `getByRole('button', { name: /join course/i })` ✓ — hardcoded label in source at `routes/invite/s/[hash]/+page.svelte:154`
