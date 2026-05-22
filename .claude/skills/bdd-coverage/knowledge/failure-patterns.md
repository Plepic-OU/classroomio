# Failure Patterns

Recurring failure modes observed across runs. Use to guide fix selection.

---

## strict-mode-violation — Multiple elements matched

**Signal:** `Error: strict mode violation: getByText("...") resolved to N elements`

**Fix pattern:** Append `.first()` when the text appears in multiple DOM locations (e.g., sidebar + main content).

**Examples seen:**
- Lesson title after save: appears in sidebar list AND in the main lesson editor pane.

---

## wrong-modal — Section modal opened instead of Lesson modal

**Signal:** Modal title says "Add New Section" instead of "Add New Lesson". Steps then fail because expected fields are absent.

**Root cause:** `defaultCourse.version = COURSE_VERSION.V2` in `Course/store.ts`. The "Add" button behaviour depends on the *loaded* course version. Before server data arrives, the store default triggers the wrong branch.

**Fix pattern:** Before clicking "Add" on the lessons page, wait for `getByRole('button', { name: /enable sections/i })`. This button is only rendered when a V1 course has loaded from the server, confirming the store is populated.

---

## carbon-toggle-click-intercepted

**Signal:** `Error: element is not visible` or click registers on the hidden `<input type="checkbox">` and fails.

**Root cause:** Carbon Design System Toggle renders a hidden checkbox + a `<label class="bx--toggle-input__label">` that visually covers it and intercepts all pointer events.

**Fix pattern:**
```typescript
await label.locator('label.bx--toggle-input__label').click({ force: true });
```
Scope the `label` to the row containing the toggle to avoid matching other toggles on the page.

---

## hydration-not-complete — Native form GET submitted before JS runs

**Signal:** URL becomes `/login?` (native GET form submission), or email input doesn't accept `.fill()`.

**Root cause:** SvelteKit SSR renders email input as `type="text"`; Svelte's `use:typeAction` changes it to `type="email"` post-hydration. If `.fill()` runs before hydration, the value is accepted but the form submits as GET.

**Fix pattern:** Wait for `page.locator('input[type="email"]').waitFor({ timeout: 15_000 })` before interacting with the login form. `waitForHydration()` in `helpers/hydration.ts` handles this on `/login`.

---

## timeout-in-full-suite — Passes alone, fails in suite

**Signal:** Test times out with 30s exceeded. The same test passes in ~45-60s when run alone.

**Root cause:** Cumulative overhead from preceding tests: each `resetTestData()` call takes ~2-5s; Supabase connections queue under load; browser context is warm but rendering after many page loads can be slower.

**Fix pattern:** Increase `timeout` in `playwright.config.ts` from `30_000` to `60_000`. Add `retries: 1` for flaky smoke tests. For known slow pages (e.g., LMS explore), use `click({ timeout: 30_000 })` per-action overrides.

---

## selector-missing — Login button ambiguity

**Signal:** `Error: strict mode violation: getByRole("button", {name: /log\s*in/i}) resolved to 2 elements`

**Root cause:** Both the "Log In" submit button and the "Login with Google" OAuth button match `/log\s*in/i`.

**Fix pattern:** Use `page.locator('button[type="submit"]')` to target only the submit button.
