/**
 * Public allowlist consulted by `src/hooks.server.ts` to bypass JWT validation on /api/* routes.
 *
 * Extracted into its own module so the e2e auth-boundary scenarios can source the canonical
 * list at runtime (see tests/e2e/features/auth/boundary.feature) rather than duplicating it.
 *
 * Matching is performed via String#includes in hooks.server.ts — entries are substrings, not
 * exact paths. Two entries (`student_prove_payment`, `teacher_student_buycourse`) intentionally
 * have no leading slash so they match anywhere in the pathname.
 */
export const PUBLIC_API_ROUTES = [
  '/api/completion',
  'student_prove_payment',
  'teacher_student_buycourse',
  '/api/polar',
  '/api/lmz',
  '/api/verify'
];
