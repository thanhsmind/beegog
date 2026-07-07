# 0004 — Dogfood Day-1 Hardening: Proof-Gated Capping, Phase Vocabulary, Trace Completeness, Spec-Dir Hygiene

- **Status:** active — amends the cell rules in `02-architecture.md` and the helper contracts in `07-contracts.md`
- **Date:** 2026-07-07
- **Source:** first real dogfood review (anphabe-gogl, two features through the chain in one day) — findings read directly from `.bee/` records, not from memory
- **Confidence:** 0.9 (every finding is a concrete artifact in the dogfood repo; the fixes are mechanical)

## Decision

Four fixes, each answering one observed failure:

1. **Proof-gated capping.** `capCell` for `small`/`standard`/`high-risk` lanes now refuses when the recorded verify has no output AND no `verification_evidence` (assertion-capping), and refuses an empty `files_changed`. `tiny` keeps the old bar (lanes scale strictness). `bee_cells.mjs verify` gains an inline `--output TEXT` flag so recording proof costs one flag, not a temp file. The `verify` field must be a runnable command; a prose description is a planning defect the worker returns `[BLOCKED]` on.
2. **Phase vocabulary is closed.** `state.mjs` exports `PHASES` (the nine-value enum) plus the one blessed terminal alias `compounding-complete` (already contractual in 07-contracts and hook 6); `isKnownPhase()` is the single source of truth. `bee_status` flags any other value as a staleness warning. Feature close sets `idle`.
3. **Gate-recording guard.** `bee_status` warns when phase is past reviewing (`scribing`/`compounding`/`compounding-complete`) but gate `review` is still pending — Gate 4 approved-in-chat-but-never-recorded is now visible.
4. **Spec-dir hygiene.** `docs/specs/` holds ONLY the state layer (area specs, `system-overview.md`, `reading-map.md`, `visuals/`). Scribing never writes other artifacts there; grooming's hunt checklist gains a misfiled-artifacts item proposing tiny move-cells.

## Rationale — the dogfood evidence

Each fix maps to a record in anphabe-gogl after one day of real use:

1. Cell `dedup-embed-nav-1` (small lane, 17 files touched) capped with `verify_passed: true`, `verify_output: null`, `verification_evidence: null`, `files_changed: []`, and a `verify_command` that is a prose description ("guard present + … + build exit0"), not a command. The core promise — evidence before claims — held socially but not mechanically; the helper accepted an assertion. The repo's own compounding pass flagged the same disease from the other side ("byte-identical proof not re-runnable"). Weight of evidence: this happened on day one, under a careful agent, on a well-written cell — it will happen again.
2. `state.json` reached `phase: "merged"` — an invented value outside the enum. Machine-checkable handoffs, hook branching, and `bee_status` semantics all quietly degrade when the phase vocabulary is open.
3. Feature `content-shell-partials` reached `compounding-complete` with `review: false` — Gate 4 either skipped or approved but never recorded; nothing surfaced it.
4. `docs/specs/` in the dogfood repo contained `FacebookAdsReport*.py/.csv`, `import-task/`, `intergrate_zoom/` alongside the first real spec. The reading map quarantined them verbally — good instinct, wrong layer: coverage counting and spec scans need the directory itself clean.

## Alternatives considered

- **Keep enforcement social (skill wording only).** Rejected by the evidence: the wording already existed ("evidence before claims", full trace tiers) and day one produced an assertion-cap anyway. The dual-runtime rule says enforcement lives in helpers first.
- **Require verify output for tiny too.** Rejected: tiny's contract is a one-line trace; forcing output capture on typo fixes is ceremony without payoff, and grooming's unverified-cells term still watches tiny.
- **Hard-reject unknown phases in `writeState`.** Rejected for now: agents also reach state via hooks and hand-edits; a hard reject inside a fail-open hook chain turns drift into crashes. Flagging via `bee_status` (which every session preamble surfaces) is proportionate; revisit if drift persists.
- **Auto-fill `files_changed` from git.** Deferred: attributing a commit to a cell mechanically is guessable but not reliable during swarms (multiple reservations, one branch). The worker knows what it touched; requiring the flag is cheap.

## Scope

- `templates/lib/cells.mjs`: proof + files checks in `capCell`. `templates/lib/state.mjs`: `PHASES`/`KNOWN_PHASES`/`isKnownPhase`. `templates/bee_cells.mjs`: `--output` flag + usage. `templates/bee_status.mjs`: unknown-phase + gate-4 warnings. `templates/tests/test_lib.mjs`: 5 new checks (33 total).
- `bee-executing` SKILL: record output at verify, `[BLOCKED]` on prose verify field, two new red flags. `AGENTS.block.md` critical rule 2 wording. `02-architecture.md` cell rules.
- `bee-grooming` reference: misfiled-artifacts hunt item. `bee-scribing` reference: spec-dir-only note.
- Version 0.1.2 → 0.1.3 (plugin manifest + `BEE_VERSION`).
- Out of scope, noted for the dogfood repo itself: relocating anphabe-gogl's misfiled `docs/specs/` artifacts is that repo's grooming proposal to approve, not a plugin change.

## Consequences

- Existing capped cells with empty traces stay as they are (history is append-only); the bar applies from 0.1.3 onward.
- A worker whose verify legitimately prints nothing (rare: silent exit-0 commands) must attach evidence or echo the exit status — accepted, that one-line cost is the point.
- The gate-4 warning can fire on repos mid-transition (phase written before the gate flag). Accepted: it reads as "record the approval you already have", which is exactly the discipline being taught.
