#!/usr/bin/env bash
# VALIDATION SPIKE for cell codex-parity-6c (no repo state touched).
# Builds isolated git fixtures under $OUT and exercises the CURRENT repo
# transport vs the review's prescribed fail-CLOSED transport.
set -u
REAL="/home/thanhsmind/projects/goglbe/beegog"
OUT="${1:-/tmp/claude-1000/-home-thanhsmind-projects-goglbe-beegog/41bdba4b-0ac5-44cd-adee-6128bb1632a6/scratchpad/6c}"
rm -rf "$OUT"; mkdir -p "$OUT"

# ---------- fixtures ----------
# A. bare-fixture: a git dir with core.bare=true (P1-a)
mkdir -p "$OUT/bare"; ( cd "$OUT/bare" && git init -q . && git config core.bare true )

# B. wrong-root: a DIFFERENT git root with no hooks/ (P1-b)
mkdir -p "$OUT/wrong/sub"; ( cd "$OUT/wrong" && git init -q . )

# C. repo-good: a real bee-looking repo with hooks/ + .bee/bin/lib
G="$OUT/good"
mkdir -p "$G/hooks" "$G/.bee/bin/lib" "$G/.bee/logs" "$G/src/pkg with spaces é/déep"
( cd "$G" && git init -q . )
: > "$G/.bee/onboarding.json"
printf '{"guards":{"idle_gate":false}}\n' > "$G/.bee/config.json"   # isolate: only direct-edit/gate rules matter
for f in adapter.mjs bee-write-guard.mjs bee-state-sync.mjs bee-session-init.mjs \
         bee-prompt-context.mjs bee-chain-nudge.mjs bee-session-close.mjs; do
  cp "$REAL/hooks/$f" "$G/hooks/$f"
done
for f in guards.mjs state.mjs reservations.mjs fsutil.mjs cells.mjs backlog.mjs decisions.mjs inject.mjs capture.mjs feedback.mjs commands_detect.mjs; do
  cp "$REAL/.bee/bin/lib/$f" "$G/.bee/bin/lib/$f" 2>/dev/null
done
echo 'x' > "$G/src/pkg with spaces é/déep/x.js"

# ---------- transports ----------
# CURRENT (verbatim from .codex/hooks.json / catalog.mjs repoCommand)
cur() { # $1 = script
cat <<EOF
r="\$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "\$r" ] || { echo "bee: hook transport unavailable (no git root)" >&2; exit 0; }
exec node "\$r"/hooks/$1 --source=repo
EOF
}
# PRESCRIBED fail-CLOSED (review, PreToolUse only)
fixed() { # $1 = script
cat <<EOF
r="\$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "\$r" ] && [ -f "\$r/hooks/$1" ] || { echo "bee write guard: cannot resolve repo root — refusing write" >&2; exit 2; }
exec node "\$r"/hooks/$1 --source=repo
EOF
}

run() { # $1=label $2=cwd $3=command-text ; stdin = payload
  local label="$1" cwd="$2" cmd="$3"; shift 3
  local so se rc
  so="$(mktemp)"; se="$(mktemp)"
  ( cd "$cwd" && bash -c "$cmd" ) >"$so" 2>"$se"; rc=$?
  printf '\n### %s\n  cwd : %s\n  EXIT: %s\n' "$label" "$cwd" "$rc"
  [ -s "$se" ] && printf '  ERR : %s\n' "$(head -c 400 "$se" | head -3 | tr '\n' '|')"
  [ -s "$so" ] && printf '  OUT : %s\n' "$(head -c 300 "$so" | tr '\n' '|')"
  rm -f "$so" "$se"
}

PT_EDIT='{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":".bee/state.json"}}'
PT_SAFE='{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"src/foo.js"}}'
AP_STATE='{"hook_event_name":"PreToolUse","tool_name":"apply_patch","tool_input":{"input":"*** Begin Patch\n*** Update File: .bee/state.json\n@@\n-old\n+new\n*** End Patch"}}'
AP_STATE_ABS="{\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"apply_patch\",\"tool_input\":{\"input\":\"*** Begin Patch\n*** Update File: $G/.bee/state.json\n@@\n-old\n+new\n*** End Patch\"}}"
AP_SAFE='{"hook_event_name":"PreToolUse","tool_name":"apply_patch","tool_input":{"input":"*** Begin Patch\n*** Add File: src/new.txt\n+hi\n*** End Patch"}}'

echo "=================== ITEM 1: REPRODUCE P1-a / P1-b (CURRENT transport) ==================="
echo "$PT_EDIT" | run "P1-a bare repo (git rev-parse exits 128)" "$OUT/bare" "$(cur bee-write-guard.mjs)"
echo "$AP_STATE" | run "P1-a bare repo, apply_patch on .bee/state.json" "$OUT/bare" "$(cur bee-write-guard.mjs)"
echo "$PT_EDIT" | run "P1-b nested WRONG git root" "$OUT/wrong/sub" "$(cur bee-write-guard.mjs)"

echo
echo "=================== ITEM 2: PRESCRIBED FAIL-CLOSED transport ==================="
echo "$PT_EDIT" | run "P1-a bare repo, FIXED" "$OUT/bare" "$(fixed bee-write-guard.mjs)"
echo "$AP_STATE" | run "P1-a bare repo apply_patch, FIXED" "$OUT/bare" "$(fixed bee-write-guard.mjs)"
echo "$PT_EDIT" | run "P1-b wrong git root, FIXED" "$OUT/wrong/sub" "$(fixed bee-write-guard.mjs)"

echo
echo "=================== ITEM 3: HAPPY-PATH REGRESSION (FIXED transport) ==================="
echo "$AP_STATE" | run "3a apply_patch .bee/state.json from ROOT (expect 2)" "$G" "$(fixed bee-write-guard.mjs)"
echo "$AP_STATE" | run "3b apply_patch '.bee/state.json' from NESTED cwd src/ (cwd-relative!)" "$G/src" "$(fixed bee-write-guard.mjs)"
echo "$AP_STATE_ABS" | run "3b' apply_patch ABSOLUTE .bee/state.json from NESTED cwd src/ (expect 2)" "$G/src" "$(fixed bee-write-guard.mjs)"
echo "$AP_STATE_ABS" | run "3c apply_patch ABSOLUTE .bee/state.json from SPACES+UNICODE cwd (expect 2)" "$G/src/pkg with spaces é/déep" "$(fixed bee-write-guard.mjs)"
echo "$PT_EDIT" | run "3d Edit .bee/state.json from SPACES+UNICODE cwd (expect 2)" "$G/src/pkg with spaces é/déep" "$(fixed bee-write-guard.mjs)"
echo "$PT_SAFE" | run "3e NON-gated Edit src/foo.js from root (expect 0)" "$G" "$(fixed bee-write-guard.mjs)"
echo "$AP_SAFE" | run "3f NON-gated apply_patch Add src/new.txt (expect 0)" "$G" "$(fixed bee-write-guard.mjs)"
echo "$PT_SAFE" | run "3g NON-gated Edit from SPACES+UNICODE cwd (expect 0)" "$G/src/pkg with spaces é/déep" "$(fixed bee-write-guard.mjs)"

echo
echo "=================== ITEM 4: ADVISORY EVENTS keep fail-OPEN (CURRENT transport) ==================="
for pair in "SessionStart:bee-session-init.mjs" "UserPromptSubmit:bee-prompt-context.mjs" \
            "PostToolUse:bee-state-sync.mjs" "SubagentStop:bee-chain-nudge.mjs" \
            "PreCompact:bee-session-close.mjs" "Stop:bee-state-sync.mjs"; do
  ev="${pair%%:*}"; sc="${pair##*:}"
  printf '{"hook_event_name":"%s"}' "$ev" | run "$ev / $sc @ bare repo (expect 0 + diagnostic)" "$OUT/bare" "$(cur "$sc")"
  printf '{"hook_event_name":"%s"}' "$ev" | run "$ev / $sc @ wrong git root (expect 0 or CRASH?)" "$OUT/wrong/sub" "$(cur "$sc")"
done

echo
echo "=================== ITEM 4b: what if the fail-CLOSED arm were applied GLOBALLY ==================="
for pair in "Stop:bee-state-sync.mjs" "SubagentStop:bee-chain-nudge.mjs"; do
  ev="${pair%%:*}"; sc="${pair##*:}"
  printf '{"hook_event_name":"%s"}' "$ev" | run "GLOBAL-fail-closed $ev @ bare repo (would exit 2 = turn-control verdict; violates R4)" "$OUT/bare" "$(fixed "$sc")"
done

echo
echo "FIXTURES: $OUT"
