---
feature: compaction-hardening
lane: high-risk
status: Ready for Review
rendered: 2026-07-23
sources:
  - docs/history/compaction-hardening/CONTEXT.md
  - docs/history/compaction-hardening/plan.md
  - cells ch-1 … ch-6
---

# Compaction Hardening — Implement Plan

## Review Status

| Gate | State |
|---|---|
| Gate 1 — decisions | ✅ approved 2026-07-23 (auto, `gate_bypass=total`) |
| Gate 2 — work shape | ✅ approved 2026-07-23 (auto, `gate_bypass=total`); `plan.md` frozen and stamped |
| Gate 3 — execution | ⏳ not yet — validating runs next |
| Gate 4 — review | not applicable; independent review is user-invoked only |

## Goal

When a session gets compacted, it must come back holding the same objective, pointed
at the same unit of work, and told the truth about which runtime enforces what.

Four outcomes (D1-D18 in `CONTEXT.md`):

1. **The doctrine stops misinforming Codex sessions.** The one sentence every session
   on every runtime reads still says Codex enforcement is self-honored prose. It is
   the measured source of the recurring "bee prioritizes Claude Code" reading, and
   `.codex/hooks.json` (8 lifecycle events, onboarding-tracked) has made it false —
   without making full parity true, since hook *execution* on Codex is still
   unverified. (D1, D2)
2. **The intent anchor gets prompted, not merely offered.** ia-1 shipped the anchor
   and recorded its own gap: nothing ever asks an agent to write one. (D10, D11)
3. **Compactions become measurable.** Nothing today records that a compaction
   happened, so nothing can notice a unit surviving several of them. (D4, D5, D9)
4. **Post-compaction orientation is sized for the moment.** Today `source=compact`
   receives the full startup preamble. (D6, D7, D8)

**Success:** a compacted session's first screen is the objective, then any state
mismatch, then exactly the work state it needs — and a Codex session reading the
doctrine gets a statement that is true in both directions.

## Current State

- `skills/bee-hive/templates/lib/intent.mjs` holds the anchor: disk-backed, immutable
  `request`/`acceptance`, code-built `precompactBlock`/`resumeBlock`. It fires on
  PreCompact and leads `SessionStart(compact|resume)`.
- `inject.mjs:300-471` `buildSessionPreamble` renders one orientation for **every**
  `SessionStart` source. `:477-513` `buildPromptReminder` renders the per-prompt line.
- `.bee/logs/` holds `hooks.jsonl` (crash-only), `dispatch.jsonl`, `tools.jsonl`. No
  compaction record of any kind exists.
- `hooks/test_hook_contracts.mjs:2740-2780` asserts the anchor path is **strictly
  additive** over the full preamble, for `compact` **and** `resume`.
- The guardrails sentence lives at `skills/bee-hive/templates/AGENTS.block.md:80` and
  in five projections; `README.md:444` additionally claims 7 Codex lifecycle events
  where the real count is 8.

## Scope

**In:** the four outcomes above, their three CLI verbs, one new library module, three
wired hooks, one contract-test split, five doc corrections, one derived parity gate,
and the full derived-artifact regeneration chain.

**Out:**

- Any provider-native compaction transport — OpenAI Responses `compaction_trigger`,
  `previous_response_id` continuation, opaque-artifact replay, or a compaction-provider
  interface. **Declined, not deferred** (D14, decision `8ba804e6`, backlog P74).
- Mechanically enforcing the ~65%-context handoff rule (backlog P72).
- A probe proving Codex actually executes `.codex/hooks.json` (backlog P73) — its
  absence is *why* D3's helper floor exists.
- Log rotation or size caps (backlog-adjacent; no existing `.bee/logs/` file has one).

## Proposed Approach

One new domain module, two thin caller classes, and a surgical extraction.

`skills/bee-hive/templates/lib/compaction.mjs` owns everything durable and everything
rendered: the log append and counting, the integrity sweep, the survival warning, the
anchor-missing predicate, and the capsule builder. Hooks and CLI verbs are two thin
caller classes over it (D3) — which is what makes the feature reachable on a runtime
that never executes a hook.

`inject.mjs` does **not** host the capsule, but three of its line renderers must be
shared with it: the onboarding-MISSING line (`:319`), the gate-bypass banner (`:344`),
and the HANDOFF block (`:376`). They are **extracted** into exported helpers both
builders call.

**Alternatives rejected** (from `plan.md`): capsule inside `inject.mjs` (makes D8's
byte-identity a claim about a file that changed everywhere, instead of a module
boundary); duplicating the three renderers (two copies of one truth — and a drifting
HANDOFF heading silently breaks two further compact-source assertions); inline log
writes in each hook (contradicts D3, unreachable by command); deferring all mirror
refreshes to one final cell (inverts capping-requires-green-verify for every cell
before it).

## Technical Design

*Authored from `CONTEXT.md` + `plan.md` + the cells; nothing here originates a
decision.*

**Data.** One append-only file, `.bee/logs/compaction.jsonl`, gitignored like the rest
of `.bee/logs/`. Each record: `{ts, event, session, lane, feature, phase, cell,
compact_index, cell_compact_count, anchor_present}`. Two event kinds — `precompact`
(written as the compaction begins) and `resume` (written when the session comes back).
The asymmetry is deliberate: a `precompact` with no matching `resume` is a session
that never returned, which is itself a signal. **Only `precompact` records are
counted, and only a `precompact` counts itself** — a `resume` carries forward the
counts its `precompact` recorded. Counting a `resume` inclusively would make one
compaction read as two and fire the oversize advisory a full cycle early.

**Control flow, PreCompact.** `bee-session-close.mjs` appends the `precompact` record,
asks the module for a survival warning (non-null once `cell_compact_count >= 2`), and
forces the anchor nudge past its 30-minute dedup — PreCompact is the last moment the
objective can still be captured verbatim. All three ride the existing advisory path:
`emitHookOutput` → `systemMessage`. **Never `encodeBlock`.** The B2/R14 contract
(`hooks/bee-session-close.mjs:234-238`) forbids a turn-control verdict on compaction,
so a blocking design is unimplementable here, not merely unwanted.

**Control flow, SessionStart.** On `source=compact` only, `bee-session-init.mjs`
appends the `resume` record and emits the capsule instead of the preamble. Twelve
items in fixed order: anchor → state mismatch → onboarding-MISSING → HANDOFF →
bypass banner → phase/mode/feature/lane → claimed cell with its verify command and
dependency status → first open gate → next action → recorded commands → survival
count and warning → critical-patterns pointer. `startup`, `clear` and `resume` are
untouched, byte for byte. Handoff **adoption** logic is untouched; only its *display*
is re-rendered in the capsule.

State resolution goes through `resolvePipeline` **with the session id**, exactly as
`buildPromptReminder` was corrected in v1.11.1. A lane-bound session that reads the
default `state.json` is the precise defect that release fixed; reintroducing it here
would recreate a loop driver at the worst possible moment.

**The sweep.** `state compact-check` is pure read. It confirms the session record and
its stored id, resolves the lane binding while *surfacing* `LANE_INVALID` /
`LANE_MISSING` / `LANE_CORRUPT` rather than swallowing them, and checks claim
ownership, the execution gate, dependency caps, reservation holds, and anchor
presence. Session-less reservation rows are legacy intra-swarm rows and are reported
`unbound`, never as a mismatch. On failure it reports and asserts one rule — *disk
state overrides conversational recollection* — and repairs nothing. Auto-repair after
a compaction would act on the least trustworthy thing in the room: the model's memory
of what it was doing.

**Failure posture.** Every new write is fail-open with a local try/catch: a log
failure never changes a caller's return value or exit code. Every new read is
fail-safe: absent anchor, absent log, absent claim, absent config each render as
nothing rather than as an error.

## Security & Permissions

*Mandatory section for the high-risk lane.*

- **What the new log contains:** timestamps, a session id, lane/feature/cell names,
  phase, and three integers. No file contents, no command output, no credentials, no
  user prose.
- **Where it lives:** `.bee/logs/compaction.jsonl`. `.bee/logs/` is gitignored
  (`.gitignore:5`), so the new record never enters version control.
- **The anchor's verbatim user text** is re-rendered by the capsule. This is ia-1's
  existing behavior on `compact`/`resume`, unchanged in content and destination — the
  capsule changes what surrounds it, never what it contains or where it goes.
- **Privileges:** no new network calls, no new external services, no new credentials,
  no new file reads outside `.bee/`. The sweep is read-only by decision (D13) and by
  the verb's contract.
- **Blast radius of the new verbs:** `state compact-log` appends one line;
  `state compact-capsule` and `state compact-check` write nothing at all.

## Affected Files

*Projected from the cells, not from prose.*

| Cell | Files |
|---|---|
| ch-1 | `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`, `docs/02-architecture.md`, `README.md`, `docs/07-contracts.md`, `scripts/test_doctrine_parity.mjs` |
| ch-2 | `skills/bee-hive/templates/lib/compaction.mjs`, `.bee/bin/lib/compaction.mjs`, `scripts/test_compaction_module.mjs` |
| ch-3 | `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/lib/command-registry.mjs`, `.bee/bin/bee.mjs`, `scripts/test_compact_verbs.mjs` |
| ch-4 | `skills/bee-hive/templates/lib/inject.mjs`, `skills/bee-hive/templates/lib/compaction.mjs`, `.bee/bin/lib/inject.mjs`, `.bee/bin/lib/compaction.mjs` |
| ch-5 | `hooks/bee-session-init.mjs`, `hooks/bee-session-close.mjs`, `hooks/bee-prompt-context.mjs`, `hooks/test_hook_contracts.mjs`, + the three `.bee/bin/hooks/` mirrors |
| ch-6 | `.bee/onboarding.json`, `.bee/bin/lib/compaction.mjs`, `.bee/bin/bee.mjs` (+ regenerated plugin trees and release manifest) |

**Every source edit lands in `skills/bee-hive/templates/…` or `hooks/`, never in
`.bee/bin/` (D17).** `.bee/bin/` is a byte-identical projection refreshed by
onboarding; an edit made there is silently reverted by the next render.

## Implementation Steps

Dependency order — `ch-1` and `ch-2` are independent and may run in parallel.

```
ch-1 ─────────────────────────────────────────────┐
ch-2 ──┬── ch-3                                    ├── ch-6
       └── ch-4 ── ch-5 ─────────────────────────┘
```

1. **ch-1 — doctrine truth + a derived gate.** Rewrite the guardrails sentence in the
   canonical template; correct five stale doc corners; run **both** render paths
   (`node scripts/render_plugin_skill_trees.mjs` for the two plugin trees, and
   `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply` for
   `.claude/skills`, `.agents/skills` and root `AGENTS.md`); author
   `scripts/test_doctrine_parity.mjs`, which derives its file list by glob and its
   event count from `.codex/hooks.json`.
2. **ch-2 — the shared module.** Append + counting, sweep, survival warning,
   anchor-missing predicate. Mirror refreshed in-cell.
3. **ch-3 — the three verbs.** Registry entries, handlers, dispatch map; `bee.mjs`
   mirror refreshed in-cell *before* verify.
4. **ch-4 — extraction + capsule.** Three renderers extracted in `inject.mjs`;
   `buildCompactCapsule` added to the module.
5. **ch-5 — hook wiring + the contract-test split.** Three hooks become thin callers;
   the `compact`/`resume` assertion is split.
6. **ch-6 — the derived-artifact chain.** Mirror → plugin render → release manifest →
   self-onboard hash ledger, then the full verify recorded verbatim.

## Validation Plan

*Describes what will be checked. No result is asserted — nothing has run.*

| Cell | Verify command |
|---|---|
| ch-1 | `node scripts/test_doctrine_parity.mjs` |
| ch-2 | `node scripts/test_compaction_module.mjs && node scripts/test_lib_mirror.mjs` |
| ch-3 | `node scripts/test_compact_verbs.mjs && node scripts/test_conformance.mjs` |
| ch-4 | `node hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs` |
| ch-5 | `node hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs` |
| ch-6 | `node scripts/run_verify.mjs` (full suite, ~30-32s parallel) |

The full test matrix — absent/empty, first run, boundary counts, ordering, corrupt
input, IO failure, idempotence, cross-runtime, concurrency, verbatim preservation,
negative control, config absent — is in `plan.md`. Two rows carry the most weight:
the **negative control** (a deliberately broken capsule must not leave the
`resume`/`startup`/`clear` assertions passing) and the **boundary count** (the
oversize advisory must fire on the second compaction, never the first).

Every `behavior_change` cell (ch-2 through ch-5) additionally owes
`red_failure_evidence` at cap time — the authoring judge already flagged ch-4 and
ch-5 for it. A test that has never been seen failing has not been shown to bite.

## Risks & Mitigation

| Risk | Level | Mitigation |
|---|---|---|
| **`inject.mjs` renderer extraction** — no precedent anywhere in the repo for a second orientation builder beside `buildSessionPreamble`; the extraction must leave its output byte-identical for `startup`, `clear` and `resume` | **HIGH** | The existing hook-contract rows for those three sources are the negative control and must stay green **untouched**. Validating must confirm the extraction is feasible before ch-4 is claimed. |
| **The D16 contract-test split** — the `compact` branch must also replace the ordering check at `hooks/test_hook_contracts.mjs:2762`, because `indexOf` returns `-1` on a renamed label and a naive port would pass or fail for the wrong reason | **HIGH** | Validating must see the *replacement* assertion, not merely the old one's absence. Two further compact-source assertions (`:2427-2455`, `:2854-2883`) must stay green, proving the HANDOFF heading stayed verbatim. |
| Three new CLI verbs | MEDIUM | Registry `examples` are executed contract; every bare boolean must reach `FLAG_ALONE_BOOLEANS` (`docs/history/learnings/20260712-dispatcher-unify.md`). |
| Off-by-one in the counting rule | MEDIUM | A test drives two full compaction cycles and asserts the threshold fires on the second. |
| Sweep swallowing a typed lane refusal | MEDIUM | Explicit prohibition in ch-2; the corrupt-lane row is in the matrix. |
| Derived-artifact chain left stale | LOW but **recurred 4×** | PAT37 (`docs/knowledge/patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md`). Each cell refreshes its own mirror; ch-6 owns the full chain. |
| Doctrine correction drifting again | LOW | ch-1's parity gate derives its ground truth — it fails if prose and `.codex/hooks.json` disagree. |

## Rollback Plan

**Primary — revert by cell, in reverse dependency order.** Each cell is one commit
carrying its cell id, so the revert set is `ch-6 → ch-5 → ch-4 → ch-3 → ch-2` and
`ch-1` independently. Reverting `ch-4` without `ch-5` is invalid — `ch-5`'s hooks call
a builder `ch-4` introduces — so those two revert together or not at all. `ch-1` is
freely revertible on its own.

**A revert is not complete until the derived-artifact chain is re-run.** Reverting
source files leaves `.bee/bin/` mirrors, the four projection trees, the release
manifest and the onboarding hash ledger describing code that no longer exists — PAT37
in the reverse direction, and the same failure the feature's own ch-6 exists to
prevent. After any revert: `node scripts/render_plugin_skill_trees.mjs`, the manifest
step, then `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply`, then
`node scripts/run_verify.mjs` green.

**Partial rollback without a revert.** The behavior is fail-open throughout: deleting
`.bee/logs/compaction.jsonl` resets the counters harmlessly, and a repo with no anchor
sees no nudge and no warning. The one shape change that cannot be disabled without a
revert is the `source=compact` capsule — see the Open Question below.

**Blast radius if it goes wrong:** orientation text and one advisory log. No user
data, no external system, no migration, nothing irreversible. The realistic worst case
is a session that reads a worse first screen after a compaction.

## Open Questions

1. **Feasibility of the extraction (for validating).** Can the three `inject.mjs`
   renderers be extracted with `buildSessionPreamble`'s output byte-identical for all
   non-`compact` sources? This is the HIGH risk row and it gates ch-4.
2. **Lane-bound resolution (for validating).** The capsule must call `resolvePipeline`
   with the session id, as `buildPromptReminder` does since v1.11.1. Expected, but it
   must be *proven* — getting it wrong reproduces the loop bug that release fixed.
3. **`.bee/logs/` existence at PreCompact time.** `appendJsonl` calls `ensureDir`; the
   hook-tier inline writers do not. Which the module uses must be settled before ch-2
   caps.
4. **No per-feature kill switch exists, and none was decided.** bee's hooks are
   config-gated individually in `.bee/config.json`, but disabling `bee-session-init`
   removes *all* orientation, not just the capsule. Whether a narrower
   `hooks.compaction` toggle should exist is **not decided** — it is not in any locked
   decision and briefing does not originate one. If the human wants it, it flows back
   through `bee-planning` as a new D-ID.
