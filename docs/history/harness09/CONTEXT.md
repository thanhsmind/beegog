# CONTEXT — harness09 (adopt learn-harness-engineering items 1–5)

Scoping synthesis (surface-scope-earlier path — no exploring pass needed): the full gap
analysis lives in [docs/09-harness-course-adoption.md](../../09-harness-course-adoption.md),
approved by the user 2026-07-08. Decision log entry `48ac3323`. This file locks the
decisions the slices cite; the doc carries the evidence.

## Locked decisions

- **D1 — Commands record.** The host project's standard commands live in `.bee/config.json`
  under a new optional `commands` object: `{setup, start, test, verify}` — each an optional
  string. No `init.sh`, no new runtime file. The record is the primitive; scripts fork per-OS.
- **D2 — Baseline gate.** The AGENTS block Startup gains one step: run `commands.verify`
  once per session before claiming any cell. A red baseline is surfaced and becomes its own
  fix-first tiny cell — never build on red. Session finish gains the mirror condition:
  standard verify green before ending a substantial work chunk.
- **D3 — Surfacing.** `bin/lib/inject.mjs` includes the commands in the session preamble
  when present; `bee_status` prints them and warns (non-blocking) when absent. Both runtimes
  see them without discovery.
- **D4 — Capture path.** Onboarding prompts for the commands (optional, skippable);
  `bee-exploring` captures them on first contact with a repo where they are absent;
  `bee-scribing` keeps them current like any Pointers-level fact.
- **D5 — Friction layer taxonomy.** Friction backlog entries gain an optional `layer` field,
  fixed enum: `spec | context | environment | verification | state` (course L01 five-layer
  attribution). Additive only — no cell-schema validation change; `trace.friction` stays a
  free string.
- **D6 — Promotion order.** In `bee-compounding`, a review finding or user correction seen
  twice promotes **first** to an executable check (grep/lint line in a verify command, a
  guard, a hook denial); `critical-patterns.md` prose is the fallback for what cannot be
  mechanized.
- **D7 — Fresh Session Test.** Grooming's hunt gains the five-question probe, each mapped
  to its artifact (system-overview / reading-map / config commands / bee_status). An
  unanswerable question files a backlog item naming the missing artifact.
- **D8 — Denial-message contract.** [07-contracts.md](../../07-contracts.md) states:
  every refusal from `bin/lib/` or a hook names the rule, the reason, and the next
  command/action (ERROR/WHY/FIX). Existing strings audited against it; tests assert it.

## Scope boundary

Adopt-later items 6–10 of docs/09 (init lane, per-area grades, ablation cadence, UAT
scorecard, instruction metadata) are **out of scope** — each has a named trigger that has
not fired. Doc-08's pending items (intake.jsonl, interventions.jsonl, verify-all) stay
separate work; slice 2 is written so the layer taxonomy can be reused by interventions
later without rework.

## Constraints

- Skill-file edits follow `bee-writing-skills` discipline: the doc-09 course evidence is the
  recorded baseline rationale; every touched skill gets a CREATION-LOG note.
- Managed-file edits (AGENTS block, templates) bump versions so `onboard_bee.mjs` migrates
  cleanly; never touch AGENTS.md content outside the BEE markers.
- Every enforcement rule ships in `bin/lib/` first (both runtimes), hooks second — roadmap
  working agreement.
