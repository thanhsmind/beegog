---
area: onboarding
updated: 2026-07-14
coverage: partial
sources:
  - installer-hardening ih-1..ih-6 (cells, 2026-07-13; flushed capture stub 92c9bcf6)
  - shim-retire D2 retirement pass (cells shim-retire-2, shim-retire-6 self-onboard proof, 2026-07-14)
  - cell onboard-statusline-1 (verification_evidence, 2026-07-11)
  - docs/history/onboard-statusline/reports/review-correctness.md
  - codex-runtime-parity D1 (distribution contract, 2026-07-11)
  - codex-runtime-parity D2 (lifecycle enforcement contract, 2026-07-11)
  - codex-runtime-parity D3 (nested-executor safety boundary, 2026-07-11)
  - codex-runtime-parity D4 (dispatch-contract scope, 2026-07-11)
  - bee-footprint D1 (managed ignore section, cells footprint-1/footprint-4, 2026-07-12)
  - fanout-delegation D1 (stale advisor key tolerance, 2026-07-12)
  - sticky-repo-hooks (cell sticky-hooks-1, 2026-07-13; found auditing 8 host projects after the v0.1.30 rollout)
decisions:
  - 3318374a (installer hardening: per-project skills default, global opt-in, default instructions import)
  - bbc6bcea (shim-retire: unified command surface; retired helper scripts removed from hosts)
  - 102efe08 (opt-in statusline vendor shape)
  - c6ee6b6e (Gate 4 onboard-statusline: anchored detection, sweep opt-in)
  - 4cc1c355 (Codex plugin-first distribution; not yet implemented)
  - b7af1bf9 (full compatible Codex lifecycle-hook parity; not yet implemented)
  - 73ed41d6 (workspace-scoped Codex executors; blanket bypass forbidden)
  - d7d5f459 (current Codex dispatch contract first; custom profiles deferred)
  - 26203bd3 (managed ignore-list section; machine-local vs team-durable split)
  - de967733 (advisor mode removed; stale config key warned-and-ignored)
  - 9927fafb (a switch that narrows what an upgrade compares must equally narrow what it claims; repo-hook opt-in is sticky)
---

# Onboarding

## Purpose

Onboarding installs and keeps current everything bee manages inside a host project:
the agent-instructions block, the runtime state files, the vendored helper commands,
and — for projects that opted in — the workspace status-display scripts. Re-running it
is always safe: it reports what would change before changing anything, and an
up-to-date project reports "nothing to do".

> **Coverage note:** this spec currently describes the **status-display (statusline)
> vendoring** and the **managed version-control ignore section** behaviors in
> full. The rest of the onboarding surface (instructions block, runtime files,
> helper vendoring, global skill sync, downgrade protection) is listed under
> Open Gaps awaiting harvest.

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
| managed ignore section | A clearly-marked, start/end-delimited block that onboarding owns inside the project's version-control ignore list. Every byte outside the delimiters belongs to the project and is never touched. |
| machine-local runtime record | Content the managed ignore section silences: workflow state, reservations, worker scratch, logs, capture queue, feedback snapshot, injection cache, the pause/handoff record, and disposable experiment files. |
| team-durable knowledge | Content that always stays version-tracked, never silenced by the managed ignore section: vendored tooling, configuration, the decision log, the friction log, and work-cell records. |
| ignore-section fingerprint | A hash of the managed ignore section's expected content, stored in the project's onboarding record so a later run can detect drift in that section specifically. |

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

**Manage the ignore section (every apply run).** Trigger: an apply run against
any host project, opted in or not — the managed ignore section is unconditional.
What blocks it: nothing; the three cases below are exhaustive and one always
applies. What changes: exactly one of —
- no ignore list exists yet → the list is created holding only the managed
  section;
- an ignore list exists without the section → the section is appended,
  inserting a guaranteed separating line break first even when the existing
  file's last line has none, so the section never fuses onto the file's last
  line;
- the section is already present but its content has drifted from the
  tracked fingerprint → only the bytes between the section's own markers are
  rewritten; every byte of the project's own content outside those markers is
  preserved exactly, unchanged.

A line that merely resembles the section's marker text inside a longer user
comment is never mistaken for the real marker, so it never triggers case two
or three by accident. Comparing the section's current content against the
fingerprint tolerates Windows-style line endings, so a line-ending-only
difference is never reported as drift and never causes a rewrite on every run.
Side effects: none beyond the ignore list file itself. What the agent
observes: the check run reports which of the three cases applies (or "current"
when the fingerprint matches) before anything is written; the apply run then
performs exactly that action and the ignore-section fingerprint in the
project's onboarding record is refreshed. What the human observes: an
up-to-date project's ignore list carries the section unchanged; a project with
drifted or missing section sees the report name the exact action before
approving it.

**Warn on already-tracked silenced paths (every run).** Trigger: any run,
check or apply, where one or more of the paths the managed ignore section is
meant to silence are already tracked in the host project's version-control
index — ignore-list entries are inert for paths already tracked, so the
managed section alone cannot silence them. What blocks it: nothing; this is
report-only. What changes: nothing to the host's version-control index —
onboarding never runs the untracking operation itself, in this or any other
behavior. Side effects: none. What the agent and human observe: the report
carries one warning naming the count of already-tracked paths and the exact
one-time command the operator must run to untrack them; the warning
disappears once no silenced path remains tracked.

**An opt-in is remembered, and what it opted into stays current (every run).**
Trigger: any run against a project that has previously opted into carrying its
own local copies of the lifecycle guardrails. What changes: those local copies
are refreshed to the current ones on **every** run thereafter — whether or not
the request repeats the opt-in switch. Why: the switch names a *choice the
project made*, not a consent owed again at each upgrade. What each actor
observes: an owner who opted in once sees their guardrails track the workflow's
own version, silently and permanently; a project that never opted in is still
never handed local guardrails by a plain run — the remembered choice is the only
thing that carries, never a default. What used to happen instead, and is the
reason this behavior is stated explicitly: a plain upgrade refreshed the standing
instruction sheet, the helpers, and the recorded version, left the guardrails at
whatever version they were first installed at, and **reported the project up to
date** — so a project could run current doctrine against its original guards
indefinitely, with no signal anywhere that it was doing so.

**Install skills into the project itself (every install/apply).** Trigger: an
install or apply against a host project. What changes: the workflow's skill set
is synced into the host project's own skill-discovery locations — one per
supported assistant runtime — and those copies are version-tracked in the host,
so every teammate receives working skills with a plain checkout. A machine-global
skill install happens only on an explicit opt-in switch, never by default; and
when the target is the workflow's own source tree, the per-project copy is
skipped (the source is already authoritative there). What each actor observes: a
fresh clone of an onboarded host has working skills with zero machine-level
setup; an operator who wants one shared machine-wide set asks for it explicitly.

**Provide the assistant-instructions import by default.** Trigger: onboarding a
host whose assistant reads a project instructions file that can import the
standing instruction sheet. What changes: the import artifact is created (or its
managed import line added) by default; declining it is an explicit opt-out
switch, not an omission. Existing content outside the managed line is never
replaced without consent. What the human observes: a freshly onboarded project
"just works" in a new session without manually wiring instructions.

**Retire superseded helper scripts (every run).** Trigger: any run against a
host that still carries one of the nine retired per-command helper scripts in
its vendored tools directory — hosts onboarded before the command surface was
unified into the single dispatcher. What blocks it: nothing. What changes: the
check run plans one removal per leftover retired script; the apply run deletes
exactly those files. Removal is scoped to the exact retired filenames inside the
managed tools directory — no other file is ever deleted by this pass. Side
effects: none. What each actor observes: after one apply, the host's tools
directory carries only the unified dispatcher with its libraries and guardrails;
a second run plans zero removals; a freshly onboarded host never receives the
retired scripts at all. The installer's own post-install verification and its
printed quickstart also speak only the unified dispatcher's status command.

**Wire the second-runtime guards (repo-hook installs).** Trigger: any run for a
project that vendors repo-local hooks (the explicit opt-in flag or its sticky
record). What blocks it: nothing — the projection is derived from the same hook
catalog as the first runtime's wiring. What changes: the second runtime's
project hook file is created or merged so every guarded lifecycle event
(session start, prompt, pre-write guard, post-task sync, subagent close,
pre-compaction, session close) runs the same vendored guard scripts. Merge
discipline: entries the project owner added themselves are preserved verbatim;
bee-shipped entries in ANY historical shape — including wiring that resolved
through the first runtime's project variable (dead on the second runtime) and
the source-repository layout — are replaced by the canonical render, never
preserved beside it (a stale twin would fire every event twice); a pre-existing
file is backed up before the first rewrite; a second apply changes nothing.
Two pinned asymmetries with the first runtime, both catalog-declared: the
model-tier guard is not wired (the second runtime does not expose agent spawn
through a pre-tool event), and every command resolves the project root from the
session's working directory with a visible fail-open when there is none. What
the human observes: after updating, the second runtime's hook panel lists the
full bee guard set for the project (trust must still be granted once, in that
runtime, per project — the installer cannot grant it).

**Guarantee the state-layer landing pages (every apply run).** Trigger: any
apply where the project lacks its reading map or its system overview in the
specs area. What blocks it: nothing. What changes: each missing file is created
as a small skeleton that names its owner (the spec-sync discipline) and points
the reader to a bootstrap pass; an existing file is NEVER touched, drifted or
not — content belongs to spec-sync, existence belongs to onboarding. What the
human observes: "read the spec before the code" and "where does X live" have a
landing page from day one in every onboarded project.

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
- **R5 (not yet implemented — P24)** — Codex receives bee primarily as one
  installable plugin containing the shared workflow skills and compatible
  lifecycle hooks. Project-local Codex hook wiring remains a fallback and
  dogfood route; one installation activates exactly one hook source so an event
  never runs twice (decision 4cc1c355).
- **R6 (not yet implemented — P24)** — On Codex, every lifecycle capability
  exposed compatibly by the host participates in bee's mechanical belt: session
  bootstrap, phase reminders, write/privacy/reservation checks, state refresh,
  worker-completion nudges, and close-time hygiene. Shared helper commands remain
  authoritative when a host path cannot be intercepted; such gaps fail open,
  stay visible to the operator, and have runtime-specific tests (decision
  b7af1bf9).
- **R7 (not yet implemented — P24)** — A nested Codex worker or reviewer starts
  with write access limited to the active workspace and keeps normal approval
  behavior. Bee never grants a blanket approval-and-sandbox bypass; broader
  access is a separate human decision for one named command (decision 73ed41d6).
- **R8 (not yet implemented — P24; profiles deferred to P25)** — Codex dispatch
  guidance matches the collaboration interface the runtime actually exposes,
  including explicit clean-context spawning and continuation. Bee does not ship
  named Codex agent profiles until swarming can select and verify those profiles;
  unused configuration is not parity (decision d7d5f459).
- **R9** — The managed ignore section covers only machine-local runtime
  records (workflow state, reservations, worker scratch, logs, capture queue,
  feedback snapshot, injection cache, the pause/handoff record, disposable
  experiment files); team-durable knowledge (vendored tooling, configuration,
  the decision log, the friction log, work-cell records) always stays
  version-tracked and is never added to the section (decision 26203bd3).
- **R10** — The managed ignore section is created, appended with a guaranteed
  separator, or content-rewritten depending on the ignore list's current
  state; every byte outside the section's own markers is preserved exactly,
  and a line only resembling the marker text is never treated as the marker
  (decision 26203bd3).
- **R11** — Onboarding never modifies the host project's version-control
  index; when a path the managed section is meant to silence is already
  tracked, the report warns and names the exact one-time untrack command for
  the operator to run instead (decision 26203bd3).

- **R12** — Skills ship per-project by default: synced into each supported
  runtime's project-level discovery location and version-tracked in the host
  repo; a machine-global install is explicit opt-in only; the workflow's own
  source tree never receives per-project copies (decision 3318374a, D2/D3/D4).
- **R13** — The assistant-instructions import artifact is created by default on
  onboarding; declining it is an explicit opt-out. Content outside the managed
  import is never replaced without consent (decision 3318374a, D1).
- **R14** — The vendored command surface is a single unified dispatcher. The
  nine retired per-command helper scripts are deleted from a host on its next
  apply; removal is scoped to the exact retired filenames inside the managed
  tools directory and is idempotent (decision bbc6bcea, D1/D2).

## Edge Cases Settled

- Settings file unparseable → not opted in, run proceeds normally.
- Status-display command present but not a text value → not opted in.
- Project-directory variable used elsewhere in the command while the script path
  is user-level → not opted in (the review's adversarial case).
- Exactly one pair file drifted → exactly that file is re-planned, the other
  untouched.
- A host `.bee/config.json` still carrying the removed `advisor` key → parses
  normally with the key stripped from the parsed result; the onboarding report
  and the status command each surface one identical warning line telling the
  owner to delete it — warn, never error (feature fanout-delegation D1, decision
  de967733; the duplicated warning text is pinned by a drift test).
- Opting out after having been opted in → the stale managed record is inert but
  currently survives; recorded as a known gap (backlog, paired with the
  equivalent behavior in the hook-vendoring mechanism). Now sharper than when it
  was filed: the remembered opt-in is what keeps guardrails current, so it is
  also what a genuine opt-out would have to clear.
- **A partial upgrade that reports success is worse than one that fails.** The
  upgrade path refreshed every part of a project it compared, and compared every
  part except the one the request had not explicitly named — so the unrefreshed
  part was not merely skipped, it was *excluded from the up-to-date judgment* and
  the project was pronounced current. Eight projects ran that way across several
  versions. Whenever a switch narrows what a run compares, the switch's absence
  must narrow what the run *claims*, never only what it does.
- A local guardrail file deleted or corrupted in a project that opted in → the
  next plain run restores it from source. Nothing else in the project is touched.
- No ignore list present at all → one is created holding only the managed
  ignore section (feature bee-footprint, decision 26203bd3).
- Ignore list present but missing a trailing line break → the managed
  ignore section is still appended cleanly, on its own line, never fused onto
  the file's last line (feature bee-footprint, decision 26203bd3).
- A user comment line that merely resembles the managed section's marker text
  → never mistaken for the real marker, so the section is not duplicated or
  corrupted around it (feature bee-footprint, decision 26203bd3).
- Managed ignore section present with Windows-style line endings → not
  reported as drift and not rewritten; only real content differences trigger
  a rewrite (feature bee-footprint, decision 26203bd3).
- A path the managed section is meant to silence is already tracked in the
  host's version-control index → the report warns and names the exact
  one-time untrack command; onboarding never runs it itself (feature
  bee-footprint, decision 26203bd3).

## Open Gaps

- The remainder of the onboarding surface is unspecified here: instructions-block
  merge rules, runtime-file creation, helper/lib vendoring, global skill sync and
  its downgrade/force protections, hook vendoring, and the greenfield init lane.
  Harvest needed; until then the authoritative description is the code and its
  test suites.
- P24 must define the transition from manually copied Codex skills and project
  hooks to the plugin-first contract, including how an installation detects and
  avoids duplicate hook sources.
- P24 must map each Codex lifecycle event and tool path to its observable bee
  outcome, and state every path that remains helper-enforced because the host
  cannot intercept it.
- P24 must replace executor presets that imply workspace isolation without
  actually enforcing it, and verify the effective sandbox/approval boundary.
- Custom Codex explorer/worker/reviewer profiles remain deferred under P25 until
  a live dispatch can select them and prove the resulting role configuration.
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
- `skills/bee-hive/scripts/onboard_bee.mjs` — `renderCodexHookEntries()`,
  `mergeCodexHooks()`, `isBeeCodexHookEntry()` (any-transport bee-entry
  matcher), `merge_codex_hooks` plan/apply action, `.codex/hooks.json`
  pseudo-entry in `buildManagedVersions`; `READING_MAP_STUB`/
  `SYSTEM_OVERVIEW_STUB` + `create_specs_stub` (create-only) — host contract:
  `.codex/hooks.json`, `docs/specs/reading-map.md`, `docs/specs/system-overview.md`.
- `skills/bee-hive/scripts/onboard_bee.mjs` — `GITIGNORE_MARKER_START`/`_END`,
  `GITIGNORE_START_RE`/`_END_RE` (marker-resemblance guard),
  `gitignoreBlockPresent`, `normalizeGitignoreForCompare` (CRLF tolerance),
  `create_gitignore_block`/`append_gitignore_block`/`update_gitignore_block`
  plan actions, `trackedGitignorePaths`/`trackedPathsNotices` (already-tracked
  advisory, never runs `git rm` itself), `gitignore_block` fingerprint field.
