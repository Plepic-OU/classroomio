# Verified Step Patterns

<!-- The skill appends entries here only after Phase 5 confirms a selector works in the running app. -->

## /signup

| Element | Verified selector |
|---------|------------------|
| Email input | `page.getByPlaceholder('you@domain.com')` |
| Password input (first) | `page.getByPlaceholder('************').first()` |
| Confirm password input | `page.getByPlaceholder('************').nth(1)` |
| Submit button | `page.getByRole('button', { name: /create account/i })` |
| Inline validation error | `page.locator('.text-red-500')` |

## /forgot

| Element | Verified selector |
|---------|------------------|
| Email input | `page.getByPlaceholder('you@domain.com')` |
| Reset Password button | `page.getByRole('button', { name: /reset password/i })` |
| Cancel button | `page.getByRole('button', { name: /cancel/i })` |
| Success heading | `page.locator('h3', { hasText: /email sent/i })` |
| Validation error | `page.locator('.text-red-500')` |
| **Note** | Submit with empty email to trigger Zod validation — "not-an-email" blocks at browser level |

## /reset

| Element | Verified selector |
|---------|------------------|
| Password input (first) | `page.getByPlaceholder('************').first()` |
| Confirm password input | `page.getByPlaceholder('************').nth(1)` |
| Reset Password button | `page.getByRole('button', { name: /reset password/i })` |
| Hydration signal | `page.locator('input[type="password"]').first().waitFor()` |

## /courses/[id]/lessons

| Element | Verified selector |
|---------|------------------|
| Content nav button | `page.getByRole('button', { name: 'Content' })` |
| Add button | `page.getByRole('button', { name: /^add$/i })` |
| Dialog input (single input in modal) | `page.locator('.dialog input')` |
| Dialog Save button | `page.locator('.dialog').getByRole('button', { name: /save/i })` |
| Section title (content area) | `page.getByText('Title').first()` — appears in sidebar nav AND content, use `.first()` |
| **Note** | New courses are always V2; "Add" creates a section, not a lesson — no URL redirect after save |

## /login

| Element | Verified selector |
|---------|------------------|
| Email input | `page.getByPlaceholder('you@domain.com')` |
| Password input | `page.getByPlaceholder('************')` |
| Log In button | `page.getByRole('button', { name: /log\s*in/i }).first()` |
| Error message | `page.locator('.text-red-500')` |
