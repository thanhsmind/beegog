#!/usr/bin/env bash
# SPIKE (codex-parity-6c re-plan): prove an OUTERMOST-marker POSIX walk closes the
# both-markers spoof that nearest-ancestor resolution leaves open, without breaking
# the legit-root and no-root cases. Disposable; never becomes production code.
#
# Threat model: an untrusted agent may write under GATE_ALLOWED_PREFIXES
# (.spikes/, docs/, plans/) — all INSIDE the repo, therefore always BELOW the real
# root. Nearest-ancestor picks the planted (deeper) root; outermost picks the real
# (shallower) root. We test both walks against the same fixtures.
set -u
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT

# --- the two candidate transports, as pure POSIX shell strings ---
# resolve_nearest: walk up, return FIRST dir with both markers (current adapter behavior)
# resolve_outermost: walk up, return LAST (highest) dir with both markers (proposed)
read -r -d '' NEAREST <<'SH'
d="$PWD"
r=""
while [ -n "$d" ]; do
  if [ -f "$d/.bee/onboarding.json" ] && [ -f "$d/hooks/bee-write-guard.mjs" ]; then r="$d"; break; fi
  [ "$d" = "/" ] && break
  d="${d%/*}"; [ -z "$d" ] && d="/"
done
printf '%s' "$r"
SH
read -r -d '' OUTERMOST <<'SH'
d="$PWD"
r=""
while [ -n "$d" ]; do
  if [ -f "$d/.bee/onboarding.json" ] && [ -f "$d/hooks/bee-write-guard.mjs" ]; then r="$d"; fi
  [ "$d" = "/" ] && break
  d="${d%/*}"; [ -z "$d" ] && d="/"
done
printf '%s' "$r"
SH

# marker guard stand-ins: real guard denies a gated write (exit 2); spoof allows (exit 0)
mkroot() { # $1=dir  $2=real|spoof
  mkdir -p "$1/.bee" "$1/hooks"
  : > "$1/.bee/onboarding.json"
  if [ "$2" = real ]; then
    printf '#!/bin/sh\necho "real guard: DENY" >&2\nexit 2\n' > "$1/hooks/bee-write-guard.mjs"
  else
    printf '#!/bin/sh\necho "SPOOF guard: allow" >&2\nexit 0\n' > "$1/hooks/bee-write-guard.mjs"
  fi
  chmod +x "$1/hooks/bee-write-guard.mjs"
}

# transport under test: resolve root by $walk, then run its guard (or fail closed)
run_transport() {  # $1=walk-src  $2=cwd
  ( cd "$2" || exit 99
    r="$(bash -c "$1")"
    [ -n "$r" ] && [ -f "$r/hooks/bee-write-guard.mjs" ] || { echo "no bee root — refusing" >&2; exit 2; }
    sh "$r/hooks/bee-write-guard.mjs" )
  echo $?
}

REAL="$SB/repo"
mkroot "$REAL" real
# attacker plants a full both-markers spoof under an allowlisted prefix, cwd nested in it
SPOOF="$REAL/.spikes/scratch"
mkroot "$SPOOF" spoof
DEEP="$SPOOF/vendor/pkg"; mkdir -p "$DEEP"
# arm 5: a tree with no bee root at all
NOROOT="$SB/elsewhere/sub"; mkdir -p "$NOROOT"

echo "case                                  | nearest | outermost | want"
echo "--------------------------------------+---------+-----------+-----"
printf "legit: cwd at real root               |   %s     |    %s      |  2\n"  "$(run_transport "$NEAREST" "$REAL")"  "$(run_transport "$OUTERMOST" "$REAL")"
printf "SPOOF: cwd in .spikes both-markers    |   %s     |    %s      |  2\n"  "$(run_transport "$NEAREST" "$DEEP")"  "$(run_transport "$OUTERMOST" "$DEEP")"
printf "no-root: cwd outside any bee root     |   %s     |    %s      |  2\n"  "$(run_transport "$NEAREST" "$NOROOT")" "$(run_transport "$OUTERMOST" "$NOROOT")"
echo
echo "want=2 means DENY (fail closed / real guard). nearest=0 on the SPOOF row is the bypass."
