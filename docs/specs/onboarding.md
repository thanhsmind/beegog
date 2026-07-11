---
area: onboarding
updated: 2026-07-11
coverage: partial
sources:
  - cell onboard-statusline-1 (verification_evidence, 2026-07-11)
  - docs/history/onboard-statusline/reports/review-correctness.md
decisions:
  - 102efe08 (opt-in statusline vendor shape)
  - c6ee6b6e (Gate 4 onboard-statusline: anchored detection, sweep opt-in)
---

# Onboarding

## Purpose

Onboarding installs and keeps current everything bee manages inside a host project:
the agent-instructions block, the runtime state files, the vendored helper commands,
and — for projects that opted in — the workspace status-display scripts. Re-running it
is always safe: it reports what would change before changing anything, and an
up-to-date project reports "nothing to do".

> **Coverage note:** this spec currently describes the **status-display (statusline)
> vendoring** behavior in full. The rest of the onboarding surface (instructions
> block, runtime files, helper vendoring, global skill sync, downgrade protection)
> is listed under Open Gaps awaiting harvest.

## Entry Points & Triggers

- A check run: the agent asks onboarding what would change (report-only, no writes).
- An apply run: the agent authorizes onboarding to perform the reported changes.
- Both runs are executed by the agent, never handed to the human.

## Data Dictionary

| Element | Meaning |
|---|---|
| status-display pair | Two scripts that render the assistant's per-session status line: the display command and its usage/cost aggregator. Canonical copies live with bee's source; each opted-in project holds a vendored copy. |
| opt-in signal | The project's assistant-settings file declares a status-display command that points at the **project's own** copy of the display script — either anchored by the project-directory variable or written as a bare project-relative path. A reference to a user-level (home-directory) copy is NOT an opt-in. |
| managed status-display record | A fingerprint per pair file, stored in the project's onboarding record **only when the project opts in**, so later runs can tell current from drifted. Projects that never opted in carry no such record. |

## Behaviors & Operations

**Detect (every run).** Onboarding reads the project's assistant-settings file and
derives the opt-in signal. What blocks it: nothing — an absent, unreadable,
unparseable, or unexpectedly-shaped settings file simply means "not opted in";
detection never fails a run. What the agent observes: opted-in projects with a
missing or altered pair file see one planned copy action per affected file;
non-opted projects see zero status-display actions, always.

**Vendor (apply run, opted-in projects only).** Each planned pair file is written
from the canonical copy, whole-file, atomically. Side effects: none beyond the two
files — the settings file is never created, modified, or backed up by this
behavior. Afterwards the project's status display renders with the canonical
behavior, and an immediate re-check reports up to date.

**Heal drift.** A locally edited pair file is treated as drift, not preference: the
next apply overwrites it with the canonical copy (same contract as every vendored
helper — the canonical source is bee's tree). A project that wants local
status-display behavior keeps its settings pointing at a user-level copy instead.

**Stay out (non-opted projects).** Projects without the opt-in signal never receive
the pair files, never gain a managed status-display record, and their up-to-date
status is entirely unaffected by this mechanism's existence.

## Actors & Access

- **Agent** — runs check and apply; the only actor that executes onboarding.
- **Human** — approves an apply when onboarding reports changes; owns the opt-in
  decision by editing their project's assistant settings (or not).

## Business Rules

- **R1** — Onboarding syncs the status-display pair only into projects already
  opted in; it never creates the opt-in and never touches the settings file in
  this stage (decision 102efe08).
- **R2** — Detection is fail-safe: any settings shape it does not positively
  recognize means "not opted in"; it never aborts or throws (decision 102efe08).
- **R3** — Only project-level references count as opt-in: the project-directory
  variable must anchor the script path itself, and bare relative references must
  not be preceded by another path segment. A user-level path containing the same
  script name, or the project-directory variable appearing elsewhere in the
  command, is not an opt-in (decision c6ee6b6e, review finding P2-1).
- **R4** — The canonical pair and an opted-in project's vendored copies must be
  byte-identical; a one-sided edit anywhere (including deleting the vendored
  copies while still opted in) is drift and fails the standing verification suite
  (decision c6ee6b6e, review finding P2-3).

## Edge Cases Settled

- Settings file unparseable → not opted in, run proceeds normally.
- Status-display command present but not a text value → not opted in.
- Project-directory variable used elsewhere in the command while the script path
  is user-level → not opted in (the review's adversarial case).
- Exactly one pair file drifted → exactly that file is re-planned, the other
  untouched.
- Opting out after having been opted in → the stale managed record is inert but
  currently survives; recorded as a known gap (backlog, paired with the
  equivalent behavior in the hook-vendoring mechanism).

## Open Gaps

- The remainder of the onboarding surface is unspecified here: instructions-block
  merge rules, runtime-file creation, helper/lib vendoring, global skill sync and
  its downgrade/force protections, hook vendoring, and the greenfield init lane.
  Harvest needed; until then the authoritative description is the code and its
  test suites.
- Opt-out manifest cleanup (see Edge Cases) — backlog item filed 2026-07-11.

## Pointers (implementation)

- `skills/bee-hive/scripts/onboard_bee.mjs` — `statuslineOptIn()`, plan stage 3b,
  `copy_statusline` apply case, `buildManagedVersions`/`subsetManaged` conditional
  `statusline` key.
- `skills/bee-hive/templates/statusline/` — canonical pair
  (`statusline-command.sh`, `statusline-usage.mjs`).
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — section 9c sandbox cases.
- `skills/bee-hive/templates/tests/test_lib.mjs` — statusline byte-equality sweep.
- Host-side settings contract: `.claude/settings.json` → `statusLine.command`.
