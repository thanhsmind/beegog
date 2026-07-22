#!/usr/bin/env bash
# bootstrap-cockpit.sh - builds the D13 cockpit/runtime layout for the
# agent-pane-orchestration control loop in a herdr workspace, rooted at the
# MAIN checkout (never a worktree - see docs/history/agent-pane-orchestration/
# CONTEXT.md, D13/D17/D21).
#
# A fresh workspace ends at exactly 3 tabs / 5 panes: the workspace's own
# pre-existing root tab+pane (untouched, never repurposed), the cockpit tab
# (chat / dispatch / merge), and the runtime tab (one pane to start, filled
# up to four by the dispatch loop later). No pane this script creates is
# ever labelled - dispatch and merge name themselves on first run (D17); a
# label set from outside would describe intent, not reality.
#
# --main-root is required and becomes the cwd of every tab and pane this
# script creates: `bee worktree new`/`bee worktree merge` both refuse to run
# from inside a linked worktree, so the control panes must be rooted at the
# MAIN checkout - without this, every dispatch iteration would fail forever
# while the loop dutifully continued (the same silent-stall class of bug a
# stale stop file causes, see below).
#
# The stop file is resolved against --main-root, never against this
# script's own invoker cwd (the human's shell, which need not be main-root):
# control-loop.sh's panes run with --cwd main-root, so anchoring here too is
# what keeps the stale-stop-file guard below and the loop's own check
# talking about the same file. control-loop.sh is also started with this
# same --main-root, for the same reason.
#
# Not idempotent by accident: before building anything, this script refuses
# if a pane already carries the label `dispatch` anywhere in the target
# workspace - that label is only ever set by a live dispatch loop naming
# itself (D17), so its presence means a dispatch loop is already polling
# this workspace's backlog and a second one would double-poll it.
#
# Usage:
#   bootstrap-cockpit.sh --workspace ID --main-root PATH [--no-start] [--dry-run]
#
#   --workspace ID     Required. The herdr workspace to build the layout in.
#   --main-root PATH   Required. Absolute path to the MAIN checkout.
#   --no-start         Build the layout only; launch no agent.
#   --dry-run          Print the herdr commands that would run; execute
#                      nothing (no workspace, tab, pane, or agent changes).

set -u

WORKSPACE=""
MAIN_ROOT=""
NO_START=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: bootstrap-cockpit.sh --workspace ID --main-root PATH [--no-start] [--dry-run]

  --workspace ID     Required. The herdr workspace to build the layout in.
  --main-root PATH   Required. Absolute path to the MAIN checkout - becomes
                      the cwd of every tab and pane this script creates.
                      `bee worktree new`/`bee worktree merge` both refuse to
                      run from inside a linked worktree, so every control
                      pane must be rooted here, never in a worktree.
  --no-start         Build the layout only; launch no agent.
  --dry-run          Print the herdr commands that would run; execute
                      nothing (no workspace, tab, pane, or agent changes).
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --workspace)
      WORKSPACE="${2:-}"
      shift 2
      ;;
    --main-root)
      MAIN_ROOT="${2:-}"
      shift 2
      ;;
    --no-start)
      NO_START=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "bootstrap-cockpit.sh: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$WORKSPACE" ]; then
  echo "bootstrap-cockpit.sh: --workspace ID is required" >&2
  usage >&2
  exit 1
fi

if [ -z "$MAIN_ROOT" ]; then
  echo "bootstrap-cockpit.sh: --main-root PATH is required - \`bee worktree new\`/\`bee worktree merge\` both refuse to run from inside a linked worktree, so every pane this script creates must be rooted at the MAIN checkout; without it the dispatch loop would fail every iteration while dutifully continuing" >&2
  usage >&2
  exit 1
fi

fail() {
  echo "bootstrap-cockpit.sh: $1" >&2
  exit 1
}

# Anchored at --main-root, not at this script's own invoker cwd (see header
# comment) - the same file control-loop.sh's panes check, since those panes
# run with --cwd main-root too.
STOP_FILE="$MAIN_ROOT/.bee/tmp/herdr-orchestrating.stop"

if [ -f "$STOP_FILE" ]; then
  echo "bootstrap-cockpit.sh: refusing to start - stop file present at $STOP_FILE; starting a loop that a stale stop file would immediately kill is the same silent-stall class of bug as a missing --main-root. Remove the stop file first if that is really what you want." >&2
  exit 1
fi

CONTROL_LOOP="$MAIN_ROOT/.claude/skills/herdr-orchestrating/scripts/control-loop.sh"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "herdr tab create --workspace $WORKSPACE --cwd $MAIN_ROOT --label cockpit --no-focus"
  echo "herdr pane split <cockpit_chat_pane> --direction right --cwd $MAIN_ROOT --no-focus"
  echo "herdr pane split <cockpit_dispatch_pane> --direction down --cwd $MAIN_ROOT --no-focus"
  echo "herdr tab create --workspace $WORKSPACE --cwd $MAIN_ROOT --label runtime --no-focus"
  if [ "$NO_START" -eq 0 ]; then
    echo "herdr pane run <cockpit_dispatch_pane> \"bash '$CONTROL_LOOP' --role dispatch --main-root '$MAIN_ROOT'\""
  fi
  echo "bootstrap-cockpit.sh: dry-run - no workspace, tab, pane, or agent changes were made"
  exit 0
fi

# json_result <dotted.path.under.result> - reads one herdr JSON response on
# stdin, prints the value at that path under .result, or fails loudly
# (surfacing herdr's own .error.message) if the call did not succeed.
json_result() {
  node -e "
    let s = '';
    process.stdin.on('data', (d) => { s += d; });
    process.stdin.on('end', () => {
      let r;
      try { r = JSON.parse(s); } catch (e) { console.error('bootstrap-cockpit.sh: unparseable herdr output: ' + s); process.exit(1); }
      if (r.error) { console.error('bootstrap-cockpit.sh: herdr error: ' + (r.error.message || JSON.stringify(r.error))); process.exit(1); }
      let v = r.result;
      for (const key of '$1'.split('.')) { v = v == null ? v : v[key]; }
      if (v == null) { console.error('bootstrap-cockpit.sh: herdr response missing result.$1: ' + s); process.exit(1); }
      console.log(v);
    });
  "
}

# find_dispatch_pane - reads a `herdr pane list` response on stdin and
# prints the pane_id of the first pane labelled `dispatch` anywhere in the
# workspace, or nothing if there is none. That label is only ever set by a
# live dispatch loop naming itself (D17) - never by this script - so its
# presence means a dispatch loop for this workspace is already running.
# Silent (never fails the script) on any parse trouble: idempotency is a
# refuse-if-sure check, not a reason to block a bootstrap over a herdr
# response shape mismatch.
find_dispatch_pane() {
  node -e "
    let s = '';
    process.stdin.on('data', (d) => { s += d; });
    process.stdin.on('end', () => {
      let r;
      try { r = JSON.parse(s); } catch (e) { process.exit(0); }
      if (!r || r.error) { process.exit(0); }
      let panes = r.result;
      if (panes && !Array.isArray(panes) && Array.isArray(panes.panes)) { panes = panes.panes; }
      if (!Array.isArray(panes)) { process.exit(0); }
      const hit = panes.find((p) => p && p.label === 'dispatch');
      if (hit) { console.log(hit.pane_id || ''); }
    });
  "
}

# Refuse when a dispatch loop already owns this workspace - see header
# comment and find_dispatch_pane above. Read-only (`pane list`), so this
# runs before anything is created.
EXISTING_DISPATCH_JSON=$(herdr pane list --workspace "$WORKSPACE") || fail "herdr pane list --workspace $WORKSPACE failed (idempotency check)"
EXISTING_DISPATCH_PANE=$(printf '%s' "$EXISTING_DISPATCH_JSON" | find_dispatch_pane)
if [ -n "$EXISTING_DISPATCH_PANE" ]; then
  fail "refusing to start - a pane labelled 'dispatch' already exists in workspace $WORKSPACE (pane $EXISTING_DISPATCH_PANE); bootstrap is not idempotent and a second run would start a second dispatch loop polling the same backlog.
  If that loop is still running, stop it first: create the stop file at $STOP_FILE and let it exit.
  If it is already stopped or dead, the label is simply left over - a label is pane metadata that outlives the process that set it. Clear it with 'herdr pane close $EXISTING_DISPATCH_PANE' or 'herdr pane rename $EXISTING_DISPATCH_PANE --clear', and remove the stop file if you created one. Stopping alone is NOT enough to get past this check."
fi

# The cockpit tab: chat is its root pane, created directly by `tab create`
# (never a repurposed pre-existing tab). Splitting right then splitting the
# right pane down yields chat / dispatch / merge (D13); every call carries
# --cwd main-root and no --label, so none of the three panes is named by
# this script.
COCKPIT_JSON=$(herdr tab create --workspace "$WORKSPACE" --cwd "$MAIN_ROOT" --label cockpit --no-focus) || fail "herdr tab create --label cockpit failed"
CHAT_PANE=$(printf '%s' "$COCKPIT_JSON" | json_result root_pane.pane_id) || exit 1

DISPATCH_JSON=$(herdr pane split "$CHAT_PANE" --direction right --cwd "$MAIN_ROOT" --no-focus) || fail "herdr pane split (dispatch) failed"
DISPATCH_PANE=$(printf '%s' "$DISPATCH_JSON" | json_result pane.pane_id) || exit 1

MERGE_JSON=$(herdr pane split "$DISPATCH_PANE" --direction down --cwd "$MAIN_ROOT" --no-focus) || fail "herdr pane split (merge) failed"
MERGE_PANE=$(printf '%s' "$MERGE_JSON" | json_result pane.pane_id) || exit 1

# The runtime tab: one pane to start (its own root pane, rooted at
# main-root), filled up to D5's cap of four by the dispatch loop later.
RUNTIME_JSON=$(herdr tab create --workspace "$WORKSPACE" --cwd "$MAIN_ROOT" --label runtime --no-focus) || fail "herdr tab create --label runtime failed"
RUNTIME_TAB=$(printf '%s' "$RUNTIME_JSON" | json_result tab.tab_id) || exit 1

echo "bootstrap-cockpit.sh: layout built in workspace $WORKSPACE - cockpit ($CHAT_PANE chat, $DISPATCH_PANE dispatch, $MERGE_PANE merge), runtime tab $RUNTIME_TAB"

if [ "$NO_START" -eq 1 ]; then
  echo "bootstrap-cockpit.sh: --no-start - layout built, no agent launched"
  exit 0
fi

if [ ! -f "$CONTROL_LOOP" ]; then
  fail "control-loop.sh not found at $CONTROL_LOOP - layout was built but the dispatch loop was not started"
fi

# Both control loops are started. `pane run` types the command into the
# already-created pane and presses Enter; it does not block on the unbounded
# loop it starts. Dispatch first, so that if merge fails to start the half
# that creates work is at least running and the failure is visible.
herdr pane run "$DISPATCH_PANE" "bash '$CONTROL_LOOP' --role dispatch --main-root '$MAIN_ROOT'" >/dev/null || fail "could not start the dispatch loop in pane $DISPATCH_PANE"
# The merge role gets a far larger timeout than dispatch. Its iteration
# contains `bee worktree merge`, whose wall clock is its own verify PLUS the
# queue behind the shared verify flock (up to three other worktrees), so a
# 900s bound would routinely fire mid-merge. Killing a merge is not a
# harmless retry: bee's abort-and-prove path is a JS `finally`, which SIGTERM
# never runs, so main would be left holding a staged uncommitted merge -
# permanently dirty, which is precisely the stall this feature had to fix
# once already. Long enough to be a genuine hang detector, never a normal
# outcome.
herdr pane run "$MERGE_PANE" "bash '$CONTROL_LOOP' --role merge --main-root '$MAIN_ROOT' --timeout 5400" >/dev/null || fail "could not start the merge loop in pane $MERGE_PANE"
echo "bootstrap-cockpit.sh: dispatch loop started in pane $DISPATCH_PANE, merge loop started in pane $MERGE_PANE"
