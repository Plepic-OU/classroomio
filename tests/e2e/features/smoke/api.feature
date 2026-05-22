@smoke @wave0 @no-reset
Feature: Wave 0 — Hono API reachable

  The Hono API root must answer with the welcome JSON.
  Design §2 Wave 0: no /health route exists, do not invent one — use GET /.

  Scenario: GET / returns 200 with welcome JSON
    Then the Hono API root responds with 200 and a non-empty "message" field
