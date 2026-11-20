"""Commit the project at the end of a run — locally, on this worktree's branch.

    python3 tools/proof_commit.py "B01: 12 pages, 47 fixes, 1 flagged, 58.3 min"

Runs git against the worktree this file lives in, not the caller's working
directory: a /loop session usually runs in a worktree of its own, where a bare
`git commit` would land on the wrong branch. Commits only gesenius/ and the
skill. After committing, pushes the branch to `origin`
(github.com/mitchellpalermo/bible-language-tools) so the work survives this
Mac. It never pushes `main`: merging the branch is Mitch's call. A failed push
is reported but does not undo the commit; the next run's push carries it.
"""
import pathlib
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
PATHS = ["gesenius", ".claude/skills/gesenius-proofread"]
REMOTE = "origin"
REPO_SLUG = "mitchellpalermo/bible-language-tools"
TRAILER = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    summary = sys.argv[1]
    git("add", "--", *PATHS)
    if git("diff", "--cached", "--quiet").returncode == 0:
        print("nothing to commit")
        return
    msg = f"proof(gesenius): {summary}\n\n{TRAILER}\n"
    r = git("commit", "-q", "-m", msg)
    if r.returncode != 0:
        sys.exit(f"commit failed:\n{r.stdout}\n{r.stderr}")
    print(git("log", "--oneline", "-1").stdout.strip())
    push()


def push() -> None:
    """Push the current branch to origin, never main."""
    url = git("remote", "get-url", REMOTE).stdout.strip()
    if REPO_SLUG not in url:
        print(f"push skipped: remote '{REMOTE}' is {url or 'missing'!r}, expected {REPO_SLUG}")
        return
    branch = git("branch", "--show-current").stdout.strip()
    if not branch or branch == "main":
        print(f"push skipped: on {branch or 'a detached HEAD'!r}, not the project's branch")
        return
    r = git("push", "-q", REMOTE, f"HEAD:refs/heads/{branch}")
    print(f"pushed to {REMOTE}/{branch}" if r.returncode == 0
          else f"push FAILED (commit kept locally):\n{r.stderr.strip()}")


if __name__ == "__main__":
    main()
