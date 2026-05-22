# ClassroomIO — SvelteKit + Carbon Components Patterns

Confirmed selector patterns and component quirks for the ClassroomIO dashboard (`apps/dashboard`).
Update this file whenever a test-bug fix reveals a new generalizable pattern (see SKILL.md §Self-improvement).

---

## TextField inputs (`Form/TextField.svelte`)

`Form/TextField.svelte` renders its label as `<p for="text-field">` — a paragraph tag, not `<label>`.
Browsers and Playwright's ARIA tree only associate `<label for="...">` with inputs, so `getByLabel('...')` returns zero elements for every TextField in this app.

```typescript
// Wrong — returns zero elements
await page.getByLabel('Course name').fill('My Course');

// Correct
await page.getByPlaceholder(/course name/i).fill('My Course');

// Alternative — add data-testid to the input in the component
await page.getByTestId('course-name-input').fill('My Course');
```

This affects every text field rendered through `Form/TextField.svelte` (email, password, course name, course description, etc.).

### Known TextField placeholders

| Field | Placeholder |
|---|---|
| Email | `you@domain.com` |
| Password | `************` |
| Course name | (match with `/course name/i`) |
| Course description | `a little description` |

---

## Hydration on the login page

SSR renders inputs as `type="text"`. After SvelteKit hydrates, `use:typeAction` in `TextField.svelte` converts them to the correct type (e.g., `type="email"`). This is the reliable hydration signal on the login page:

```typescript
await page.locator('input[type="email"]').waitFor();
```

**Only valid** after `page.goto('/login')`. Do not use for client-side navigations.

---

## Login error message

The login error element has `role="alert"` and `data-testid="login-error"`:

```typescript
await page.locator('[data-testid="login-error"]').waitFor();
// or
await expect(page.getByRole('alert')).toBeVisible();
```

Source: `apps/dashboard/src/routes/login/+page.svelte`

---

## Auth tags and storageState

Every scenario must carry exactly one tag from `helpers/fixtures.ts`:

| Tag | Storage state | Redirects to |
|---|---|---|
| `@no-auth` | empty (no cookies) | login page |
| `@auth-admin` | `.auth/admin.json` | `/org/...` |
| `@auth-student` | `.auth/student.json` | `/lms/...` |
| `@auth-teacher` | `.auth/teacher.json` (Phase 3+) | `/lms/...` |

---

## Navigation after login

After `auth-setup` saves storage state, the page context starts already authenticated. Use these readiness signals:

```typescript
// Org admin — wait for sidebar or org URL
await page.waitForURL(/\/org\//);

// Student — wait for MyLearning page
await page.waitForURL(/\/lms/);
```

For client-side navigations (clicking links), wait for the first meaningful element, not URL:
```typescript
await page.getByRole('link', { name: /courses/i }).click();
await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
```
