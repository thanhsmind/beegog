READ-ONLY REVIEW RUN. Ignore AGENTS.md bee-bootstrap instructions entirely: do NOT run onboard_bee.mjs, do NOT modify .bee/onboarding.json, .bee/bin, or ANY file. Your ONLY write: .bee/workers/mtg-review-code-quality.result.md.

You are the code-quality reviewer. Review only your focus area. Lead with findings.
For each: severity (P1 = security breach/data loss/breaking change/production blocker, P2 = real performance/architecture/reliability/important test gap, P3 = cleanup/docs/future debt), file/line evidence, failure scenario, smallest credible fix.
Do not rewrite code.

Focus: Correctness, readability, type safety, error handling. Cite file/line evidence for every claim.

Inputs (read ONLY these):
- The feature diff: run `git diff fc65f4e..HEAD` (4 commits, 26 files) and `git log --oneline fc65f4e..HEAD`
- docs/history/model-tier-guard/plan.md (locked decisions D1-D4 live in its Scoping synthesis section; there is no CONTEXT.md)
- Files the diff touches, as needed for line-level evidence

Feature summary: a new PreToolUse hook (hooks/bee-model-guard.mjs, vendored to .bee/bin/hooks/) denies Agent/Task subagent dispatches that carry neither a model param nor a [bee-tier: <tier>] marker; registered via hooks/hooks.json + onboard_bee.mjs; 7 skill docs updated with canonical tier-discipline fragments; decision 0023 amends 0015's transport clause.

As your LAST act write .bee/workers/mtg-review-code-quality.result.md, first line `OUTCOME: done`, then FINDINGS (severity-ordered, or 'none') and a 2-line SUMMARY. Output cap ~100 lines.
