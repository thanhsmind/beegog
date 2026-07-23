# Validation — compaction-hardening, slice 1 (ch-1 … ch-6)

**Lane:** high-risk · **Gate 2:** approved 2026-07-23 (plan frozen) · **Gate 3:** pending
**Status:** in progress — persona panel (coherence / feasibility / scope-guardian) and
cold-pickup cell review outstanding. No verdict is recorded until they return.

## Reality Gate

| Dimension | Score | Evidence |
|---|---|---|
| **MODE FIT** | PENDING | Claimed 5 flags (public contracts, cross-platform, changes-behavior-an-existing-test-asserts, replaces-existing-proof, multi-domain), no hard-gate flag → high-risk. The scope-guardian lens is independently auditing this count, specifically whether "public contracts" (an internal `docs/07-contracts.md`) and "cross-platform" (restating dual-runtime support) are padding. If the honest count falls under 4, the lane is over-ceremonied and the slice returns to planning for a lane correction. |
| **REPO FIT** | PASS | Every path and line anchor in `CONTEXT.md` was independently verified twice against the source copy (not the mirror): `inject.mjs:319/:344/:376/:516-535`, `state.mjs:1224-1260/:1655`, `claims.mjs:168-201/:297-319`, `reservations.mjs:92-98`, `bee-session-close.mjs:201-225/:227-256/:234-238/:413-415`, `adapter.mjs:355-372`, `command-registry.mjs:877-905`, `bee.mjs:4992-4994`, `onboard_bee.mjs:474/:2635/:2690`, `test_lib_mirror.mjs:16-20`, `onboarding.json:43,44,48,51`. `node scripts/test_lib_mirror.mjs` was run during review: green, 28 lib + 10 hook files byte-identical. |
| **ASSUMPTIONS** | PENDING | Five blocking assumptions are in the feasibility matrix below; four are being measured by the feasibility lens now. None may be accepted on plausibility. |
| **SMALLER PATH** | PENDING | Six cells across four waves for a feature whose runtime effect is orientation text plus one advisory log. The scope-guardian lens is checking both directions — ceremony inflation and half-implemented decisions. |
| **PROOF SURFACE** | PASS | Every cell carries a runnable `verify`. Three name test files the cell itself authors (legitimate); the cold-pickup review is checking whether such a verify could pass trivially. Cells ch-2…ch-5 are `behavior_change: true` and owe red-failure evidence at cap time — the authoring judge already flagged ch-4 and ch-5 for it. |

## Schedule (required evidence for a multi-cell slice)

`node .bee/bin/bee.mjs cells schedule --feature compaction-hardening --json`:

```json
{
  "waves": [["ch-1","ch-2"],["ch-3","ch-4"],["ch-5"],["ch-6"]],
  "diagnostics": { "cycles": [], "unsatisfiable_deps": [], "empty_files": [] }
}
```

**Zero cycles, zero unsatisfiable deps, zero empty file lists. Four waves**, matching
the dependency graph in `implement-plan.md`. Wave 1 (`ch-1`, `ch-2`) is genuinely
parallel — disjoint file sets, no shared path.

## Feasibility Matrix

| # | Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|---|
| 1 | The three `inject.mjs` renderers can be extracted with `buildSessionPreamble` byte-identical for `startup`/`clear`/`resume` | **HIGH** — no precedent in the repo for a second orientation builder | Read the actual code at `inject.mjs:300-400`; state whether the blocks are self-contained or depend on local mutable state / inline-computed variables | feasibility lens, in flight | PENDING |
| 2 | The D16 test split can replace the ordering check at `test_hook_contracts.mjs:2762` rather than port it | **HIGH** — `indexOf` returns `-1` on a renamed label, so a naive port passes or fails for the wrong reason | The replacement assertion must be exhibited, not merely the old one's absence | feasibility + coherence lenses, in flight | PENDING |
| 3 | The capsule must call `resolvePipeline` **with** the session id | MEDIUM — getting it wrong reproduces the v1.11.1 loop driver | Quote today's resolve call in both `buildSessionPreamble` and `buildPromptReminder`; name which the capsule must copy | feasibility lens, in flight | PENDING |
| 4 | `.bee/logs/` exists at PreCompact time, or the append must create it | MEDIUM — a bare `fs.appendFileSync` would throw ENOENT on a fresh repo | Find where `.bee/logs/` is created; decide `appendJsonl` (has `ensureDir`) vs the hook-tier inline pattern (does not) | feasibility lens, in flight | PENDING |
| 5 | The release-manifest step named in PAT37's chain exists and has a runnable command | MEDIUM — ch-6 depends on it and its action currently says "find it" | Quote the script and its invocation | feasibility lens, in flight | PENDING |
| 6 | The current tree's verify baseline is green | **BLOCKING if red** — never build on red | Run `run_verify.mjs` and the three suites the cells reuse; report exit status | feasibility lens, in flight | PENDING |

## Panel & Review (high-risk lane)

| Lens | Scope | State |
|---|---|---|
| Coherence | decision coverage D1-D18, cross-artifact and cell-to-cell contradiction, key links, prohibition conflicts | in flight |
| Feasibility | the six matrix rows above, run as measurements | in flight |
| Scope-guardian | ceremony inflation (the 5-flag count), scope creep past the D-IDs, and under-scope (half-implemented decisions) | in flight |
| Cold-pickup cell review | can a stranger execute each cell with no session history | in flight |

Security lens was not dispatched: the diff of concerns carries no auth, no
authorization, no data-loss surface, no external provider and no new credential path
(see the implement plan's Security & Permissions section). Recorded as a deliberate
panel-composition choice, not an omission.

## Advisor Consult

Required before Gate 3 on a high-risk lane at **every** bypass level (AO2b/AO3) — the
bypass lifts the human checkpoint, never this mechanical precondition. Not yet run:
the evidence bundle must carry the panel's validation findings, which are outstanding.

## Panel Findings (3 of 4 lenses returned)

**Coherence: 3 BLOCKER / 9 WARNING. Scope-guardian: 3 BLOCKER / 2 WARNING (lane
upheld). Cold-pickup: CRITICAL on ch-1, ch-3, ch-4, ch-5, ch-6.** Deduped, the
blocking set is six findings. Each was re-measured by the orchestrator before being
accepted — none is taken on the reviewer's word.

### B1 — The slice builds four cells on a red baseline. PAT37's fifth recurrence.

`scripts/run_verify.mjs:56-64` runs `release_manifest.mjs --check` and
`ledger_parity.mjs --check` as EXTRA_SUITES. `release_manifest.mjs:3-8` hashes
`skills/bee-hive/templates/lib/*.mjs` and `.bee/bin/lib/*.mjs`;
`ledger_parity.mjs:44-45` exits 1 when "no unrecorded `.mjs` sits in the managed lib
dir" is violated. **The moment ch-2 creates `compaction.mjs`, both go red repo-wide**
— and ch-2's verify (`test_compaction_module.mjs && test_lib_mirror.mjs`) touches
neither. ch-3, ch-4 and ch-5 then each cap green against a red shared baseline until
ch-6 regenerates.

PAT37's recorded fix direction, verbatim: *"any lib-touching cell's verify carries all
three regen/checks explicitly."* `plan.md:73-74` cites PAT37 and then routes the whole
chain to ch-6 anyway. D18 does not defend this — it locks the mirror copy and the
final onboarding, never a deferred manifest. This also collides with AGENTS.md
critical rule 16: any session claiming ch-3/4/5 runs the baseline gate, finds red, and
owes a fix-first cell.

### B2 — Registering `state compact-capsule` in ch-3 makes the repo red until ch-4.

`skills/bee-hive/templates/tests/test_bee_cli.mjs:2558` asserts *every* registry entry
had its example executed — unconditional over the whole registry, and the suite sits
in a `run_verify` discovery root. `buildCompactCapsule` is ch-4's artifact; ch-3's
`deps` is `["ch-2"]`. ch-3's own escape hatch ("let this cell's test cover only the log
and check verbs") does not survive that gate, and ch-3's must-have "every registry
example actually executes successfully" is unsatisfiable as sequenced.

### B3 — ch-4 is `behavior_change: true` with a verify that cannot go red for it.

ch-4 authors no test. `hooks/test_hook_contracts.mjs` never calls
`buildCompactCapsule`, so ch-4's verify passes identically whether the capsule is
correct, returns `""`, or throws. Three of its four must-have truths are unprovable,
and the red-failure evidence the authoring judge demanded does not exist.

### B4 — The anchor would render twice on `source=compact`.

`hooks/bee-session-init.mjs:44` (`ANCHOR_LEAD_SOURCES = new Set(["compact","resume"])`)
already prepends the anchor, and `:148-150` joins it ahead of the preamble. D6 item 1
puts the anchor *inside* the capsule; ch-5 says only "emit the capsule instead of
`buildSessionPreamble`", leaving `intentLeadBlock` untouched. Result: anchor + (anchor
+ capsule). Both ch-5's "anchor-first" must-have and the D16 replacement assertion
still pass on a duplicate, since `startsWith("## INTENT ANCHOR")` holds either way.

### B5 — ch-1's derived gate cannot see the file D1 names, and its derivation is wrong.

The action says "glob the projection copies", which matches `**/AGENTS.block.md` — the
template plus four projections — but **not** the merged root `AGENTS.md`, which D1
names explicitly and which currently carries the retired sentence. The gate would go
green while the file every session actually loads still carries it. Separately, the
instruction to compare against `Object.keys()` of `.codex/hooks.json` is literally
wrong: measured, that yields `['hooks']` (length 1); the 8 events are
`Object.keys(json.hooks)`.

### B6 — ch-1 and ch-5 are both scope-overloaded, and ch-1 writes five other cells' files.

ch-1 runs `onboard_bee.mjs --apply`, which writes `.bee/bin/bee.mjs`
(`onboard_bee.mjs:2620`), `.bee/bin/lib/*` (`:2635`), `.bee/bin/hooks/*` (`:2690`) and
`.bee/onboarding.json` (`:2785`) — ch-2's, ch-3's, ch-5's and ch-6's declared files,
none of them in ch-1's own `files` array, and ch-1 is scheduled in the same wave as
ch-2. That is an unreserved cross-cell write under critical rule 4. ch-5 separately
holds three hooks with three event semantics plus the HIGH-rated contract-test surgery.

### Accepted warnings (folded into the re-plan, not blocking on their own)

- `AGENTS.md` is **19181 bytes** against `test_agents_budget.mjs`'s 20480 hard fail —
  **1299 bytes of headroom**, and ch-1's verify omits that suite while D2's replacement
  wording adds all 8 event names.
- The "6-hook automation skeleton" claim is live in `INSTALL.md:63`,
  `README.md:479`, `docs/01-distillation.md:36`, `docs/05-roadmap.md:69`,
  `docs/06-runtime-integration.md:40` and `docs/02-architecture.md:223` — none in D1's
  list. Measured: `ls hooks/bee-*.mjs` = **9**. The Claude-first framing also survives
  verbatim at `docs/06-runtime-integration.md:5-6` and `INSTALL.md:63`, which
  falsifies `CONTEXT.md:84-87`'s claim that the reading traced to one sentence plus
  four corners.
- ch-2's `appendCompactionRecord` is given no instruction to resolve the lane with the
  session id, though ch-4 is — same bug class, one cell earlier, uncovered.
- ch-6's `read_first` omits `CONTEXT.md`, yet it cites D18; its step 3 ("find it") is
  answerable from its own `read_first` — `scripts/release_manifest.mjs --write`.
- `plan.md`'s per-cell verify column is a strict subset of the cells' actual verifies.

### Feasibility lens — measured, and it corrects the plan twice

**Baseline is GREEN.** On the clean tree at `1cec84e`: `hooks/test_hook_contracts.mjs`
exit 0 (9.0 s), `scripts/test_lib_mirror.mjs` exit 0 (39 ms),
`scripts/test_conformance.mjs` exit 0 (1.6 s), `scripts/run_verify.mjs` exit 0 —
`PASS run_verify: 84 suite(s), concurrency=5, wall=63611ms`. Nothing is being built on
red today; B1 is about the red this slice would *create*.

Matrix rows now carrying evidence:

| # | Result | Evidence |
|---|---|---|
| 1 | **PASS — not blocked** | The onboarding line (`inject.mjs:318-326`) and bypass banner (`:342-354`) are pure `lines.push` of locally-computed strings — mechanical. The HANDOFF block (`:369-387`) is the `else if` arm of a two-arm branch and shares a leading `lines.push('')` with the adopted arm — awkward, not blocked. Since `ADOPT_SOURCES` excludes `compact`, `handoffOutcome` is always null on the capsule path, so the capsule only ever needs that second arm. |
| 2 | **PASS, and the risk was overstated** | Measured: with the anchor present (index ≥ 0) and `- Phase:` renamed (`-1`), `n < -1` is **false** — the row fails loudly. It cannot silently pass. `plan.md:126`'s "passes or fails for the wrong reason" is half wrong. |
| 3 | **PASS — the question was already answered** | `buildSessionPreamble` (`inject.mjs:301-305`) and `buildPromptReminder` (`:477-479`) make the *identical* `resolvePipeline(root, { sessionId })` call with the same fail-open fallback, and the hook passes the id at `bee-session-init.mjs:144`. `buildSessionPreamble` was never the unfixed builder; the plan's open question 2 rested on a false premise. |
| 4 | **PASS** | `.bee/logs/` is created by onboarding (`onboard_bee.mjs:2609`, asserted at `test_onboard_bee.mjs:448`), and `appendJsonl` calls `ensureDir` first (`fsutil.mjs:107-110`). Routing D4 through the module is safe; a bare `fs.appendFileSync` would not be. |
| 5 | **PASS** | `scripts/release_manifest.mjs --write` regenerates `docs/history/codex-harness-hardening/release-manifest.json`; `--check` and `--selftest` are already wired at `run_verify.mjs:57-58`, `ledger_parity.mjs --check` at `:64`. ch-6's "find it" was answerable from its own `read_first`. |
| 6 | **PASS** | Baseline green, above. |

**Two further corrections to the plan:**

- **Wall-time is 2× the plan's figure.** `plan.md:65` says "~30-32s parallel"; measured
  **63.6 s**. The comments it cited (`run_verify.mjs:2-4, 545-550`) are themselves stale
  — the suite is 84 files now. Every ch-6 cap and every baseline-gate run costs ~64 s.
- **D16's necessity is contingent, and the plan asserts it unconditionally.** Both
  fixtures in the `:2740-2780` loop render through the same `source=compact` path. Under
  the reading where the *hook* keeps prefixing the anchor and the capsule is items 2-12,
  `controlOut` is itself a capsule and the additivity assertion **stays green untouched**
  — D16's supersession would be unnecessary. It is only needed under the reading where
  the capsule owns the anchor. That is the same un-owned decision as B4, and it reaches
  further than the test: "requires replacing existing proof" was one of the five
  mode-gate flags, so one of the escalation's own inputs is live only under one of two
  unresolved readings.

### Upheld by the panel

- **The lane is right.** Scope-guardian audited the 5-flag count and found the honest
  floor is **4 flags → high-risk** even discounting the weakest evidence; reaching
  `standard` requires discounting two. The "public contracts" flag is real but
  *mis-cited* — the stronger contract is the shipped `bee.mjs --help --json` manifest
  and the doctrine block rendered into every consumer repo, not an in-repo doc.
- `scripts/test_doctrine_parity.mjs` and ch-4's `inject.mjs` extraction are both
  authorized by CONTEXT.md, not invented scope.
- D1's, D9's and D10's surfaces are all assigned; decision coverage D1-D18 is complete.
- Zero dependency cycles; every cited line anchor resolves to what it claims.

## Verdict

**NOT READY — RETURN TO PLANNING.**

Six blocking findings, four of them structural to the slice shape rather than to any
one cell's wording: the manifest/ledger regen must move into every lib-touching cell's
own verify (B1), the capsule verb must move to the cell that builds it (B2), ch-4 needs
its own suite (B3), and ch-1 and ch-5 must be split (B6). Repairing those changes the
step list and the validation plan that `plan.md` froze at Gate 2, so this returns to
planning for a re-shape rather than being patched in place.

Gate 3 stays closed. Nothing is approved for execution.
