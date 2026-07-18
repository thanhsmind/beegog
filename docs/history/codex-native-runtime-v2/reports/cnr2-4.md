# cnr2-4 — Codex capability spike (S2/D2)

**Status:** [DONE]
**Outcome:** Read-only spike on `codex-cli 0.144.4` produced a 10-row capability matrix (A1–F1) with
one verdict + verbatim-evidence-or-reason per row, trust-bypassed vs normal-trust distinguished, and
explicit S3/S4/S6 gating consequences. Verify `MATRIX-OK`.

**Files touched:**
- `docs/history/codex-native-runtime-v2/reports/capability-matrix.md` (tracked summary — 10 rows + gating)
- `.bee/spikes/codex-native-runtime-v2/capability-matrix.md` (full verbatim evidence; gitignored/disposable)
- `.bee/spikes/codex-native-runtime-v2/evidence/*` (raw probe outputs; gitignored)

**Headline verdicts:** observed — C1 (`update_plan`→PostToolUse), C2 (hook ABI envelope), D1
(`spawn_agent`→PreToolUse with `agent_type`), F1 (live trust gate; `doctor --json` has no hook/agent
rows). not-observed — A1/A2 (`.codex/agents/*.toml` not discovered; only built-in
`default`/`explorer`/`worker` spawnable), B1 (`plugin_hooks` feature removed). unknown+follow-up —
B2, B3, E1. Gating — S3: defer D6 / proceed D7; S4: defer D8 / proceed D10; S6: doctor fail-closed.

Full trace/evidence: `.bee/cells/cnr2-4.json`.
