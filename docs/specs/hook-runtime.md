---
area: hook-runtime
updated: 2026-07-16
sources: [codex-hook-state-parity cells 2, 3, 5 (paired Codex subagent audit, package authority, exclusive hook-source arbitration, and fresh-host handler delivery; capped traces and reports, 2026-07-16); codex-sandbox-baseline cells codex-sandbox-baseline-2/codex-sandbox-baseline-4 (nested test entrypoints use the shared isolated runner; external integration keeps real status/output grading, 2026-07-16); codex-runtime-parity Safety foundation — cells codex-parity-2, 2b, 3, 4 (traces in .bee/cells/), reports in docs/history/codex-runtime-parity/reports/; codex-runtime-parity repo-fallback capture 2026-07-12 — cells codex-parity-6a, 6b; bee-footprint D2 (cell footprint-2, 2026-07-12); dispatcher-unify du-2 (2026-07-12, flushed capture stub 9e68432b); shim-retire D3 transition guard (cell shim-retire-3, 2026-07-14)]
decisions: [codex-hook-state-parity D1-D3, D8-D13; a83a3613 (shared isolated runner for nested Node entrypoints; real Git/Bash/Codex integration remains external); codex-runtime-parity D1, D2; 0023; d91a8398-2d63-426b-a133-341568453200; 5e6582af-57b7-442f-9ded-b3eda61f5543; 8ed35504 (write-guard always-writable set shrinks); bbc6bcea (shim-retire D3: dual command-shape recognition, retired form transitional); cf511ff3 (installed plugin package is authoritative; source arbitration and cleanup are proof-gated)]
coverage: partial
---

# Hook Runtime (lifecycle guardrails)

## Purpose

While an AI assistant works inside a bee-managed project, a set of lifecycle
checkpoints runs around it: session start context, per-prompt reminders, write
protection, dispatch auditing, state refresh, worker nudges, and close-time
hygiene. This area describes what those checkpoints guarantee, on which
assistant runtime, and what happens when input is hostile or a path is
unsupported. The guardrails are a safety net, not a security boundary — the
durable project instructions and the shared helper checks remain the final
belt for anything a checkpoint cannot see.

## Entry Points & Triggers

- A supported assistant runtime (two are supported today) fires a checkpoint at
  each lifecycle event: session start, user prompt submitted, before a tool
  runs, after tracked task updates, before context compaction, when a child
  agent starts, when a child agent stops, and when the session stops.
- Which checkpoints are active comes from one **catalog of record** rendered
  into projections. Each supported runtime consumes only its own projection;
  the projections differ only by an explicitly named allowed list. There are
  three directional differences: Claude alone has the pre-spawn model-tier
  guard, while Codex alone has child-start and child-stop lifecycle audits.
- One runtime loads its checkpoints from two possible delivery locations: a
  packaged location, and its own project's source-repository fallback
  location. Both are rendered from the same catalog of record, at an explicit
  rendering target, using the same per-checkpoint handler wiring — the
  fallback is never a hand-authored or forked copy of the packaged rendering.

## Data Dictionary

| Element | Meaning |
|---|---|
| catalog of record | The single logical definition of every checkpoint: event, matcher, handler. Both runtime projections are rendered from it deterministically — rendering again must reproduce both byte-for-byte. |
| projection | The runtime-specific checkpoint list a given assistant actually loads. One per runtime, checked in, never hand-divergent. |
| allowed difference | A named, exported exception explaining why one projection carries a checkpoint the other lacks. Any un-named difference between projections is a defect. |
| native-subagent audit | A silent, bounded lifecycle record written after a Codex child starts or stops. It is evidence only: never authorization, never a block, and never a replacement for pre-spawn control. |
| fail-open | On unreadable/hostile input or an internal crash, the checkpoint permits the action and logs the gap visibly. It never silently swallows the event. |
| fail-closed (deny) | The checkpoint blocks the action with a corrective message telling the actor how to proceed correctly. |
| advisory | A checkpoint message that informs the assistant without blocking or continuing any turn — delivered as a parseable structured message, never as a turn-control verdict. |
| coverage gap | A named event/path the runtime cannot intercept, logged visibly at runtime and listed here — never claimed as protected. |
| reviewed definition | The exact command definition the owner has inspected and trusted. A new or changed non-managed definition does not run until it is reviewed again. |
| rendering target | Which delivery location a projection is being produced for: the packaged location, or the project's own source-repository fallback location. Same catalog, same handlers; only the concrete checkpoint command differs by target. |
| source identity | An explicit marker a rendered checkpoint command passes to its shared handler, stating which rendering target launched it, so the handler can log or branch on provenance instead of guessing from environment. |
| always-writable location | A small named set of locations a write may target without the active feature's gate routing, because the content is machine-local and disposable — today: the workflow's own state/log directory and, inside it, a dedicated subfolder for disposable experiment work. Removing a location from this set only tightens governance; adding one is a deliberate, reviewed decision. |

## Behaviors & Operations

**B1 — Hostile-input immunity (every checkpoint).** Whatever arrives on a
checkpoint's input — empty, garbage bytes, null, a list where an object was
expected, a wrong-typed working directory, or a multi-megabyte payload — the
checkpoint normalizes it before touching any field. It never crashes the
assistant's turn. The decision it would have made is never *flipped* by an
internal failure: a crash in logging or loading support code ends in fail-open
with a visible log entry, not in a new allow or a new deny. Every actor
observes either the normal outcome or a logged fail-open — never a stack trace
ending the turn.

**B2 — Advisories never steer the conversation.** Close-time, compaction, and
child-stop checkpoints only inform: their output is a structured message the
runtime displays/parses. They never emit a turn-control verdict, because on
those events a verdict would resume a stopped child or loop the main turn.

**B3 — Batch file-change requests are guarded per target.** When the runtime
announces a batch file-change request (the patch-style tool), the write guard
parses every add/update/delete/move target and runs each one through the same
gate, direct-edit, and reservation decisions that govern single writes.
- All targets provable → each target decided on its own; one denied target
  denies the request with a corrective message.
- Request intercepted but targets NOT provable (no parsable change lines, a
  blank path, a target resolving outside the project) → **deny** with a
  corrective message. An intercepted-but-unreadable batch is never waved
  through.
- The outer event itself malformed (no batch envelope present at all) →
  fail-open, logged: the guard cannot know a write was intended.

**B3a — Workflow-command requests are shape-checked against the published
catalog.** When a shell request invokes a workflow verb, the guard resolves the
command against the catalog of record — including verbs whose full name is
three words deep (group, sub-group, action) — and validates the required
parameters and value shapes before the command runs. A malformed invocation is
denied with the command, the missing or wrong field, and the corrective shape;
a well-formed one proceeds untouched. Deep verbs previously escaped this check
unvalidated (a silent fail-open); they no longer do.

**B4 — Worker nudges reach the right worker.** The child-stop nudge matches a
returning worker by its registered identity (the same identity workers use to
reserve files); an unregistered child still gets the generic nudge.

**B5 — Two projections, one truth.** Changing the catalog of record and
re-rendering updates both projections in the same change; the parity check in
the installation suite compares the assistant-facing settings against the
correct projection for that runtime and fails on any un-allowed drift. Each
difference is declared by runtime, event, and handler, and each projection is
proved independently.

**B6 — Project checkpoints are active, rooted, and reviewed.** Project
checkpoints are enabled unless an active configuration explicitly disables
them. A checkpoint command starts with the session's working directory, which
may be below the project root, so a project-local command first resolves the
project root and then launches its handler. A new or changed non-managed
definition is listed for review and skipped until the human owner trusts that
exact definition. Afterwards, a fresh lifecycle event uses the reviewed
definition; until then the assistant continues without that checkpoint and the
owner sees the pending-review warning.

**B7 — The source-repository fallback is derived, not authored.** The
fallback delivery location's checkpoint file is produced by rendering the
catalog of record at the source-repository target. Release proof renders fresh
root and nested-directory fixtures; a checked-in project snapshot is tested
separately as a development/fallback artifact and never substitutes for package
proof (codex-runtime-parity cell 6a; codex-hook-state-parity cells 2-3).
Fresh-host proof also requires every handler filename referenced by the rendered
projection to exist in the copied handler payload; structural parity without
artifact delivery is not a working fallback (codex-hook-state-parity cell 5).

**B8 — Fallback checkpoint commands are environment-independent.** A
checkpoint command rendered for the source-repository target does not depend
on any environment variable that only the packaged delivery location
provides. Instead, at launch it resolves the project root itself from the
current working directory and only then hands off to the shared checkpoint
handler, passing an explicit source identity so the handler knows it was
launched from the fallback rather than the packaged location. This
resolve-then-handoff step succeeds from the project root and from any working
directory nested below it, including paths containing spaces or non-ASCII
characters (codex-runtime-parity cells 6a, 6b).

**B9 — Launch-setup failure and a computed decision are different things.**
Before a fallback checkpoint command reaches its shared handler, it must
complete its own root-resolution/launch setup. If that pre-handoff step
cannot complete, the checkpoint today fails open **visibly**: it writes
exactly one diagnostic to the error stream, writes nothing to the output
stream, and exits success — never the silent crash this replaced. Once the
shared handler is reached, its own outcome — ordinary success or a deliberate
denial — passes through the launch step unchanged (codex-runtime-parity cell
6a; see Open Gaps — this default is under active revision for checkpoints
capable of denial).

**B10 — Session-stop handlers speak JSON or say nothing.** Both handlers
wired to the session-stop checkpoint exit success. Whichever of them produces
output at all produces a single non-empty payload that parses as JSON
carrying a human-readable summary field, and never a turn-control block
verdict — consistent with B2 (advisories never steer the conversation). A
handler with nothing to report stays completely silent rather than emit a
placeholder (codex-runtime-parity cell 6b).

**B11 — A repo-root disposable-experiment location is no longer
always-writable.** Trigger: a write targeting the former repo-root
disposable-experiment location. What blocks it: the same gate routing that
governs any other source path — the active feature's phase and gate state —
exactly as for a path outside the always-writable set; nothing exempts this
location anymore. What changes: this location moves from always-writable to
governed, strictly shrinking the always-writable set by one entry; disposable
experiment work itself continues unblocked, but now inside the workflow's own
always-writable directory, under a dedicated subfolder that location's
existing allowance already covers. Side effects: the close-time nudge's own
always-writable set shrinks identically, so a write left in the old location
is flagged there too, not only by the write guard. What actors observe: the
assistant sees the same corrective deny/allow outcome it would see writing to
any other governed source path; the human owner sees no new prompt — the
location simply stopped being an exception (bee-footprint D2).

**B12 — No active work means no source writes — a finished feature is not an
open door.** Trigger: any write to a governed path while the workflow sits in a
terminal state — either *nothing has started yet* or *the last feature has
closed* (workflow-state: the two terminal states, and the only two from which a
new feature may start). What blocks it: the intake gate, which denies the write
and names the terminal state it fired on, telling the assistant to route the
request through the workflow first. What is still allowed: the always-writable
set plus the knowledge locations (docs, plans, the workflow's own directory) —
the closing steps of a feature, spec sync and learning capture, must keep
writing after that feature closes. Why the state and not the gates decide this:
a closed feature leaves its approvals **behind it**, still recorded as
approved. Reading approvals alone, a finished feature is indistinguishable from
an approved one, so the guard reads the state — the phase — and the moment work
is no longer active the door is shut regardless of what the last feature was
allowed to do. Escape hatch: unchanged — a repository may disable the intake
gate entirely in its configuration, and doing so disables it for both terminal
states alike, never one but not the other (decision c2c46488).

**B13 — Codex records paired native-subagent lifecycle evidence.** The same
bounded audit handler receives child-start and child-stop events. It records
only bounded lifecycle identifiers and never prompt, transcript, environment,
credentials, or secrets. Malformed input and write failures stay silent and
fail open; the handler has no deny or block path.

**B14 — Exactly one bee hook source is active.** An installation selects the
package projection or the project fallback. Package activation is proved before
recognized fallback entries are removed; fallback activation is proved only
after the package is known inactive. User and foreign hook entries survive.

## Actors & Access

- **The assistant** (either runtime) — subject of every checkpoint; observes
  context injections, denials with corrective messages, and advisories.
- **The human owner** — sees deny messages surfaced by the assistant and the
  visible gap log; approves anything the guardrails escalate (privacy reads,
  gates).
- **Workers (child agents)** — same write rules as the main assistant;
  additionally matched by registered identity for nudges.

## Business Rules

- R1 — One catalog of record; projections are rendered, never hand-edited;
  all three directional differences must be exported by name
  (codex-runtime-parity D1; codex-hook-state-parity D1-D3).
- R2 — A checkpoint failure never flips an allow/deny decision; fail-open is
  visible, never silent (codex-runtime-parity D2).
- R3 — An intercepted batch change with unprovable targets is denied, not
  fail-opened (codex-runtime-parity D2, strengthening).
- R4 — Advisory events never emit turn-control verdicts (codex-runtime-parity D2).
- R5 — Every dispatch of a subagent carries an explicit model-tier transport
  and is audit-logged (decision 0023; the audit checkpoint is an allowed
  difference — it exists only where the runtime exposes dispatch).
- R6 — Project checkpoints are enabled by default, resolve project-local
  handlers from the project root even when a session starts below it, and any
  changed non-managed definition requires fresh human review before execution
  (decision d91a8398-2d63-426b-a133-341568453200).
- R7 — The source-repository fallback checkpoint file is generated from the
  catalog of record at an explicit rendering target and is never
  hand-authored; the installation suite reproduces the rendering and fails on
  any byte drift (codex-runtime-parity cell 6a).
- R8 — A source-repository fallback checkpoint command must not depend on
  environment that only the packaged delivery location provides; it resolves
  the project root itself at launch and must succeed from the project root
  and from nested working directories, including paths with spaces and
  non-ASCII characters (codex-runtime-parity cells 6a, 6b).
- R9 — A fallback checkpoint's pre-handoff launch-setup failure fails open
  visibly today — one diagnostic on the error stream, nothing on the output
  stream, success exit — while the shared handler's own decision (ordinary
  success or deliberate denial) passes through that launch step unchanged
  (codex-runtime-parity cell 6a; under revision for deny-capable checkpoints,
  see Open Gaps).
- R10 — Every session-stop handler exits success; any non-empty output from
  it parses as a single JSON object carrying a summary field and never a
  block verdict (codex-runtime-parity cell 6b).
- R11 — The write guard's always-writable set no longer includes the
  repo-root disposable-experiment location; that work now lives inside the
  workflow's own already-writable directory, under a dedicated subfolder. The
  set of ungoverned writable locations only shrinks from this change, never
  grows; the session-close nudge's allowed-path set shrinks identically
  (bee-footprint D2).

- R12 — The intake gate fires in **every** terminal state, not merely the
  never-started one: a source write is governed whenever no feature is active,
  including immediately after a feature closes with its approvals still on
  record. Approvals belong to the feature that earned them and never outlive
  it; the active state, not the recorded approvals, decides whether the door is
  open (decision c2c46488).
- R13 — The guardrails are a safety net, not the authority. The workflow's
  written law is what governs the assistant; a checkpoint exists to catch what
  the assistant forgets, and its silence is never permission. An assistant must
  never treat "the guard did not stop me" as approval, because that promotes
  the guard's coverage into the protocol and turns every gap in the guard into
  a gap in the workflow — which is exactly how R12's gap was found in real use
  (decision c2c46488).

- R14 — The write guard's command-shape recognition accepts both the unified
  dispatcher form (group + verb) and the retired per-command helper form. The
  retired form is a transition affordance for hosts whose vendored tools predate
  the unified surface — it is slated for removal once hosts have upgraded (a
  debt item tracks it), and its recognition never revives the deleted scripts
  themselves (decision bbc6bcea, D3).
- R15 — Codex plugin delivery loads
  the catalog-derived hook projection from the installed package. The checked-in
  project checkpoint file is a development and repo-fallback projection only;
  release/reinstall proof exercises the installed package, and project fallback
  success never substitutes for that package proof (codex-hook-state-parity
  D9/D13; decision cf511ff3).
- R16 — Plugin and project hooks are
  mutually exclusive bee sources. Migration to plugin delivery removes only
  catalog-recognized bee entries after installed-package integrity is proven;
  migration to project fallback first proves the plugin inactive. User hook entries
  survive both transitions unchanged (codex-hook-state-parity D10–D13; decision
  cf511ff3).
- R17 — Codex native-subagent audit is bounded, audit-only, and post-start. It
  never claims pre-spawn authority and never records arbitrary event content.

## Edge Cases Settled

- A change line with a whitespace-only path counts as unprovable → deny (found
  and pinned during matrix construction).
- Regenerating the RED-baseline evidence report is timestamp-stable in content;
  only noise fields differ.
- Simultaneously requesting the evidence-baseline and catalog-only test modes
  is rejected as contradictory.
- Explicitly disabling checkpoints produces no project lifecycle execution;
  the absence of an opt-in flag does not disable them.
- Editing a reviewed command definition makes only the changed definition
  pending review; automation never rewrites or bypasses the owner's trust
  record.
- A fallback checkpoint's project-root resolution succeeds identically from a
  working directory whose path contains spaces and non-ASCII characters as it
  does from a plain path (proven against an isolated fixture, codex-runtime-parity
  cell 6b).

## Open Gaps

- Native (non-shell) file reads and the incomplete unified-shell path on the
  second runtime cannot be intercepted — governed by the durable instructions
  and helper checks; logged as coverage gaps at runtime.
- Fixture and installed-package proofs are green. Live proof that Codex loads
  the package-delivered projection in a real trusted session remains
  outstanding because this environment cannot write the user Codex home.
- Child-agent event payloads on the second runtime may not carry a correlatable
  identity for reservation ownership; until proven, those paths rely on the
  helper checks (named fallback, codex-runtime-parity validation).
- The source-repository (dogfood) deny-capable checkpoint is a **guardrail
  against honest mistakes, not a security boundary against a hostile in-project
  actor** — per D2, hooks provide enforcement "without pretending hooks are a
  complete security boundary." A proposed hardening (cell 6c) to make the
  repo-fallback deny checkpoint spoof-proof was **scoped out and stopped**
  (decision f398aa60): three validation rounds each proved a new bypass in
  resolving the checkpoint's own root/handler from an untrusted working
  directory — nearest-ancestor marker resolution is exploitable downward,
  outermost-ancestor upward, both defeatable by a directory symlink under a
  write-allowlisted prefix (lexical vs realpath), and marker files can be
  planted through Bash primitives the write-target extractor does not model
  (`dd`, `install`, `python -c open`, `rsync`) — the same ungoverned-write
  class named in the first gap above. These are **recorded known limits of the
  guardrail, not defects to be closed by ever-more root-resolution hardening.**
  Two accidental (non-adversarial) failure modes remain open and would be the
  only justification for a future *minimal* fix: on a bare repository the
  pre-handoff resolution fails open (ALLOW) rather than closed, and a foreign
  nested working directory can make the deny checkpoint's launch crash rather
  than emit a visible diagnostic. A minimal fix (resolve the checkpoint root the
  same way the handler does, and fail the deny checkpoint closed on launch-setup
  failure) is available as a small fresh cell if ever wanted; it is not planned.
- The source-repository fallback declares no equivalent command for a
  non-POSIX-shell or native-Windows session: the rendering emits only a
  POSIX shell command and does not populate the runtime's separate
  Windows-specific command field. This is undeclared today, not merely
  deferred — a Windows or non-POSIX-login-shell (e.g., fish, nu) session has
  no working fallback checkpoint.
- Recorded tradeoff (bee-footprint P3): the workflow's disposable-experiment
  subfolder is both always-writable and excluded from version control, so its
  contents never appear in a change listing. This is deliberate, not a defect
  — but a reviewer must not read a clean change listing as proof that nothing
  was staged in that location; confirming its contents requires looking at
  the location itself.

## Pointers (implementation)

- `scripts/lib/run-module-worker.mjs` — shared isolated runner for nested test
  entrypoints used by the hook, command, onboarding, and metadata suites.
- `scripts/test_portable_paths.mjs` and `hooks/test_hook_contracts.mjs` — real
  external integration remains external; assertions grade concrete exit status,
  stdout, and stderr even when the execution environment adds a launch warning.
- Catalog + renderer: `hooks/catalog.mjs` (exports `ALLOWED_DIFFERENCES`,
  `TARGETS`, `REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC`); `renderProjection`/
  `renderProjectionText` take an explicit `target` (`plugin` default, `repo`)
  so both rendering targets share one function, never forked logic.
  Projections: `hooks/hooks.json` (Codex, plugin target), `hooks/claude-hooks.json`
  (Claude, plugin target; `.claude-plugin/plugin.json` points here).
- Shared adapter: `hooks/adapter.mjs`; the eight handlers `hooks/bee-*.mjs`,
  including the paired Codex native-subagent audit handler and its vendored
  mirror.
- Batch guard: `hooks/bee-write-guard.mjs` (`extractApplyPatchTargets`).
- CLI-shape guard incl. 3-token verb resolution: `hooks/bee-write-guard.mjs`
  against the `command-registry.mjs` catalog. Evidence: `.bee/cells/du-2.json`,
  `docs/history/dispatcher-unify/`.
- Always-writable set: `GATE_ALLOWED_PREFIXES` in
  `skills/bee-hive/templates/lib/guards.mjs` (`.bee/`, `docs/`, `plans/`,
  `AGENTS.md`; repo-root `.spikes/` removed per bee-footprint D2 — the
  workflow's own `.bee/spikes/` subfolder is already covered by `.bee/`);
  session-close nudge mirrors it as `NUDGE_ALLOWED` in
  `hooks/bee-session-close.mjs`.
- Suites: `hooks/test_hook_contracts.mjs` (modes: default, `--baseline`,
  `--catalog-only`, `--repo-route-only`), `hooks/test_write_guard.mjs`,
  `hooks/test_model_guard.mjs`; parity check in
  `skills/bee-hive/scripts/test_onboard_bee.mjs`.
- Package/fallback distribution proof: `skills/bee-hive/scripts/plugin_distribution.mjs`
  and `skills/bee-hive/scripts/test_plugin_distribution.mjs`. The checked-in
  `.codex/hooks.json` is a development/fallback snapshot, not package proof.
- Parity evidence: `.bee/cells/codex-hook-state-parity-{2,3}.json` and
  `docs/history/codex-hook-state-parity/reports/`.
- Evidence: `docs/history/codex-runtime-parity/` (red-baseline.md, cell reports);
  commits `d1777ed`, `5458b34`, `cf1ce51`, `a30fb0c`, `f0860ac`, `7499a71`.
- Codex source-repository fallback: `.codex/hooks.json`, generated only by
  `renderProjectionText("codex", { target: "repo" })` — never hand-authored;
  current runtime contract: `https://learn.chatgpt.com/docs/hooks`.
