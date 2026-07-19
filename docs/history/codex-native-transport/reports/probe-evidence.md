# Probe evidence — codex-native-transport (V1–V3, D3/D4)

Cell: cnt-5. Source of truth for locked decisions: `CONTEXT.md` (D1–D9, E1–E6).
Method and machinery: `scripts/canary_codex.mjs --probe` / `--probe-selftest`.
Prior spike (folded, superseded where noted below by fresher live evidence):
`.bee/spikes/codex-native-transport/probe-v1v3.md`.

Every observation below is version-scoped (D3): a verdict recorded on one
`codex --version` is never assumed to hold on another. Two distinct live runs
sit in this report, on two different builds, and they disagree — which is
itself the headline finding.

---

## Run A — spike, codex-cli 0.144.4 (folded from probe-v1v3.md)

**V1 (override acceptance): CONFIRMED-YES.** With `multi_agent_v2` force-enabled
inside an isolated `CODEX_HOME`, three of four live `spawn_agent` calls
carrying `model="gpt-5.6-sol"`, `reasoning_effort="low"`, `fork_turns="none"`,
`agent_type="worker"` were accepted by codex's router with no catalog
refusal. The live, ground-truth `SpawnAgentArgs` serde whitelist is
`{message, task_name, agent_type, model, reasoning_effort, service_tier,
fork_turns, fork_context}`; `task_name` accepts only lowercase/digits/
underscores (a hyphenated value was rejected before override fields were
even reached).

**V2 (config.toml syntax): CONFIRMED.** Six variants tried; winning/simplest
form is `[features]\nmulti_agent_v2 = true`, equivalently `--enable
multi_agent_v2`. `hide_spawn_agent_metadata` must be set inside the **nested
table** `[features.multi_agent_v2]` alongside an explicit `enabled = true` —
the nested table *without* `enabled` does not flip the flag.

**V3 (PreToolUse envelope): UNOBSERVED — a real gap, not a guess.** A
hand-rolled single-hook `.codex/hooks.json` (`PreToolUse` matcher
`spawn_agent` only, no other bee scaffolding) never fired despite three
successful override spawns in the same run, despite `--dangerously-bypass-
hook-trust` being confirmed active, and despite adding an "invoked" marker
file as the hook's first line. Root cause left open, with a named follow-up:
re-run through a fixture built by `onboard_bee.mjs --apply --repo-hooks`
(the full onboarded chain), mirroring the method that DID observe a
`spawn_agent` PreToolUse fire in the `codex-native-runtime-v2` capability
spike (`docs/history/codex-native-runtime-v2/reports/capability-matrix.md`,
row D1).

---

## Run B — this cell, codex-cli 0.144.6, `node scripts/canary_codex.mjs --probe`

Live run, `2026-07-19T04:54:33.118Z`. Method upgrade over Run A per the
follow-up above: fixture built via `onboard_bee.mjs --apply --repo-hooks`
(same `buildFixture()` the P1–P5 canary suite already uses), with a capture
hook **prepended** into the fixture's own `.codex/hooks.json`
`PreToolUse`/`spawn_agent` group — ahead of the real installed
`bee-model-guard.mjs` entry, never replacing it, so the exact installed
chain still runs unmodified after it. Isolation (D4): a per-run `mktemp`
`CODEX_HOME` seeded with a read-only copy of `auth.json` plus the unlock
TOML; the real `CODEX_HOME/config.toml` was snapshotted before and confirmed
byte-identical after (`isolation_ok: true` — verified independently post-run:
`md5sum ~/.codex/config.toml` unchanged, zero `multi_agent_v2` occurrences).

**Deviation found and fixed while building this leg:** the initial
`nativeTransportUnlockToml()` combined a flat `[features]\nmulti_agent_v2 =
true` scalar *and* a nested `[features.multi_agent_v2]` table in the same
document — invalid TOML (a key cannot be both a boolean value and a table).
`codex debug models` failed outright with `Error: config.toml:8:11: duplicate
key` the first time this leg ran for real. Fixed to the nested-table-alone
form (V2's confirmed `v2d` variant, which flips `multi_agent_v2` to `true`
on its own — the flat line was both broken and redundant). `--probe-
selftest` gained a regression assertion against the same shape
(`scripts/canary_codex.mjs`, `runProbeSelftest`).

**Live `codex features list` inside the isolated home:** `multi_agent` =
stable/true (unchanged from 0.144.4), `multi_agent_v2` = under
development/**true** (successfully force-enabled, confirming V2 still holds
on 0.144.6).

**V1 re-run on 0.144.6: REFUSED — different from 0.144.4.** With
`hide_spawn_agent_metadata=false` set (required to expose the override
fields to the model per E1), **every** turn in the isolated home — including
a plain "reply with the single word: canary" turn with no `spawn_agent`
attempt at all — fails immediately with an API-level 400:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Invalid Value: 'tools'. Function 'collaboration.spawn_agent' is reserved for use by this model and must match the configured schema.",
    "param": "tools"
  },
  "status": 400
}
```

Isolated confirmation (two separate live turns, both under
`multi_agent_v2=true`): a turn with `hide_spawn_agent_metadata` left at its
default (`true`, hidden) completes normally (`turn.completed`, model replies
"canary"); the identical turn with `hide_spawn_agent_metadata=false` fails
with the exact error above. The failure is therefore attributable to
`hide_spawn_agent_metadata=false` itself — the account's currently-selected
model rejects the *tool schema advertisement*, not the override call
content — and reproduces independent of what (if anything) the model is
asked to do with `spawn_agent`. `override_spawn_accepted: false`.

**V3 re-run on 0.144.6: UNOBSERVED — a third, distinct outcome, not a repeat
of Run A's gap.** Because the turn itself is rejected server-side before the
model can attempt any tool call, `spawn_agent` is never invoked at all, so
the installed `PreToolUse` chain (including the prepended capture hook) is
never exercised — `hook_invoked: false`, `envelope_count: 0`,
`override_fields_observed: false`. This is honestly different from Run A's
finding ("hook never fired despite a successful call reaching the
tool-execution stage") and does not resolve Run A's open root-cause
question about the hand-rolled-hooks-vs-onboarded-chain divergence — it
answers a version-gated precondition failure instead. Whether the onboarded
chain's `spawn_agent` `PreToolUse` fires on a call that actually reaches
tool execution remains open pending a codex build where `hide_spawn_agent_
metadata=false` is again accepted by the API.

**Classification:** `native_budget_only` (per D3a: `multi_agent_v2=true`
alone is insufficient without `override_spawn_accepted=true`) — this is the
honest, evidence-driven outcome; either answer was always a valid green
(CONTEXT D3, plan.md V1/V3).

**Machine record:** `.bee/native-transport-probe.json` (gitignored,
`schema: native-transport-probe/1`), written by `writeNativeTransportProbe`
(`.bee/bin/bee.mjs`). Because the real host `CODEX_HOME` was never touched
(D4), the record's `multi_agent_v2: true` config-scope entry will correctly
fail `readNativeTransportClassification`'s live re-check (`flag_state_
changed`) against the real, un-elevated host — the record stays inert
exactly as designed, and this was independently confirmed by inspection
rather than assumed.

---

## Reading Run A vs Run B together

The two runs are ~two patch versions apart (0.144.4 → 0.144.6) and disagree
on V1. This is direct, observed confirmation of D3's premise — "verdict is
version+config-scoped... nothing may be assumed from version strings
alone" — rather than a contradiction to reconcile: **an override surface
proven live on one build fully regressed by the next patch release**, with
no changelog signal available to bee. This is exactly the scenario
`readNativeTransportClassification`'s version-check validity leg
(`version_changed` reason, `cnt-2`) exists to catch, and this run is live
proof that leg is load-bearing, not defensive-programming boilerplate.

## Open follow-up (not this cell's scope)

Re-run V3 specifically once a codex build accepts `hide_spawn_agent_
metadata=false` again (or find the config path this account's model
actually authorizes it under) — only then does a real `spawn_agent` call
reach tool execution and let the onboarded-chain `PreToolUse` hook fire for
real, closing Run A's still-open root-cause question about the hand-rolled
vs. onboarded hook-discovery divergence.
