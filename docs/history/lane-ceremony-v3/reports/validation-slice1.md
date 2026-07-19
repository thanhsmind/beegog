# Validation report — lane-ceremony-v3, slice 1 (the whole feature)

Date: 2026-07-19 · Lane: standard · Cells: lcv3-1…lcv3-5 (sequential)

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | 3 flags (public contracts, multi-domain, existing covered behavior) counted in plan.md §Mode Gate; no hard-gate flag — gates/reality checks preserved, reordered only (D5) or re-homed (D3/D4). Standard, not high-risk. |
| REPO FIT | PASS | Direct precedent: doctrine edits ship as skill text + doctrine-test updates + render + manifest (critical-patterns :514-530; git history cnt-7 "re-render plugin projections post-guard-edit"). Doctrine test already greps skill prose (test_gate_bypass_doctrine.mjs:29-84) — extension is the established mechanism. |
| ASSUMPTIONS | PASS | All blocking assumptions proven or repaired — matrix below. |
| SMALLER PATH | PASS | docs lane impossible (test files are code; skills are runtime doctrine for the agent); tiny/small impossible (10+ product files across 2 layers). Standard is the floor. |
| PROOF SURFACE | PASS | Per-cell: test_gate_bypass_doctrine (+ test_agents_budget for lcv3-4) + release_manifest --check. Close: full recorded commands.verify chain. Baseline verified green this session (background run, exit 0). |

## Feasibility matrix

| # | Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Doctrine test baseline green & extensible | blocking | run it | `node scripts/test_gate_bypass_doctrine.mjs` → PASS, 0 failures (this session) | PROVEN |
| 2 | Dependency schedule sound | blocking | zero cycles + expected wave shape | `bee cells schedule` → 5 waves `[lcv3-1]…[lcv3-5]`, cycles: [], unsatisfiable: [] | PROVEN |
| 3 | AGENTS block stays ≤ 20 KiB after rewording | blocking for lcv3-4 | byte headroom | AGENTS.block.md = 16 753 B < 20 480 B (~3.7 KiB headroom; edits are rewordings, not additions) | PROVEN |
| 4 | Per-step verify stays green mid-slice (shared baseline never red between cells) | blocking | what does the verify chain hash? | **FINDING:** release_manifest.mjs hashes canonical `skills/` ("plugin_skill" role, :44-52 comment "still hashed unchanged for package integrity") → any skill edit without regen turns `--check` red. test_plugin_distribution.mjs is fixture-sandboxed (writes its own pkg/repo fixtures, :53-72) — no real-repo parity check. | REPAIRED — cells lcv3-1…4 patched (`cells update`): same-cell `render_plugin_skill_trees.mjs` + `release_manifest.mjs --write`, verify += `--check`, rendered trees + manifest in the cell's commit. plan.md §Approach updated. |
| 5 | onboard --apply re-renders root AGENTS.md byte-identical | blocking for lcv3-4 | mechanism exists | README.md:342 (drift refresh in place); test_agents_budget.mjs:84-109 asserts byte-identity — the test proves the mechanism every run | PROVEN |
| 6 | Render refuses cleanly on marker damage (no partial writes) | medium | script contract | render_plugin_skill_trees.mjs:1-17 header + test_skill_render.mjs (refusal = exit 1, zero writes) | PROVEN |

## Spikes

None required — no assumption needed new disposable code; all proofs came from command output and source inspection.

## Advisor consult

Not required: standard lane, no hard-gate flag (AO2b applies to high-risk/hard-gate slices). Recorded here per protocol.

## Plan-checker findings (review slot, adversarial — 1 iteration)

Verdict: FINDINGS — 2 WARNINGs, 0 BLOCKERs. Both fixed same-turn via `cells update`:

1. **WARNING (fixed):** cells lcv3-1…3 prohibitions said "no edits outside the three/four listed files" while the render+manifest repair had grown `files[]` to 6-7 entries — self-contradiction with the cells' own close-out. Reworded to "no edits outside the listed files (the files array is authoritative)".
2. **WARNING (fixed):** lcv3-5's `verify` ran only a 2-suite subset while its must_haves demanded the full chain — and `cells cap` gates on the verify field. `verify` replaced with the full recorded `commands.verify` string.

Clean dimensions: D-ID coverage D1–D10 all mapped to cells (D2/D10 negatives honored); dependency chain strictly linear, all shared paths edge-linked (no concurrent-edit hazard); all 19 read_first paths exist; doctrine test greps canonical `skills/` (valid mid-slice); scope inside D10 — no bee.mjs/hooks/state-machine touches; onboard-managed roots and render targets verified disjoint; every uncovered inventory anchor is one the inventory itself rates "scribing's job / compatible / keep".

## Cell review findings (cold pickup)

Verdict: all five cells CLEAN, zero CRITICAL. Confirmations: every verify command runs standalone as written (exit 0 pre-flight); RED-first premise is genuine (the doctrine test today has zero mentions of the new invariants, so the new assertions fail before each rewrite); read_first covers all assumed context; the `.txt` RED/verify captures under `docs/history/…/reports/` pass the write-guard (its history rule is a code-extension DENYLIST — `.bee/bin/lib/guards.mjs:40-51` — `.txt` is not in it). MINOR flags (stale "three/four listed files" numerals in lcv3-1…3; lcv3-5 subset verify) were already fixed by the plan-checker round's `cells update` patches — confirmed on disk post-review (grep: zero hits; lcv3-5 verify = the full recorded chain).

**Systemic note (recorded for execution):** `release_manifest --check` hashes `skills/**` and the rendered trees as independent roles — it forces `--write` after a skill edit but does not itself prove render parity; a worker who ran `--write` without the render would carry stale projections to lcv3-5, where `test_skill_render` + the full chain catch it. Acceptable under the strictly linear chain; the orchestrator's per-cell goal-check MUST confirm each cell's `-red.txt` shows a real failing tail (RED-first is instruction-enforced, not verify-enforced) and that the render actually ran (rendered-tree diff present in the cell's commit).

## Decision

**READY** — reality gate 5/5 PASS, feasibility matrix 6/6 PROVEN or REPAIRED, plan-checker structurally clean after 2 fixed WARNINGs (1 iteration), cell review zero CRITICAL. READY is a feasibility verdict; execution approval follows the gate-bypass contract (level `total`).
