---
name: bee-compounding
description: >-
  Capture durable learnings and decisions so future work starts smarter. Use when scribing completes, or when work is intentionally abandoned with lessons worth keeping.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads cell traces and logs decisions via the vendored .bee/bin helpers.
---

# Compounding (honey)

Compounding captures reusable lessons from completed work and feeds them back into future exploring, planning, and reviewing. Run it after `bee-scribing` completes, or when work is intentionally abandoned with lessons. Do not skip it for meaningful work just because the session feels done.

## 1. Gather Evidence

- `docs/history/<feature>/CONTEXT.md`, `plan.md`, worker reports under `docs/history/<feature>/reports/`
- cells and traces: `node .bee/bin/bee.mjs cells list --feature <feature>`
- review findings (including residual-findings.md, if present)
- feature commit history

If history artifacts are incomplete, fall back to the session summary and recent git diff. NEVER fabricate learnings — a thin honest entry beats an invented rich one.

§1 evidence gather and the §8 digest refresh delegate as extraction-tier I/O workers per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`) — the three analysts below are already tiered.

## 2. Analyze — Three Parallel Analysts

Launch three temp-finding subagents in parallel (prompts in `references/compounding-reference.md`):

| Analyst | Focus | Tier |
|---|---|---|
| pattern extractor | reusable code/process/integration patterns | extraction |
| decision analyst | important choices, tradeoffs, surprises | generation |
| failure analyst | blockers, wrong assumptions, regressions, missing checks | generation |

Subagents return temporary findings only — they NEVER write durable files. The orchestrator synthesizes.

## 3. Synthesize — One Learnings File

Write one dated file: `docs/history/learnings/YYYYMMDD-<slug>.md` with frontmatter (`date`, `feature`, `categories`, `severity`, `tags`) and sections **What Happened** / **Root Cause** / **Recommendation**. Recommendations are imperative future rules: "When X, do Y" — specific enough to act on. Template in the reference.

Before writing, redact secrets and PII from every evidence snippet. If a finding cannot be safely redacted, drop it and note the skip in the run summary. Secrets never enter learnings.

## 4. Promote Criticals — Check First, Prose Second

For a lesson that clears the bar below, the **first-choice promotion target is an executable check**: a grep/lint line appended to the affected area's verify command, a `bin/lib` guard, or a hook denial. A twice-seen review finding or user correction almost always qualifies — mechanize it and it can never recur; prose in `critical-patterns.md` taxes every session preamble and relies on being read. Prose is the fallback for what genuinely cannot be mechanized (judgment calls, product taste). File the check as a tiny/small cell if it cannot ship in the current feature.

Either way, promote sparingly — only when a lesson meets ALL three criteria:

1. **Multi-feature relevance** — it will matter beyond this feature.
2. **Meaningful waste prevented** — it would save future agents real time or real damage.
3. **Generalizable** — it is a rule, not an anecdote.

Ten findings rarely yield ten criticals. Keep critical-patterns.md high signal; a bloated file gets skipped, and then nothing compounds.

## 5. Log Durable Decisions

```
node .bee/bin/bee.mjs decisions log --decision "..." --rationale "..." [--alternatives "..."] [--confidence N]
```

Log choices future planning must honor. Supersede outdated decisions (`bee.mjs decisions supersede`) — never edit history.

## 6. Guard the State Layer (decisions 0001, 0002)

`bee-scribing` owns `docs/specs/`; compounding only verifies the handoff happened:

1. Check `.bee/state.json` for the feature's scribing record ("scribing: N specs synced" or "scribing: no sync needed").
2. Record present → note it in the run summary and move on.
3. Record absent while `behavior_change` cells were capped → **invoke bee-scribing now**, then resume compounding. Never merge specs inline "to save a step" — the BA-grade template, sources, and rebuild check live in scribing, and a shortcut sync produces exactly the shallow spec decision 0002 exists to prevent.

**Backlog done-flip fallback (D11b):** confirm the feature's `docs/backlog.md` row flipped to `done` with a `docs/history/<feature>/` link. Scribing owns that flip at sync; when scribing legitimately NOOPed (no `behavior_change` cell, nothing to sync), compounding is the last close point — do the done-flip here so no shipped feature leaves a stale `in-flight` row. Prose-ruled, never hook-enforced (D7).

**Review candidate at close (SPEC review-on-demand R3, flow 7.1 step 6):** the feature closes without independent review — that is the normal path, not a shortcut. Register the completed change set so it can be picked up by a later user-invoked review: `node .bee/bin/bee.mjs reviews candidate add --feature <feature> --head "$(git rev-parse HEAD)" --mode <lane>` (`<lane>` is the feature's lane — tiny/small/spike/standard/high-risk). Then post the completion line: "Completed and verified: N cells. Independent review not requested; the change set was added to review candidates." Never describe the close as reviewed or approved — the feature is truthfully `unreviewed` until a user-invoked review session covers this head (R10).

## 7. File Unresolved Friction

Unresolved friction from cell traces or the session → `node .bee/bin/bee.mjs backlog add --type friction --severity <P1|P2|P3> --layer <layer> --title "<friction>" --detail "<predicted impact>" --feature <feature>`, so `bee-grooming` can hunt them later. Field guidance in the reference.

## 8. Refresh the Feedback Digest (D1 — warn, never block)

After the learnings file is written, refresh the local feedback digest so the evolving-loop telemetry stays current:

```
node .bee/bin/bee.mjs feedback digest
```

Run this unprompted at every close — it is part of compounding, not an optional extra, and no user, teammate, or missing skill mention excuses skipping it. Per D1 the dogfood side stays zero-effort: this is a compounding side effect, never a task the host project has to think about.

**Warn, never block.** A failing or absent refresh — the command throws, `bee.mjs` is missing, or the helper is not installed — is a one-line warning in the run summary and **nothing more**. It NEVER blocks, fails, delays, or reverses a host project's feature close. A host project's close must never fail because bee wanted telemetry; a thrown digest is bee's problem to file as friction (step 7), not the feature's problem. "Something threw during close, stop the line" does not apply here — the digest is side-channel telemetry, explicitly non-load-bearing for the feature's correctness.

This holds **regardless of whether you recognize the error**. An unfamiliar, never-seen-before, or scary-looking stack trace (`TypeError`, `undefined`, "corrupted", anything) from `bee.mjs feedback` is STILL just a telemetry failure — it cannot corrupt the feature, its data, or its correctness, because the digest is a read-only side effect that runs after all feature work is already done and committed. "But I don't understand this specific error yet, so I should block until I do" is the loophole, not the exception: warn, file the exact error as friction (step 7) for bee to investigate later, and let the close proceed **now**. You never need to understand a digest error before closing; understanding it is post-close cleanup, never a gate.

**Never skip silently.** If the refresh is not run — for any reason, including context pressure, exhaustion, or an unfamiliar error — say so explicitly in the run summary and Handoff line (e.g. "digest refresh skipped: <reason>"). A silent omission is a violation even when the surrounding handoff template has no field for it; extend the handoff rather than emit a clean-looking close that hides the skip.

## 9. Update State

Record the completed compounding run: `node .bee/bin/bee.mjs state set --phase compounding-complete --next-action "<next action>" --summary "learnings: <file path>; promoted: <count>"`.

## Hard Gates

- Do NOT skip compounding for meaningful work. "The session feels done" is the rationalization, not a reason.
- Do NOT promote everything as critical — apply all three criteria.
- Do NOT write generic lessons ("test more carefully" is banned-grade advice). Concrete situation, root cause, imperative rule.
- Do NOT let subagents write durable files; the orchestrator synthesizes.
- Do NOT close out while `behavior_change` cells were capped but scribing never ran — invoke bee-scribing; never sync specs inline. A spec older than the behavior it describes is measured entropy, not a detail.
- Secrets and PII never appear in learnings, decisions, or backlog entries.

## Headless

`mode:headless`: gather, analyze, and write the dated learnings file for unambiguous findings; log clearly-durable decisions and friction. Critical promotions and ambiguous calls are NOT applied — they go to an `Outstanding Questions` section of the structured terminal report for the human. A missing scribing record is reported there too (headless compounding never invokes another skill on its own).

## Red Flags

- skipping compounding because the user left or the session feels done
- promoting most findings as critical
- vague advice with no situation or root cause
- inventing findings when artifacts are missing
- an analyst subagent writing to `docs/history/learnings/` directly
- an API key, token, or credential in an evidence snippet
- `behavior_change` cells capped but no scribing record — and compounding "fixing" it by editing `docs/specs/` itself
- closing without running the digest refresh because "the skill/teammate didn't ask for it" — it is a step, not an optional extra (Scenario 1)
- blocking or failing a host project's feature close because `bee.mjs feedback digest` threw — telemetry never stops the line; warn and file friction (Scenario 2)
- treating an *unfamiliar* digest error as exempt from warn-never-block — "I must understand this throw before I can close" is the loophole; a digest error never gates a close, understanding it is post-close cleanup (Scenario 2 REFACTOR)
- skipping the digest refresh under context/exhaustion pressure and saying nothing — a silent skip is a violation; disclose it in the summary and Handoff (Scenario 3)

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Compounding complete: learnings at `docs/history/learnings/YYYYMMDD-<slug>.md`, <N> critical promotions, state-layer guard checked. Invoke bee-hive skill.

| Reference | When to Load |
|---|---|
| `references/compounding-reference.md` | analyst prompts, learnings template, promotion format, backlog entry format |
