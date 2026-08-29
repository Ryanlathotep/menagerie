#!/usr/bin/env bash
# Draft release highlights from git history.
# Usage: release_notes.sh [since-ref]   (defaults to last tag, else last 20 commits)
set -uo pipefail

SINCE="${1:-}"
if [ -z "$SINCE" ]; then
  SINCE=$(git describe --tags --abbrev=0 2>/dev/null || true)
fi
if [ -n "$SINCE" ]; then
  RANGE="$SINCE..HEAD"
else
  RANGE="-20"
fi

SHA=$(git rev-parse --short HEAD)
STAMP=$(date -u +%Y%m%d-%H%M)
VERSION="${VERSION:-$STAMP-$SHA}"
OUT="docs/releases/$VERSION.md"
mkdir -p docs/releases

{
  echo "# Menagerie — $VERSION"
  echo
  echo "_itch.io build label: \`$SHA-$STAMP\`_"
  echo
  echo "## New"
  echo "- TODO"
  echo
  echo "## Improved"
  echo "- TODO"
  echo
  echo "## Fixed"
  echo "- TODO"
  echo
  echo "## Under the hood"
  echo "- TODO"
  echo
  echo "---"
  echo
  echo "<!-- raw material: rewrite the sections above from this, then delete -->"
  echo "<!--"
  echo "Commits ($RANGE):"
  git log --no-merges --pretty='- %s (%h)' $RANGE 2>/dev/null
  echo
  echo "Files changed:"
  if [ -n "$SINCE" ]; then
    git diff --stat "$SINCE"..HEAD 2>/dev/null
  else
    git diff --stat HEAD~20..HEAD 2>/dev/null
  fi
  echo "-->"
} > "$OUT"

echo "Wrote $OUT"
echo "Version: $VERSION"
