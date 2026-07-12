#!/usr/bin/env bash
# Proves the D2 fail-open contract of the repo-target transport shape that
# cell codex-parity-6a will render. This is the exact string, not a paraphrase.
REPO=/home/thanhsmind/projects/goglbe/beegog
TRANSPORT='r="$(git rev-parse --show-toplevel 2>/dev/null)"; [ -n "$r" ] || exit 0; exec node "$r"/hooks/bee-session-close.mjs --source=repo'

echo "=== transport under test ==="
echo "  $TRANSPORT"
echo

echo "A) non-git cwd (/tmp) — D2 requires exit 0, and node must NOT be invoked on an empty root"
( cd /tmp && printf '{"hook_event_name":"Stop"}' | bash -lc "$TRANSPORT" >/dev/null 2>&1; echo "   exit=$?" )

echo "B) git absent from PATH — D2 requires exit 0"
( cd "$REPO" && printf '{"hook_event_name":"Stop"}' | env PATH=/nonexistent:/usr/bin:/bin bash -lc "$TRANSPORT" >/dev/null 2>&1; echo "   exit=$?" )

echo "C) nested cwd INSIDE the repo — must resolve the root and actually run"
( cd "$REPO/hooks" && printf '{"hook_event_name":"Stop","cwd":"%s"}' "$REPO" | bash -lc "$TRANSPORT" >/dev/null 2>&1; echo "   exit=$?" )

echo "D) repo root — must resolve and run"
( cd "$REPO" && printf '{"hook_event_name":"Stop","cwd":"%s"}' "$REPO" | bash -lc "$TRANSPORT" >/dev/null 2>&1; echo "   exit=$?" )

echo
echo "E) COUNTERFACTUAL — the SAME command WITHOUT the fail-open guard, non-git cwd."
echo "   This is what the rejected cell would have shipped. It must reproduce the bug."
( cd /tmp && printf '{"hook_event_name":"Stop"}' | bash -lc 'exec node "$(git rev-parse --show-toplevel 2>/dev/null)"/hooks/bee-session-close.mjs' 2>&1 | head -2 )
