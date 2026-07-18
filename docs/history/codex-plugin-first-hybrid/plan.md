# codex-plugin-first-hybrid — plan (high-risk lane)

Fix GH #22 P0-1: codex plugin-first must never end skills-only. Decisions
D1-D5 in CONTEXT.md; anchors from the v1.6.0 gather.

## Mode gate

High-risk: installer/distribution path (public contract, cross-env), delivery
of the mechanical enforcement layer itself (a miss disables every guard), and
existing covered behavior (installer E2E suite). Advisor consult before Gate 3.

## Slice (2 cells, serialized cph-1 → cph-2)

### cph-1 — onboard_bee.mjs hybrid apply (behavior_change)
- `onboard_bee.mjs:3103`: stop hard-forcing `repoHooks=false` under
  `--plugin-source`. New shape: plugin-first keeps claude repo-local hook
  entries OFF (exclusive semantics, D5) but ALWAYS runs the codex hook
  projection when the install targets codex — vendored `.bee/bin/hooks/` +
  `mergeCodexHooks(.codex/hooks.json)` (the 2449-2480 block, split so the
  codex projection is separately reachable).
- Runtime knowledge: onboard_bee must know the selected runtime; add a
  `--runtime` passthrough flag (claude|codex|both, default both) — install.sh
  already owns the value (cph-2 wires it).
- D4 ordering inside apply: codex hook write happens before the skill-stage
  completion is reported; a hook-write failure surfaces as a typed blocked
  result for the whole apply (fail-closed), never a skills-only success.
- Tests (skills/bee-hive/scripts/test_onboard_bee.mjs): plugin-source+codex
  writes .codex/hooks.json + vendored hooks; plugin-source+claude-only does
  NOT write claude repo-local hook entries (unchanged exclusivity); sticky
  repo-hooks record no longer silently swallowed; injected hook-write failure
  → typed blocked, no skills-only end state.
- Verify: `node skills/bee-hive/scripts/test_onboard_bee.mjs && node skills/bee-hive/scripts/test_plugin_distribution.mjs && node scripts/test_lib_mirror.mjs`

### cph-2 — install.sh plumbing + E2E scenarios (behavior_change)
- `install.sh:220-225`: plugin-first branch also passes `--runtime "$RUNTIME"`
  (and keeps `--plugin-source`); repo-copy branch unchanged.
- `transition_plugin` ordering honors D4 (hook projection lands via the
  onboarding apply before/with the plugin transition; a refused apply aborts
  the transition path with the fail-closed message naming repo-copy/hybrid).
- E2E (scripts/test_installers_e2e.mjs, slots after test 12): (a)
  `--runtime codex --distribution plugin-first` → `.codex/hooks.json` present
  with required matchers + vendored hooks dir present + skills from plugin;
  (b) hook-write-impossible fixture (e.g. `.codex` path occupied by a file)
  → typed refusal, no skills-only end state; (c) claude plugin-first
  unchanged (regression guard on exclusivity).
- Doctor alignment spot-check inside (a): `bee doctor --runtime codex --json`
  reports `hooks_file_present: ok` post-install (trust rows stay blocking —
  matrix F1 — that is expected and asserted as such).
- Verify: `node scripts/test_installers_e2e.mjs --installer bash && node skills/bee-hive/scripts/test_onboard_bee.mjs`

## Files (union)
`skills/bee-hive/scripts/onboard_bee.mjs`, `scripts/install.sh`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`,
`scripts/test_installers_e2e.mjs`, mirrors of any touched template-side file
(onboard_bee.mjs lives in skills/bee-hive/scripts — check its projection
copies in .claude/.agents/.claude-plugin/.codex-plugin trees + manifest).

## Out of scope
install.ps1 parity (Windows E2E is its own deferred slice — file backlog row),
upstream codex plugin-hook capability, #22 items 3/6/7.

## Close-out
Full configured verify green; spec sync onboarding.md (hybrid carve-out, R12);
decision logging the B1 asymmetry resolution; comment on GH #22 scoping what
v1.6.0 already shipped + this fix; issue stays open for items 3/6/7 unless the
user says otherwise.
