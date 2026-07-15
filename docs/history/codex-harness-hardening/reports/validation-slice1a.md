# Validation report — codex-harness-hardening, Slice 1a (Foundational guards)

**Lane:** standard · **Verdict:** READY · **Date:** 2026-07-15 · **Gate 3:** auto-approved via bypass (standard, no hard-gate)

## Reality gate
| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | standard (public-contract + cross-platform + multi-domain = 3 flags, no hard-gate); additive guards, no runtime-logic change |
| REPO FIT | PASS | 15 lib files each side, **currently byte-identical** (mirror test green now); tuple all 0.1.44 (tuple test green now); readdirSync pattern + version-line formats confirmed |
| ASSUMPTIONS | PASS | config.json editable (proven Slice 0); manifest scope = release-identity-critical set (phased per open-Q1) |
| SMALLER PATH | PASS | 2 disjoint cells; tuple+mirror combined (shared config.json write) so they don't serialize |
| PROOF SURFACE | PASS | both guards green now + self-tests prove the bite |

## Review (review/opus) — STRUCTURALLY CLEAN, no BLOCKER; 4 WARNINGs fixed
- Verify false-pass check: **CLEAN** — the Slice 0 pipe-masking failure did not recur (pure `&&` chains).
- FIXED 1a-2: file-wide `grep -q` → `node -e` asserting both scripts inside the `commands.verify` field value.
- FIXED 1a-1: `role` vocabulary now enumerated (source_lib / runtime_lib / plugin_manifest).
- FIXED 1a-1: negative proof baked into a `--selftest` subcommand in the verify string (was manual).
- Noted (accepted): 1a-2 tuple is a phased subset of DIST-05 (no git tag / projections yet) — expands in a later slice; dep-disjointness, parallel safety, scope fencing all sound.

## Verdict
READY. Both guards preserve the green baseline (repo is synced at 0.1.44) and exist to catch future desync/mirror-drift. No source-resolution/status logic touched (that is Slice 1b). Gate 3 auto-approved under gate_bypass per user direction to honor bypass for standard sub-slices.
