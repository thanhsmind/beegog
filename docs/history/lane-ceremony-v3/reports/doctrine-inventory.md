# lane-ceremony-v3 — old-doctrine surface inventory (gather digest, 2026-07-19)

Produced by a generation-tier scan; anchors verified against v1.6.2 source. Cells cite this file in `read_first`.

## 1. Restatements of the old doctrine

`artifact_readiness` / enrichment:
- skills/bee-planning/SKILL.md:77 (`artifact_readiness: requirements-only`), :89 ("Enrich the **same** plan.md in place to implementation-ready"), :107 (headless requirements-only)
- skills/bee-planning/references/planning-reference.md:49, :83 (`<!-- implementation-ready additions (after Gate 2): -->`), :156 (trace-of-shapes line)
- skills/bee-validating/SKILL.md:27, :31 (gate-in requires `artifact_readiness: implementation-ready`)
- skills/bee-hive/references/go-mode.md:20, :26, :106; routing-and-contracts.md:110

"current slice":
- go-mode.md:34, :119; routing-and-contracts.md:168; bee-planning/SKILL.md:23, :90; planning-reference.md:111; bee-swarming/SKILL.md:150; validation-reference.md:103, :121; docs/specs/workflow-state.md:215 (spec layer — scribing's job, not a cell)

Risk flags (old wording incl. "existing covered behavior", "weak proof around the area"):
- skills/bee-hive/SKILL.md:98; skills/bee-planning/SKILL.md:53; README.md:217 (tail differs: "weak proof")

File caps:
- bee-hive/SKILL.md:103 (`≤2 files`), :105 (`≤three files`); bee-planning/SKILL.md:56; README.md:221

Merged gate / fast path:
- go-mode.md:7 (densest single restatement of tiny/small ceremony); bee-planning/SKILL.md:122; planning-reference.md:92 (tiny/small "direct note"); README.md:87

## 2. Test pins (what must stay true)

- scripts/test_gate_bypass_doctrine.mjs:29 — bee-planning/SKILL.md must contain tokens `gate_bypass_level` AND `full`; :36-39 — phrases "safety floor is absolute" / "bypass does not apply" banned. Same token+ban check for bee-exploring (plus :84 litmus "confident best answer"), bee-validating, go-mode (token `full`). NO lane numbers or plan wording pinned.
- scripts/test_conformance.mjs — black-box CLI/hook checks only; no prose greps. (`lane: "small"` at :143 is a fixture field value, unaffected.)
- scripts/test_skill_render.mjs — mechanical marker/byte/provenance checks; no prose.
- scripts/test_agents_budget.mjs:55-80 — AGENTS.block.md template + root AGENTS.md ≤ 20 KiB; :84-109 — root AGENTS.md BEE block byte-identical to template → any template edit requires onboard --apply re-render in the same step.

## 3. Chain touchpoints to update

- bee-validating/SKILL.md:27,31 (gate-in condition); validation-reference.md:103,121 (report `Work:` fields — compatible, review only)
- bee-swarming/SKILL.md:96 (worker prompt cites plan.md path — tiny must cite the cell instead), :123 (lane-scaled re-verify), :150 (next-slice return), :161/:182 (AO14 single-worker red flags — keep)
- bee-briefing/SKILL.md:34 (tiny/spike: none), :60-61 (projection sources), :80 (projection framing), :84 (drift rule → cells-only per D9)
- bee-scribing/SKILL.md:48,132 (never copy from plan.md — stays valid), :79-81, :116 (lane-scaled sync — keep)
- bee-executing/SKILL.md — zero hits; untouched.
- routing-and-contracts.md:30, :110-111, :168, :271-274 (working-files tree: plan.md currently unconditional)
- go-mode.md:7, :20-34, :102-106, :119
- AGENTS.block.md (template):12, :20 ("bee-planning (shape) → bee-briefing renders implement-plan.md (small+)"), :37, :44, :68 (docs/history tree note)

## 4. Render pipeline (run after skill edits)

1. `node scripts/render_plugin_skill_trees.mjs` — regenerates committed `.claude-plugin/skills/` + `.codex-plugin/skills/`; refuses on marker errors, zero writes.
2. `node scripts/release_manifest.mjs --write` — regen manifest (hashes plugin trees); `--check` is in commands.verify. MUST land in the same cell that re-renders trees (critical-patterns:514-530, recurred 2026-07-19 cnt-3).
3. `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root /home/thanhsmind/projects/goglbe/beegog --apply --json` — refreshes managed roots + AGENTS.md/CLAUDE.md byte-sync.

## 5. Precedent

- critical-patterns:514-530 — manifest regen same-cell rule (direct precedent).
- critical-patterns:242,246 — prose-only constraints get stripped; mechanize invariants → this feature adds RED-first assertions pinning the NEW doctrine into test_gate_bypass_doctrine.mjs.
- learnings/20260712-skill-metadata-projection.md — render-parity discipline now encoded in test_skill_render.mjs.
