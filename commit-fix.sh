#!/bin/bash

# Commit script for day 4, ws 2, step 2 fixes
# Usage: ./commit-fix.sh "additional message" (optional)

ISSUE_NR="17"
ISSUE_TITLE="Feature access logic per plan tier"
PREFIX="day 4, ws 2, step 2, fix issues: "

if [ -z "$1" ]; then
  MESSAGE="${PREFIX}#${ISSUE_NR} ${ISSUE_TITLE}"
else
  MESSAGE="${PREFIX}#${ISSUE_NR} ${ISSUE_TITLE} - $1"
fi

echo "Committing with message: $MESSAGE"
git add -A
git commit -m "$MESSAGE"
