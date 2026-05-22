import { test as setup } from '@playwright/test';
import path from 'node:path';
import { loginAs } from '../helpers/login';

const STUDENT_AUTH_FILE = path.resolve(__dirname, '..', '.auth', 'student.json');

setup('authenticate as student', async ({ page, context }) => {
  await loginAs(page, 'student@test.com');
  await context.storageState({ path: STUDENT_AUTH_FILE });
});
