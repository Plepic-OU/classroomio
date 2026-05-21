---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design

**Documentation:**
- Check if the project's CLAUDE.md defines a temporary files directory (look for patterns like `task_plans/`, `temp/`, or similar directories mentioned for development plans, scratchbooks, or task-related files)
- If a project-specific directory is defined, use that location for the design document
- Otherwise, use the default: `docs/plans/YYYY-MM-DD-<topic>-design.md`

**Validation:**
- Immediately after writing the design document, invoke the `validate-design-document` skill against the just-written file
- Use the Skill tool with `skill: "validate-design-document"` and `args: "<path-to-the-design-doc>"` (the same path the Documentation step just wrote to)
- The skill spawns project-specific expert subagents in parallel and returns Critical / Warning / Note findings before any implementation begins
- Apply the triage flow that skill returns — but constrain auto-apply tightly:
  - **Auto-apply is limited to factual corrections only** — wrong filename, wrong route shape, wrong type/function/table name, incorrect line reference, broken cross-reference, demonstrably-false claim about the codebase. The fix must have one obvious form and no validator may contradict it.
  - **Anything that involves design judgment is surfaced to the user, never silently applied** — even when a validator recommends it strongly. This includes: scope changes, dropping/adding features, architectural shifts, simplification suggestions, naming/style preferences, deferral decisions, choosing between competing valid approaches.
  - When in doubt, surface — do not auto-apply.
- Do not skip this step

~~**Implementation:**
- Ask user: "Ready to set up for implementation?"
- Act depending on the answer~~

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
