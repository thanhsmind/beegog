---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# fanout-delegation — Plan

**Source of truth:** `docs/history/fanout-delegation/CONTEXT.md` (D1–D3, Gate 1 approved 2026-07-12 under gate_bypass).

## Mode Gate

Flags counted (mechanical): **3** → `standard`.

- **data model** — `.bee/config.json` schema loses the `advisor` key; `readConfig` shape changes.
- **existing covered behavior** — advisor has a 34-line test block (`test_lib.mjs:1099–1132`) and preamble/status surfacing; removal touches covered behavior.
- **multi-domain** — vendored libs + 10 skill files + docs/backlog + tests in one feature.

No hard-gate flag (no auth/security/external provider/data loss; `normalizeAdvisor` removal deletes a feature's config parsing, not input validation on a boundary). Smaller modes are insufficient: >3 files, story-sized behavior, two distinct workstreams (removal + new contract).

## Discovery

**L1** — everything is in-repo; no external research. Evidence gathered by two tiered I/O workers (dogfooding D2 during planning itself):

- Advisor removal inventory (extraction worker digest, 2026-07-12): 3 byte-identical twin pairs (`templates/lib/state.mjs` ↔ `.bee/bin/lib/state.mjs`; same for `lib/inject.mjs`, `bee_status.mjs`); `state.mjs` items at 87–90 (`ADVISOR_POINTS`), 94 (`DEFAULT_ADVISOR`), 96–108 (`normalizeAdvisor`), 147 (comment), 329 (`readConfig` field), 534–546 (`advisorModel`); `inject.mjs:125–130` preamble line; `bee_status.mjs:108,178–180`; `onboard_bee.mjs:96–99` DEFAULT_CONFIG; `test_lib.mjs:26–27` imports + 1099–1132 test block; `.bee/config.json` + `.bee/config-sample.json` advisor blocks; `routing-and-contracts.md:172–186`; `bee-swarming/SKILL.md:55`; `swarming-reference.md:50`; README 237/369/382; `docs/config-reference.md:40–56`; `docs/model-presets.md:88`; backlog P13.
- Gather-altitude mining (generation worker digest, 2026-07-12): per-skill GATHER/DECIDE split (folded into the Delegation Contract table below); the 5 existing "ad-hoc dispatches default to generation" lines (exploring:23, planning:45, scribing:20, grooming:70, xia:30); Chaining Contract table at `routing-and-contracts.md:96–110`, advisor section 172–186, next heading at 188.

## Approach

One slice, three cells. Chosen path: **delete advisor wholesale + write the delegation contract as prose** (per D2: no new hook; the model-guard + P22 dispatch log already enforce/audit tier transport on every Agent dispatch — reused unchanged).

Rejected alternatives:
- *New enforcement hook for the delegation threshold* — rejected by D2 (prose-ruled; thresholds misfire both directions).
- *Deprecate advisor behind a warning but keep code* — rejected by D1 (dead-but-kept code is the debt grooming hunts).
- *Per-skill bespoke delegation prose in each SKILL.md only* — rejected: the contract lives once in `routing-and-contracts.md`; each SKILL.md gets one pointer line, so future skills inherit it (memory: lean harness, knowledge over ceremony).

Risk map:

| Component | Risk | Proof needed |
|---|---|---|
| state.mjs advisor removal (twins + tests) | LOW | suite green after removal; grep 0 hits |
| Stale `advisor` key must warn, never error | MEDIUM | new test row: config with advisor key → readConfig succeeds + warning surfaced in onboard/status |
| Skill prose edits (10 files) | LOW | grep assertions per file |
| Lane-scaling v2 amendment (D3) wording | MEDIUM | cell reviewer cold-pickup; wording must not reopen the config-sample ceremony regression (decision d02a6bc6) |
| `.bee/config.json` advisor key removal | LOW | no CLI verb exists for config edits — file friction via `bee_backlog.mjs add`, then hand-edit per hive rule 11 |

### Delegation Contract (the content cells will install)

**Contract text** (one canonical section in `routing-and-contracts.md`, slotted after the Chaining Contract table, replacing the advisor section):

- The session model owns **decide-altitude**: gates, Socratic questions, mode gate, synthesis of findings, accept/reject of worker results, state writes, human conversation.
- **Gather-altitude** steps — multi-file reads, log/report/history mining, doc rendering from artifacts, repo scans — dispatch down-tier as **I/O workers** returning digests, when the step needs reading >3 files OR content the main model only needs as a digest (D2; orchestrator may override either way, same spirit as decision 0016).
- Applies in **every lane and every phase** (D3): tiny/small's "0 subagents" means zero *ceremony* subagents; I/O workers are exempt. A 1-file tiny fix never crosses the rubric, so it stays inline naturally.
- **Digest contract:** an I/O worker returns paths read, the facts extracted (with file:line anchors), and verbatim quotes only where asked; the orchestrator never re-reads what a digest already answers.
- **Transport unchanged:** anchored `[bee-tier: <tier>]` marker or `model` param (decision 0023), model name in the Agent description, background-dispatch where the runtime supports it (decision 0017), P22 dispatch log as the audit trail. I/O workers do **not** register in `bee_state.mjs worker add` (registry stays swarm-cell-scoped: reservations/status tracking are execution concerns; the dispatch log is the audit surface for gathers).

**Per-skill delegate/decide lines** (replace the 5 existing "default to generation" sentences; net-new in validating/swarming/reviewing/compounding/briefing/hive):

| Skill | Gather-altitude (delegate) | Tier |
|---|---|---|
| exploring | step 1 scope reads; step 3 gray-area scout digest | extraction / generation |
| planning | step 1 bootstrap (CONTEXT, patterns, decisions, learnings grep, status) | extraction |
| validating | orient reads (CONTEXT, plan, discovery, cells) | extraction |
| swarming | step 1 wave analysis (dep/overlap walk); verify-output capture (judgment stays) | extraction |
| reviewing | required-inputs gather; §3 evidence-gate mining; §4 artifact EXISTS/SUBSTANTIVE scan (WIRED + severity stay) | extraction / generation |
| scribing | §1 gather sources; §2 map deltas; §3 render sections; harvest inventory; §7 reading-map refresh | extraction / generation |
| compounding | §1 evidence gather; §8 digest refresh (analysts already tiered) | extraction |
| grooming | §1 entropy inputs; §2 mechanical debt scans (dead-code proof stays generation) | extraction / generation |
| briefing | section→source projection, walkthrough reconstruction | generation |
| xia | already the delegated researcher; internal step 1 ledger may sub-delegate | extraction |

**Rescue-ladder reword** (`bee-swarming/SKILL.md:55`): "Stronger tier — re-dispatch at the next model tier up (extraction → generation → ceiling); ceiling is the session model (decision 0015), so the top rung is handing the blocker back to the orchestrator itself with the worker's evidence attached." Advisor sentence deleted; `swarming-reference.md:50` trailing clause "or a called-only advisor (rescue ladder)" deleted.

## Cells (current slice — created after Gate 2)

1. **fanout-1 `advisor-code-removal`** (generation): state.mjs / inject.mjs / bee_status.mjs twins, onboard_bee.mjs DEFAULT_CONFIG, config-sample.json, test_lib.mjs (drop imports + block 1099–1132; add stale-key-warn row), stale-`advisor`-key warning in onboarding + bee_status (warn, never error — D1). Verify: full suite + `grep -ri advisor` clean in libs/templates (except the warn path).
2. **fanout-2 `delegation-contract-prose`** (generation): routing-and-contracts.md (advisor section → Delegation Contract section), 10 SKILL.md delegate/decide lines, rescue-ladder reword, bee-hive lane-table "0 ceremony subagents" amendment (D3). Verify: grep assertions (new lines present, advisor absent).
3. **fanout-3 `docs-and-ledger`** (extraction hint): README ×3, config-reference.md, model-presets.md:88, backlog P13 kill + P23 note, supersession notes in decisions 0013/0015 docs. Verify: grep assertions. (Reversal decision entry + `.bee/config.json` key removal are orchestrator-owned, not cell work.)

Dependency: none between 1/2/3 (disjoint files) — one wave.

## Test Matrix (lane-scaled sketch)

- config **without** advisor key → readConfig fine, no warning (new default path).
- config **with** stale advisor key → loads fine + warning in onboarding/status; never an error (D1).
- twins byte-equality sweep stays green (existing standing test).
- suite has zero references to `advisorModel`/`ADVISOR_POINTS` after removal.
- preamble/status render without the advisor line; tier_mix still renders.

## Open questions for validating

- Does anything else import `advisorModel`/`ADVISOR_POINTS`/`normalizeAdvisor` beyond the inventory (fresh grep at validate time)?
- Does removing the config key while hooks read config mid-session break the live session? (expectation: readConfig tolerates absence — prove with a probe).
