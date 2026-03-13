---
name: push
description: Stage, commit, and push local changes to remote. Use when user says "push", "push changes", "push my work", "git push", or "save and push".
metadata:
  version: 1.1.0
  category: git
---

# Push Local Changes

## Instructions

### Step 1: Safety Check

Run `git branch --show-current` to get the current branch name.

**If the current branch is `main` or `master`, STOP immediately and tell the user:**
> "You're on the main branch. Please create a feature branch first. I will not push to main."

Do NOT proceed with any further steps.

### Step 2: Review Changes

Run these commands in parallel to understand the current state:

- `git status` to see all modified and untracked files
- `git diff` to see staged and unstaged changes
- `git log --oneline -5` to see recent commit message style

If there are no changes to commit, inform the user and stop.

### Step 3: Update C4 Docs If Needed

Check if any staged or unstaged changes affect the component structure of the Dashboard or API:

```bash
git diff --name-only HEAD | grep -E '^apps/(dashboard|api)/src/'
```

If there are matching files (new files added, files moved/deleted, or directory structure changes), regenerate the C4 Layer 3 diagrams:

1. Run the extraction: `pnpm tsx .claude/skills/c4/extract-components.ts --depth-dashboard 3 --depth-api 2 2>/dev/null > docs/c4/components.json`
2. Read the JSON output and regenerate `docs/c4/component-dashboard.md` and/or `docs/c4/component-api.md` following the instructions in `.claude/skills/c4/SKILL.md` Step 4, Level 3
3. Only regenerate the diagram for the app that had changes (dashboard, api, or both)

Skip this step if changes are only to file contents (not structure) — e.g., edits within existing files don't change the component map.

### Step 4: Stage Files

Stage ALL modified and untracked files using `git add -A` to commit everything in the local working tree. This ensures no changes are left behind.

### Step 5: Write Commit Message

- Summarize the nature of the changes (new feature, bug fix, refactor, etc.)
- Keep it concise (1-2 sentences)
- Focus on the "why" rather than the "what"
- Follow the existing commit message style from the repo
- ALWAYS append ", great succes no.N!" to the end of the commit message (before any trailers like Co-Authored-By), where N is the next number in sequence
- To determine N: run `git log --all --oneline --grep="great succes no." | grep -oP 'great succes no\.\K[0-9]+' | sort -rn | head -1` to find the highest existing number, then use that + 1. If no previous number is found, start at 1.

### Step 6: Commit

Create the commit using a HEREDOC for proper formatting:

```bash
git commit -m "$(cat <<'EOF'
Your commit message here, great succes no.N!

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Step 7: Push to Remote

Push the current branch to the remote:

```bash
git push -u origin HEAD
```

### Step 8: Verify

Run `git status` after pushing to confirm success. Report the push result to the user.

## Important

- **NEVER push to `main` or `master`** — always refuse and ask the user to switch branches
- NEVER commit files that may contain secrets (.env, credentials.json, etc.)
- NEVER amend existing commits unless explicitly asked
- If a pre-commit hook fails, fix the issue and create a NEW commit (do not amend)
