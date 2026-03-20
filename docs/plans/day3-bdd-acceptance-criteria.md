# BDD Playwright Setup — Acceptance criteria

## Test setup
- MUST be able see all test videos and screenshots, even successful ones
- Test result folder must be in gitignore
- The initial test cases passing continuously
- Data reset before tests is fast (e.g. truncate tables + re-seed)
- Quick turnaround for test failurs (timeout may not be more than 10s)
- The playwright report URL is showing test runs

## Running the tests
- E2E tests can be run from one pnpm command.
- Tests MUST NOT start the services automatically.
- There is quick check for dependant services. If they are missing, fail fast.

## Devcontainer setup
- playwright and the browser plugin MUST be installed during docker build
- playwright ports forwarded properly, so both endpoints MUST be reachable from host machine (appPort and forwardPorts)
- ask user to help with devcontainer rebuild

## Test writing e2e tests
- when writing and debugging E2E tests, distill that knowledge into project skill "e2e-test-writing"

## Documentation
- CLAUDE.md includes information about the E2E tests flow.