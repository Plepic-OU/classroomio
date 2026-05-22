import { Before } from './fixtures';
import { loginAs } from './helpers/login';
import { TEST_USERS } from './helpers/test-users';

Before({ tags: '@login-as-admin' }, async ({ page }) => {
  await loginAs(page, TEST_USERS.admin.email);
});

Before({ tags: '@login-as-student' }, async ({ page }) => {
  await loginAs(page, TEST_USERS.student.email);
});
