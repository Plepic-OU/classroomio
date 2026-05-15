# Day 2, workshop 3 — compare models for validation

## Goal

Run the same SRD through three general-purpose validation subagents — one on **Haiku**, one on **Sonnet**, one on **Opus
** — and compare what each finds, how long each takes, and what each costs.

## What you'll learn

- The practical trade-off between Haiku (fast, cheap, shallow) and Opus (slow, expensive, thorough) — and where Sonnet
  sits in between.

## Steps

0. **Commit your progress** from workshop 2. You want a clean rollback point before spawning agents that touch the repo.

1. **Run validation with each subagent** against the SRD you produced in workshop 2. Use the same prompt for all three —
   the only variable should be the model.
  - one with `model: haiku`
  - one with `model: sonnet`
  - one with `model: opus`

2. **Compare across three dimensions:**
  - **Findings** — how many issues did each model surface? Were they real issues or false positives? Did any model find
    something the others missed?
  - **Speed** — how long did each validation take? Haiku should be the fastest, Opus the slowest.
  - **Cost** — check token usage in the session. Bigger models cost more per token *and* tend to generate more output.

   Write the answers down. This is the comparison you'll reach for next time you're picking a model for a validator.

## Optional / advanced

- **Thinking effort isn't a frontmatter field on Opus.** Find another way to drive validation at a specific thinking
  effort and re-run the comparison across thinking-effort levels.
- **Cross-vendor validation.** Run the same SRD through a non-Claude model (e.g. OpenAI Codex CLI) and compare its
  validation against Claude's.

## When you get stuck

If you don't know how to create agents and compare the results. All of this is meant to be done with claude, you just
need to write your intent.