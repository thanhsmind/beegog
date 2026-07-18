# Advisor re-consult — codex-native-runtime-v2, slice 3 rev3 (terse residual check)

You returned 5 residuals on rev2 (digest advisor-digest-s3r2.md). All are now resolved as LOCKED decisions + cell text (decision log + plan.md + cells cnr2-9/10/11/12 updated):

1. Plugin topology LOCKED, not delegated: committed rendered trees — `.claude-plugin/skills/ = render(canonical, claude)`, `.codex-plugin/skills/ = render(canonical, codex)` — manifests repointed, release inventory covers them, test_plugin_distribution pins tree == render(canonical) recomputed at test time. Package-time rendering explicitly rejected.
2. cnr2-10 → cnr2-11 serialized; cnr2-11 is the sole final-render owner with all four rendered-tree roots in its file scope; cnr2-10 renders only transiently for its own verify.
3. Provenance simplified: a rendered projection is refused as an onboarding source for ANY target (own runtime included); canonical or plugin source required. No target-filter semantics introduced.
4. Verify consistency: token-level bans retained ONLY on claude rendered copies (valid because who-must-act attribution + contrast-note relocation empties spawn_agent/wait_agent tokens there); codex copies use phrase-level rules (pinned `subagent_type: "bee-` types, `.claude/agents`, `claude -p`) and legitimately retain the bare subagent_type token in the AO11 note. Prohibition reworded to match.
5. plan.md current-slice section now lists all four cells with the serialized order and drops the stale follow-up line.

Question: any remaining blocker? Terse numbered residuals + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING) only — do not re-derive the full analysis.
