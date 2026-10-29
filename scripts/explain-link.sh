#!/usr/bin/env bash
# Runs the app's own cost and chart logic on a shared results link and prints what it computes.
# Usage: scripts/explain-link.sh '<results link>' [plan-name-substring-for-full-ledger]
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: $0 '<link>' [plan]" >&2; exit 1; }
cd "$(dirname "$0")/.."
[ -d src/generated ] || npm run build-data >/dev/null
LINK="$1" PLAN="${2:-}" CI=true npx react-scripts test --watchAll=false explainLink 2>&1 \
  | sed -n '/console.log/,${/^\s*at \|console.log\|^\s*$/!p}'
