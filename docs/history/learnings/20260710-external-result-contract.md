---
date: 2026-07-10
feature: external-result-contract
categories: [protocol, external-executors, review]
severity: medium
tags: [cli-executor, codex, finish-contract, cross-model-review, resume, agents-md]
---

# external-result-contract — file-checkable finish + first real external dispatch

## What Happened

Two repository-harness patterns (SYMPHONY_SCOPE §4.4/§4.6) were adapted into the External
Executors protocol: a finish contract (`.bee/workers/<cell-id>.result.json`, outcome = the four
status tokens as a cli transport, accept-by-file rule) and a durable workspace contract (the
prompt file as the stable contract path). The feature's own review became the protocol's first
real field test: a GPT reviewer was dispatched via codex CLI (prompt file → `-o` result → resume
rescue rounds) and found 4 real findings in round 1 plus a new ordering contradiction in round 2.

## Root Cause (per failure)

1. **Reviewer self-blocked on the AGENTS.md bootstrap (round-1 rescue round).** The worker prompt
   shape's step 1 is "Read AGENTS.md"; the repo's BEE block tells readers to stop and run
   onboarding when it looks stale. A read-only reviewer with "do not modify files" obeyed both and
   deadlocked. Wrong assumption: one worker template is safe for a non-mutating review pass.
2. **`codex exec resume` rejected `--sandbox` (exit 2, invisible).** Resume inherits the original
   session's sandbox/config; re-passing dispatch-time flags is invalid — and the protocol's default
   stderr suppression hid the flag-rejection until stderr was re-enabled.
3. **The author self-contradicted the protocol twice** (template-vs-suffix P1; result.json ordered
   after the terminal status-token message). Each sentence was locally plausible; the composed
   document was impossible to execute. Both were caught only by the independent cross-model
   reviewer — self-review checked local correctness, not end-to-end composition.

## Recommendation

- When dispatching an external CLI as a **reviewer** (or any read-only role), prepend an explicit
  scope-out before the template's "Read AGENTS.md" step: this process is read-only and must skip
  the bee-hive onboarding bootstrap — that workflow governs work sessions, not review passes.
  (Latent: the reviewer-dispatch path still lacks this line — filed as friction.)
- When building a resume/rescue command for an external CLI, do not re-pass dispatch-time flags
  (sandbox, model, config) — resume inherits them. When a rescue round returns an empty result,
  re-enable stderr immediately instead of guessing. (Shipped into the protocol text.)
- When a new instruction composes with a canonical or terminal element ("verbatim template",
  "as your last act", "final message"), re-read the fully composed artifact end-to-end as the
  executor would run it before shipping — and for protocol text, keep the independent
  different-model reviewer: it caught what the author missed twice in one day.
- When adopting an external harness pattern, port the acceptance rule, not the machinery: the
  4-token transport + accept-by-file landed with zero code, while the rejected pieces
  (partial/needs_intake enum, JSON schema validator, preemptive worktree shim spec) would each
  have rippled into hooks and docs for no acceptance gain.
