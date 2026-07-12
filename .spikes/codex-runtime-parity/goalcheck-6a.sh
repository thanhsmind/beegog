#!/usr/bin/env bash
# Orchestrator goal-check for codex-parity-6a.
# Executes the REAL commands Codex loads from .codex/hooks.json, the way Codex
# runs them ($SHELL -lc), with the Claude variables absent — i.e. the exact
# conditions that produced the incident.
REPO=/home/thanhsmind/projects/goglbe/beegog
cd "$REPO" || exit 1

mapfile -t STOPCMDS < <(node -e '
const h=require("./.codex/hooks.json");
for(const g of h.hooks.Stop) for(const k of g.hooks) console.log(JSON.stringify(k.command));
')

echo "=== A) THE INCIDENT: both Stop handlers, Claude vars unset, from repo root ==="
i=0
for c in "${STOPCMDS[@]}"; do
  i=$((i+1))
  cmd=$(node -e "console.log(JSON.parse(process.argv[1]))" "$c")
  out=$(printf '{"hook_event_name":"Stop","cwd":"%s"}' "$REPO" \
        | env -u CLAUDE_PROJECT_DIR -u CLAUDE_PLUGIN_ROOT bash -lc "$cmd" 2>/tmp/e$i)
  echo "  Stop handler $i -> exit=$?  (was 1 / MODULE_NOT_FOUND before the fix)"
  if [ -n "$out" ]; then
    echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log("     stdout is JSON:",("systemMessage" in j)?"has systemMessage":"NO systemMessage","| decision:",j.decision??"(none)")}catch{console.log("     stdout NOT JSON <-- would break Codex")}})'
  else
    echo "     stdout empty (allowed)"
  fi
done

echo
echo "=== B) NESTED cwd (hooks/), Claude vars unset ==="
cmd=$(node -e "console.log(JSON.parse(process.argv[1]))" "${STOPCMDS[0]}")
( cd "$REPO/hooks" && printf '{"hook_event_name":"Stop","cwd":"%s"}' "$REPO" \
  | env -u CLAUDE_PROJECT_DIR -u CLAUDE_PLUGIN_ROOT bash -lc "$cmd" >/dev/null 2>&1; echo "  nested cwd -> exit=$?" )

echo
echo "=== C) FAIL-OPEN: non-git cwd — must exit 0, empty stdout, pinned literal on stderr ==="
( cd /tmp && printf '{"hook_event_name":"Stop"}' \
  | env -u CLAUDE_PROJECT_DIR bash -lc "$cmd" >/tmp/o.txt 2>/tmp/err.txt; echo "  exit=$?" )
echo "  stdout bytes: $(wc -c </tmp/o.txt)  (must be 0)"
grep -qF 'bee: hook transport unavailable (no git root)' /tmp/err.txt \
  && echo "  stderr carries the PINNED literal ✓" || echo "  stderr MISSING the pinned literal ✗"

echo
echo "=== D) FAIL-OPEN: git shimmed off PATH — must exit 0 + same literal ==="
( cd "$REPO" && printf '{"hook_event_name":"Stop"}' \
  | env -u CLAUDE_PROJECT_DIR PATH=/usr/bin:/bin bash -lc "PATH=/nonexistent:/usr/bin:/bin; $cmd" >/tmp/o2.txt 2>/tmp/err2.txt; echo "  exit=$?" )
echo "  stdout bytes: $(wc -c </tmp/o2.txt)  (must be 0)"
grep -qF 'bee: hook transport unavailable (no git root)' /tmp/err2.txt \
  && echo "  stderr carries the PINNED literal ✓" || echo "  stderr MISSING the pinned literal ✗"
