@wave1 @auth @no-reset
Feature: Auth boundary on dashboard /api/* routes

  hooks.server.ts validates JWT for any pathname matching String#includes('/api').
  PUBLIC_API_ROUTES (sourced at runtime from apps/dashboard/src/lib/auth/public-api-routes.ts)
  bypass the JWT check via the same .includes() match — so allowlist entries match anywhere
  in the path, which is a permissive surface worth pinning down with a test.

  Scenario: Protected /api/* without an Authorization header returns 401
    When I GET the dashboard path "/api/anything-protected" without auth
    Then the dashboard response status is 401

  Scenario: Every PUBLIC_API_ROUTES allowlist entry bypasses the JWT check
    When I GET each PUBLIC_API_ROUTES entry without auth
    Then none of the responses are 401

  Scenario: A non-API path containing a public-allowlist substring also bypasses
    # Documents the loose-substring behavior of the allowlist check.
    # `student_prove_payment` matches anywhere in the path, not just under /api/.
    When I GET the dashboard path "/foo/student_prove_payment/bar" without auth
    Then the dashboard response status is not 401

  Scenario: A non-API path containing the substring "/api" still triggers JWT validation
    # Design §2 Wave 1 explicitly asks for this negative scenario. The protection check is
    # `pathname.includes('/api')`, which matches any path with `/api` anywhere in it — even
    # paths that aren't routes under /api/. Without auth, these still get 401'd.
    When I GET the dashboard path "/foo/api-docs/bar" without auth
    Then the dashboard response status is 401
