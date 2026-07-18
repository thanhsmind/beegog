# Advisor re-consult — codex-native-runtime-v2, slice 3 rev2 (post-reshape)

You are a read-only advisor. You previously returned RETURN-TO-PLANNING on this slice (your findings 1-7, digest advisor-digest-s3.md). The slice was reshaped to address every finding, plus a parallel panel's repo-reality findings. Verify the repairs are sufficient; return numbered residual findings + verdict (PROCEED / PROCEED-WITH-CHANGES / RETURN-TO-PLANNING). Read-only; no bee state mutations.

## Repairs mapped to your findings

1 (lossy source): cnr2-9 now adds render-schema/target provenance metadata to rendered targets and extends source-identity.mjs (templates/lib + mirror) to REFUSE a rendered projection as an onboarding source for the opposite runtime or for canonical sync — loud blocked_no_source-style, zero mutations. skills/ (canonical) remains the only cross-runtime source.
2 (plugin bleed): NEW cell cnr2-12 (deps cnr2-9, BEFORE any tagging): each plugin route ships its runtime's rendered tree generated through the renderer; release inventory covers rendered trees; test_plugin_distribution gains runtime-clean assertions. Tagging cells (cnr2-10/11) now dep on BOTH cnr2-9 and cnr2-12 — no window where plugins serve half-tagged source.
3 (three contracts): release hash = canonical bytes incl. markers (unchanged); per-target drift = render(canonical, target) at BOTH hash sites the panel located (computeSkillItems onboard_bee.mjs:693 and applySyncSkill fast-skip :1233-1236); downgrade preflight stays version-based, untouched.
4 (test scope): cnr2-10 now owns skills/bee-hive/templates/tests/test_lib.mjs (census ~:7879 flips: wait_agent prose required in codex projection, absent in claude projection); cnr2-9 wires test_skill_render.mjs AND scripts/test_state_write_concurrency.mjs into commands.verify and the test_verify_manifest mandatory-suite guard.
5 (grammar/atomicity): exact full-line markers; refusals for nesting, unclosed, stray end, unknown labels, frontmatter placement, markers inside code fences (forbidden, not parsed); WHOLE-TREE validation before any mutation (zero writes for the entire apply on any malformed file); zero-marker path preserves BOM/CRLF/final-newline/arbitrary bytes.
6 (equality proof): both tagging cells freeze pre-tag git blob hashes; proof = marker-strip reproduces the frozen baseline, with ONLY the permitted mechanical table/bullet re-layout (see 7) and the named D10 delta; diff recorded and justified hunk-by-hunk in the cell report. Token spot-greps replaced with phrase-level rules (pinned-type phrases, .claude/agents, claude -p) — panel showed bare-token bans are unsatisfiable (AO11 note mentions subagent_type) and the old greps were vacuous (spawn_agent lives in swarming-reference.md, now grepped directly).
7 (attribution): who-must-act rule adopted; AO11 budget mechanics codex-only; cross-runtime contrast notes move to docs/06-runtime-integration.md (non-loaded), not duplicated into both projections.

Panel additions also folded: the self_skip premise was wrong — real mechanism is applySyncSkill via self-onboard mode "sync" (stale doc line bee-hive/SKILL.md:31 fixed in cnr2-9); the 3-column runtime table (swarming-reference.md:116-128) and interwoven bullets get PERMITTED paired per-runtime restructuring under the semantic-preservation proof.

## Question

Any residual blocker in the reshaped slice? Answer tersely; a short numbered list + verdict is enough — no need to re-derive the full analysis.
