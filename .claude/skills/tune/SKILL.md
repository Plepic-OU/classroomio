---
name: tune
description: Create or modify Claude Code skills and CLAUDE.md guides. Use when user says "tune", "create skill", "modify skill", "update claude.md", or wants to adjust project instructions.
metadata:
  version: 1.0.0
  category: meta
---

# Tune - Skill & Guide Manager

Create new skills, modify existing skills, or update CLAUDE.md project guides.

## Usage

`/tune <target> > <description>`

- `/tune commit > add co-author trailer` — modify the commit skill
- `/tune new-skill > description of what it does` — create a new skill
- `/tune claude.md > add testing conventions` — update CLAUDE.md

## Instructions

### Step 1: Parse the Request

Extract:
- **Target**: the skill name or `claude.md` (everything before `>`)
- **Description**: what to create or change (everything after `>`)

If no `>` is provided, treat the entire input as the description and ask the user what target to modify.

### Step 2: Locate the Target

- **Existing skill**: Read `.claude/skills/<target>/SKILL.md`
- **New skill**: Will create `.claude/skills/<target>/SKILL.md`
- **CLAUDE.md**: Read `/workspaces/classroomio/CLAUDE.md`

### Step 3: Make Changes

#### For new skills:

Create `.claude/skills/<skill-name>/SKILL.md` with this structure:

```markdown
---
name: <skill-name>
description: <When to trigger this skill. Include example phrases users might say.>
metadata:
  version: 1.0.0
  category: <appropriate category>
---

# <Skill Title>

## Instructions

### Step 1: ...

<Clear, actionable steps>

## Important

<Any guardrails or warnings>
```

#### For existing skills:

Read the current SKILL.md, apply the requested changes, and write back. Preserve the existing structure and frontmatter format.

#### For CLAUDE.md:

Read the current file, apply the requested changes, and write back. Keep it concise — CLAUDE.md should contain only essential project-wide instructions.

### Step 4: Verify

After writing changes:
- Read back the modified file to confirm it was written correctly
- Summarize what was changed

## Important

- ALWAYS read the target file before modifying it
- Keep skills focused — one skill per concern
- Skill descriptions must include trigger phrases so Claude knows when to invoke them
- CLAUDE.md should stay concise; move detailed instructions into skills instead
- Follow the frontmatter format exactly (name, description, metadata with version and category)
- Do NOT delete or overwrite unrelated content when editing existing files
