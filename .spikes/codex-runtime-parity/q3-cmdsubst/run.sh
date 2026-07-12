#!/usr/bin/env bash
# SPIKE Q3 — A/B/C, one run, three transports on the SAME SessionStart event:
#
#   CONTROL-abspath      node /abs/path/probe.mjs            (no expansion needed)
#   TREATMENT-cmdsubst   node "$(git rev-parse --show-toplevel)"/probe.mjs
#   TREATMENT-envvar     node "$SPIKE_ROOT"/probe.mjs
#
# Discriminates cleanly:
#   nothing fires            -> hooks don't run in `codex exec`; harness problem, retry in TUI
#   control only             -> NO command substitution; the git-root transport is DEAD
#   control + cmdsubst       -> $( ) IS substituted; cell codex-parity-6's transport is VIABLE
#
# SAFETY: isolated CODEX_HOME. Never touches ~/.codex.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$ROOT/proj"
HOME_DIR="$ROOT/home"
MARKER="$ROOT/marker.jsonl"

rm -rf "$HOME_DIR"
mkdir -p "$HOME_DIR" "$PROJ/nested/deep"
: > "$MARKER"

if [ ! -d "$PROJ/.git" ]; then
  git -C "$PROJ" init -q
  git -C "$PROJ" config user.email spike@local
  git -C "$PROJ" config user.name spike
fi

cat > "$HOME_DIR/config.toml" <<EOF
model = "gpt-5.6-sol"
bypass_hook_trust = true

# NOTE (spike finding): Codex hooks are gated behind this experimental feature
# flag. Without it, NO project hook runs at all -- silently, with exit 0 and no
# diagnostic. The real ~/.codex/config.toml carries it; a fresh install does not.
[features]
hooks = true

[projects."$PROJ"]
trust_level = "trusted"
EOF

if [ -f "$HOME/.codex/auth.json" ]; then
  cp "$HOME/.codex/auth.json" "$HOME_DIR/auth.json"
fi

echo "=== transports under test ==="
grep -o '"command": ".*"' "$PROJ/.codex/hooks.json" | sed 's/^/  /'
echo

cd "$PROJ/nested/deep" || exit 1
echo "=== codex exec, cwd = proj/nested/deep (nested on purpose) ==="
CODEX_HOME="$HOME_DIR" PROBE_MARKER="$MARKER" SPIKE_ROOT="$PROJ" \
  timeout 150 codex exec --skip-git-repo-check "reply with the single word: ok" \
  >"$ROOT/codex.stdout" 2>"$ROOT/codex.stderr"
echo "codex exit=$?"
echo

echo "=== hook stderr/stdout mentioning hooks ==="
grep -iE "hook" "$ROOT/codex.stderr" "$ROOT/codex.stdout" | head -10 || echo "  (no hook lines)"
echo

echo "=== MARKER ==="
if [ -s "$MARKER" ]; then
  cat "$MARKER"
else
  echo "  (empty — no hook command ran at all)"
fi
echo
echo "=== VERDICT ==="
fired() { grep -q "\"$1\"" "$MARKER" 2>/dev/null; }
if ! [ -s "$MARKER" ]; then
  echo "  INCONCLUSIVE — not even the absolute-path CONTROL fired."
  echo "  => project hooks do not execute under \`codex exec\`; re-run the probe in an interactive session."
elif fired CONTROL-abspath && fired TREATMENT-cmdsubst; then
  echo "  YES — Codex performs command substitution. git-root transport is VIABLE."
elif fired CONTROL-abspath; then
  echo "  NO — control fired but \$( ) did NOT. The git-root transport is DEAD ON ARRIVAL."
  echo "  => planning must choose another transport (env var, or absolute path written at onboard time)."
else
  echo "  ANOMALY — treatment fired without control. Inspect marker above."
fi
