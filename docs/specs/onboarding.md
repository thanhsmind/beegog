---
area: onboarding
updated: 2026-07-16
coverage: partial
sources:
  - installer-version-parity-1-3-1 locked rules (fail-closed release tuple, full projection parity, greenfield/brownfield end-to-end success contract; D1/D3 verified in-engine with plugin-first coverage, D7 managed-set cleanup fencing, D2/D8 Linux Bash E2E shipped — cells -4/-2/-3, 2026-07-16; field fix cell -5: plugin CLI mutation verbs take NO --json (only `plugin list` does — real codex/claude contract), rollback reconciles the probed current state against the pre-run snapshot and reports failure only when restoring a previously-present plugin genuinely fails (a transition that died before installing anything rolls back as a no-op success), and the E2E fake CLIs reject --json on mutations so the wrong-flag contract can never test green again)
  - codex-sandbox-baseline cells codex-sandbox-baseline-1/codex-sandbox-baseline-2 (real onboarding entrypoint through the shared isolated test runner; full onboarding suite green, 2026-07-16)
  - codex-hook-state-parity cells 2, 3, 5 (paired Codex lifecycle audit, exclusive plugin-first/repo-copy distribution, and fresh-host handler delivery; capped traces and reports, 2026-07-16)
  - codex-harness-hardening-1d cells 1d-1/1d-2 (SRC-01..06 source-identity classifier R17 + status source field; 8 classifier/status tests, 2026-07-15)
  - codex-harness-hardening-1c cell codex-harness-hardening-1c-1 (honest status drift R16 via the onboarding managed-hash ledger; 5 drift tests, 2026-07-15)
  - codex-harness-hardening cell codex-harness-hardening-1b-1 (runtime-lib downgrade guard R15; split-brain regression 3->0, 2026-07-15)
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
  - 55ff17ef (release-version parity is fail-closed across every distributed projection)
  - 09b776b5 (both installers prove complete greenfield/brownfield postconditions before success)
  - fc76ce41 (release 1.3.1 excludes unfinished wait-loop/worktree-isolation work)
  - 17bfc14a (Codex-safe onboarding tests preserve the real CLI entrypoint and observable process contract through an isolated Worker)
  - a83a3613 (shared isolated runner for nested Node entrypoints; real Git/Bash/Codex integration remains external)
  - cf511ff3 (plugin/package and repo-copy sources are mutually exclusive; cleanup is integrity- and ownership-proof-gated in both directions)
  - ce4eee19 (SRC-01..06 shipped as a pure shared classifier, wrap-not-replace, consumed by status + onboarding — codex-harness-hardening 1d)
  - 21be04f7 (status gains a report-only source field; unknown/legacy never implicit source — codex-harness-hardening 1d)
  - 485e949a (honest status drift reference = the onboarding managed-hash ledger; no new shipped artifact — codex-harness-hardening 1c)
  - 579bbad7 (status drift is report-only, stays a boolean + optional detail; fail-open on absent/legacy ledger — codex-harness-hardening 1c)
  - fe6593c0 (runtime-lib downgrade refusal targets the vendored copy path; zero-mutation, self-install included — codex-harness-hardening 1b)
  - 3318374a (installer hardening: per-project skills default, global opt-in, default instructions import)
  - bbc6bcea (shim-retire: unified command surface; retired helper scripts removed from hosts)
  - 102efe08 (opt-in statusline vendor shape)
  - c6ee6b6e (Gate 4 onboard-statusline: anchored detection, sweep opt-in)
  - 4cc1c355 (Codex plugin-first distribution)
  - b7af1bf9 (full compatible Codex lifecycle-hook parity)
  - codex-hook-state-parity D1-D3, D8-D14
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

> **Coverage note:** this spec describes status-display vendoring, the managed
> ignore section, distribution-mode selection, exclusive hook-source
> arbitration, fenced cleanup, and installed-package proof. Remaining surfaces
> are listed under Open Gaps.

## Entry Points & Triggers

- A check run: the agent asks onboarding what would change (report-only, no writes).
- An apply run: the agent authorizes onboarding to perform the reported changes.
- Both runs are executed by the agent, never handed to the human.
- Plugin-capable installs default to a plugin-first check/apply transaction;
  `repo-copy` is an explicit fallback mode.
- A dry run plans the complete distribution transaction and mutates nothing.

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
| distribution mode | The exclusive source selected for one install: `plugin-first` or explicit `repo-copy`. The two are never active together. |
| release inventory | The complete, duplicate-free file set and package metadata that an enabled installed package must match before cleanup is authorized. |
| ownership ledger | The installer's exact record of user-runtime roots and directories it created; name similarity alone never grants deletion authority. |
| recognized bee hook entry | A hook entry whose event, matcher, and handler match the generated bee catalog. Foreign and user entries are never recognized by name alone. |
| whole-run snapshot | The inputs revalidated immediately before mutation: paths, aliases, symlinks, package status, inventory, ledger, and hook shapes. Any mismatch aborts the entire run with zero writes. |

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
status is entirely unaffected by this mechanism's existence. Such a project still
shows a status line if the human's user-level settings name a user-level copy — but
that copy is outside onboarding's reach and may be arbitrarily stale. Keeping it
current is a manual copy from the canonical pair, and nothing in bee detects or
reports its drift.

### What the status display renders

One line of session facts, then an optional second line of per-model token and cost
totals. Every segment is omitted when its fact is unavailable, and an unavailable
fact never fails the line (a missing subscription-usage report, a project outside
version control, a model without an effort setting — each simply drops its segment).

| Segment | Fact |
|---|---|
| location | The session's working directory, and its version-control branch when there is one |
| model | The model's display name, plus its reasoning-effort level when that level is not the default |
| context | Percentage of the context window **remaining** — never the percentage used |
| session usage | Percentage of the rolling short-window subscription limit consumed, when the runtime reports one |
| weekly usage | Percentage of the rolling weekly subscription limit consumed, when the runtime reports one |
| cost | Per-model new/cached token totals and their billed cost, aggregated over the session and every subagent transcript |

**Context colour is a workflow signal, not a gauge.** The colour of the context
segment answers one question — "does the human need to think about a handoff?" —
so its thresholds track bee's handoff mark (pause at roughly 65% of the window
consumed, i.e. ~35% remaining), not an even split of the scale:

| Context remaining | Colour | Meaning |
|---|---|---|
| above ~35% | calm (green) | routine work; nothing to do |
| ~20-35% | caution (yellow) | the handoff mark is here; start wrapping up |
| below ~20% | alarm (red) | write the handoff and pause |

The rule this encodes: an alarm colour that is on for most of a working session is
not an alarm. Any future retune keeps the caution band anchored on the handoff mark
for exactly that reason. The subscription-usage segments follow the same principle —
quiet by default, emphasized only once consumption is high enough to matter.

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

**Select and prove exactly one distribution source.** Plugin-first is the
default on a capable runtime. It proves an enabled installed package and its
complete release inventory, preflights the whole transaction, then removes only
direct plain `bee-*` skill directories and catalog-recognized bee hook entries
from project fallback roots. Repo-copy first proves the package inactive, then
generates the managed project projections; Codex-only receives the same hook
catalog as a combined-runtime install. Bash and PowerShell installers use the
same planner and proof rules. A symlink, alias, unknown target, invalid ledger,
package mismatch, or hook-shape mismatch aborts before any write. Release proof
uses a staged cachebuster without changing the canonical package/version tuple;
live user-home installation and fresh-thread loading remain outstanding UAT.
Every generated repository hook command must resolve to a handler included in
the same fresh-host onboarding payload; projection topology without referenced
file delivery is a failed install, even when catalog parity itself is green.

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

**Fetch the workflow source without a full working tree (bootstrap installs).**
Trigger: an install invoked with no local source, so the installer must fetch the
workflow from its published repository at some reference. What changes: the fetch
checks out only the trees the installer actually reads — the skill set and the
plugin manifest — never the whole tree. Why it matters: the workspace filesystem
of one supported platform rejects several characters that the source platform
allows in filenames (colon, asterisk, question mark, quote, angle brackets,
pipe), plus reserved device names and trailing dots or spaces; a single such path
anywhere in the reference aborts the *entire* working-tree materialisation, and
the install would otherwise proceed against an empty source and blame the
network. Narrowing the checkout makes the install independent of every path the
installer never reads, on any reference including historical released ones. After
the fetch the installer probes for the workflow's own bootstrap script and stops
with an explicit source error if it is absent — an empty source is never mistaken
for a network fault again. Companion rule (the other half of the same guarantee):
**every tracked path in this repository must be checkout-able on the restrictive
platform**, and the repository's verification command fails when any tracked path
carries a forbidden character, a reserved device name, or a trailing dot/space.

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

**Guarantee the second runtime's status display (machine-level, add-only).**
Trigger: any run on a machine whose second-runtime user config exists but
carries no status-line key — the second runtime has no per-project status
surface and no custom-script support, only a fixed-segment list in the user
config. What blocks it: the tool being absent (no user config file — onboarding
never creates it) or the key already being present, custom segments included: a
present choice is preference, never drift, and is left untouched byte-for-byte.
What changes: the canonical segment list (working directory, branch, model with
effort, context remaining, both rate-limit windows, tokens used — mirroring the
first runtime's status line) is spliced under the existing TUI section or
appended as a new one, with a backup written first. What the human observes:
after one apply per machine, the second runtime shows the same status story as
the first; a re-run plans nothing.

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
- **R5** — Plugin-capable runtimes
  receive bee primarily as one installable package containing the shared workflow
  skills and compatible lifecycle hooks. Release and reinstall update the package
  the runtime loads directly; project-local skill and hook projections remain an
  explicit fallback and dogfood route. One installation activates exactly one
  source so a skill or event never runs twice (decision 4cc1c355, extended by
  codex-hook-state-parity D9; decision cf511ff3).
- **R6** — On Codex, every lifecycle capability
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

- **R12** — Plugin-first is
  the default distribution when the selected runtime can install the package.
  Per-project copies are created only by the explicit repo-copy fallback; a
  machine-global copy remains explicit opt-in. The workflow's source tree is not
  a host-install target (codex-hook-state-parity D9/D10; supersedes the
  default-copy portion of decision 3318374a; decision cf511ff3).
- **R13** — The assistant-instructions import artifact is created by default on
  onboarding; declining it is an explicit opt-out. Content outside the managed
  import is never replaced without consent (decision 3318374a, D1).
- **R14** — The vendored command surface is a single unified dispatcher. The
  nine retired per-command helper scripts are deleted from a host on its next
  apply; removal is scoped to the exact retired filenames inside the managed
  tools directory and is idempotent (decision bbc6bcea, D1/D2).
- **R15** — Onboarding never downgrades a project's vendored runtime. Before
  vendoring its own runtime helpers into a project, it compares the running
  installer's runtime version against the version already installed in the
  project; if the installer is older, it refuses the **entire** apply before
  making any change and reports a blocked downgrade. This holds even in the
  self-install case — where the installer's own source tree lives inside the
  project it targets, so the per-project skill syncs are skipped — because the
  refusal is drawn from the runtime version alone, independent of any
  per-location sync. A refused downgrade changes nothing anywhere (zero
  mutation across every vendored file and the installation ledger). A project
  with no runtime yet is a fresh install and proceeds; a project whose
  installed runtime version cannot be read is treated as unknown and is also
  refused — never overwritten by an older or unreadable source. An explicit
  force override is honored only when both the source and the installed version
  are known release numbers (decision fe6593c0; cell codex-harness-hardening-1b-1).
- **R16** — The status report tells the truth about the vendored runtime. At
  install, onboarding records a per-file content fingerprint of every vendored
  helper and library module. The status report recomputes those fingerprints
  from the files actually on disk and reports **drift** whenever any managed
  file's content differs from what was recorded, a managed file is missing or an
  unrecorded one has appeared, or the recorded version differs from the running
  one — so a runtime altered without re-onboarding is caught **even when its
  version string is unchanged**. Drift stays a single true/false fact; an
  optional companion list names which files drifted. The report only *reports*:
  it never repairs — bringing the runtime back into agreement is an apply run.
  When no fingerprint record exists yet (a legacy installation) or it cannot be
  read, the check degrades to the version comparison alone and the report still
  renders — it never fails on a missing or unreadable record (decisions 485e949a,
  579bbad7; cell codex-harness-hardening-1c-1).
- **R17** — Source origin is named, never guessed from the nearest path. A single
  shared detector classifies the bee source tree into exactly one of five
  origins: a **canonical development checkout** (the authored source, carrying its
  package manifest and version-control marker), a **project's vendored copy** (a
  projection living inside a host project's assistant-runtime folders), an
  **installed package** (a distributed manifested snapshot — usable as the source
  for the same project's runtime and copies, but never permitted to install
  shared/global targets), the **legacy shared location** (the old machine-global
  root — only reported or migrated, never an implicit source), and **unrecognized**
  (a missing or unreadable manifest, or anything ambiguous). The status report
  surfaces this origin (report-only), and onboarding names the same origin using
  the same detector, so the two never disagree about identity. Classification is
  pure — it only reads, never changes anything, and never fails — and an
  unrecognized origin is named as such, never silently treated as an authoritative
  source that may overwrite an installation (decisions ce4eee19, b5341fe7,
  21be04f7; cells codex-harness-hardening-1d-1, 1d-2).
- **R18** — Plugin-first migration
  cleans duplicate skills and bee hook entries only after the installed package is
  reported enabled and its installed skills/hooks match the release inventory;
  command success alone is not proof. Skill cleanup candidates are derived by
  exact name from the `plugin_skill` records of the validated release inventory —
  never by name prefix — within the selected repository's Claude, shared-agent,
  and Codex skill roots; a directory whose name is not in that managed set (a
  project-owned `bee-custom` included) is skipped before any check. A missing,
  malformed, duplicate, or inconsistent inventory (zero managed skills, a
  non-`bee-` managed name, a bad path) refuses the whole cleanup before any
  mutation. Hook cleanup removes only catalog-recognized bee entries and preserves
  user entries and their container files. Non-bee entries, files, symlinks,
  aliases, unknown targets, and paths outside those roots make the whole cleanup
  refuse before mutation (codex-hook-state-parity D10/D11/D13; decision cf511ff3;
  managed-set fencing: installer-version-parity-1-3-1 D7, cell
  installer-version-parity-1-3-1-2, 2026-07-16).
- **R19** — Repo-copy fallback is
  the reverse exclusive transition: the installer first disables or uninstalls the
  bee plugin and verifies it inactive, then creates managed repository copies. If
  deactivation cannot be proven, nothing is copied or removed. User-runtime cleanup
  additionally requires a valid installer ownership ledger naming the exact root
  and directories; a name match alone does not authorize global deletion
  (codex-hook-state-parity D12/D14; decision cf511ff3).
- **R20** — Immediately before the first mutation, the installer revalidates a
  whole-run snapshot. Any path, symlink, alias, package, inventory, ledger, or
  hook-shape mismatch aborts the transaction with zero writes.
- **R21 (not yet implemented — installer-version-parity-1-3-1)** — An install
  has one release version across its authoritative source, enabled package,
  project runtime, and every project-local assistant capability copy. Every
  required source marker must exist, be readable, and agree before the target
  changes. Target surfaces may be absent for a new project, but every applicable
  one must exist and equal the validated source version before success; an
  existing unreadable or different target is never ignored. A successful run
  can never report one version while an assistant discovers another (decision
  55ff17ef).
- **R22 (not yet implemented — installer-version-parity-1-3-1)** — A top-level
  installer reports success only after the target reports the requested release
  version for both onboarding and the selected package source, reports no managed
  drift, and an immediate second check reports nothing left to update. A mere
  "installed" flag is not a sufficient success condition (decision 09b776b5).
- **R23 (not yet implemented — installer-version-parity-1-3-1)** — The Linux and
  Windows entry points prove the same observable outcomes for a new project and
  an already-onboarded project: all required onboarding information exists,
  owner content and prior workflow state survive an upgrade, managed capability
  copies move to the requested release, and repeating the run is idempotent
  (decision 09b776b5).
- **R24 (not yet implemented — installer-version-parity-1-3-1)** — Removing
  project fallback capabilities requires proof that each candidate belongs to
  the managed release set. Sharing the workflow's name prefix is not ownership;
  a project-owned capability remains untouched.
- **R25 (not yet implemented — installer-version-parity-1-3-1)** — Planning,
  preview, and dry-run never install, remove, or change a runtime package.
  Package transition begins only after confirmation and is exercised in an
  isolated environment that proves the ordering rather than bypassing it with a
  prewritten status response.

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
  merge rules, runtime-file creation, helper/lib vendoring, global skill sync, and
  the greenfield init lane. The runtime-**downgrade** protection is now specced
  (R15 — the self-install runtime-lib downgrade refusal, zero-mutation); the
  broader force-override reporting and per-skill-target sync details remain to
  harvest. Until then the authoritative description of the unspecced parts is the
  code and its test suites.
- Plugin-first/repo-copy implementation, fixture metadata, release inventory,
  lifecycle mapping, and repository verification are green. Real user-home
  install/reinstall plus fresh-thread loading remain outstanding because this
  environment exposes the Codex home read-only.
- P24 must replace executor presets that imply workspace isolation without
  actually enforcing it, and verify the effective sandbox/approval boundary.
- Custom Codex explorer/worker/reviewer profiles remain deferred under P25 until
  a live dispatch can select them and prove the resulting role configuration.
- Opt-out manifest cleanup (see Edge Cases) — backlog item filed 2026-07-11.

## Pointers (implementation)

- `scripts/lib/run-module-worker.mjs` — shared isolated test-entrypoint runner;
  preserves arguments, environment, stdout, stderr, and exit status without
  changing the production entrypoint.
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — the complete onboarding
  suite keeps its real and fixture-local entrypoints and all prior assertions
  while routing nested Node launches through the shared runner.
- `skills/bee-hive/scripts/plugin_distribution.mjs` and
  `skills/bee-hive/scripts/test_plugin_distribution.mjs` — shared strict
  planner/prover and the 22-case transaction suite used by both installers.
- `scripts/install.sh`, `scripts/install.ps1`, `.codex-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, and the release inventory/tuple tests —
  package wiring, cross-platform entrypoints, metadata, inventory, and staged
  cachebuster proof. Evidence: `.bee/cells/codex-hook-state-parity-3.json` and
  `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-3.md`.
- Fresh-host handler-delivery proof: `.bee/cells/codex-hook-state-parity-5.json`
  and `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-5.md`.
- `skills/bee-hive/scripts/onboard_bee.mjs` — `statuslineOptIn()`, plan stage 3b,
  `copy_statusline` apply case, `buildManagedVersions`/`subsetManaged` conditional
  `statusline` key.
- `skills/bee-hive/templates/statusline/` — canonical pair
  (`statusline-command.sh`, `statusline-usage.mjs`).
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — section 9c sandbox cases.
- `skills/bee-hive/templates/tests/test_lib.mjs` — statusline byte-equality sweep.
- Host-side settings contract: `.claude/settings.json` → `statusLine.command`.
- `skills/bee-hive/scripts/onboard_bee.mjs` — `CODEX_STATUS_LINE_BLOCK`,
  `codexUserConfigPath()`, `codexStatuslineMissing()`,
  `ensure_codex_statusline` plan/apply action (machine-level: `~/.codex/config.toml`,
  never repoRoot-joined).
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
