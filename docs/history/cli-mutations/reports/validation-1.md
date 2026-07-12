# Validation report — cli-mutations, slice 1 (cells 1–4)

Lane: standard · Date: 2026-07-11 · Validator: session orchestrator (fable) ·
Plan-checker + cell reviewer: opus (native — self-modifying bee work never routes
to external CLI executors, decision 0019 / bee-evolving contract)

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | 2 risk flags (data model, covered behavior) → standard; 4 surfaces across templates/lib/hooks/prose exceed small |
| REPO FIT | PASS | thin-CLI pattern exists (bee_cells.mjs); templates→.bee/bin vendor flow via onboard_bee.mjs:833 generic copy; test seams in templates/tests/test_lib.mjs + hooks/test_model_guard.mjs |
| ASSUMPTIONS | PASS | all four open questions resolved with file evidence (below) |
| SMALLER PATH | PASS | SQLite rejected (no tool-call reduction, loses git-diff); --json passthrough rejected (keeps schema-drift class alive); prose-only rejected (prose decays — 17-line kind: drift is the live proof) |
| PROOF SURFACE | PASS | every cell has a runnable verify: test suite + smoke greps + cmp vendor-copy checks |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| state-sync hook won't fight the new CLI | lost gate write | read hook RMW scope | hooks/bee-state-sync.mjs:82-92 writes only `cells` + `last_activity`, readState immediately before writeState; window ms-scale, identical to status-quo hand edits | ACCEPTED — cell 1 truth: re-read immediately before atomic write |
| scribing-run key set is knowable | wrong schema | exact keys | bee-scribing/SKILL.md:112: feature, date, ISO `at`, areas_synced, next_action (+ top-level phase/next_action) | PROVEN — --next-action flag added |
| dual type vocabulary is importable | duplicated literals | exports exist | lib/feedback.mjs:67 KIND_ALIASES, :98 NORMALIZED_KINDS, both exported | PROVEN |
| write-guard deny won't block the CLIs' own writes | CLI self-lockout | extractBashTargets behavior | guards.mjs:185-249: extracts redirection/sed -i/git/cp targets only; `node .bee/bin/bee_state.mjs set …` extracts nothing → passes; `cat >> .bee/backlog.jsonl` → caught | PROVEN — deny rule goes in checkWrite, first-hit, before GATE_ALLOWED_PREFIXES (`.bee/` is an allowed prefix today, so precedence is mandatory) |
| layer enum | unfileable friction | live data scan | backlog carries layer `security` (2 rows); feedback.mjs treats layer as free string | BLOCKER FIXED — no allowlist, free string ≤40 |
| phase validation target | feature-close deadlock | enum source | lib/state.mjs: PHASES (9) vs KNOWN_PHASES (+compounding-complete) | FIXED — pin isKnownPhase |

## Plan-checker (opus, adversarial) — iteration 1

1 BLOCKER (cell 2 invented layer enum vs live `security` data) — **fixed**: free string, no allowlist.
6 WARNINGS — fixed in cells: isKnownPhase pin (2), --next-action flag (3), broadened cell-3 verify incl. backlog.jsonl + "Record …" phrasing (5), inert source field dropped (6), fail-open row reworded to hook-wrapper scope (7). Accepted as constraint: state-sync RMW window (4) — same exposure as status quo, re-read-before-write required.
Verified sound: onboarding generic copy needs no change; all named exports exist; existing checkWrite tests untouched by the new rule; dependency graph correct.
Iteration 2: re-verification of the seven findings — see addendum below.

## Cell review (opus, cold pickup)

- cell 1 PASS (2 minors folded: --next-action, bee_status.mjs in read_first)
- cell 2 CRITICAL fixed: deps now ["cli-mutations-1"] (shared test_lib.mjs edit serialized — wave 1 is now cell 1 alone, wave 2 = cell 2, wave 3 = cells 3+4)
- cell 3 CRITICAL fixed: verify broadened (backlog.jsonl covered, "Record the scribing run in" phrasing caught, both CLI names excluded)
- cell 4 PASS (guards.mjs relocation noted as the more correct insertion point; plan file-bounds updated)

## Verdict

**READY WITH CONSTRAINTS**
- C1: cell 1 re-reads state.json immediately before every atomic write (RMW window minimal; hook field-scoping intentionally deferred — filed as friction if it ever bites).
- C2: wave order is 1 → 2 → 3+4 (test_lib.mjs serialization + verb-name dependency).
- C3: node -e writes to state.json remain mechanically unreachable by the guard; the prose rule (cell 3) is the only cover — accepted, revisit only if post-ship audits find node -e hand-edits.

## Approval block

Gate 3 (execution) — gate_bypass on, standard lane, no hard-gate flag →
auto-approved per decision 0010; audit decision logged. Approval covers cells
cli-mutations-1..4 only.

## Addendum — plan-checker iteration 2 (re-verification)

All 7 findings RESOLVED against the current cell files (finding 4 = accepted
risk by design). Notable confirmations: cell 3's broadened verify does not
self-trip on its own standing-rule text; severity P1|P2|P3 gate matches the
PAIN_SEVERITY key set exactly (feedback.mjs:101); dep graph 1 → 2 → {3,4} has
no cycle. **STRUCTURALLY CLEAN: yes.**
