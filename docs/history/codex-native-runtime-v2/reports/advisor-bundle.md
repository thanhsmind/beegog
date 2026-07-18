# Advisor evidence bundle — codex-native-runtime-v2, slice S1+S2 (pre-Gate-3 consult)

You are a read-only advisor. Assess feasibility and risk of the slice below. Do NOT approve anything; return findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING) with numbered, actionable points.

## Feature goal

Bee (an agent workflow harness shipped to both Claude Code and Codex runtimes) must give Codex the same operating experience as Claude Code. External review docs/REFs/be-codex.md was verified claim-by-claim; this feature implements it capability-gated. Slices S1+S2 now; S3-S7 (plugin/agent/adapter/doctor/conformance) gated on S2's capability matrix.

## Current slice cells (post-validation-repair state)

- cnr2-1 (D3): remove stale "Codex has no lifecycle hooks" claims in INSTALL.md:120, README.md:434, docs/06-runtime-integration.md:52; add Codex verify procedure to INSTALL.md (project trust → /hooks review → observed rows in .bee/logs/hooks.jsonl; three-state model hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed). Verify: grep-zero + three-state presence.
- cnr2-2 (D4): state-sync PostToolUse matcher superset update_plan|TaskCreate|TaskUpdate|TodoWrite, changed in hooks/catalog.mjs (confirmed single source of truth rendering hooks/hooks.json [Codex plugin projection], hooks/claude-hooks.json [Claude projection], .codex/hooks.json [repo target]); re-render all; extend bee-state-sync.mjs internal tool-name filter identically if present; pin with a new assertion in hooks/test_hook_contracts.mjs. Verify: test_hook_contracts + matcher grep on .codex/hooks.json.
- cnr2-3: DROPPED at validation — split-brain premise disproved (manifests are intentional per-runtime catalog projections, drift-check + ALLOWED_DIFFERENCES already pin them, test_hook_contracts.mjs:751+).
- cnr2-4 (D2): read-only capability spike on installed codex CLI (codex-cli 0.144.4 confirmed present): observe (a) .codex/agents/*.toml custom agents incl. developer_instructions, (b) plugin hooks key, (c) update_plan tool name reaching PostToolUse, (d) PreToolUse for agent spawns, (e) SubagentStart equivalent, (f) /hooks trust surface. Verdicts observed/not-observed/unknown with verbatim evidence; docs-only claims cap at unknown. Output: capability matrix gating S3/S4/S6.

## Reality-gate evidence so far

- Baseline verify chain: green this session (2026-07-18, full recorded suite, exit 0).
- codex CLI present: codex-cli 0.144.4.
- Generator model confirmed: hooks/catalog.mjs header documents projections and targets; catalog drift-check exists (cell codex-parity-2 lineage).
- Cell schedule: waves [[cnr2-1, cnr2-2, cnr2-4]] then [] — zero cycles, no unsatisfiable deps (cnr2-3 dropped).
- Plan-checker panel + cold-pickup cell review dispatched (review tier), results pending; their findings will be reconciled before dispatch — flag anything you consider a blocker they might miss.

## Risks

- cnr2-2 MEDIUM: matcher rendered into three artifacts; drift-check must stay green; ALLOWED_DIFFERENCES may need extending if superset is per-runtime (cell prefers same superset both projections).
- cnr2-4 MEDIUM: honesty risk — mitigated by verbatim-evidence rule and unknown-is-acceptable.
- cnr2-1 LOW: docs-only; grep-zero verify could false-fail if new prose re-uses the banned phrase (cell instructs replacement wording).

## Questions for you

1. Any hidden coupling you can see between the matcher superset and existing Codex hook behavior (state-sync firing on update_plan payload shape vs TaskCreate payload shape — bee-state-sync.mjs must parse update_plan's tool_input correctly)?
2. Is the spike's capability list complete for gating S3/S4/S6, or is something missing that later slices will need observed?
3. Any objection to shipping cnr2-1's doc claims before the spike's trust-state findings land?
