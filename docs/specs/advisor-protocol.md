---
area: advisor-protocol
updated: 2026-07-19
sources: [advisor cells adv-1..adv-3 (worker consult loop, 2026-07-13); advisor-and-orchestration Slices 2A-i..2A-iv, 2B, 3A, 3B, 4, 5 (cells ao-2ai-1..ao-5-1, traces in .bee/cells/, reports docs/history/advisor-and-orchestration/reports/, 2026-07-17); dogfood run .bee/spikes/advisor-and-orchestration/2aiv-cli-gather-dogfood.md; first live orchestrator consult digest .bee/spikes/advisor-and-orchestration/slice5-advisor-digest.txt; codex-native-transport cells cnt-1/cnt-2/cnt-3 (resolver + config native slot shape, capability classification, dispatch-prepare native branch + honest economics; traces in .bee/cells/, reports docs/history/codex-native-transport/reports/, 2026-07-19); codex-native-transport cell cnt-7 (Claude guard allowlist folds the adviser slot, closing a live adviser-dispatch refusal; trace in .bee/cells/, report docs/history/codex-native-transport/reports/cnt-7.md, 2026-07-19)]
decisions: [advisor D1-D3; 72f3d6dd (AO5 — config is the authority, no strength test, same-model no-op only); AO8 (advice-class slots read-only); AO2(b)/AO3/AO13 (one orchestrator trigger; Gate 3 precondition; event-based staleness, never a TTL); AO4 (call paths split by trigger class); f1ca79b9 (AO15 — attribution fields); 0019 + 2A-iv GO (external gather proven through config); AO14 (execution-worker class); 126412b9 (precondition keys on the selected record's mode); codex-native-transport D1-D3, D5, D7 (3ceba8f5, cnt advisor conditions 69513d80, D3a c0cba64e)]
coverage: full
---

# Advisor Protocol (second opinions for workers and the orchestrator)

## Purpose

A bee-managed project may configure an **adviser** — a stronger or independent
model, possibly a different vendor's, reachable as a model or as an external
read-only command. The protocol answers three questions: *who* may ask for
advice (a stuck worker; the orchestrator before opening execution on high-risk
work), *when* the ask is mandatory versus available, and *what advice may never
do* (approve a gate, override a locked decision, or write anything). It exists
so that expensive mistakes meet a second opinion **before** they ship, without
adding a single human checkpoint.

## Entry Points & Triggers

- **Worker trigger (available, budgeted):** a worker that has just hit its
  first serious failed verification attempt may consult the adviser named in
  its dispatch — at most twice per claim, then it must return blocked.
- **Orchestrator trigger (mandatory, mechanical):** before the execution gate
  opens for work in the high-risk mode, the orchestrator must hold a live
  (non-stale) consult record. The approval verb itself refuses otherwise.
  This is machinery, not a human stop: every autopilot level still runs it.
- No other trigger exists. Conflict-between-decisions and scope-creep triggers
  were considered and explicitly deferred/dropped (they lack a mechanical
  detector today).

## Data Dictionary

| Element | Meaning |
|---|---|
| adviser | The advice-class helper the workspace configured: a model name, or an external read-only command. Whatever is configured IS the adviser — no family test, no strength ranking, no self-judged skip. |
| the one honest no-op | The only legitimate skip: the adviser resolves to literally the same model the asking worker runs on. An external-command adviser is never the same model, so it is always offered. |
| evidence bundle | What travels to the adviser: the exact check that failed and its output plus a diagnosis (worker ask), or the plan summary, risk map, and validation findings (orchestrator ask). Never session history, never secrets. |
| consult record | The durable stamp of an orchestrator consult: when, who was consulted, the head of the advice, and three machine-stamped anchors (active feature, newest active decision, plan fingerprint). Anchors are stamped by the recording verb, never supplied by the caller. |
| consult staleness | Event-based, never a time limit: the record stops satisfying the precondition when the feature changed, a newer decision became active, the plan changed, or the execution gate was revoked after the consult. |
| consult budget | Two consults per worker claim. A re-claim after a context-rescue grants a fresh budget; exhaustion returns the worker blocked, never a third ask. |
| advice-class slot | The adviser and reviewer configuration slots. Both are read-only by rule: configuration checking refuses a command carrying a known write-granting or auto-approve token on these slots. |

## Behaviors & Operations

**B1 — The dispatcher offers the adviser; the worker never self-assesses.**
At dispatch the orchestrator resolves the configured adviser and applies the
one honest no-op; otherwise the dispatch names the adviser and exactly how to
reach it (its proven transport). Workers on the session's strongest tier are
offered advisers too — configuration outranks any strength intuition.

**B2 — A stuck worker consults inside its own turn.** After its first serious
failed verification attempt, the worker sends the evidence bundle and applies
the reply itself. Advice that contradicts a locked decision converts to a
block citing both. The consult and its outcome land in the work unit's trace,
so the cap record shows what was asked and what came back.

**B3 — The orchestrator consults before high-risk execution approval.** The
orchestrator builds the evidence bundle, runs the adviser **read-only**
(external command: exactly as configured, bundle on standard input, printed
output is the advice; model-shaped: a review-class read-only dispatch), and
records the consult. The approval verb then verifies the record is live; a
missing or stale record refuses the approval with a corrective message naming
each failed condition and the exact consult flow. A workspace with no adviser
configured records that fact and proceeds — the rule adds one trigger, not a
dependency on configuration.

**B4 — Advice is advice.** It never approves a gate, never overrides a locked
decision, never edits anything, and is never accepted as verification — the
orchestrator still re-runs every verify itself. The mechanism meant to catch a
mistake is not allowed to make one: advice-class transports are refused write
privileges at configuration checking.

## Actors & Access

- **The orchestrator** — resolves and offers advisers, runs the mandatory
  pre-approval consult, records it, and owns every accept/reject decision.
- **Workers** — may consult only when dispatched with an adviser line, only
  after a real failure, within budget.
- **The adviser** — read-only; sees only the evidence bundle; its output is
  data, never instructions.
- **The human owner** — configures the adviser; is never stopped by a consult
  (autopilot levels govern human stops; this protocol adds none).

## Business Rules

- R1 — Config is the authority; the model does not get a vote (the ladder that
  once ranked models and silently skipped configured advisers is removed).
- R2 — The only skip is the literal same-model no-op.
- R3 — Advice-class slots are read-only, enforced at configuration checking
  (an honest blocklist of known write-granting/auto-approve tokens, stated as
  such — never a positive read-only guarantee).
- R4 — High-risk execution approval requires a live consult record; staleness
  is event-based (four events), never a time limit.
- R5 — Consult anchors are machine-stamped against the same record the verb
  mutates; callers cannot forge freshness.
- R6 — Advice never approves, never overrides, never writes; consults never
  substitute for the orchestrator's own verification re-run.
- R7 — The worker budget is two per claim; exhaustion returns blocked.
- R8 — **Dispatch payloads have one source of truth** (gh22-completion g22-1):
  `bee dispatch prepare --runtime <r> --kind cell|gather|reviewer|advisor`
  emits the guard-conformant payload (tier marker anchored exactly where the
  guard checks; pinned agent types from the guard's own map), a dispatch id,
  and the economics block. The guard's decision core is an exported pure
  function (`evaluateDispatch`) shared by the hook and prepare's tests —
  prepare's output is proven against the real guard, never a copied regex.
  Prepare surfaces tier refusals verbatim (a cli-shaped slot stays
  gather-only); the advisor kind resolves its model through the advisor
  resolver, never the generation slot. The same resolvers additionally accept,
  on any slot including advisor, a native model-override leaf and an
  explicit-fallback composite (codex-native-transport D2); the composite
  exposes its CLI fallback leg only when its fallback policy is stated
  explicitly (D1) — a bare native leaf or an unconfigured slot never invents a
  fallback command, and every pre-existing slot shape keeps resolving
  byte-identically.
- R9 — **Dispatch records tell the economic truth** (gh22-completion g22-2;
  refined by codex-native-transport D1/D3/D7): every record carries
  logical_tier, requested_model, effective_model, effective_model_status,
  channel, enforcement (additive; the legacy transport key is untouched). A
  model-param dispatch is `pinned`; a bare-marker budget dispatch is
  `unverified`. A second-runtime native spawn stays `inherited-or-unknown`
  with `prompt-budget` enforcement UNLESS a version- and configuration-scoped
  capability probe has classified the client as accepting a native model
  override for the resolved route — only then does the record carry
  `native-requested` status with `native-model-param` enforcement, the
  requested model/effort on the payload, and `effective_model` still null (the
  probe proves the client *accepted* the request, never that the runtime *ran*
  on it; a child's self-report is still never evidence). A route that resolves
  native but the probe has not confirmed falls back to an explicitly
  configured CLI command with the reason recorded, or — with no such fallback
  configured — returns a typed refusal naming the classification that blocked
  it; config names the requested model, the log never silently claims it took
  effect.

## Edge Cases Settled

- External command reporting success while doing nothing → advice/gather
  output is accepted only between declared framing markers; missing or empty
  output is a failed run, surfaced loudly (proven by a real dogfood run).
- Adviser configured but the command cannot receive a prompt → refused at
  configuration checking (prompt transport is declared, never inferred).
- Corrupt or hand-edited consult record → reads as missing; the verb never
  crashes; the approval refuses with the standard message.
- Execution gate revoked after a consult → the old consult is stale by rule;
  re-approval requires a fresh consult.
- A native-override route whose capability probe has not (yet) confirmed the
  client, and whose slot carries no explicit fallback policy, refuses the
  dispatch by name rather than silently downgrading to the budget-only path
  or inventing a CLI command (codex-native-transport D1/D3a).
- An adviser-kind dispatch prepared with a correctly-resolved adviser model
  was, until closed, still refused by the pre-spawn guard as an unconfigured
  model — the guard's allowlist recognized the tier slots but not the adviser
  slot, even though prepare's payload and the guard's decision core share the
  same resolver. The guard's allowlist now folds in a configured model-shaped
  adviser's own model (a cli-shaped, native, or unconfigured adviser adds
  nothing), closing the asymmetry; this can only turn a refusal into an
  allowance, never the reverse (codex-native-transport cnt-7; mechanism
  specced in `hook-runtime.md` B16).

## Open Gaps

- External advice/gather runs do not yet appear in the dispatch audit log
  (known, assigned to the measurement backlog — the passive tools log covers
  in-family calls only).
- The conflict-between-decisions trigger waits on structured decision records
  (its prerequisite feature), and the scope-creep trigger has no source of
  truth; neither is built, neither is silently substituted.

## Pointers (implementation)

- Worker loop: `skills/bee-executing/SKILL.md` (Advisor Consult section);
  dispatch-time offer + same-model no-op: `skills/bee-swarming/SKILL.md` §4.
- Orchestrator consult + throw: `skills/bee-validating/SKILL.md` (Gate 3);
  `handleStateGate` + `state advisor-ref record/show` in
  `skills/bee-hive/templates/bee.mjs`; helpers `advisorRefAnchors` /
  `advisorRefStale` in `skills/bee-hive/templates/lib/state.mjs`.
- Read-only validation: `validateModelsConfig` (advice-class token blocklist)
  + `validateAgentFilesDrift`, same lib; suite `scripts/test_config_validate.mjs`.
- Guard allowlist fold (Edge Cases, cnt-7): `configuredModelSet` in
  `skills/bee-hive/templates/lib/dispatch-guard.mjs` (mirrored in
  `.bee/bin/lib/dispatch-guard.mjs`) calls `resolveAdvisor(root, 'claude')`
  directly, since the adviser slot is deliberately not a `CONFIGURABLE_SLOTS`
  member. Canary rows: `hooks/test_model_guard.mjs` rows 21-22.
- Resolution: `resolveAdvisor` (state.mjs); external gather contract:
  `skills/bee-hive/references/routing-and-contracts.md` (cli gather branch)
  and `docs/specs/doctrine-layer.md` B8/R12.
- Gate precondition spec detail: `docs/specs/workflow-state.md` B9/B9a.
- Native-override transport (config shape, capability probe, dispatch
  prepare's native branch): capability classification and the doctor unlock
  row are specced in `docs/specs/hook-runtime.md`; the resolver's native leaf
  and explicit-fallback composite sit beside `resolveAdvisor`/`resolveTier`
  above (`skills/bee-hive/templates/lib/state.mjs`); `prepareDispatch`'s
  native branch and `deriveEconomics`'s `native-requested` status share
  `skills/bee-hive/templates/lib/dispatch-prepare.mjs` with R8's
  `evaluateDispatch`.
