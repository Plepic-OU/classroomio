# Day 3, workshop 1 — Implement the BDD design doc

## Goal

Take the design doc you produced in day 2 workshop 2 — BDD coverage strategy on top of the Playwright + Gherkin scaffold, plus the self-improving skill that grows that coverage — and turn it into working code. You'll implement it chunk by chunk, using a role-specialised **implementation-validator** subagent to verify each chunk against the doc, and finishing with `/code-review` as a final bug-finding pass.

The point isn't the BDD framework. The point is the *discipline*: chunked implement → validate → final review. Once you've felt it work on real work, you can apply it to anything.

## What you'll learn

- How a role-specialised subagent (`implementation-validator`) differs from the general-purpose model-comparison agents from day 2 workshop 3.
- Where front-loaded design (day 2) pays off downstream: the validator can only check what the design doc actually pinned down.

## Steps

1. **Confirm prereqs.**
   - Design doc from day 2 workshop 2 is committed somewhere readable in the repo (e.g. `<design...md>` at the docs/plans).
   - Day 2 work is committed cleanly. This is your rollback point if today goes sideways.
   - The BDD scaffold's existing example scenarios still run green: `pnpm test:e2e`.

2. **Install the implementation-validator subagent.** Two paths:

   2a. *Prebuilt.* Download the agent file and save it as `.claude/agents/implementation-validator.md`:
   https://drive.google.com/file/d/1dTmevoXtmzPFV0RKZ9Aflqgozwj51kCE

   2b. *Roll your own.* Ask Claude Code (or `/agents`) to author a project subagent whose job is to verify that an implementation matches a written plan — flagging deviations, missing requirements, and unjustified extras. The agent's `name:` **must** be `implementation-validator` exactly; the prompt in step 3 references it by name.

   After dropping the file in, **restart Claude Code** so it picks up the new agent. Confirm with `/agents` — it should appear in the list.

3. **Implement chunk by chunk, validating each.** Paste:

   > Implement the plan in `<design...md>` (the design doc from day 2). Split the task into smaller chunks and handle one by one. After each chunk, use the `implementation-validator` agent to verify that part against the design doc. Only move to the next chunk when validation passes.
   >
   > When iterating on e2e tests, keep the timeout small (10s is enough) and debug one test at a time so the loop stays fast.

4. **Run `/code-review` on the uncommitted changes** once implementation is done and `pnpm test:e2e` is green:

   > /code-review

   Let Claude fix the issues it surfaces. `/code-review` is a built-in claude code skill.

5. **Re-verify and commit.**
   - `pnpm test:e2e` — still green after the review-driven fixes.
   - Re-run the implementation-validator one more time across the full change to make sure the post-review edits didn't drift the implementation away from the design.
   - Commit. Note in the commit message what the validator caught and what `/code-review` caught — useful for the retrospective.

## Optional / advanced

- **Cross-tool comparison.** Compare the built-in `/code-review` with the custom `code-review` skill on the same diff. Redundant or complementary?
- **Stack the validators.** Add a second specialised subagent (e.g. `test-coverage-reviewer`) and chain it after `implementation-validator`. Does the second layer find new things, or restate?
