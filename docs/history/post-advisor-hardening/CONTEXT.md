# post-advisor-hardening — CONTEXT

Locked decisions (sourced from advisor-and-orchestration's learnings file `docs/history/learnings/20260717-guard-membership-escape-routes.md` and filed friction; no open product questions — the parent feature's own close-out named all three).

| ID | Decision | Rationale |
|---|---|---|
| H1 | **Onboarding-generator drift check (test-only).** A suite row derives the per-runtime hook sets from `hooks/catalog.mjs` (minus `ALLOWED_DIFFERENCES`) and asserts every onboarding generator inventory covers them: the vendored-hook list, the Claude settings template, and the codex repo-projection template. A hook added to the catalog without teaching the generators fails RED at baseline. | Closes the clobber class from learnings Addendum 2 (P2 friction): the checked projections self-correct via drift rows, the generator templates silently lagged and a live settings edit was clobbered by self-onboard. |
| H2 | **`cells add`/`cells update` manifest lint (advisory).** When a cell's `verify` mentions `release_manifest` and its `files` lacks `docs/history/codex-harness-hardening/release-manifest.json`, the verb prints a loud WARNING naming the trap and the fix. Warning, never refusal — the planner is the audience; a refusal would fight legitimate shapes. | Second sighting rule from Addendum 1 (P3 friction): both fresh 2A-iii cells hit the trap; mechanize the reminder at authoring time. |
| H3 | **Session-close B15 instruction names the consult step.** The gate-bypass net's instruction text (bee-session-close) tells the agent that a high-risk execution approval requires a live advisor consult first (record via `state advisor-ref record`), so the mechanized instruction can no longer steer into the AO3 throw uninformed. Prose/message text only; no behavior change to the net itself. | P3 friction from Slice 4's checker W2: the instruction was written pre-precondition and is now incomplete for high-risk. |

Out of scope: any new refusal, any runtime behavior change beyond H2's warning line, PBIs P33–P36.
