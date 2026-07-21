---
area: doctrine-layer
updated: 2026-07-19
sources: [lane-ceremony-v3 cells lcv3-1..lcv3-4 (traces in .bee/cells/, reports docs/history/lane-ceremony-v3/reports/, 2026-07-19 — plan freeze, lane work-packet shapes, product-file caps, test-anchored flags, intake-first classification; each RED-first against the doctrine assertion suite); fanout-doctrine (cell fanout-doctrine-1, 2026-07-13, flushed capture stub 2f796f40); terminal-phase-gate (cell tpg-2, 2026-07-13); tier-transport-doctrine (cell tier-transport-doctrine-1, 2026-07-13); codex-agent-wait-loop (cells codex-agent-wait-loop-2/codex-agent-wait-loop-3, 2026-07-15/2026-07-19 — native wait rule plus independently reviewed D6/D7 repair); compounding-fanout-hardening (cell cfh-1, 2026-07-17, flushed capture stub d3417cb2); advisor-and-orchestration Slice 2A-ii (cells ao-2aii-1/ao-2aii-2, 2026-07-17); advisor-and-orchestration Slice 2A-iii (cells ao-2aiii-1/ao-2aiii-2 — dispatch-boundary enforcement + gather-purpose routing prose, 2026-07-17); advisor-and-orchestration Slice 5 (cell ao-5-1 — execution-worker class, tiny/small single-worker execution, AO14, 2026-07-17)]
decisions: [lane-ceremony-v3 D1-D10 (docs/history/lane-ceremony-v3/CONTEXT.md, 2026-07-19); ba5a35f1-981d-4cb5-8a57-234a187f122d (placement rule); c2c46488 (an unblocked write is not an approved write); 1689af1b (silent bookkeeping); D1/D2/D3 delegation contract; 0023 + 6cd34376 (explicit-tier transport rides critical rule 13, B3a); codex-agent-wait-loop D1-D5 + ebb70b72-e5e5-43f2-a692-beb371b99f6c (native empty-wait discipline and live Codex surface); 040f8ef0 (read-only analyst spawn + partial-return fan-out, B7/R11)]
coverage: partial
---

# Doctrine Layer (the standing instructions an assistant always carries)

## Purpose

The workflow governs an assistant that does not remember. Every rule the
assistant must obey has to reach it *inside the turn it is needed*, and the
assistant's attention is loaded from two very different kinds of source:

- a **standing instruction sheet**, read at the start of every session and again
  after every memory compaction — always present, in every turn, whether or not
  any part of the workflow was invoked; and
- **procedure references**, opened only when a specific stage of the workflow is
  invoked and needs them.

The doctrine layer is the first of those two. It is the set of rules that hold
*unconditionally* — including in ordinary conversation turns, where the
assistant is only talking to the human and no stage of the workflow is running.
This area owns what belongs in that layer, how it reaches every project, and how
it is kept from silently emptying out.

## Entry Points & Triggers

| Trigger | What happens |
|---|---|
| A session begins | The assistant reads the standing instruction sheet before doing anything else. |
| Memory is compacted mid-session | The assistant re-reads it — compaction destroys everything the sheet is not part of. |
| A project is onboarded or upgraded | The current doctrine is written into that project's own instruction sheet, replacing the previous copy in place. |
| A workflow stage is invoked | Procedure references for that stage load *on top of* doctrine; they never substitute for it. |
| The suite runs | Each doctrine rule that must never disappear is checked for by name; a missing rule fails the suite. |

## Data Dictionary

| Element | Meaning |
|---|---|
| **Standing instruction sheet** | The always-loaded rule document that lives in each governed project and is read every session. Carries: startup steps, the stage chain and its approval gates, the numbered critical rules, the working-file inventory, the guardrail rules, the red-flag list, and the session-finish checklist. |
| **Critical rule** | A numbered, unconditional instruction on the standing sheet. Holds in every phase, every lane, and every turn — including turns where no workflow stage is running. |
| **Procedure reference** | A detailed document belonging to one workflow stage, loaded only when that stage is invoked. Correct home for *how* a stage does its job; wrong home for anything that must hold when that stage is not running. |
| **Anchor** | A distinctive phrase from a doctrine rule that the suite asserts is still present on the standing sheet. An anchor is how a rule is prevented from quietly drifting back down into a procedure reference. |
| **Always-applies rule** | A rule whose answer to *"must this hold when no workflow stage is running?"* is yes. Always-applies rules belong on the standing sheet, without exception. |
| **Decide-altitude** | Work that requires judgment the orchestrating model must not hand off: approval gates, the mode decision, synthesis of findings, accepting or rejecting a helper's result, durable state writes, and conversation with the human. |
| **Gather-altitude** | Mechanical work whose output the orchestrator needs only as a summary: file hunts, codebase scans, multi-file inventories, routine rendering. |
| **Empty wait** | A native Codex `wait_agent` call that returns timeout or no completed agent. It reports only that no completion arrived in that interval; it is not a worker failure or ownership signal. |
| **Progress interval** | Before another bounded native wait: perform at least one material task-local action if work remains (without needing to exhaust it), otherwise take exactly one `list_agents` snapshot; handle any completion exactly once, recompute relevant liveness, then send concise commentary naming both the live agent state and the next action. Zero live agents ends collection. |

## Behaviors & Operations

**B1 — Doctrine reaches every governed project by copy, not by reference.**
Trigger: a project is onboarded or upgraded. What changes: the doctrine block
inside that project's own instruction sheet is replaced with the current one,
in place, leaving any project-authored content outside the block untouched. What
each actor observes: the assistant working in that project reads the new rules
from its very next session, with no action by that project's owner; the owner
sees exactly one bounded region of their instruction sheet change. Why by copy:
a project must carry its rules locally — an assistant reading a project's
instructions cannot be assumed to have access to the workflow's own repository.

**B2 — A rule that must hold when no stage is running is placed on the standing
sheet; anything else may live in a procedure reference.** Trigger: any new rule
is authored. What decides its home: the single question *"does this need to hold
when no workflow stage is running?"* — yes places it on the standing sheet, no
permits a procedure reference. What each actor observes: a rule placed correctly
takes effect in every turn; a rule placed in a procedure reference is **silently
absent from every turn in which its stage is not invoked** — the assistant is not
disobeying it, it is not being told it. This failure is invisible from the rule's
own text: a perfectly written rule in the wrong home behaves exactly like no rule
at all, and the only symptom the human sees is having to repeat the instruction
by hand (decision ba5a35f1).

**B3 — Mechanical gathering is delegated to helpers; deciding is not.** Trigger:
the assistant faces a mechanical step during any turn. What decides delegation:
the step is handed to a lower-cost helper when it requires reading more than
three sources, or when its content is needed only as a summary rather than word
for word. What each actor observes: the helper returns the sources it read, the
facts with precise anchors, and quoted material only where it was asked for; the
orchestrator never re-reads what a summary already answered, and never delegates
decide-altitude work. Why the rule exists as doctrine rather than stage
procedure: the resource being protected is the orchestrator's own limited
attention, and it is consumed in *every* turn — most damagingly in conversation
turns, where no stage is running to remind it (B2's failure mode, observed).

**B3a — A standing rule carries whatever mechanics compliance requires; only the
elaboration may be referenced.** Trigger: a rule on the standing sheet orders an
action that has a required form — a mandatory parameter, a marker, a naming
convention — and a guard rejects the action when that form is missing. What is
placed on the standing sheet: the order *and* the minimum needed to obey it
correctly on the first attempt. What may stay in a procedure reference: the
rationale, the tiers, the full contract. What each actor observes when the split
is wrong: the rule fires in turns where the reference is not loaded, the action
is attempted in its bare form, and the guard denies it — so the assistant learns
the requirement only from the rejection, and pays one wasted attempt per session
to do so. This is B2's failure at half-scale: the order travelled to the always-
loaded layer and its transport did not (observed with the delegation rule and the
subagent tier marker; decision 0023).

**B4 — A doctrine rule is pinned by an anchor the suite enforces.** Trigger: the
suite runs. What is checked: for each rule that must never disappear, a
distinctive phrase from it is asserted present on both the master copy of the
standing sheet and this project's own. What happens on failure: the suite fails,
naming the missing rule. Why: doctrine has no runtime — nothing *executes* a
rule, so nothing fails loudly when one goes missing. The anchor test is the only
mechanism that makes deleting or relocating a rule a visible event.

**B5 — Doctrine binds the assistant even where no mechanism enforces it.**
Trigger: an action doctrine forbids, in a project or runtime where no automated
guard covers that action. What happens: the assistant obeys anyway. What each
actor observes: nothing — which is the point. A guard's silence is not an
approval, and a gap in a guard is not a gap in the rules; treating the guard as
the authority makes the guard's coverage the real protocol and quietly deletes
every rule it fails to cover (decision c2c46488).

**B6 — A native Codex empty wait is separated from any later wait by visible,
material progress.** Trigger: `wait_agent` returns timeout or no completion for
a bee-owned native subagent. What happens: the assistant never calls
`wait_agent` again immediately. It first continues material task-local work; if
none remains, it takes exactly one `list_agents` snapshot. At least one material
task-local action satisfies this branch; exhausting every independent action is
not required. If an agent completes during the interval, its result is handled
exactly once, the relevant live-agent set is recomputed, and zero live agents
ends collection without another wait. The assistant then sends one concise
commentary update naming both the live agent state and the next action, after
which a later bounded wait is allowed only when a relevant agent remains. What
does not count: no-op work,
repeated state reads, hidden reasoning, generic commentary, or commentary alone.
What remains owned: every running agent, claim, and reservation; timeout never
licenses interrupt, duplicate dispatch, claim release, or reservation release.
This applies to ordinary gathers and all bee stages using native Codex agents.
External CLI processes and artifact polling keep their separate executor
contract. Authority, urgency, or a no-chatter request creates no exception
(codex-agent-wait-loop D1-D7).

**B7 — A gathering helper is spawned without write ability, and a fan-out
synthesizes from what returned rather than waiting for a full set.** Trigger:
one or more helpers are dispatched to read and analyze — the settled case is the
closing stage's parallel analyst fan-out. What happens: each such helper runs
with a read-only capability surface — the prohibition on writing is carried by
what the helper *can do*, never by a sentence in its prompt, because a prompt
sentence is advice and a capability boundary is a wall (observed: an analyst
told "write no files" in prose implemented and committed source unrequested). A
dispatch that fails at creation is surfaced and re-dispatched exactly once; an
identical second failure ends retrying, and synthesis proceeds from whichever
helpers did return. Synthesis never requires all-of-N returns. What each actor
observes: the orchestrator never hangs waiting on a fixed helper count
(observed: a session stuck indefinitely "waiting for 3 background agents" when
one dispatch had died at creation), and no gathering helper can modify the
project no matter what its instructions say (decision 040f8ef0).

**B7a — Two helper classes, distinguished by authority and state effects.** The
delegation layer names exactly two worker classes. An **I/O-offload helper**
(gather/extract/review) holds no authority and mutates no workflow state: it
never registers, never reserves, never caps — it returns a digest and vanishes.
An **execution worker** implements exactly one assigned unit of work: it
registers in the worker registry, reserves the files it will touch, and its
result feeds a cap — and since the smallest lanes also execute through one such
dispatched worker, "zero subagents" for a small piece of work means zero
*ceremony* helpers (reviewers, panels), never zero I/O helpers and never zero
execution workers. Independent reviewers and checkers are neither class: they
are review-class dispatches with no execution authority. The class is defined
by what the dispatch may *do*, never by which mechanism launched it. The
orchestrator authors the smallest lanes' completion report itself, from the
worker's verbatim diff plus the orchestrator's own fresh verification re-run
(AO14; ao-5-1, 2026-07-17).

**B8 — A helper tier backed by an external command serves gathers only, and its
output is accepted only between declared markers.** Trigger: a helper tier is
configured as an external command-line assistant (a different vendor's model
driven through its own command) and a dispatch resolves that tier. What happens:
resolving it **for a read-only gather** yields the external command; resolving it
**for unit execution** yields a typed refusal from the resolution machinery
itself — the boundary is enforced in code, not by guidance text, because an
external command runs in its own working directory where the workflow's own
bookkeeping would land in a phantom copy and every record would be written where
the workflow never reads (observed by probe). A gather through an external
command runs the configured command **exactly as written** (nothing appended),
feeds the task in on standard input, hands the command only absolute locations,
and treats the printed output **between declared framing markers** as the digest;
output missing its markers, or an empty digest, is a **failed run surfaced
loudly** — never accepted as silent success. Such a gather creates no work unit,
no reservation, and no worker registration. Known gap, assigned not omitted:
these runs do not yet appear in the dispatch audit log. What each actor observes:
the human's configured command is the whole invocation contract; configuration
checking refuses a command with no declared prompt transport, any command
carrying a known auto-approve/bypass token, and — on **advice-class** slots
(adviser, reviewer), which are read-only by rule — a command carrying a known
write-granting sandbox token (a blocklist of known-bad tokens, stated honestly
as such, never a positive read-only guarantee); and unit execution can never
route to the external path until it earns its own proof (decisions 34398e69,
4ec5be1a; advice-class refusal per AO8, cell ao-2b-2).

## Actors & Access

- **The orchestrating assistant** — reads the standing sheet every session and
  after every compaction; bound by every rule on it in every turn; owns all
  decide-altitude work.
- **A delegated helper** — receives one bounded mechanical task and returns a
  summary. Never receives decide-altitude work, and never inherits the
  orchestrator's conversation. When its task is purely to read and analyze, it
  is spawned read-only (B7).
- **The human owner** — authors and amends doctrine; approves the gates doctrine
  reserves for them. Never asked to run the workflow's own machinery.
- **A governed project** — receives doctrine by copy at onboarding; may carry its
  own instructions outside the doctrine block, which are never overwritten.

## Business Rules

- **R1** — A rule that must hold when no workflow stage is running belongs on the
  standing instruction sheet. A procedure reference is never an acceptable home
  for it (ba5a35f1).
- **R2** — Every doctrine rule that must never disappear carries a suite-enforced
  anchor. A rule without one may be deleted or relocated with no signal.
- **R3** — Mechanical gathering delegates to a lower-cost helper when it needs
  more than three sources, or content wanted only as a summary. The orchestrator
  may override in either direction; the threshold is judgment, not a mechanism.
- **R4** — Decide-altitude work never delegates: gates, the mode decision,
  synthesis, accept/reject of a helper's result, state writes, and conversation
  with the human (D1).
- **R5** — The delegation threshold applies in every lane and every phase,
  including the smallest ones. The lanes' "no helpers" rule for small work means
  no *ceremony* helpers — reviewers, checkers, panels — never no gathering
  helpers (D3).
- **R6** — An unblocked action is not an approved action. Automated guards catch
  what the assistant forgets; their silence grants nothing (c2c46488).
- **R7** — The workflow's own machinery is run by the assistant, never handed to
  the human. The human's only actions are approvals, decisions, and permissions.
- **R8** — The workflow's internal vocabulary stays out of the conversation. The
  human hears the work in their own terms; the machinery runs silently (1689af1b).
- **R9** — For bee-owned native Codex agents, `empty wait → wait_agent` is
  forbidden. Another bounded wait is allowed only after the exact progress
  interval: at least one material task-local action or, only when none remains,
  exactly one `list_agents` snapshot; handle any completion exactly once,
  recompute liveness, then commentary naming live agent state and next action.
  Zero relevant live agents means no later wait.
- **R10** — A native wait timeout never changes worker or ownership state. It
  never licenses interrupt, duplicate dispatch, claim release, or reservation
  release; external process and artifact polling remains a separate contract.
- **R11** — A read-and-analyze helper is dispatched with a read-only capability
  surface, never merely a read-only instruction; and a parallel fan-out's
  synthesis proceeds from partial returns — one re-dispatch per failed creation,
  then synthesize from what came back, never an unbounded wait for all-of-N
  (040f8ef0).
- **R12** — An external-command helper tier is gather-only: the resolution
  machinery returns a typed refusal when such a tier is resolved for unit
  execution, and a caller must explicitly declare the gather purpose to receive
  the command. Purpose defaults to the refused side; malformed purpose values
  fail safe to refusal, and the refusal is a returned value, never a crash — the
  resolution sits under a fail-open guard path (34398e69, 4ec5be1a). The
  boundary is also enforced at the dispatch checkpoint: an in-family helper
  dispatch declaring an external-command tier is refused with a corrective
  message routing to the gather path, and the routing procedures teach the
  explicit gather-purpose form as the documented way to reach the command
  (2A-iii, 6b155218).
- **R13** — Small work starts from an executable work packet, never a shrunken
  feature plan (lane-ceremony-v3 D3/D4/D5). The tiny lane's complete work shape
  is the request plus one work unit — the unit is the micro-plan, carrying the
  touched paths, the directive, the acceptance contract, the verification
  command, and the classification record (flag count, product-file count, lane);
  no plan document exists. The small lane's default shape is a short scoping
  synthesis logged through the decision log plus one-to-three units; a plan
  document is opt-in, written only when a durable multi-slice strategy genuinely
  needs one. In both lanes the approval order is fixed: draft unit(s) are
  previewed in the approval message, the inline reality check runs, THEN the one
  merged shape+execution approval is asked (or auto-recorded under bypass), and
  only after approval are units persisted and claimed — execution approval is
  never granted before the execution package exists, and never
  persist-then-preview.
- **R14** — Lane caps count product files only (lane-ceremony-v3 D6):
  production source, tests, and runtime configuration the behavior change
  itself must touch. Workflow bookkeeping, history and specification documents,
  plans/briefs/reports, and generated projections or manifests never count
  toward a lane cap — the workflow's own artifacts can never promote a change
  out of its honest lane.
- **R15** — The two experience-based risk flags are test-anchored
  (lane-ceremony-v3 D7): "changes behavior an existing test asserts (a covered
  contract must change)" and "the change requires weakening, deleting, or
  replacing existing proof". A covered bugfix that keeps existing tests green
  and adds a new one scores zero on both. The remaining flags and the
  2-3→standard / 4+→high-risk thresholds are unchanged.
- **R16** — Classification precedes context loading (lane-ceremony-v3 D8): the
  planning stage classifies the lane first from the request plus at most two
  targeted reads, then loads context scaled to the lane — targeted reads only
  for tiny, bounded for small, full bootstrap for standard and high-risk. The
  critical-patterns digest stays mandatory in every lane (it already rides the
  session preamble at zero extra cost). The lane decision re-runs upward any
  time evidence demands escalation; de-escalation requires cited evidence.

- **The verify ladder (cli-performance D4, `e54878b1`):** a cell's verify is its
  TARGETED suite (seconds), run red-first and green by the worker; the full
  configured chain (~minute) runs at exactly four milestones — session
  baseline, wave close (once, by the orchestrator, the independent full proof
  for the whole wave), session finish, and worktree-merge/release gates.
  Judges and reviewers never run the full chain as part of a verdict. Proven
  the day it landed: the wave-close run caught a real escape (raw NUL bytes in
  a lib file) that every targeted suite had missed. Companion performance
  idiom for derived read paths (D1/D2, cells cp-1/cp-2): shared inputs are
  read once per call and threaded down — never re-read per item — and
  repeated child-process answers are memoized in a pass-local map that dies
  with the pass; no cross-call caches, no TTLs, no daemons.

## Edge Cases Settled

- **A perfectly written rule can be perfectly ineffective.** The delegation rule
  was fully specified, and cited by every workflow stage, for its entire life
  before this settlement — and the human still had to repeat it by hand, because
  every citation of it lived somewhere that ordinary conversation never loaded.
  Completeness of a rule's *text* says nothing about its *reach*. When a rule is
  being ignored, check its placement before rewriting its wording.
- **The lanes' "zero helpers" rule is not zero helpers.** Small-work lanes
  suppress ceremony helpers, not gathering helpers. A one-file fix simply never
  crosses the delegation threshold on its own, so it stays in-session naturally —
  the suppression and the threshold never actually conflict.
- **Doctrine is not gated.** Amending the standing sheet is knowledge work, and
  knowledge locations stay writable in every phase, including the terminal ones
  where source edits are shut (hook-runtime B12).
- **“Sit idle” does not ban native bounded waiting.** It bans scratchpad/file
  polling for harness-managed agents. Native Codex uses `wait_agent` as its yield
  mechanism, with B6's mandatory progress interval after an empty wait; external
  executors continue to use their process/artifact contract.
- **A completion during the interval is not merely elapsed time.** It satisfies
  progress only when its result is consumed exactly once before the update. The
  assistant then recomputes liveness and stops collection instead of issuing an
  unnecessary empty wait when no relevant agent remains.

## Open Gaps

- No stated ceiling on doctrine length. The standing sheet is loaded in full,
  every session, in every governed project — its cost is paid on every turn and
  nothing currently bounds its growth, nor defines what would justify retiring a
  rule to make room.
- The three-source delegation threshold is asserted, not measured. No evidence
  records where the real break-even sits, or whether it differs by how large the
  sources are.
- No mechanism detects the B2 failure in the other direction: a rule correctly
  placed on the standing sheet that *should* have been a procedure reference
  (bloat), as opposed to one wrongly buried in a reference (silence). Only the
  silence direction is guarded.

## Pointers (implementation)

- Master copy of the standing sheet: `skills/bee-hive/templates/AGENTS.block.md`;
  the rendered per-project copy sits between the `<!-- BEE:START -->` /
  `<!-- BEE:END -->` markers in each host's root `AGENTS.md`.
- B1's copy-into-project step: `skills/bee-hive/scripts/onboard_bee.mjs`
  (`update_agents_block` plan item).
- The delegation contract in full (tiers, digest contract):
  `skills/bee-hive/references/routing-and-contracts.md` § Delegation contract —
  the *detail* legitimately lives there; the rule itself, and the transport it
  requires (a `model` param or an anchored `[bee-tier:]` marker, B3a), are
  critical rule 13 on the standing sheet. The guard that rejects a bare,
  config-disagreeing, or cli-tier-declared dispatch (declared tier read before
  the model param, 2A-iii): `hooks/bee-model-guard.mjs`.
- Anchor tests (B4/R2): `skills/bee-hive/templates/tests/test_lib.mjs` — the
  `census:` checks, including the delegation-layer anchor and the on-demand
  review anchors, plus the native Codex empty-wait anchor across the master,
  root, canonical procedure, and writable `.claude` surfaces.
- Model tiers behind R3: `.bee/config.json` `models` (extraction / generation /
  review / advisor slots), resolved per dispatch by `bee-swarming`.
- B7/R11's settled case: `skills/bee-compounding/SKILL.md` §2 (analysts pinned
  to the runtime's read-only agent type — Claude Code `Explore` — with
  event-driven wait, one re-dispatch, partial-return synthesis); RED→GREEN
  record in `skills/bee-compounding/CREATION-LOG.md` amendment 2026-07-17.
- B8/R12 implementation: `resolveTier(root, slot, runtime, {for:'gather'|'cell'})`
  in `skills/bee-hive/templates/lib/state.mjs` (default `'cell'`, refusal
  `{type:'refused', reason:'cli_tier_gather_only'}`); the cli gather branch +
  `<<<BEE_DIGEST … BEE_DIGEST>>>` delimiter contract in
  `skills/bee-hive/references/routing-and-contracts.md` § Delegation contract,
  census-anchored in `templates/tests/test_lib.mjs`; feature
  advisor-and-orchestration Slice 2A-ii (cells ao-2aii-1/ao-2aii-2, 2026-07-17).
