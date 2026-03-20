---
name: e2e-test-writing
description: Write a new BDD/Playwright E2E test for ClassroomIO. Use when the user asks to create, add, or write an E2E test, end-to-end test, or integration test.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent
---

# E2E Test Writer

Write a new BDD/Playwright E2E test for ClassroomIO.

## Steps

1. **Read the test writing guide** for conventions, patterns, and accumulated learnings:
   - Read `${CLAUDE_SKILL_DIR}/guide.md`

2. **Understand the flow to test**:
   - If the user specified a flow, explore the relevant routes, components, and data in the codebase
   - If no flow specified, choose the most valuable untested flow based on existing coverage in `e2e/features/`

3. **Check existing tests** to avoid duplicates and reuse step definitions:
   - Read all files in `e2e/features/` to see what's already covered
   - Read all files in `e2e/steps/` to find reusable step definitions

4. **Write the test**:
   - Create a `.feature` file in `e2e/features/` (mirror app route structure)
   - Create or update step definitions in `e2e/steps/` (mirror feature structure)
   - Reuse existing steps where possible (Cucumber matches by pattern globally)
   - Follow the selector priority: role > text > data-testid > CSS
   - Keep scenarios independent (DB is reset before each)

5. **Run the test** to verify it works:
   ```bash
   pnpm test:e2e
   ```
   - If the test fails, debug using screenshots in `e2e/test-results/screenshots/`
   - Fix and re-run until it passes

6. **Capture learnings** — After the test passes (or after debugging failures), update the guide:
   - Open `${CLAUDE_SKILL_DIR}/guide.md`
   - Add any new learnings to the `## Learnings` section at the bottom
   - Learnings should be specific, actionable tips that help write future tests
   - Examples: selector patterns that work/don't work, timing issues, data dependencies, component quirks
   - Do NOT add learnings that duplicate existing ones
   - If no new learnings were discovered, say so in your response but don't modify the file
