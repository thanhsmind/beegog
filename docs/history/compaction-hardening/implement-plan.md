---
artifact_contract: bee-implement-plan/v1
feature: compaction-hardening
lane: high-risk
status: Approved
updated: 2026-07-23
sources:
  - docs/history/compaction-hardening/CONTEXT.md
  - docs/history/compaction-hardening/plan.md (revision 3)
  - .bee/cells/cz-1.json … cz-8.json
  - docs/history/compaction-hardening/reports/advisor-digest-gate3.md
  - docs/history/compaction-hardening/reports/validation-slice1.md
  - docs/history/compaction-hardening/reports/cz-1.md … cz-8.md
decisions: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27]
---

# Implementation Plan: Compaction Hardening

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the cell traces (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## Regenerated at close — why this note exists

This file was rendered once, from plan.md **revision 1**, at Gate 2, and was never
refreshed while planning re-shaped the work twice more: revision 2 (after Gate 3
validation returned six blocking findings — `reports/validation-slice1.md`) and
revision 3 (after D19 changed which component owns the intent anchor). At close it
still named cells **ch-1 … ch-6** (36 references), reported Gate 3 as "not yet", and
carried **D16's contract-test split as a HIGH risk** — a decision D19 retired outright
before any cell touched `hooks/test_hook_contracts.mjs` for that reason. The shipped
slice is eight cells, **cz-1 … cz-8**, strictly serial (D21).

The machine-facing artifacts stayed current throughout — `CONTEXT.md` gained D19-D27
with explicit supersession notes as each was decided, `plan.md` was frozen fresh at
revision 3, and every cell trace records its own real evidence. What lagged was this
one file, because nothing in the revision-2/revision-3 churn or in validating/swarming
calls `bee-briefing` again on its own — a brief renders at Gate 2 and refreshes only
when the chain calls render/refresh/walkthrough. This is the one artifact a human is
expected to read to understand the feature; a stale copy of it describing a plan that
never executed is worse than no artifact, so it is regenerated here from the eight
cell traces and the reports, at close.

## Review Status

| Gate | State |
|---|---|
| Gate 1 — decisions | ✅ approved 2026-07-23 (auto, `gate_bypass=total`) |
| Gate 2 — work shape | ✅ approved 2026-07-23 for revision 3 (auto, `gate_bypass=total`); `plan.md` frozen at revision 3 |
| Gate 3 — execution | ✅ approved 2026-07-23 (auto, `gate_bypass=total`); advisor consult required for high-risk at every bypass level ran twice (`reports/advisor-digest-gate3.md`) and both repairs it found (D23-D27 record gap; capsule dropping `handoffOutcome`) were applied before the gate fired |
| Gate 4 — review | not applicable — independent review is user-invoked only and was never requested for this change set. The feature is complete and **unreviewed**; nothing below should be read as "reviewed" or "approved for merge." |

All eight cells are capped with a recorded green verify; the full suite (`run_verify.mjs`)
last ran 89/89 green at cz-8 (wall 71.3s). `docs/knowledge/areas/hook-runtime` was synced
by scribing (`.bee/state.json` `last_scribing_run`).

## Goal

When a session gets compacted, it must come back holding the same objective, pointed
at the same unit of work, and told the truth about which runtime enforces what.

Four outcomes (D1-D27 in `CONTEXT.md`):

1. **The doctrine stops misinforming Codex sessions.** The guardrails sentence every
   session on every runtime reads said Codex enforcement is self-honored prose. It was
   the measured source of the recurring "bee prioritizes Claude Code" reading, and
   `.codex/hooks.json` (8 lifecycle events, onboarding-tracked) had made it false —
   without making full parity true, since hook *execution* on Codex is still
   unverified. (D1, D2, D22, D25)
2. **The intent anchor gets prompted, not merely offered.** ia-1 shipped the anchor
   and recorded its own gap: nothing ever asked an agent to write one. (D10, D11)
3. **Compactions become measurable.** Nothing recorded that a compaction happened, so
   nothing could notice a unit surviving several of them. (D4, D5, D9)
4. **Post-compaction orientation is sized for the moment.** `source=compact` received
   the full startup preamble; the hook keeps owning the anchor and a new capsule
   replaces the preamble body only. (D6, D7, D8, D19)

**Success:** a compacted session's first screen is the objective (rendered by the
hook, unchanged), then any state mismatch, then exactly the work state it needs — and
a Codex session reading the doctrine gets a statement that is true in both directions.

## Current State (as inspected during planning, before this feature)

- `skills/bee-hive/templates/lib/intent.mjs` held the anchor: disk-backed, immutable
  `request`/`acceptance`, code-built `precompactBlock`/`resumeBlock` renderers. It
  fired on PreCompact and led `SessionStart(compact|resume)`.
- `inject.mjs:300-471` `buildSessionPreamble` rendered one orientation for **every**
  `SessionStart` source. `:477-513` `buildPromptReminder` rendered the per-prompt line.
- `.bee/logs/` held `hooks.jsonl` (crash-only), `dispatch.jsonl`, `tools.jsonl`. No
  compaction record of any kind existed.
- `hooks/test_hook_contracts.mjs:2740-2780` asserted the anchor path was **strictly
  additive** over the full preamble, for `compact` **and** `resume` — the row this
  feature had to keep green, not replace (D19 made the once-planned D16 replacement
  unnecessary).
- The guardrails sentence lived at `skills/bee-hive/templates/AGENTS.block.md:80` and
  in five projections; the "six-hook"/"6-hook skeleton" claim was live in six more
  files, and `README.md:444` additionally claimed 7 Codex lifecycle events where the
  measured count is 8 (D22, D25).

## Scope

**In (shipped):** the four outcomes above; three CLI verbs (`state compact-log`,
`state compact-check`, `state compact-capsule`); one new library module
(`compaction.mjs`); three hooks rewired as thin callers; every live doctrine
stale-corner correction, not only the two lines first named (D22); one derived parity
gate (`test_doctrine_parity.mjs`) that knows four separate hook counts apart (D25); and
the full derived-artifact regeneration chain, widened to its measured trigger —
anything under `skills/**` or `hooks/**` (D24), not only `templates/lib/` (D20's
original, too-narrow scope).

**Out:**

- Any provider-native compaction transport — OpenAI Responses `compaction_trigger`,
  `previous_response_id` continuation, opaque-artifact replay, or a
  compaction-provider interface. **Declined, not deferred** (D14, decision `8ba804e6`,
  backlog row P74).
- Mechanically enforcing the ~65%-context handoff rule (backlog P72).
- A probe proving Codex actually executes `.codex/hooks.json` (backlog P73) — its
  absence is *why* D3's helper floor exists.
- Log rotation or size caps (no existing `.bee/logs/*.jsonl` file has one).

## Proposed Approach

One new domain module, two thin caller classes, and a surgical extraction — unchanged
in substance from revision 1's approach, with one structural correction that changed
what "the capsule" means (D19).

`skills/bee-hive/templates/lib/compaction.mjs` owns everything durable and rendered:
the log append and counting, the integrity sweep, the survival warning, the
anchor-missing predicate, and the capsule builder. Hooks and CLI verbs are two thin
caller classes over it (D3) — which is what makes the feature reachable on a runtime
that never executes a hook.

`inject.mjs` does **not** host the capsule, but three of its line renderers are shared
with it: the onboarding-MISSING line, the gate-bypass banner, and the HANDOFF block
(including the `- Adoption not applied:` reason line, D26/D27). They are **extracted**
into exported helpers both builders call, proven byte-identical against a committed
golden rather than a `git show HEAD:` reconstruction (which would pass at cap and
decay to a tautology for every later cell).

**The anchor is never duplicated and never moved.** `hooks/bee-session-init.mjs`'s
`intentLeadBlock`/`ANCHOR_LEAD_SOURCES` keep prefixing the anchor on `compact` exactly
as before this feature; the capsule is the **body only** — D6 items 2-12 (D19). This
supersedes revision 1's D6 item 1, which read as "the capsule renders the anchor," and
retires D16's contract-test split entirely: since the hook's `controlOut` is itself a
capsule, the additivity row at `hooks/test_hook_contracts.mjs:2740-2780` stays green
**untouched**.

**Alternatives rejected** (carried from revision 1's approach, unchanged by revision 3):
capsule logic inside `inject.mjs` (makes D8's byte-identity a claim about a file that
changed everywhere, instead of a module boundary); duplicating the three renderers (two
copies of one truth — and a drifting HANDOFF heading would silently break two further
compact-source assertions); inline log writes in each hook (contradicts D3, unreachable
by command on a runtime that never executes a hook); deferring all mirror/manifest
refreshes to one final cell (inverts capping-requires-green-verify for every cell
before it — PAT37's fifth recurrence, which is exactly what revision 1 would have done).

## Technical Design

*Authored from `CONTEXT.md` + `plan.md` + the eight cell traces; nothing here
originates a decision.*

**Data.** One append-only file, `.bee/logs/compaction.jsonl`, gitignored like the rest
of `.bee/logs/`. Each record: `{ts, event, session, lane, feature, phase, cell,
compact_index, cell_compact_count, anchor_present}`. Two event kinds — `precompact`
(written as the compaction begins) and `resume` (written when the session comes back).
**Only `precompact` records are counted, and only a `precompact` counts itself** — a
`resume` carries forward the counts its `precompact` recorded. `compaction.mjs`'s
`readCompactionCounts` implements this as a row filter over the log
(`if (record.event !== 'precompact') continue`), never a read of any stored index, so
the rule is structural rather than merely tested — confirmed by an adversarial probe at
cap time (cz-3's semantic judge) and by a deliberate mutation of the increment
expression that was run, observed red, and reverted.

**Control flow, PreCompact.** `bee-session-close.mjs` appends the `precompact` record,
asks the module for a survival warning (non-null once `cell_compact_count >= 2`), and
forces the anchor nudge past its 30-minute dedup — PreCompact is the last moment the
objective can still be captured verbatim (D11). All three ride the existing advisory
path: `emitHookOutput` → `systemMessage`. **Never `encodeBlock`.** The B2/R14 contract
(`hooks/bee-session-close.mjs:234-238`) forbids a turn-control verdict on compaction; cz-7's
suite proves this against four inputs with a positive control (the same fixture DOES
block on `Stop`), so the guarantee is demonstrated, not merely asserted.

**Control flow, SessionStart.** On `source=compact` only, `bee-session-init.mjs`
appends the `resume` record and passes `buildCompactCapsule(root, {sessionId,
handoffOutcome})` instead of `buildSessionPreamble` to the hook's output — carrying
through the `handoffOutcome` the hook already computes at its handoff-adoption check
(D27; the parameter's absence at the call site, not the renderer, was the gap D26
alone left open). The capsule renders eleven items in fixed order: STATE MISMATCH (when
`compactCheck` fails) → onboarding-MISSING → HANDOFF block (with the
`- Adoption not applied:` line when applicable) → bypass banner → phase/mode/feature/lane
(the `- Phase:` label unchanged, so the ordering check at
`hooks/test_hook_contracts.mjs:2762` stays meaningful) → claimed cell with its verify
command and dependency status → first open gate → next action → recorded commands →
survival count and D9 warning → critical-patterns pointer. `startup`, `clear` and
`resume` keep `buildSessionPreamble` byte for byte — proven against a committed golden
(`scripts/fixtures/preamble-golden.txt`), not a live reconstruction. **No capsule byte
varies with anchor presence:** `compaction.mjs`'s `CAPSULE_MUTED_CHECKS = new
Set(['anchor'])` filters `compactCheck`'s own "an anchor exists" check out of the
STATE MISMATCH rendering before it renders, proven by paired renders of the same repo
before/after `.bee/intent/` is written — for both a clean sweep and a failing one.

**The sweep.** `state compact-check` is pure read. It confirms the session record and
its stored id, resolves the lane binding while *surfacing* `LANE_INVALID` /
`LANE_MISSING` / `LANE_CORRUPT` rather than swallowing them, and checks claim
ownership, the execution gate, dependency caps, reservation holds, and anchor
presence. Session-less reservation rows are legacy intra-swarm rows and are reported
`unbound`, never as a mismatch. It mutates nothing — proven by hashing the whole
`.bee/` tree across two consecutive runs, not by comparing stdout.

**Failure posture.** Every new write is fail-open with a local try/catch: a log
failure never changes a caller's return value or exit code — proven both in-process
(an `EISDIR` planted at the log path) and out-of-process (a child process whose only
work is the failing append still exits 0). Every new read is fail-safe: absent anchor,
absent log, absent claim, absent config each render as nothing rather than as an error.

**API / contract.** Three verbs, following `state.handoff.write`'s registry shape
(D3): `state compact-log --event <precompact|resume> --session-id <id> [--json]`
(appends the record, returns the counts); `state compact-check --session-id <id>
[--json]` (renders the D12 sweep; exits non-zero only on a usage error, never on a
detected mismatch); `state compact-capsule --session-id <id>` (renders the capsule to
stdout). `compact-check`'s JSON output carries an `anchor_missing` check naming the
same command the D10 nudge would name, which is how the nudge stays reachable by
command on a runtime that never executes a hook.

## Security & Permissions

*Mandatory section for the high-risk lane. Corrected below where the shipped shape
differs from revision 1's guess.*

- **What the new log contains:** timestamps, a session id, lane/feature/cell names,
  phase, and three integers. No file contents, no command output, no credentials, no
  user prose.
- **Where it lives:** `.bee/logs/compaction.jsonl`. `.bee/logs/` is gitignored, so the
  new record never enters version control.
- **The anchor's verbatim user text is never touched by this feature.** Revision 1
  guessed the capsule would re-render it; D19 corrected that — the hook prefixes the
  anchor exactly as it did before this feature, on `compact` and `resume` alike, and
  the capsule is proven (by paired renders) to never carry an anchor-correlated byte.
  The anchor's content, rendering and destination are entirely ia-1's existing code,
  unmodified.
- **Privileges:** no new network calls, no new external services, no new credentials,
  no new file reads outside `.bee/`. The sweep is read-only by decision (D13) and by
  the verb's contract — proven by a tree-hash negative control across two consecutive
  `compact-check` runs.
- **Blast radius of the new verbs:** `state compact-log` appends one line;
  `state compact-capsule` and `state compact-check` write nothing at all.

## Affected Files

*Projected from the eight cells' declared `files`, source files only — each
lib/hook/doctrine-touching cell also refreshes its own `.bee/bin/` mirror, the four
rendered plugin-skill trees, and the release manifest/onboarding ledger in the same
cell per D24; those regenerated artifacts are omitted below for readability.*

| Cell | Source files | Purpose |
|---|---|---|
| cz-1 | `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`, `docs/02-architecture.md`, `docs/06-runtime-integration.md`, `docs/01-distillation.md`, `docs/05-roadmap.md`, `docs/decisions/0002-scribing-skill.md`, `README.md`, `INSTALL.md`, `docs/07-contracts.md` | Doctrine sentence rewrite + every live stale hook-count corner (D1/D2/D22/D25) |
| cz-2 | `scripts/test_doctrine_parity.mjs` (new) | The derived doctrine parity gate (D22/D25) |
| cz-3 | `skills/bee-hive/templates/lib/compaction.mjs` (new), `scripts/test_compaction_module.mjs` (new) | The shared module: log, counts, sweep, warning, anchor predicate (D3/D4/D5/D9/D10/D12/D13) |
| cz-4 | `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `scripts/test_compact_verbs.mjs` (new) | Two verbs: `compact-log`, `compact-check` |
| cz-5 | `skills/bee-hive/templates/lib/inject.mjs`, `skills/bee-hive/templates/lib/compaction.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `scripts/test_compact_capsule.mjs` (new), `scripts/fixtures/preamble-golden.txt` (new) | Renderer extraction, `buildCompactCapsule`, the `compact-capsule` verb, the committed golden |
| cz-6 | `hooks/bee-session-init.mjs`, `scripts/test_compact_capsule.mjs` (extended) | `SessionStart` compact branch, passing `handoffOutcome` (D27) |
| cz-7 | `hooks/bee-session-close.mjs`, `hooks/bee-prompt-context.mjs`, `hooks/test_hook_contracts.mjs`, `scripts/test_compaction_advisories.mjs` (new) | PreCompact warning + forced nudge; UserPromptSubmit deduped nudge; the D23 split of the PreCompact additivity row |
| cz-8 | *(none — confirmation only)* | Confirms the derived-artifact chain and the full verify; found zero stale diffs |

**Every source edit lands in `skills/bee-hive/templates/…` or `hooks/`, never in
`.bee/bin/` (D17).** `.bee/bin/` is a byte-identical projection refreshed by
onboarding in the same cell that touches its source; a hand-edit there is silently
reverted by the next render.

## Implementation Steps

Strictly serial (D21) — `cz-1 → cz-2 → cz-3 → cz-4 → cz-5 → cz-6 → cz-7 → cz-8`, all
eight capped with a recorded green verify.

- [x] **cz-1 — doctrine truth, all live corners.** Rewrites the guardrails sentence in
  the canonical template; corrects every live stale hook-count corner, not only the
  two first named (D1/D2/D22); runs the D24 regen chain. `AGENTS.md` stayed inside its
  20480-byte hard budget (measured 19467B).
- [x] **cz-2 — the doctrine gate.** Authors `scripts/test_doctrine_parity.mjs`: scan
  set derived from `git ls-files`, four hook counts derived independently (9 scripts /
  8 Codex events / 7 Claude events / 6 toggles), `--selftest` demonstrating both bite
  conditions on fixture roots.
- [x] **cz-3 — the shared module.** `compaction.mjs`: append + counting, sweep,
  survival warning, anchor-missing predicate. 25 checks, red-first against the absent
  module, re-proven biting via a counting-rule mutation probe.
- [x] **cz-4 — the two verbs.** `compact-log` and `compact-check` registered, thin
  callers over cz-3; `compact-capsule` deliberately **not** registered here (its
  builder does not exist until cz-5, and the registry-coverage gate is unconditional).
- [x] **cz-5 — the capsule.** Three `inject.mjs` renderers extracted and proven
  byte-identical against a committed golden; `buildCompactCapsule` added, with the
  anchor-independence proof (STEP 4b) inside this cell rather than deferred to a suite
  that does not yet exercise it; `compact-capsule` registered.
- [x] **cz-6 — the hook takes the branch.** `SessionStart` emits the capsule on
  `source=compact` only, carrying `handoffOutcome` through (D27); `intentLeadBlock`
  untouched (D19); `hooks/test_hook_contracts.mjs` green with zero edits.
- [x] **cz-7 — the advisory surfaces.** PreCompact warning + forced nudge;
  UserPromptSubmit deduped nudge; splits the one existing assertion D23 identified
  (`hooks/test_hook_contracts.mjs:2692-2712`) into two byte-exact rows, never weakened
  to a substring match.
- [x] **cz-8 — close the chain.** Confirms (does not repair) the derived-artifact
  chain; runs the full suite. 89/89 green, wall 71.3s (up from the 84-suite, 63.6s
  baseline — the feature added five suites).

## Validation Plan

*Real recorded evidence — every row below has run. Full output lives in each cell's
`trace.verify_output` (`.bee/cells/cz-*.json`) and in `docs/history/compaction-hardening/reports/cz-*.md`.*

| Cell | Verify command (as recorded) | Result |
|---|---|---|
| cz-1 | `node scripts/test_agents_budget.mjs && node scripts/release_manifest.mjs --check && node scripts/run_verify.mjs` | Green. 4 budget checks pass (19467B / 20480B); manifest 480 files match; full verify 84 suites green, 63.5s. One unrelated flake (`test_store_lock` case c under concurrency=5) reproduced clean in isolation and on re-run — filed as friction, not a fix-first cell. |
| cz-2 | `node scripts/test_doctrine_parity.mjs --selftest && node scripts/test_doctrine_parity.mjs` | Green. `--selftest` demonstrated both bite conditions (retired sentence in root `AGENTS.md`; a false "six scripts" claim against the derived 9). Main run: 0 live copies of the retired sentence across 6 doctrine files; 23 count claims agree with their derived quantity. |
| cz-3 | `node scripts/test_compaction_module.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check && node scripts/ledger_parity.mjs --check` | Green, 25/25. Red-failure evidence recorded twice: absent-module red, then a deliberate counting-rule mutation (`resume` incrementing inclusively) reproduced as one failing row before being reverted. Semantic judge: PASS on all 6 checks. |
| cz-4 | `node scripts/test_compact_verbs.mjs && node scripts/test_conformance.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/release_manifest.mjs --check && node scripts/ledger_parity.mjs --check` | Green, 7/7 + 10/10 + 248/248. `compact-capsule` confirmed absent from the shipped registry until cz-5 (`--help --json \| grep -c compact-capsule` → 0). Semantic judge: PASS on all 6 checks. |
| cz-5 | `node scripts/test_compact_capsule.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check && node scripts/ledger_parity.mjs --check` | Green, 11/11; hook contracts 193/193 rows, **zero edits**; `test_bee_cli` 250/250. Semantic judge independently re-ran the full chain and re-derived the golden's pre-extraction baseline (`git diff a4ed971 HEAD` on the golden is empty). Two attempts before this one were destroyed by a concurrent session's force-unclaim + merge (backlog, P1 `coordination`, filed twice) — recovered from artifacts preserved under `.bee/tmp/cz-5/`. |
| cz-6 | `node scripts/test_compact_capsule.mjs && node hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` | Green, 14/14 (11 inherited + 3 through-the-hook); hook contracts 193/193, **zero edits**. Red-failure evidence recorded against the un-wired hook first (`12 passed, 2 failed`), including a discriminating fix to the handoff row after its first draft passed red for the wrong reason (`buildSessionPreamble` also renders the adoption line). |
| cz-7 | `node scripts/test_compaction_advisories.mjs && node hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` | Green, 7/7; hook contracts 194 rows (net +1 from the D23 split), 0 failing. Red-failure evidence recorded twice: the new suite against un-wired hooks (`3 passed, 4 failed`), and the un-split contract row against wired hooks (predicted failure, exactly one row red, as D23 said it would). |
| cz-8 | `node scripts/run_verify.mjs` | Green, **89/89 suites**, wall 71.3s. Derived-artifact chain confirmed with zero diffs beyond `onboarding.json`'s expected `updated_at` churn; `.bee/bin/bee.mjs` matches its source byte for byte (sha256 `5d07617d…`). |

**Gate 3 advisor consult** (required for high-risk at every bypass level): ran twice
against revision 3 and the eight cells (`reports/advisor-digest-gate3.md`). The
initial consult found one record-of-truth gap (D23-D27 existed only in
`.bee/decisions.jsonl`, not yet in `CONTEXT.md`) and one genuine contract hole (the
capsule dropped `handoffOutcome` at the call site — D26 protected the renderer, not
the caller). Both were repaired before the gate fired. The confirming consult, run
after the repairs, found one further gap the repairs themselves had opened — the
anchor-independence must-have had no named mechanism and could not have been caught
inside cz-5 as originally scoped — and that became cz-5's STEP 4b.

**Semantic judges** ran on every `behavior_change` cell except cz-8 (cz-3 through
cz-7): five PASS verdicts, `confidence: high`, covering counting-rule structure,
read-only sweep proof, typed lane-code surfacing, anchor-independence, golden
provenance, and the D23 split's discrimination. One judge finding was filed as friction
rather than fixed in-cell: four rendered `test_bee_cli.mjs` projections read by the
frozen judge as undeclared test-source edits are pure `render_plugin_skill_trees.mjs`
output (confirmed byte-identical via `diff -q`), a declaration gap in cell `files`
lists, not a test rewrite.

## Risks & Mitigation

*From `plan.md` revision 3's risk map, with the materialized outcome recorded for
each — including the two risks no cell listed.*

| Risk | Level (final) | Outcome |
|---|---|---|
| `inject.mjs` renderer extraction | MEDIUM (revision 1 rated it HIGH; measured feasible before cz-5 was claimed) | Shipped: three renderers extracted, proven byte-identical against a committed golden. `hooks/test_hook_contracts.mjs` green with zero edits. |
| D16 contract-test split | **RETIRED** (revision 1 rated it HIGH) | D19 kept the hook owning the anchor, so `hooks/test_hook_contracts.mjs:2740-2780` never needed its assertion replaced — no test surgery landed. |
| The PreCompact additivity row changes (D23) | MEDIUM, materialized as predicted | cz-7 split `hooks/test_hook_contracts.mjs:2692-2712` into two byte-exact rows; red-proved against the un-wired hooks first; never weakened to a substring match. |
| Capsule drops `handoffOutcome` at the call site | Not in any cell's original risk list — found by the Gate 3 advisor consult | D27 added; cz-5 and cz-6 each gained an asserting test row before capping. |
| No named mechanism for anchor-independence | Not in any cell's original risk list — found by the advisor's confirming consult, after the first repair | cz-5's action gained STEP 4b: a paired-render byte-equality proof, including a failing-sweep pair, so the gap could not surface only at cz-6 (whose files exclude `compaction.mjs`). |
| Off-by-one in the counting rule | MEDIUM, closed | cz-3 drives two full compaction cycles and includes a deliberate mutation probe, reproduced red, then reverted. |
| Derived-artifact chain left stale (PAT37, recurring) | LOW, closed on its 5th recurrence — but the trigger itself was mis-scoped first | D20's `templates/lib/`-only trigger was measured wrong; `release_manifest.mjs` hashes `skills/**` and `hooks/**` in full. D24 widened it; cz-8 confirmed zero stale diffs. |
| Doctrine correction drifting again | LOW, closed | cz-2's gate derives all four hook counts and its own scan set; `--selftest` demonstrated both failure modes. |
| The doctrine gate's bare-count disambiguation is prose-shaped inside a mechanical check | LOW, accepted (not repaired) | Advisor: right shape overall, but telling a true "six toggles" from a false "six scripts" rests on surrounding-prose heuristics — a recorded future maintenance cost. |
| Same-checkout coordination — not in any cell's risk list | **Realized once, P1** | A concurrent session force-unclaimed cz-5 mid-flight; its merge destroyed roughly ten minutes of verified-green work (backlog, `coordination`, filed twice). The isolated-worktree fallback then proved undriveable — a dispatched worker inherits the parent session's working directory, so entering the worktree did not re-anchor write-guard resolution — and cz-5 finished in the main checkout after the owner confirmed no other session would write (`.bee/state.json` summary; backlog P1 `hooks`, "bee-write-guard enforces cross-worktree containment for Edit/Write but not for relative Bash targets"). |

## Rollback Plan

**Primary — revert by cell, in reverse dependency order.** Each cell is one commit
carrying its cell id. D21's strictly-serial schedule chains every cell's `deps` back
through the one before it (`cz-2→cz-1`, `cz-3→cz-2`, … `cz-8→cz-7`), so the mechanically
complete revert set is `cz-8 → cz-7 → cz-6 → cz-5 → cz-4 → cz-3 → cz-2 → cz-1`.

In practice the functional coupling is tighter in the middle of the chain than the
schedule alone implies: `cz-6`'s hook calls `buildCompactCapsule` (`cz-5`), `cz-5`'s
capsule calls `compaction.mjs` (`cz-3`), and `cz-7`'s advisories also call
`compaction.mjs` and split a test row that only makes sense with `cz-3`/`cz-6` present
— reverting any one of `cz-3` through `cz-7` requires reverting everything after it in
the same operation. `cz-1` (doctrine text + gate) is the loosest link: nothing among
`cz-3`-`cz-8` calls into it, so it is revertible on its own — only `cz-2`'s own gate
goes red, since it asserts against the corrected doctrine `cz-1` wrote.

**A revert is not complete until the derived-artifact chain is re-run.** Reverting
source files leaves `.bee/bin/` mirrors, the four projection trees, the release
manifest and the onboarding hash ledger describing code that no longer exists — PAT37
in the reverse direction. After any revert: `node scripts/render_plugin_skill_trees.mjs`,
then `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply`, then
`node scripts/release_manifest.mjs --write`, then `node scripts/run_verify.mjs` green.

**Partial rollback without a revert.** The behavior is fail-open throughout: deleting
`.bee/logs/compaction.jsonl` resets the counters harmlessly, and a repo with no anchor
sees no nudge and no warning. Because D19 kept the anchor entirely on the hook's
existing, unmodified code path, there is no anchor-rendering behavior this feature
could break by being disabled. The one shape change that cannot be disabled without a
full revert is the `source=compact` capsule replacing the full preamble — see Open
Questions.

**Blast radius if it goes wrong:** orientation text and one advisory log. No user
data, no external system, no migration, nothing irreversible. The realistic worst case
is a session that reads a worse first screen after a compaction.

## Open Questions

1. ~~Feasibility of the `inject.mjs` extraction~~ — **RESOLVED.** Measured MEDIUM, not
   HIGH; shipped in cz-5, proven byte-identical against a committed golden.
2. ~~Lane-bound resolution~~ — **RESOLVED.** `compaction.mjs` calls
   `resolvePipeline(root, {sessionId})` with the id throughout, matching
   `buildPromptReminder`'s v1.11.1 fix; a lane-bound-session row proves the record
   carries the lane's own feature/phase (cz-3).
3. ~~`.bee/logs/` existence at PreCompact time~~ — **RESOLVED.** Routed through
   `fsutil.appendJsonl` (calls `ensureDir`); an `EISDIR` probe in cz-3 proves the
   failure mode is fail-open.
4. **No per-feature kill switch exists, and none was decided — still open.** bee's
   hooks are config-gated individually in `.bee/config.json`, but disabling
   `bee-session-init` removes *all* orientation, not just the capsule. Whether a
   narrower `hooks.compaction` toggle should exist was never resolved by any locked
   decision and no cell added one. If the human wants it, it flows back through
   `bee-planning` as a new D-ID.

No other blocking open questions. Ready for the record.
