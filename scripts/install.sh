#!/usr/bin/env bash
set -euo pipefail

# install.sh — install bee (https://github.com/thanhsmind/beegog) into a project.
#
# Two layers:
#   1. Runtime layer (opt-in, --global-skills): copy the bee skills into your
#      agent's global skills directory (~/.claude/skills and/or ~/.codex/skills).
#      Off by default — the per-project sync in layer 2 is the default layout.
#   2. Repo layer: run onboard_bee.mjs against the target project — installs the
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

# ---------- prerequisites ----------

command -v node >/dev/null 2>&1 || fail "Node.js 18+ is required (node not found on PATH)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18+ is required (found $(node --version))."

# ---------- resolve bee source (local checkout or clone) ----------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd -P || true)"
CLEANUP_DIR=""
cleanup() { [ -n "$CLEANUP_DIR" ] && rm -rf "$CLEANUP_DIR" || true; }
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
BEE_VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version)" "$BEE_SRC/.claude-plugin/plugin.json" 2>/dev/null || echo unknown)"
log "source   $BEE_SRC (bee $BEE_VERSION)"

# ---------- layer 1: global runtime skills (opt-in via --global-skills) ----------

install_skills_to() {
  local dest="$1" label="$2" copied=0 updated=0 same=0
  mkdir -p "$dest"
  for skill in "$BEE_SRC"/skills/*/; do
    local name; name="$(basename "$skill")"
    local target="$dest/$name"
    if [ -d "$target" ]; then
      if diff -rq "$skill" "$target" >/dev/null 2>&1; then
        same=$((same + 1)); continue
      fi
      if [ "$DRY_RUN" -eq 1 ]; then log "would update  $label/$name"; updated=$((updated + 1)); continue; fi
      rm -rf "$target"; cp -R "$skill" "$target"; updated=$((updated + 1))
    else
      if [ "$DRY_RUN" -eq 1 ]; then log "would copy    $label/$name"; copied=$((copied + 1)); continue; fi
      cp -R "$skill" "$target"; copied=$((copied + 1))
    fi
  done
  log "skills   $label: $copied new, $updated updated, $same unchanged"
}

if [ "$GLOBAL_SKILLS" -eq 1 ]; then
  if [ "$RUNTIME" = "claude" ] || [ "$RUNTIME" = "both" ]; then
    install_skills_to "${CLAUDE_HOME:-$HOME/.claude}/skills" "~/.claude/skills"
  fi
  if [ "$RUNTIME" = "codex" ] || [ "$RUNTIME" = "both" ]; then
    install_skills_to "${CODEX_HOME:-$HOME/.codex}/skills" "~/.codex/skills"
  fi
else
  log "skills   global copy skipped (pass --global-skills to also populate ~/.claude/skills, ~/.codex/skills)"
fi
if [ "$RUNTIME" = "claude" ] || [ "$RUNTIME" = "both" ]; then
  log "note     prefer the Claude Code plugin route when available:"
  log "         /plugin marketplace add thanhsmind/beegog  ->  /plugin install bee@bee"
  log "         (plugin route ships hooks automatically; this copy route wires repo hooks instead)"
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
if [ "$REPO_HOOKS" -eq 1 ]; then
  if [ "$RUNTIME" = "claude" ] || [ "$RUNTIME" = "both" ]; then
    ONBOARD_FLAGS+=("--repo-hooks")
  fi
fi
if [ "$NO_CLAUDE_MD" -eq 1 ]; then
  ONBOARD_FLAGS+=("--no-claude-md")
fi
if [ "$GLOBAL_SKILLS" -eq 1 ]; then
  ONBOARD_FLAGS+=("--global-skills")
fi

log "plan     onboard_bee.mjs ${ONBOARD_FLAGS[*]:-} (dry-run first)"
node "$ONBOARD" --repo-root "$TARGET_DIR" ${ONBOARD_FLAGS[@]+"${ONBOARD_FLAGS[@]}"} || fail "Onboarding plan failed."

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run  nothing written. Re-run without --dry-run to apply."
  exit 0
fi

confirm "Apply this onboarding plan to $TARGET_DIR?" || fail "Aborted — nothing applied."
node "$ONBOARD" --repo-root "$TARGET_DIR" --apply ${ONBOARD_FLAGS[@]+"${ONBOARD_FLAGS[@]}"} >/dev/null \
  || fail "Onboarding apply failed."

# ---------- verify ----------

STATUS="$(cd "$TARGET_DIR" && node .bee/bin/bee.mjs status --json 2>/dev/null)" \
  || fail "Verification failed: bee.mjs status did not run."
printf '%s' "$STATUS" | node -e '
  const s = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (!s.onboarding || s.onboarding.installed !== true) { console.error("bee.mjs status reports not installed"); process.exit(1); }
  console.log(`verify   onboarding ok (bee ${s.onboarding.bee_version}), phase: ${s.phase}`);
' || fail "Verification failed: unexpected bee.mjs status output."

log ""
log "bee installed."
log "  next: open an agent session in $TARGET_DIR"
log "  - Claude Code: the session preamble appears via hooks; or say \"Route this through bee: <task>\""
log "  - Codex: the AGENTS.md BEE block bootstraps; first step is bee.mjs status"
log "  - scout any time: node .bee/bin/bee.mjs status --json"
