#!/usr/bin/env python3
"""Solve GitHub issues by spawning Claude Code agents in parallel worktrees.

Usage:
    python issue-runner.py 14 18 21
    python issue-runner.py 14
    python issue-runner.py 14 18 --dry-run
"""

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


REPO = "Plepic-OU/classroomio"


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def fetch_issue(number: int) -> dict:
    """Fetch issue title and body from GitHub."""
    result = run([
        "gh", "issue", "view", str(number),
        "--repo", REPO,
        "--json", "number,title,body,labels",
    ])
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch issue #{number}: {result.stderr.strip()}")
    return json.loads(result.stdout)


def build_prompt(number: int, title: str, labels: str, body: str) -> str:
    return (
        f"Solve GitHub issue #{number}: {title}\n\n"
        f"Labels: {labels}\n\n"
        f"Issue body:\n{body}\n\n"
        "Instructions:\n"
        "- Read the issue carefully and implement what is asked.\n"
        "- Run any relevant tests to verify your work.\n"
        "- Commit your changes when done.\n"
    )


def build_command(prompt: str, branch: str) -> list[str]:
    return [
        "claude", "-p", prompt,
        "--worktree", branch,
        "--output-format", "json",
        "--allowedTools",
        "Bash,Read,Write,Edit,Glob,Grep,Agent,Skill",
    ]


def dry_run_issue(number: int) -> dict:
    """Fetch issue and show what would happen without running Claude."""
    print(f"[#{number}] Fetching issue...")
    issue = fetch_issue(number)
    title = issue["title"]
    labels = ", ".join(l["name"] for l in issue.get("labels", []))
    branch = f"issue-{number}"
    prompt = build_prompt(number, title, labels, issue["body"])
    cmd = build_command(prompt, branch)

    print(f"\n{'─' * 60}")
    print(f"Issue:   #{number} — {title}")
    print(f"Labels:  {labels or '(none)'}")
    print(f"Branch:  {branch}")
    print(f"Command: {' '.join(cmd[:6])} [...]")
    print(f"Prompt:\n{prompt[:500]}{'...' if len(prompt) > 500 else ''}")
    print(f"{'─' * 60}")

    return {"number": number, "title": title, "branch": branch}


def solve_issue(number: int) -> dict:
    """Fetch an issue and run Claude Code to solve it."""
    print(f"[#{number}] Fetching issue...")
    issue = fetch_issue(number)
    title = issue["title"]
    labels = ", ".join(l["name"] for l in issue.get("labels", []))
    print(f"[#{number}] {title}")

    branch = f"issue-{number}"
    prompt = build_prompt(number, title, labels, issue["body"])

    print(f"[#{number}] Spawning Claude Code on branch '{branch}'...")
    result = run(build_command(prompt, branch))

    # Parse session ID from JSON output
    session_id = None
    try:
        output = json.loads(result.stdout)
        session_id = output.get("session_id")
    except (json.JSONDecodeError, TypeError):
        pass

    return {
        "number": number,
        "title": title,
        "branch": branch,
        "session_id": session_id,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def main():
    parser = argparse.ArgumentParser(description="Solve GitHub issues with Claude Code")
    parser.add_argument("issues", nargs="+", type=int, help="Issue numbers to solve")
    parser.add_argument(
        "-j", "--jobs", type=int, default=3,
        help="Max parallel agents (default: 3)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch issues and show what would run, without spawning agents",
    )
    args = parser.parse_args()

    if args.dry_run:
        print(f"DRY RUN — fetching {len(args.issues)} issue(s), no agents will be spawned\n")
        for n in args.issues:
            try:
                dry_run_issue(n)
            except Exception as e:
                print(f"[#{n}] ERROR fetching: {e}")
        return

    results = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = {pool.submit(solve_issue, n): n for n in args.issues}
        for future in as_completed(futures):
            number = futures[future]
            try:
                result = future.result()
                results.append(result)
                status = "OK" if result["returncode"] == 0 else "FAIL"
                print(f"\n[#{number}] {status} (branch: {result['branch']})")
                if result["returncode"] != 0:
                    print(f"[#{number}] stderr: {result['stderr'][-500:]}")
            except Exception as e:
                print(f"\n[#{number}] ERROR: {e}")
                results.append({"number": number, "error": str(e)})

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for r in sorted(results, key=lambda x: x["number"]):
        n = r["number"]
        sid = r.get("session_id", "unknown")
        if "error" in r:
            print(f"  #{n}: ERROR - {r['error']}")
        elif r["returncode"] == 0:
            print(f"  #{n}: OK -> branch '{r['branch']}'  (session: {sid})")
        else:
            print(f"  #{n}: FAIL (exit {r['returncode']})  (session: {sid})")
            print(f"         Resume: claude --resume {sid}")


if __name__ == "__main__":
    main()
