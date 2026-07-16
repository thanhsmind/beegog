#!/usr/bin/env bash
set -euo pipefail

# install.sh — install bee (https://github.com/thanhsmind/beegog) into a project.
#
# Two authoritative distribution modes:
#   1. plugin-first: prove the installed plugin package before removing legacy
#      project projections; onboarding never creates repo skill/hook copies.
#   2. repo-copy: prove the plugin inactive before onboarding vendors skills and
#      hooks into the repository.
#      Both modes run onboard_bee.mjs against the target project — it installs the
#      AGENTS.md BEE block, .bee/ runtime files, vendored helpers, and (by
#      default) syncs the bee skills per-project into <repo>/.claude/skills and
#      <repo>/.agents/skills.
#
# Greenfield (empty dir / no git) and brownfield (existing repo) are both
# supported: onboarding merges via BEE:START/END markers, never touches content
# outside them, never overwrites existing state, and is idempotent.

REPO_URL="https://github.com/thanhsmind/beegog.git"
RAW_BASE="https://raw.githubusercontent.com/thanhsmind/beegog/main"

usage() {
  cat <<'EOF'
Usage: install.sh [options] [path]

Install bee into a target project directory (greenfield or brownfield).

Options:
  -d, --directory <path>  Target project directory. Defaults to the current
                          directory. Created if missing (greenfield).
      --runtime <which>   Which runtime skills to install: claude, codex, or
                          both. Default: both.
      --distribution <mode>
                          plugin-first or repo-copy. Default: repo-copy.
      --plugin-state-file <path>
                          Read runtime plugin-list JSON from a fixture/probe file.
                          Primarily for automation; otherwise runtime CLIs are used.
      --ownership-ledger <path>
                          Exact installer ledger required before plugin-first may
                          clean user/global skill roots.
      --source <path>     Use a local bee checkout instead of cloning GitHub.
      --ref <ref>         Git branch/tag to clone. Default: main.
      --no-hooks          Skip --repo-hooks wiring for Claude Code. By default
                          this installer wires repo-local hooks, because the
                          manual skills-copy route does not load plugin hooks.
      --global-skills     Also copy bee skills into the legacy global runtime
                          directories (~/.claude/skills, ~/.codex/skills) and
                          pass --global-skills through to onboarding. Off by
                          default — onboarding's per-project sync (layer 2)
                          into <repo>/.claude/skills and <repo>/.agents/skills
                          is the default layout.
      --no-claude-md      Skip writing/extending CLAUDE.md with the bare
                          @AGENTS.md import. By default onboarding writes it
                          (third-belt bootstrap for Claude Code).
      --claude-md         Accepted for compatibility; a no-op alias of the
                          default (CLAUDE.md is written unless --no-claude-md
                          is passed).
      --no-git-init       Greenfield: do not run `git init` in a non-git target.
  -y, --yes               Non-interactive; accept defaults, skip prompts.
      --dry-run           Show the runtime copies and the exact onboarding plan
                          (onboard_bee.mjs without --apply). Writes nothing.
  -h, --help              Show this help.

Safety (brownfield):
  - AGENTS.md: only the <!-- BEE:START --> .. <!-- BEE:END --> block is managed;
    everything outside it is preserved byte-for-byte.
  - .bee/state.json, decisions.jsonl, cells/ are never overwritten.
  - .claude/settings.json hook merge creates a .bak backup; re-runs never
    duplicate entries.
  - Skills: onboarding syncs the bee skills per-project by default into
    <repo>/.claude/skills (Claude Code) and <repo>/.agents/skills (Codex);
    these trees are committed, not gitignored. Pass --global-skills to also
    copy into ~/.claude/skills / ~/.codex/skills (layer 1, legacy behavior).
  - CLAUDE.md: written by default with the @AGENTS.md import; existing content
    is preserved and the import block is appended once, never duplicated.
    Pass --no-claude-md to skip it.
  - Run with --dry-run first to see the exact plan for YOUR repo.

Examples:
  scripts/install.sh                          # this checkout -> current dir
  scripts/install.sh -d /path/to/project -y   # non-interactive
  scripts/install.sh --dry-run                # plan only
  curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -y
  curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -d /path/to/project --runtime claude --global-skills -y
EOF
}

log()  { printf '%s\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

can_prompt() { [ -r /dev/tty ] && [ -w /dev/tty ]; }

confirm() {
  # confirm <question> ; returns 0 for yes. --yes always yes; non-interactive without --yes fails safe.
  local question="$1"
  if [ "$ASSUME_YES" -eq 1 ]; then return 0; fi
  if ! can_prompt; then
    fail "$question — no TTY to ask. Re-run with --yes to accept, or run interactively."
  fi
  printf '%s [y/N] ' "$question" > /dev/tty
  local answer; IFS= read -r answer < /dev/tty
  case "$answer" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

TARGET_DIR="$PWD"
RUNTIME="both"
DISTRIBUTION_MODE="repo-copy"
PLUGIN_STATE_FILE=""
OWNERSHIP_LEDGER=""
SOURCE=""
REF="main"
REPO_HOOKS=1
GLOBAL_SKILLS=0
NO_CLAUDE_MD=0
GIT_INIT=1
ASSUME_YES=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--directory) TARGET_DIR="$2"; shift 2 ;;
    --runtime)      RUNTIME="$2"; shift 2 ;;
    --distribution) DISTRIBUTION_MODE="$2"; shift 2 ;;
    --plugin-state-file) PLUGIN_STATE_FILE="$2"; shift 2 ;;
    --ownership-ledger) OWNERSHIP_LEDGER="$2"; shift 2 ;;
    --source)       SOURCE="$2"; shift 2 ;;
    --ref)          REF="$2"; shift 2 ;;
    --no-hooks)     REPO_HOOKS=0; shift ;;
    --global-skills) GLOBAL_SKILLS=1; shift ;;
    --no-claude-md) NO_CLAUDE_MD=1; shift ;;
    --claude-md)    shift ;;
    --no-git-init)  GIT_INIT=0; shift ;;
    -y|--yes)       ASSUME_YES=1; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    -*)             fail "Unknown option: $1 (see --help)" ;;
    *)              TARGET_DIR="$1"; shift ;;
  esac
done

case "$RUNTIME" in claude|codex|both) ;; *) fail "--runtime must be claude, codex, or both" ;; esac
case "$DISTRIBUTION_MODE" in plugin-first|repo-copy) ;; *) fail "--distribution must be plugin-first or repo-copy" ;; esac

# ---------- prerequisites ----------

command -v node >/dev/null 2>&1 || fail "Node.js 18+ is required (node not found on PATH)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18+ is required (found $(node --version))."

# ---------- resolve bee source (local checkout or clone) ----------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd -P || true)"
CLEANUP_DIR=""
STATE_TMP=""
cleanup() {
  [ -n "$CLEANUP_DIR" ] && rm -rf "$CLEANUP_DIR" || true
  [ -n "$STATE_TMP" ] && rm -rf "$STATE_TMP" || true
}
trap cleanup EXIT

if [ -n "$SOURCE" ]; then
  BEE_SRC="$(cd "$SOURCE" && pwd -P)" || fail "--source path not found: $SOURCE"
elif [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../skills/bee-hive/scripts/onboard_bee.mjs" ]; then
  BEE_SRC="$(cd "$SCRIPT_DIR/.." && pwd -P)"
else
  command -v git >/dev/null 2>&1 || fail "git is required to fetch bee (or pass --source <local-checkout>)."
  CLEANUP_DIR="$(mktemp -d)"
  log "fetch    $REPO_URL (ref: $REF)"
  git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$CLEANUP_DIR/bee" \
    || fail "Clone failed. Check network access to github.com/thanhsmind/beegog."
  BEE_SRC="$CLEANUP_DIR/bee"
fi

ONBOARD="$BEE_SRC/skills/bee-hive/scripts/onboard_bee.mjs"
[ -f "$ONBOARD" ] || fail "Not a bee checkout (missing skills/bee-hive/scripts/onboard_bee.mjs): $BEE_SRC"
DIST_HELPER="$BEE_SRC/skills/bee-hive/scripts/plugin_distribution.mjs"
RELEASE_MANIFEST="$BEE_SRC/docs/history/codex-harness-hardening/release-manifest.json"
[ -f "$DIST_HELPER" ] || fail "Not a bee release (missing plugin_distribution.mjs): $BEE_SRC"
[ -f "$RELEASE_MANIFEST" ] || fail "Not a bee release (missing release manifest): $BEE_SRC"
BEE_VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version)" "$BEE_SRC/.claude-plugin/plugin.json" 2>/dev/null || echo unknown)"
log "source   $BEE_SRC (bee $BEE_VERSION)"

# Direct global replacement is intentionally gone: user-root cleanup is legal
# only through an exact ownership ledger consumed by the shared planner.
if [ "$GLOBAL_SKILLS" -eq 1 ] && [ -z "$OWNERSHIP_LEDGER" ]; then
  fail "--global-skills requires --ownership-ledger; basename-only global replacement is refused"
fi

# ---------- layer 2: target repo (greenfield / brownfield) ----------

if [ ! -d "$TARGET_DIR" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    log "would create  $TARGET_DIR (greenfield)"
  else
    confirm "Target $TARGET_DIR does not exist. Create it (greenfield)?" || fail "Aborted."
    mkdir -p "$TARGET_DIR" 2>/dev/null \
      || fail "cannot create target directory '$TARGET_DIR' (permission denied or invalid path). Pass a real, writable path to -d — e.g. -d ~/projects/my-app — not a literal '/path/to/...' placeholder."
  fi
fi
TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd -P || printf '%s' "$TARGET_DIR")"

MODE="brownfield"
if [ ! -e "$TARGET_DIR/.git" ]; then
  MODE="greenfield"
  if [ "$GIT_INIT" -eq 1 ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      log "would run     git init ($TARGET_DIR is not a git repo)"
    elif command -v git >/dev/null 2>&1 && confirm "No git repo at $TARGET_DIR. Run git init?"; then
      git -C "$TARGET_DIR" init --quiet
    fi
  fi
elif [ -f "$TARGET_DIR/.bee/onboarding.json" ]; then
  MODE="brownfield (bee already onboarded — refresh)"
elif [ -f "$TARGET_DIR/AGENTS.md" ] || [ -f "$TARGET_DIR/CLAUDE.md" ]; then
  MODE="brownfield (existing agent docs — BEE block will be merged, nothing outside markers touched)"
fi
log "target   $TARGET_DIR [$MODE]"

ONBOARD_FLAGS=()
if [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then
  ONBOARD_FLAGS+=("--plugin-source")
elif [ "$REPO_HOOKS" -eq 1 ]; then
  ONBOARD_FLAGS+=("--repo-hooks")
fi
if [ "$NO_CLAUDE_MD" -eq 1 ]; then
  ONBOARD_FLAGS+=("--no-claude-md")
fi
if [ "$GLOBAL_SKILLS" -eq 1 ]; then
  ONBOARD_FLAGS+=("--global-skills")
fi

runtime_active() { case "$RUNTIME" in "$1"|both) return 0 ;; *) return 1 ;; esac; }

# D8: pre-confirmation is READ-ONLY. probe_plugin_state runs only `plugin list`
# status probes (never install/remove/marketplace), records the current runtime
# plugin state into $1, and never mutates a runtime plugin, target, or home.
probe_plugin_state() {
  local dest="$1"
  if [ -n "$PLUGIN_STATE_FILE" ]; then
    [ -f "$PLUGIN_STATE_FILE" ] || fail "--plugin-state-file not found: $PLUGIN_STATE_FILE"
    STATE_FILE="$PLUGIN_STATE_FILE"
    return
  fi
  local claude_json="$STATE_TMP/claude.json" codex_json="$STATE_TMP/codex.json"
  printf '[]\n' > "$claude_json"; printf '[]\n' > "$codex_json"
  if runtime_active codex; then
    if command -v codex >/dev/null 2>&1; then
      codex plugin list --json > "$codex_json" || fail "Codex plugin status probe failed"
    elif [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then fail "Codex CLI is required for plugin-first"; fi
  fi
  if runtime_active claude; then
    if command -v claude >/dev/null 2>&1; then
      claude plugin list --json > "$claude_json" || fail "Claude plugin status probe failed"
    elif [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then fail "Claude CLI is required for plugin-first"; fi
  fi
  node -e 'const fs=require("fs"); const read=p=>JSON.parse(fs.readFileSync(p,"utf8")); fs.writeFileSync(process.argv[3], JSON.stringify({claude:read(process.argv[1]),codex:read(process.argv[2])}));' "$claude_json" "$codex_json" "$dest" \
    || fail "Plugin status probe returned unreadable data (package-list shape drift)"
}

# Whether the bee plugin was installed for <runtime> in the pre-run snapshot.
# Prints 1/0; used to decide the inverse transition during rollback.
plugin_was_installed() {
  local rt="$1" src="$2"
  node -e '
    const fs=require("fs");
    const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const list=s[process.argv[2]];
    const arr=Array.isArray(list)?list:((list&&(list.plugins||list.items||list.data))||(list&&typeof list==="object"?[list]:[]));
    const p=arr.find(x=>{const n=x&&(x.name||x.id||(x.plugin&&x.plugin.name));return n==="bee"||String(n||"").startsWith("bee@")});
    let out="0";
    if(p){const st=String(p.status||p.state||"").toLowerCase();out=(p.installed===true||!["removed","not_installed"].includes(st))?"1":"0";}
    process.stdout.write(out);
  ' "$src" "$rt" 2>/dev/null || printf '0'
}

# POST-confirmation transition: plugin-first installs the plugin package; repo-copy
# removes it. Returns nonzero if a required plugin-first transition fails.
transition_plugin() {
  [ -n "$PLUGIN_STATE_FILE" ] && return 0
  local rt add_verb rm_verb
  for rt in codex claude; do
    runtime_active "$rt" || continue
    command -v "$rt" >/dev/null 2>&1 || { [ "$DISTRIBUTION_MODE" = "plugin-first" ] && fail "$rt CLI is required for plugin-first"; continue; }
    if [ "$rt" = "codex" ]; then add_verb="add"; rm_verb="remove"; else add_verb="install"; rm_verb="uninstall"; fi
    if [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then
      "$rt" plugin marketplace add "$BEE_SRC" --json >/dev/null || return 1
      "$rt" plugin "$add_verb" bee@bee --json >/dev/null || return 1
    else
      "$rt" plugin "$rm_verb" bee@bee --json >/dev/null 2>&1 || true
    fi
  done
  return 0
}

# Restore every runtime to its exact pre-run installed/enabled state. Returns
# nonzero if any inverse transition fails so the caller can report it.
rollback_plugin() {
  [ -n "$PLUGIN_STATE_FILE" ] && return 0
  local rc=0 rt was add_verb rm_verb
  for rt in codex claude; do
    runtime_active "$rt" || continue
    command -v "$rt" >/dev/null 2>&1 || continue
    if [ "$rt" = "codex" ]; then add_verb="add"; rm_verb="remove"; else add_verb="install"; rm_verb="uninstall"; fi
    was="$(plugin_was_installed "$rt" "$PRE_STATE_FILE")"
    if [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then
      if [ "$was" != "1" ]; then "$rt" plugin "$rm_verb" bee@bee --json >/dev/null 2>&1 || rc=1; fi
    else
      if [ "$was" = "1" ]; then
        "$rt" plugin marketplace add "$BEE_SRC" --json >/dev/null 2>&1 || rc=1
        "$rt" plugin "$add_verb" bee@bee --json >/dev/null 2>&1 || rc=1
      fi
    fi
  done
  return $rc
}

# A post-transition failure: roll the plugin state back to the pre-run snapshot,
# leave the target untouched, report BOTH the primary and any rollback failure,
# and exit nonzero (never convert a failed install into success).
handle_transition_failure() {
  printf 'Error: %s\n' "$1" >&2
  if rollback_plugin; then
    printf 'rollback: pre-run plugin state restored; target left unchanged\n' >&2
  else
    printf 'Error: rollback failed to fully restore the pre-run plugin state\n' >&2
  fi
  exit 1
}

STATE_TMP="$(mktemp -d)"
STATE_FILE="$STATE_TMP/state.json"
PRE_STATE_FILE="$STATE_TMP/pre-state.json"

# 1. read-only probe of the CURRENT plugin state (pre-confirmation, no mutation).
probe_plugin_state "$STATE_FILE"
cp "$STATE_FILE" "$PRE_STATE_FILE"

DIST_ARGS=(--mode "$DISTRIBUTION_MODE" --runtime "$RUNTIME" --repo-root "$TARGET_DIR" --release-manifest "$RELEASE_MANIFEST" --plugin-state-file "$STATE_FILE")
if [ -n "$OWNERSHIP_LEDGER" ]; then DIST_ARGS+=(--ledger "$OWNERSHIP_LEDGER"); fi
if [ "$GLOBAL_SKILLS" -eq 1 ]; then
  if [ "$RUNTIME" = "claude" ] || [ "$RUNTIME" = "both" ]; then DIST_ARGS+=(--user-skill-root "${CLAUDE_HOME:-$HOME/.claude}/skills"); fi
  if [ "$RUNTIME" = "codex" ] || [ "$RUNTIME" = "both" ]; then DIST_ARGS+=(--user-skill-root "${CODEX_HOME:-$HOME/.codex}/skills"); fi
fi

# onboard_plan_json prints the onboarding plan as JSON (plan mode, writes nothing).
onboard_plan_json() {
  node "$ONBOARD" --repo-root "$TARGET_DIR" --json ${ONBOARD_FLAGS[@]+"${ONBOARD_FLAGS[@]}"} 2>/dev/null
}
# plan_field <json> <field> — extract one string field, or "parse_error" on bad JSON.
plan_field() {
  printf '%s' "$1" | node -e 'let d="";process.stdin.on("data",c=>{d+=c}).on("end",()=>{try{const s=JSON.parse(d);process.stdout.write(String(s[process.argv[1]]??""));}catch{process.stdout.write("parse_error");}})' "$2"
}

# 2. mutation-free preview: onboarding plan (writes nothing). A blocked/refused
#    plan (invalid or mixed source tuple, refused downgrade) must fail loudly HERE,
#    before any confirmation, transition, or target/home write. onboard_bee reports
#    a refusal as a non-`changes_needed`/`up_to_date` status (and may still exit 0),
#    so status — not exit code alone — is the gate.
log "plan     onboard_bee.mjs ${ONBOARD_FLAGS[*]:-} (preview, writes nothing)"
PREVIEW_JSON="$(onboard_plan_json)" || fail "Onboarding plan failed."
PREVIEW_STATUS="$(plan_field "$PREVIEW_JSON" status)"
case "$PREVIEW_STATUS" in
  up_to_date|changes_needed) log "plan     status: $PREVIEW_STATUS" ;;
  *) fail "Onboarding refused before any change [$PREVIEW_STATUS]: $(plan_field "$PREVIEW_JSON" reason)" ;;
esac

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run  nothing written, no plugin changes. Re-run without --dry-run to apply."
  exit 0
fi

# 3. confirmation gate. Nothing above this line mutates a plugin, target, or home.
confirm "Apply this onboarding plan to $TARGET_DIR?" || fail "Aborted — nothing applied."

# 4. transition the selected plugin, then re-probe and revalidate before onboarding.
transition_plugin || handle_transition_failure "Plugin transition failed"

# Test-only fault seam: simulate a failure immediately after the transition and
# before onboarding, to prove the rollback contract (never set in real installs).
[ -n "${BEE_INSTALL_FAULT_AFTER_TRANSITION:-}" ] && handle_transition_failure "injected post-transition fault (BEE_INSTALL_FAULT_AFTER_TRANSITION)"

probe_plugin_state "$STATE_FILE"
node "$DIST_HELPER" "${DIST_ARGS[@]}" || handle_transition_failure "Distribution preflight refused after transition"

# 5. apply onboarding, but ONLY when the plan has work. A repeat install that is
#    already current must not rewrite managed files (no timestamp-only churn).
APPLY_JSON="$(onboard_plan_json)" || handle_transition_failure "Onboarding plan failed after transition"
APPLY_STATUS="$(plan_field "$APPLY_JSON" status)"
case "$APPLY_STATUS" in
  up_to_date) log "onboard  already current — no managed files rewritten" ;;
  changes_needed)
    node "$ONBOARD" --repo-root "$TARGET_DIR" --apply ${ONBOARD_FLAGS[@]+"${ONBOARD_FLAGS[@]}"} >/dev/null \
      || handle_transition_failure "Onboarding apply failed" ;;
  *) handle_transition_failure "Onboarding refused after transition [$APPLY_STATUS]" ;;
esac

if [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then
  node "$DIST_HELPER" "${DIST_ARGS[@]}" --apply || handle_transition_failure "Plugin-first cleanup refused; repository fallbacks were preserved"
fi

# ---------- verify: strict final postconditions (D2) ----------
# Success requires exact source/onboarding/runtime/projection version equality,
# no drift, and an immediate up_to_date recheck — not merely an "installed" flag.

STATUS="$(cd "$TARGET_DIR" && node .bee/bin/bee.mjs status --json 2>/dev/null)" \
  || fail "Verification failed: bee.mjs status did not run."
printf '%s' "$STATUS" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (!s.onboarding || s.onboarding.installed !== true) { console.error("bee.mjs status reports not installed"); process.exit(1); }
  const expected = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version;
  if (s.onboarding.bee_version !== expected || s.onboarding.plugin_version !== expected || s.onboarding.drift !== false) {
    console.error(`version parity failed: expected ${expected}, got bee=${s.onboarding.bee_version}, plugin=${s.onboarding.plugin_version}, drift=${s.onboarding.drift}`);
    process.exit(1);
  }
  console.log(`verify   onboarding ok (bee ${s.onboarding.bee_version}), phase: ${s.phase}`);
' "$BEE_SRC/.claude-plugin/plugin.json" || fail "Verification failed: unexpected bee.mjs status output."

# Immediate up_to_date recheck: a fresh onboarding plan must find nothing to do.
# This proves onboarding/runtime/project-projection surfaces all equal the source
# tuple (any drift would re-plan work here).
RECHECK="$(node "$ONBOARD" --repo-root "$TARGET_DIR" --json ${ONBOARD_FLAGS[@]+"${ONBOARD_FLAGS[@]}"} 2>/dev/null)" \
  || fail "Verification failed: onboarding recheck did not run."
printf '%s' "$RECHECK" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (s.status !== "up_to_date") {
    console.error(`onboarding recheck expected up_to_date, got ${s.status}`);
    process.exit(1);
  }
' || fail "Verification failed: onboarding is not up_to_date immediately after apply."

# Plugin-first: the distribution recheck must also report nothing left to clean.
if [ "$DISTRIBUTION_MODE" = "plugin-first" ]; then
  probe_plugin_state "$STATE_FILE"
  node "$DIST_HELPER" "${DIST_ARGS[@]}" >/dev/null || fail "Verification failed: distribution recheck refused."
fi

log ""
log "bee installed."
log "  next: open an agent session in $TARGET_DIR"
log "  - Claude Code: the session preamble appears via hooks; or say \"Route this through bee: <task>\""
log "  - Codex: the AGENTS.md BEE block bootstraps; first step is bee.mjs status"
log "  - scout any time: node .bee/bin/bee.mjs status --json"
