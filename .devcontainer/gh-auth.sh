#!/usr/bin/env bash
# Authenticate the GitHub CLI inside the devcontainer.
#
# Wired to postStartCommand (not postCreateCommand) so it runs on EVERY container
# start — gh's credentials live in the container filesystem, which is recreated on
# rebuild, so re-authenticating on each start is what makes auth survive restarts.
#
# Always exits 0: a missing or bad token must never stop the container from starting.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  cat <<'MSG'
⚠️  GitHub CLI not authenticated — .devcontainer/github-token is missing.

   1. Accept the collaborator invite for Plepic-OU/classroomio (check your email).
   2. Create a fine-grained PAT: https://github.com/settings/personal-access-tokens/new
        Repository access ....... Only select repositories -> Plepic-OU/classroomio
        Repository permissions .. Read and write on: Contents, Issues, Pull requests,
                                  Deployments, Discussions, Pages, Workflows
   3. Save it as .devcontainer/github-token   (gitignored — never commit it)
   4. Re-run:  bash .devcontainer/gh-auth.sh
MSG
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️  gh CLI not found in this container."
  echo "   The github-cli devcontainer feature only installs on a rebuild:"
  echo "   devcontainer up --workspace-folder . --remove-existing-container"
  exit 0
fi

chmod 600 "$TOKEN_FILE" 2>/dev/null || true
token="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"

if [ -z "$token" ]; then
  echo "⚠️  .devcontainer/github-token is empty — skipping gh authentication."
  exit 0
fi

if printf '%s' "$token" | gh auth login --with-token >/dev/null 2>&1; then
  gh auth setup-git >/dev/null 2>&1 || true
  who="$(gh api user --jq .login 2>/dev/null || echo 'unknown user')"
  echo "✅ gh authenticated as $who — git credentials configured."
else
  echo "❌ gh auth login failed. The token may be expired, malformed, or missing scopes."
  echo "   Check it at https://github.com/settings/personal-access-tokens"
fi

exit 0
