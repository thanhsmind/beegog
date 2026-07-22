#!/usr/bin/env bash
# control-loop.sh - unbounded, stoppable poll-act loop for the herdr-orchestrating
# control agents (dispatch / merge).
#
# Each iteration invokes a FRESH headless claude session (no continuation
# across iterations): the cold start per iteration is what keeps the
# context profile flat no matter how many iterations run.
#
# The loop never terminates itself on a failing iteration - a non-zero exit
# from the iteration is reported and the loop continues. The only way to
# stop it is the human's stop gesture: create the stop file at
# <main-root>/.bee/tmp/herdr-orchestrating.stop. The loop checks for that
# file at the top of every iteration and exits cleanly when it is found.
#
# The stop file is resolved to an ABSOLUTE path, anchored at --main-root
# when given, else at `git rev-parse --show-toplevel`, else at the cwd this
# script happens to run from. This matters because bootstrap-cockpit.sh and
# this loop can run from different cwds (the human's shell vs. the pane's
# --cwd main-root) - a relative path would let the two silently disagree
# about which file means "stop".
#
# Each iteration - the real `claude -p` call, same as a stubbed --command -
# runs under a timeout (default 900s, overridable via --timeout). A timeout
# is not special: `timeout` reports it via a non-zero exit code, which the
# loop treats exactly like any other failed iteration - reported, and the
# loop continues (D19). A hung invocation must never be the thing that
# leaves the human's stop gesture unreachable.
#
# Usage:
#   control-loop.sh --role dispatch|merge [--main-root PATH] [--interval N]
#                    [--timeout N] [--max-iterations N] [--once]
#                    [--command CMD]
#
#   --role dispatch|merge   Which control agent this loop drives; selects
#                           the prompt file sent to claude.
#   --main-root PATH        Absolute path to the MAIN checkout. Anchors the
#                           stop file so it means the same thing here and in
#                           bootstrap-cockpit.sh. Defaults to
#                           `git rev-parse --show-toplevel`, else cwd.
#   --interval N            Seconds between iterations. Default: 60.
#   --timeout N             Seconds before an iteration is killed and
#                           counted as a failed iteration. Default: 900.
#   --max-iterations N      Stop after N iterations. Test-only; omit for an
#                           unbounded loop.
#   --once                  Run exactly one iteration then exit. Test-only.
#   --command CMD           Test-only. Evaluated as a shell string via
#                           `bash -c`, run instead of invoking claude. Lets
#                           tests exercise the loop mechanics without
#                           spawning a real agent.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ROLE=""
MAIN_ROOT=""
INTERVAL=60
TIMEOUT=900
MAX_ITERATIONS=""
ONCE=0
TEST_COMMAND=""

usage() {
  cat <<'EOF'
Usage: control-loop.sh --role dispatch|merge [--main-root PATH] [--interval N] [--timeout N] [--max-iterations N] [--once] [--command CMD]

  --role dispatch|merge   Which control agent this loop drives (selects the
                          prompt file sent to claude).
  --main-root PATH        Absolute path to the MAIN checkout; anchors the
                          stop file. Defaults to `git rev-parse
                          --show-toplevel`, else cwd.
  --interval N            Seconds between iterations. Default: 60.
  --timeout N             Seconds before an iteration is killed and counted
                          as a failed iteration. Default: 900.
  --max-iterations N      Stop after N iterations. Test-only.
  --once                  Run exactly one iteration then exit. Test-only.
  --command CMD           Test-only: evaluated as a shell string via
                          `bash -c`, run instead of invoking claude.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --role)
      ROLE="${2:-}"
      shift 2
      ;;
    --main-root)
      MAIN_ROOT="${2:-}"
      shift 2
      ;;
    --interval)
      INTERVAL="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:-}"
      shift 2
      ;;
    --max-iterations)
      MAX_ITERATIONS="${2:-}"
      shift 2
      ;;
    --once)
      ONCE=1
      shift
      ;;
    --command)
      TEST_COMMAND="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "control-loop.sh: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$ROLE" ]; then
  echo "control-loop.sh: --role dispatch|merge is required" >&2
  usage >&2
  exit 1
fi

case "$ROLE" in
  dispatch|merge)
    ;;
  *)
    echo "control-loop.sh: unknown role '$ROLE' (expected dispatch or merge)" >&2
    exit 1
    ;;
esac

PROMPT_FILE="$SCRIPT_DIR/../references/${ROLE}-prompt.md"

# resolve_main_root - an absolute path both this loop and
# bootstrap-cockpit.sh can agree on: --main-root when given, else the repo
# root, else cwd. Never a bare relative path - the whole point is that the
# stop file means the same file regardless of the invoker's cwd.
resolve_main_root() {
  if [ -n "$MAIN_ROOT" ]; then
    printf '%s\n' "$MAIN_ROOT"
    return 0
  fi
  local top
  top="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$top" ]; then
    printf '%s\n' "$top"
    return 0
  fi
  pwd
}

STOP_FILE="$(resolve_main_root)/.bee/tmp/herdr-orchestrating.stop"

echo "interval=${INTERVAL}s"

run_iteration() {
  if [ -n "$TEST_COMMAND" ]; then
    timeout -k 30s "${TIMEOUT}s" bash -c "$TEST_COMMAND"
    return $?
  fi

  if [ ! -f "$PROMPT_FILE" ]; then
    echo "control-loop.sh: prompt file not found: $PROMPT_FILE" >&2
    return 1
  fi

  PROMPT="$(cat "$PROMPT_FILE")"
  timeout -k 30s "${TIMEOUT}s" claude -p "$PROMPT" --model sonnet --permission-mode bypassPermissions
  return $?
}

count=0
while true; do
  if [ -f "$STOP_FILE" ]; then
    echo "control-loop.sh: stop file found at $STOP_FILE; exiting"
    exit 0
  fi

  if [ -n "$MAX_ITERATIONS" ] && [ "$count" -ge "$MAX_ITERATIONS" ]; then
    exit 0
  fi

  run_iteration
  rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "control-loop.sh: iteration timed out after ${TIMEOUT}s; reported as a failed iteration, continuing" >&2
  elif [ "$rc" -ne 0 ]; then
    echo "control-loop.sh: iteration failed with exit code $rc; continuing" >&2
  fi

  count=$((count + 1))

  if [ "$ONCE" -eq 1 ]; then
    exit 0
  fi

  if [ -n "$MAX_ITERATIONS" ] && [ "$count" -ge "$MAX_ITERATIONS" ]; then
    exit 0
  fi

  sleep "$INTERVAL"
done
