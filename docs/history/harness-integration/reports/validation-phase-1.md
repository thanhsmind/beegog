# Validation Report — harness-integration Phase 1

**Date:** 2026-07-11 | **Mode:** high-risk | **Verdict: NOT READY — RETURN TO PLANNING**

## Reality gate

| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | high-risk correctly forced by the `audit/security` hard-gate flag (Phase 1 touches `hooks/bee-write-guard.mjs`) |
| REPO FIT | FAIL → FIXED | `AGENTS.template.md` referenced throughout CONTEXT.md/approach.md/plan.md/implement-plan.md/cell-4 does not exist. Real path: `skills/bee-hive/templates/AGENTS.block.md`. Corrected in all 5 artifacts before dispatching the panel. |
| ASSUMPTIONS | FAIL (see panel findings) | Core assumption "bee.mjs delegates to the existing helpers' handlers" is false — see Blocker 1 |
| SMALLER PATH | PASS | high-risk is mechanically forced; no smaller lane available regardless of scope |
| PROOF SURFACE | FAIL (see panel findings) | Cell 3's verify command cannot exercise the file it modifies — see Blocker 2 |

## Persona panel (high-risk scaling) — 4 independent lenses, isolated context, `[bee-tier: ceiling]`

Deviation from configured `review` tier, disclosed: `.bee/config.json` resolves `review` to an external `codex exec --yolo ... workspace-write` process. This was **not used** — a `workspace-write`/`--yolo` external process runs outside this session's `bee-write-guard.mjs` PreToolUse hook entirely, meaning it could edit source files pre-Gate-3 without the enforcement this whole feature exists to prove. Used the `ceiling` tier (session model) via the Agent tool instead — matches the "security-sensitive, high-risk" branch of bee's own tier rubric.

### Coherence lens — 4 BLOCKERS, 4 WARNINGS
### Feasibility lens — 2 BLOCKERS
### Security lens — 3 BLOCKERS, 1 WARNING
### Cold-pickup lens — 4 CRITICAL (across cells 1, 3, 4), 2 MINOR

## Synthesized findings (deduped, corroborated hit → promoted)

### BLOCKER 1 — Cell 2's core delegation mechanism does not work as specified (corroborated by feasibility + cold-pickup lenses independently)

Cell 2 and `implement-plan.md` §5 both state `bee.mjs` "delegates to the matching existing helper module's handler." All 4 helpers (`bee_status/cells/reservations/decisions.mjs`) export **nothing** — each ends with `process.exitCode = main(process.argv.slice(2));`, a private, unexported function invoked immediately on import against the real process's real argv. Importing any of them from `bee.mjs` would execute the wrong argv immediately, write to stdout uncontrollably, and clobber `process.exitCode` — before validation even runs. Cell 2's own prohibition forbids editing these 4 files, so there is no in-process path. The only viable mechanism (child-process spawn per delegated call) is named nowhere in any artifact.

**This requires a design decision, not a mechanical fix** — subprocess spawn (`spawnSync`) preserves D5 exactly (zero edit to the 4 helpers) at the cost of one `node` fork per dispatched call and argv/stdout/exit-code forwarding complexity; refactoring the 4 helpers to export a callable `main` preserves single-process performance but changes what "no rewrite of their internals" (D5) actually means. **Recommendation: subprocess spawn — most faithful to D5 as locked, cheapest to prove safe.** This is presented for your decision below, not decided silently.

### BLOCKER 2 — Cell 3's verify command cannot prove its own must_haves (corroborated by feasibility + security + cold-pickup lenses — 3 of 4)

`test_lib.mjs` only unit-tests `guards.mjs`'s exported functions directly; it never spawns or exercises `hooks/bee-write-guard.mjs` as a script. No test in the repo today exercises the hook's own dispatch logic (stdin parsing, tool-type branching, fail-open catch). Cell 3's "zero regression" must-have has no evidence path as scoped. **Fix (mechanical): add a hook-level integration test (spawn `bee-write-guard.mjs` with crafted stdin payloads) to cell 3's `files`, and require it in `verify`.**

### BLOCKER 3 — Fail-open composition risk in the highest-risk file (security lens, most severe single finding)

`main()` wraps every check in **one shared try/catch** with **one shared `denial` variable**. Any exception in the new 4th check's Bash-parsing logic — or a careless unconditional overwrite of `denial` — silently erases an already-computed deny from checks 1–3 and returns allow. The cell's current prohibitions forbid editing the *existing checks' code* but say nothing about isolating the *new* check's failure modes from *already-computed* denials in the same pass. **Fix (mechanical, deterministic — reviewer named the exact guarantee needed): add an explicit must-have — "the new check must never overwrite or discard a denial already set by checks 1–3, by early-return, assignment, or uncaught exception" — plus a regression test forcing the new check to throw while a prior check has already denied, asserting the original deny still wins.**

### BLOCKER 4 — Cell 3 / Cell 4 vendoring circularity (cold-pickup lens, concrete)

The hook's existing convention imports shared lib modules only from the **vendored** copy (`.bee/bin/lib/<name>`), never the template tree. `validate-args.mjs` isn't vendored to `.bee/bin/lib/` until cell 4 runs — but cell 4 *depends on* cell 3. Following the hook's own established convention, cell 3 cannot import a not-yet-vendored file. **This is a dependency-graph fix (mechanical once named): cell 3 needs its dependency on a vendoring step resolved — either cell 4's vendoring step is split out and reordered before cell 3, or cell 3 imports from the template path directly (deviating from the hook's stated convention, needs a one-line justification).** Presented alongside Blocker 1 for your input since it interacts with the delegation-mechanism decision.

### BLOCKER 5 — Cell 4's premise is factually wrong (cold-pickup lens, concrete, deterministic)

`onboard_bee.mjs`'s vendoring (`listTemplateHelpers()`/`listTemplateLibModules()`) already auto-discovers every `.mjs` file under the template dirs via `readdirSync` — no hardcoded per-file allowlist. Cells 1–2's new files will be vendored and hash-tracked automatically, zero code change needed. Cell 4's current premise ("wire onboard_bee.mjs to vendor...") pressures a worker toward manufacturing an unneeded change. **Fix (mechanical): correct cell 4's action to "confirm the existing generic vendoring auto-covers the 3 new files (no code change expected); focus the cell on `AGENTS.block.md` + docs only."**

### BLOCKER 6 — Cell 1's test examples risk corrupting this repo's own live `.bee/` state (cold-pickup lens, concrete)

Manifest-as-tested-contract examples include state-mutating calls (e.g. `cells cap`). All 4 helpers resolve their working root via `findRepoRoot(process.cwd())` — if `test_bee_cli.mjs` runs examples without isolating `cwd` to a temp repo, it mutates this checkout's real `.bee/cells`, `.bee/reservations.json`, `.bee/decisions.jsonl` (the very data these 4 cells live in). `test_lib.mjs` already has the correct `os.tmpdir()`-isolation precedent but isn't in cell 1's `read_first`. **Fix (mechanical): add `test_lib.mjs` to `read_first`; add an explicit action line requiring temp-repo isolation for every executed example.**

### Non-blocking, mechanical fixes bundled with the above

- Cell-4's `decisions` array missing `"D6"` despite prose citing it.
- Cell-1's action mis-cites D2 to justify intra-phase build order (D2 governs inter-phase sequencing only) — reword, tag stays.
- `implement-plan.md` §8 wrongly attributes new CLI tests to `test_lib.mjs`; correct file is `test_bee_cli.mjs`.
- Scope gap: `schema_version` field and `deprecated`/`use_instead` redirect logic are named in `implement-plan.md`/plan.md's test matrix but owned by no cell — assign to cell 1 (field) and cell 2 (redirect logic) explicitly.
- Cell 4's D6 attribution overstates what D6 says (D6 defers a mechanism that never existed; it does not "replace" one) — reword.

## Decision

**NOT READY — RETURN TO PLANNING.** Blockers 1 and 4 need a design decision (delegation mechanism; dependency reordering) that changes cell scope, not a same-cell patch. Blockers 2, 3, 5, 6 and the bundled minor fixes are mechanical and can be applied verbatim once the design decision lands. Per bee's own precedent (decision c05613d9): mechanical/deterministic findings do not need user escalation, but Blocker 1's design choice does — presented above with a recommendation (subprocess spawn), not decided silently.

This is iteration 1 of the plan-checker cycle (max 3 before mandatory escalation) — well within budget to fix and re-run.

## Iteration 2 (re-verification, `[bee-tier: ceiling]`)

User decision on Blocker 1: confirmed the 4 existing CLI entrypoints are already thin wrappers over `lib/*.mjs` (verified: `bee_cells.mjs` imports `listCells/readyCells/readCell/addCell/claimCell/recordVerify/capCell/blockCell/dropCell/setTier/judgeCell` from `lib/cells.mjs`; the other 3 follow the identical pattern) — no refactor needed, `bee.mjs` becomes a 5th thin wrapper over the same `lib/*.mjs` modules. Blocker 4 resolved the same way: since Blocker 5 proved vendoring is generic/automatic, cell 3 simply re-runs the existing vendoring step itself before testing, closing the circularity without new design.

All 6 blockers + bundled minor fixes applied to cells 1–4 and to CONTEXT.md/approach.md/plan.md/implement-plan.md. Re-dispatched one consolidated plan-checker (`[bee-tier: ceiling]`) to verify each fix against source, not just reworded prose.

**Verdict: READY.** Every one of the 6 blockers confirmed resolved with source-verified evidence (e.g., re-read `hooks/bee-write-guard.mjs`'s actual `try/catch`/`denial` structure to confirm the new must-have targets the right mechanism; re-read `onboard_bee.mjs`'s generic `readdirSync` scan to confirm cell 4's corrected premise holds). DAG and parallel-wave file-disjointness re-checked and still valid after cells 2/3's `read_first`/`files` grew.

Two new informational (non-blocking) findings, both applied:
- Cell 2's `read_first`/`key_links` were missing `lib/capture.mjs`/`lib/backlog.mjs` (needed by the `status` subcommand group, since `bee_status.mjs` imports from them too) — added.
- Cell 3's onboarding-vendoring prerequisite touches `.bee/bin/lib/validate-args.mjs` and `.bee/onboarding.json` (git-tracked, generated) outside its declared `files` — not a `judgeCell`/reservation risk (checked against both), but a disclosure-completeness gap — added a `must_haves.notes` entry requiring both paths in `trace.files_changed` at cap time.

Decision vocabulary: **READY WITH CONSTRAINTS** — READY on structure/feasibility/security/cold-pickup; "with constraints" only in the sense that this is a feasibility verdict per bee-validating's own rule ("READY is a feasibility verdict, not execution approval — Gate 3 still requires the user"), not because any substantive gap remains open.
