You are a fresh-eyes reviewer with no conversation history. Review ONE document for Gate 1 readiness: docs/history/skill-sync/CONTEXT.md (in the current repo).

Also read, for grounding only: skills/bee-hive/scripts/onboard_bee.mjs (skim the plan/apply structure), and `ls skills/` + `ls ~/.claude/skills` if accessible.

Check exactly:
1. Completeness — does CONTEXT.md give planning everything: boundary, domain types, locked decisions with D-IDs and rationale, scout paths, open questions?
2. Contradictions — do any two decisions conflict (e.g. D2 auto-sync vs D3 refuse-on-downgrade: is the failure mode when a HOST repo onboard runs from an old bee checkout well-defined?), or conflict with the scouted reality?
3. Vague decisions — could two reasonable implementers read a D-ID differently? Name the sentence.
4. Missing gray areas — is there an unstated PRODUCT decision (not implementation choice) that planning would have to guess?
5. Blockers — anything that makes this feature unbuildable as scoped.

Output format: start with `VERDICT: PASS` or `VERDICT: FINDINGS` then numbered findings, each with the CONTEXT.md line/quote, why it matters, and the smallest fix. Max 5 findings, terse. Do not modify any files.
