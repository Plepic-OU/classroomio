# Day 2, workshop 2 — create SRD for BDD test coverage

## Goal

Design a system that gives ClassroomIO BDD-style end-to-end test coverage **and** a self-improving skill that produces,
runs, and extends that coverage on its own. You'll start from a BDD scaffold we've provided, use the **brainstorming**
skill to produce a design document for the goal, then validate the design with a team of specialised agents running in
parallel.

## What you'll learn

- Why the bottleneck in agentic development is *validating* code, not producing it — and how a good design doc shifts
  effort upstream, where it's cheaper.
- The role of the brainstorming skill: it interviews **you**. You hold the domain knowledge; the skill structures it
  into a precise spec.
- BDD and Gherkin (`Given / When / Then`) as a bridge between requirements and test cases.
- What a **self-improving skill** is: one that observes its own output (failing scenarios, missing assertions, flaky
  steps) and updates its own instructions and helpers.
- The fresh-context principle: a separate agent with no exposure to the writing process catches what the author missed.
  Multiple specialised agents in parallel catch more.
- How to wire up an MCP server (Context7) so Claude can look up current library docs (Playwright, Gherkin, etc.) while
  it works.

## Steps

0. **Wire up Context7** so Claude can fetch current library docs on demand. We're doing this via the **Context7 MCP
   server**. The CLI route exists too, but its auth flow expects to bind a `localhost` callback, which doesn't play
   nicely inside a devcontainer — MCP is the recommended path for this setup and is listed as a supported client in
   the [Context7 docs](https://context7.com/docs/resources/all-clients).

   0a. **Register the MCP server with Claude Code.** From inside the devcontainer:

   ```
   claude mcp add --transport http --scope project context7 https://mcp.context7.com/mcp
   ```

   0b. **Restart Claude** and verify the server is connected:

   ```
   claude mcp list
   ```

   You should see `context7` in the output with a connected status. If it's not connected, ask Claude to inspect
   `.mcp.json` and the server logs.

1. **Commit your progress so far.** This is your rollback point if anything goes sideways.

2. **Look at the BDD scaffold we've provided.** Playwright + Gherkin are already wired up in the repo with a couple of
   trivial example scenarios so you know the runner works. Try it out and make sure you can access test result from host
   machine. Ask Claude for help if it's unfamiliar territory for you.

3. **Install the brainstorming skill.** Download, unpack, and place it in the project's skills
   directory: https://drive.google.com/file/d/1rO3eqvZiJO3bqIze9m8lqAQK4-VpbKZx

   *Restart Claude after adding the skill — skills are loaded at session start.*

4. **Run `/brainstorming`** with this scope:

   ```
   Create a design document for two things together:
   1. **BDD test coverage** for ClassroomIO on top of the provided Playwright + Gherkin scaffold — which user-facing flows to cover, in what order, and how to keep scenarios independent and deterministic.
   2. A **self-improving skill** that produces, runs, and extends this BDD coverage — it should be able to read the current scenario set, identify gaps against the app's behaviour, write new `.feature` files and step definitions, run them, and update its own instructions based on what it learns from failures.
   The skill should include technical details and pointers for working with this project specific technical libraries. Use context7 for up to date examples.
   ```

   Answer the skill's questions thoughtfully — vague answers in produce a vague design doc out.

5. **Validate with a team of specialised agents.** Instead of running one validator, run several in parallel, each with
   a different lens.

  - Install `/validate-design-document` for the design-doc
    lens: https://drive.google.com/file/d/14xGf770kwVsbWerLVLpaOSbUjCxLWr5z
  - Make a copy of the design doc first (`cp design.md design.before.md`) so you can diff later.
  - Run the agents against the same doc, in parallel. Read each agent's feedback and decide what to merge — they will
    disagree; that's the point.

6. **Close the loop.** Update the brainstorming skill so that whenever it writes a design document, it automatically
   invokes the validation skill on the produced document.

## Optional / advanced

- **Publish the skills as a marketplace.** Push the brainstorming + validate-design-document skills (plus your
  self-improving BDD skill, once it exists) to a separate GitHub repo formatted as a Claude marketplace, and share with
  other students.
- **Visualise the flow** of skills and agents — produce a diagram showing which skill calls which, and where context
  flows.
- **Build a scoring skill** for design docs. Avoid generic 1–5 / 0%–100% scores — those are too coarse to be useful.
  Instead, list **true/false attributes** the doc should satisfy and let AI assess each individually. Try both
  approaches and compare. Then run the same plan through Opus, Sonnet, and Haiku and see how the scores diverge.

## When you get stuck

- If you cannot see test results from host machine. Debug with claude from host machine. Maybe you did not rebuild the
  devcontainer. Maybe the playwright dashboard is not running.
- If you forgot to restart Claude after installing a skill, `/brainstorming` will look like it doesn't exist. `/skills`
  show what's actually loaded.

