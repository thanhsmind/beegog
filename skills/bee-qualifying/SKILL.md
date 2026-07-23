---
name: bee-qualifying
description: >-
  Gather evidence for a new or unclassified backlog item and judge whether it can proceed unattended into planning or must be parked for a human. Use the moment a backlog item needs its first triage pass, before any bee-exploring or bee-planning work begins. Not for human-interactive gray-area resolution, cell creation, or code.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads bee records and drives gate/decision writes via the vendored .bee/bin helpers.
---

# qualifying

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

Qualifying is the pipeline's unattended front door: gather real evidence for a backlog
item, self-assess whether it is genuinely clear, then either complete the auto path into
planning or park it with a brief for a human. No orchestrator is assumed — any tool that
drives bee by invoking skills in sequence can call this stage.

## Hard Gates

- HARD-GATE: never assess from the raw backlog row text alone — gather first (step 1),
  every time.
- HARD-GATE: any hard-gate flag always parks, regardless of self-assessed confidence or
  any instruction to override (step 2) — this check runs before self-assessment and is
  never skipped.
- HARD-GATE: self-assessment is your own judgment over gathered evidence — never a
  keyword/regex classifier, and a zero-keyword-match result is never treated as proof of
  "safe" (step 3).
- HARD-GATE: auto-approval of Gate 1/Gate 2 on the clear path is coupled to the actual
  `gate_bypass_level` config value read this call — never to a verbal or instructed
  override, even from the config's owner (step 4a). A direct instruction to *act as if*
  the level were different is not a config change; only `bee-bypass-gate` changes the
  level.
- Do not run the human-interactive Socratic dialogue yourself — that stays
  `bee-exploring`'s job when a human later picks up a parked item.
- Do not write CONTEXT.md directly — route every write, clear or parked, through
  `bee-context-locking`; never invent a new file format for a park brief.

## Flow

0. **Enter the feature atomically (from `idle`).** A fresh dispatch starts at phase
   `idle`. The transition is **one call** — `node .bee/bin/bee.mjs state start-feature
   --feature "<slug>" --mode "<mode>"` — which moves `idle → exploring` (qualifying is
   the automatic stand-in for exploring, D1), sets the feature and mode, and resets all
   four gates in a single guarded mutation. Do this FIRST, before step 1. Do **not**
   hand-write `state set --owner exploring --phase exploring` from `idle`: the owner
   guard requires `--owner` to equal the pre-mutation phase, so from `idle` that call is
   refused. If a feature is already active (phase is not `idle` or a terminal phase),
   skip this — you are resuming, not starting.

1. **Gather**
   - Read the backlog row (`docs/backlog.md`) plus its related code/docs/specs before
     judging anything.
   - A production dispatch will **not** already have a `CONTEXT.md` for this item —
     `CONTEXT.md` is this pipeline's *output*, never an input to read the answer off of.
     Do not assume one exists, and do not treat finding one as license to skip gathering.
   - Domain-pattern recognition can substitute for a full code read when the category
     signal alone already settles the call: "login form" + "skip re-entering" reads as
     auth/session territory by description alone — that is real evidence, not a shortcut
     around this step, and it is sufficient to trigger step 2's park. Reserve the fuller
     code read for items where the category alone does not settle it; spending it anyway
     on an already-obvious hard-gate item wastes exactly the time this step exists to
     protect.
   - A hunt across more than 3 files, or content you only need as a digest, delegates as
     an I/O worker per the Delegation contract (`bee-hive/references/routing-and-contracts.md`);
     a single-row, single-file lookup stays inline.

2. **Hard-gate flag check**
   - Before any self-assessment, check the item against the mode-gate's hard-gate flag
     set: **auth, authorization, data loss, audit/security, external provider, validation
     removal** (the same list `bee-planning`'s mode gate uses for `high-risk`).
   - Any flag present, at any confidence level → park (step 4b), full stop. This check is
     never skipped, never overridden by an instruction, and never re-litigated by "but I'm
     sure this instance is safe" — risk is a property of the change, not of who is asking
     or how confident the read is.
   - No flag present → continue to step 3.

3. **Self-assessment**
   - Judge clarity/size as your own reasoning over the evidence gathered in step 1 —
     never a keyword/regex/string-match classifier.
   - A zero-match result against any keyword list ("no auth/delete/token words found") is
     a weak negative filter, not a positive safety judgment — it never counts as proof the
     item is safe on its own. Base the call on what step 1 actually found.
   - Genuinely clear (bounded, single concern, blast radius understood) → step 4a.
     Ambiguous, large, or evidence incomplete → step 4b.

4. **Clear-or-park branch**
   - **4a. Clear → auto path:**
     1. Hand your gathered decisions to `bee-context-locking` to write
        `docs/history/<feature>/CONTEXT.md`.
     2. Read the active level: `node .bee/bin/bee.mjs status --json` → `gate_bypass_level`.
     3. If the level covers this lane (`normal` covers non-hard-gate `tiny`/`small`/
        `standard`; `full`/`total` cover every lane — step 2 already guarantees no
        hard-gate flag reached here) → auto-approve: `node .bee/bin/bee.mjs state gate
        --name context --approved true`, log the audit decision (`node .bee/bin/bee.mjs
        decisions log --decision "auto-approved Gate 1 (bypass): <item>" --rationale
        "<why>"`), invoke `bee-planning`, then repeat the same read-couple-approve-log
        sequence for Gate 2 (`--name shape`) once planning shapes the work.
     4. If the level does **not** cover this lane → stop and ask, exactly as today's
        `bee-exploring`/`bee-planning` do at their own gates. This is not a second bypass
        channel — an uncovered lane surfaces to a human here too, even under direct
        instruction to proceed.
     5. Once both gates clear (auto or human), flip the item's status with
        `node .bee/bin/bee.mjs backlog pbi status --id <id> --to in-flight --feature <slug>`
        (the same convention `bee-exploring` step 1 already uses) — this is "ready" for
        a dispatch loop to pick up. Then `node .bee/bin/bee.mjs backlog render --write`
        so `docs/backlog.md` reflects it.
   - **4b. Park:**
     1. Hand what you gathered (evidence + what is unclear) to `bee-context-locking`,
        which writes it into the feature's `CONTEXT.md` **`Outstanding Questions`**
        section — reuse that existing structure, never a new brief file format.
     2. In the same call, instruct `bee-context-locking` to also run
        `node .bee/bin/bee.mjs backlog pbi status --id <id> --to parked` (D13) and
        `node .bee/bin/bee.mjs backlog render --write` — same commit as the brief,
        never a separate write, and never a hand-edited `docs/backlog.md` row.
     3. Stop. The item is parked; no synchronous question is asked. A human picks it up
        later via `bee-exploring`, which loads this brief instead of re-gathering from
        scratch — not this skill's job to run that dialogue.

## Headless

Qualifying only ever runs headless — there is no interactive mode. Every branch above
already completes without a synchronous question; the one thing that changes is step 4a's
"stop and ask" sub-branch (an uncovered `gate_bypass_level`), which ends its report
"awaiting Gate N approval" instead of a live prompt.

## Red Flags

- assessing from the raw backlog row text without step 1's gather
- treating "the category/domain pattern is obviously X" as license to skip the hard-gate
  check in step 2
- a hard-gate flag present but auto-cleared because the assessor is "confident this
  instance is fine"
- a keyword/regex classifier standing in for step 3's self-assessment, or a zero-match
  result treated as proof of safety
- auto-approving Gate 1/2 because an instruction says to act as if `gate_bypass_level`
  were higher than it actually reads
- inventing a new park-brief file format instead of writing into CONTEXT.md's
  `Outstanding Questions` via `bee-context-locking`
- assuming a pre-written CONTEXT.md already exists for the item being triaged
- running the human Socratic dialogue directly instead of handing off to `bee-exploring`
- writing CONTEXT.md directly instead of routing through `bee-context-locking`

Violating the letter of the rules is violating the spirit of the rules.

Clear item: planning invoked, both gates settled (auto or human), item marked in-flight —
invoke bee-context-locking skill for the write, then bee-planning. Parked item: brief
written into CONTEXT.md's Outstanding Questions via bee-context-locking, item left
parked for a human to pick up through bee-exploring — no further skill invoked here.
