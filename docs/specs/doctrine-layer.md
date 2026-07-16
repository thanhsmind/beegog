---
area: doctrine-layer
updated: 2026-07-15
sources: [fanout-doctrine (cell fanout-doctrine-1, 2026-07-13, flushed capture stub 2f796f40); terminal-phase-gate (cell tpg-2, 2026-07-13); tier-transport-doctrine (cell tier-transport-doctrine-1, 2026-07-13); codex-agent-wait-loop (cell codex-agent-wait-loop-2, 2026-07-15)]
decisions: [ba5a35f1-981d-4cb5-8a57-234a187f122d (placement rule); c2c46488 (an unblocked write is not an approved write); 1689af1b (silent bookkeeping); D1/D2/D3 delegation contract; 0023 + 6cd34376 (explicit-tier transport rides critical rule 13, B3a); codex-agent-wait-loop D1-D5 + ebb70b72-e5e5-43f2-a692-beb371b99f6c (native empty-wait discipline and live Codex surface)]
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
| **Progress interval** | Before another bounded native wait: continue material task-local work if any remains, otherwise take exactly one `list_agents` snapshot; then send concise commentary naming both the live agent state and the next action. |

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

## Actors & Access

- **The orchestrating assistant** — reads the standing sheet every session and
  after every compaction; bound by every rule on it in every turn; owns all
  decide-altitude work.
- **A delegated helper** — receives one bounded mechanical task and returns a
  summary. Never receives decide-altitude work, and never inherits the
  orchestrator's conversation.
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
  critical rule 13 on the standing sheet. The guard that rejects a bare dispatch:
  `hooks/bee-model-guard.mjs`.
- Anchor tests (B4/R2): `skills/bee-hive/templates/tests/test_lib.mjs` — the
  `census:` checks, including the delegation-layer anchor and the on-demand
  review anchors, plus the native Codex empty-wait anchor across the master,
  root, canonical procedure, and writable `.claude` surfaces.
- Model tiers behind R3: `.bee/config.json` `models` (extraction / generation /
  review / advisor slots), resolved per dispatch by `bee-swarming`.
