# codex-plugin-first-hybrid — CONTEXT (locked decisions)

GitHub issue #22, P0 item 1 — the most serious remaining gap after v1.6.0:
`--runtime codex --distribution plugin-first` can end with plugin skills
installed but NO hooks, because codex-cli 0.144.4 has no working plugin-hook
mechanism (capability matrix row F1) while the codex plugin manifest packages
only `"skills"`. Result: a repo that LOOKS onboarded but has zero mechanical
enforcement — exactly the "unblocked write is not an approved write" trap at
install time.

Items 2/4/5 of #22 already shipped in v1.6.0 (bee doctor, AGENTS.md
budget+dedupe, automatable conformance subset) — out of scope here. Items 3,
6, 7 (dispatch prepare CLI, economics split, tiny A/B) are separate features.

## In scope

1. **Hybrid Codex distribution** (the issue's preferred option): codex
   plugin-first = skills from the plugin, AGENTS.md + bee.mjs from onboarding,
   and `.codex/hooks.json` + hook scripts STILL installed repo-local.
2. **Fail-closed fallback**: where the hybrid hook install cannot happen, the
   installer refuses loudly naming repo-copy/hybrid — never a skills-only
   "success".
3. **E2E scenario** in the installer suite: codex plugin-first → repo-local
   hooks present OR typed refusal; a skills-only end state is a test failure.
4. Doctor alignment: the states this feature creates must map onto
   `bee doctor --runtime codex` rows (hooks file presence, drift, readiness).

## Out of scope

- Codex plugin-hook support itself (upstream capability, matrix F1).
- Dispatch-prepare CLI (#22 P0-3), economics attribution (#22 P1-6), tiny A/B
  (#22 P1-7) — later features.
- Claude-runtime distribution paths — untouched.

## Locked decisions

- **D1 — hybrid is the paved road, not an option flag.** On codex,
  plugin-first ALWAYS behaves hybrid: hooks ride repo-local in the same
  apply. No new user-facing mode name; the existing `plugin-first` flag just
  stops lying on codex. (Fail-closed refusal only where the hook write is
  impossible.)
- **D2 — never skills-only.** Any codex path that would end with skills
  installed and no repo-local hooks must end in a typed refusal instead,
  naming the fix (repo-copy or hybrid retry). E2E-proven.
- **D3 — doctor is the acceptance oracle.** After a hybrid install, `bee
  doctor --runtime codex` must report hooks file present + baseline match;
  after a refused install, doctor must NOT report ready. The E2E asserts via
  doctor rows where practical.
- **D4-REVISED (advisor R2) — three achievable guarantees replace the naive
  ordering:** (a) hooks are written before the distribution cleanup pass runs;
  (b) the cleanup pass must NOT strip the codex hook entries under hybrid;
  (c) a hook-write failure fails the onboarding apply, which rolls back the
  just-installed plugin (`handle_transition_failure` → `rollback_plugin`).
  The plugin transition itself runs before onboarding by necessity
  (plugin-first onboarding depends on the installed package) — do not reorder.
- **D5 (amended, advisor R1) — hybrid is runtime-scoped to codex, and the
  distribution cleanup must not strip `.codex/hooks.json` bee entries under
  codex hybrid.** Claude plugin-first keeps its exclusive semantics untouched
  (claude repo-local hook entries still stripped). The codex projection is a
  HOISTED, separately-gated path (`pluginSource && runtime∈{codex,both}`),
  never a widened `repoHooks` (advisor R4). It fires from the passed
  `--runtime`, never from recorded state (upgrade path — old installs carry no
  runtime record).
- **D6 — typed blocked path for the hook write (advisor R3).** The codex-hook
  apply failure surfaces as a typed blocked result naming repo-copy/hybrid
  retry (mirroring `skillSync.blocked`), not an untyped thrown error. If the
  managed set gains the codex hooks file, that inclusion is gated on
  `runtime∈{codex,both} && pluginSource` so claude-only installs never report
  codex drift (advisor R5).

## Reality anchors (gather, v1.6.0)

- `install.sh:220-225`: `--plugin-source` and `--repo-hooks` mutually
  exclusive by construction; plugin-first never passes `--repo-hooks`.
- `onboard_bee.mjs:3103`: `repoHooks: args.pluginSource ? false : ...` —
  plugin-first hard-forces hooks off, overriding even a sticky record.
- Hook-writing block `onboard_bee.mjs:2449-2480` (codex projection
  `mergeCodexHooks` at 2470-2479) — skipped entirely under plugin-first.
- `.codex-plugin/plugin.json:17`: manifest packages `"skills"` only; no
  `hooks` key exists.
- Capability matrix B1 (line 25): `plugin_hooks = removed/false` on codex-cli
  0.144.4 — plugin-bundled hooks are not a working mechanism regardless of
  manifest shape; B2/B3 unknown; D6 verdict "repo-local .codex/hooks.json
  stays authoritative".
- E2E `test_installers_e2e.mjs` test 12 (~:480-502): plugin-first runs with
  default runtime (both), never asserts `.codex/hooks.json` state, no test
  passes `--runtime codex`.
- Doctor rows already detect the bad state: `hooks_file_present`
  (`bee.mjs:2497-2505`) and `hook_sources` (`bee.mjs:2605-2617`) — the
  acceptance oracle for D3.
- Spec text to update at scribing: `docs/specs/onboarding.md:84` (exclusive
  modes), `:191-194` (plugin-first removes hook entries), `:378-382` (R12) —
  all currently state exclusivity with no codex carve-out.

## Acceptance

- Fresh temp repo, codex plugin-first install → `.codex/hooks.json` + hook
  scripts exist repo-local, skills resolve from the plugin tree, doctor rows
  green (except the structurally-unknown trust rows, which stay blocking per
  matrix F1).
- Hook-write-impossible fixture → typed refusal, zero skills installed.
- Full configured verify green; installer E2E extended, not weakened.
