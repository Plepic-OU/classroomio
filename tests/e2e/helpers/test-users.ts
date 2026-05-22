export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: '123456',
    fullname: 'Elon Gates',
    orgSlug: 'udemy-test',
    orgName: 'Udemy Test',
  },
  student: { email: 'student@test.com', password: '123456', fullname: 'John Doe' },
} as const;

export function userByEmail(email: string) {
  const user = Object.values(TEST_USERS).find((u) => u.email === email);
  if (!user) throw new Error(`Unknown test user: ${email}`);
  return user;
}
