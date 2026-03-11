---
name: sync
description: Sync changes from the main branch into the current branch. Use when user says "sync", "sync with main", "update branch", "pull from main", "rebase on main", or "merge main".
metadata:
  version: 1.0.0
  category: git
---

# Sync Current Branch with Main

## Instructions

### Step 1: Safety Check

Run `git branch --show-current` to get the current branch name.

**If the current branch is `main` or `master`, STOP immediately and tell the user:**
> "You're already on the main branch. Switch to a feature branch first."

Do NOT proceed with any further steps.

### Step 2: Check Working Tree

Run `git status` to check for uncommitted changes.

If there are uncommitted changes, **STOP and tell the user:**
> "You have uncommitted changes. Please commit or stash them before syncing."

### Step 3: Fetch Latest from Remote

```bash
git fetch origin main
```

### Step 4: Rebase onto Main

Rebase the current branch on top of the latest main:

```bash
git rebase origin/main
```

### Step 5: Handle Conflicts

If the rebase encounters conflicts:
1. Run `git diff --name-only --diff-filter=U` to list conflicted files
2. Show the conflicts to the user
3. Ask the user how they want to resolve them
4. After resolution, run `git add <resolved-files>` and `git rebase --continue`

If the user wants to abort, run `git rebase --abort`.

### Step 6: Verify

Run these commands to confirm success:
- `git status` to verify clean working tree
- `git log --oneline -5` to show the updated commit history

Report the result to the user.

## Important

- NEVER force-push after rebase without asking the user first
- NEVER sync if there are uncommitted changes
- NEVER run rebase on `main` or `master`
- If conflicts arise, always involve the user in resolution — do not auto-resolve
