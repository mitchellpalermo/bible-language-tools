#!/bin/sh
export PATH="/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.3.0/bin:$PATH"
WORKTREE="/Users/mitch/code/greek-tools/.claude/worktrees/lucid-elion"
MAIN="/Users/mitch/code/greek-tools"
# Mirror public/data from main repo if not already present
if [ ! -d "$WORKTREE/public/data" ]; then
  mkdir -p "$WORKTREE/public"
  cp -r "$MAIN/public/data" "$WORKTREE/public/data"
fi
cd "$WORKTREE"
npm run dev -- --port 4330
