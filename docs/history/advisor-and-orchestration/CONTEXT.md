# Advisor And Orchestration — Context

**Feature slug:** advisor-and-orchestration
**Date:** 2026-07-14
**Exploring session:** complete (rewritten once — see *Correction Record*)
**Scope:** Deep
**Domain types:** RUN (hooks, worker dispatch, gates), ORGANIZE (config schema, agent definitions), CALL (advisor transport)

> **Decision IDs are prefixed `AO`, never `D`.** The earlier advisor feature already cites `D1`/`D2`/`D3` verbatim inside live code (`state.mjs:76`, `state.mjs:742`, `bee-swarming/SKILL.md:42`, cell `adv-2`) and `routing-and-contracts.md:195` carries another `D1`. A second `D1` in the same area would make every downstream citation ambiguous (AO7).

## Correction Record — read this before anything else

The first draft of this document was built on a **false premise**: that bee's `advisor` slot was configured but never triggered. **It is triggered.** A worker-level advisor loop shipped already and is live:

- `skills/bee-executing/SKILL.md:72-101` — the worker consults on its **first** serious failed verify (not the second), with a budget of **2 consults per claim**; an exhausted budget ends in `[BLOCKED]` and **the cell never reaches cap**. Advice never substitutes for fresh verify output; advice conflicting with a locked decision is an instant `[BLOCKED]`.
- `skills/bee-swarming/SKILL.md:42-46` — the orchestrator runs a degenerate check at dispatch (advisor resolving to the worker's own model → skip; worker at `ceiling` → skip) and only then adds an `Advisor` line.
- `state.mjs` already exports `resolveAdvisor`; `advisor` is deliberately outside `CONFIGURABLE_SLOTS`.

The shipped rule is **stricter** than what this session first proposed: it consults one attempt earlier and closes at a harder point. The original proposal was a regression, and it also depended on a red-verify streak counter that does not exist (`cells.mjs:365-378` `recordVerify` overwrites a single scalar `verify_passed` — no history).

**What this feature is, therefore, is the delta — not a rebuild.** The worker loop is kept verbatim.

## The Real Gaps

1. **The orchestrator cannot consult at all.** `bee-executing/SKILL.md:74` states it outright: the advisor is *"not a gate-time or orchestrator-level consult"*. The user's request — *main cũng phải gọi được advisor* — is genuinely unbuilt.
2. **Tiny and small lanes are advisor-blind.** The advisor lives inside the swarm dispatch. Tiny/small execute "direct, in-session (solo)" (`bee-hive/SKILL.md:116`), so there is no worker, so there is no `Advisor` line, so there is no consult — in the lanes bee runs most often.
3. **The model guard has two holes** (verified independently):
   - `bee-model-guard.mjs:123-126` — `tool_input.model` is accepted as *any non-empty string*, unvalidated. `model: "banana"` passes and is written to `.bee/logs/dispatch.jsonl` as a legitimate `transport: "model-param"`. **The audit trail records lies.**
   - `bee-model-guard.mjs:127-131` — an anchored `[bee-tier: …]` marker **asserts intent and selects nothing**; the hook is deny-only and never injects a model param. Without a `model` param the subagent inherits the session (ceiling) model regardless of what the marker claims. This is the most likely explanation of the three `general-purpose` subagents the user saw with no visible model.
4. **Nothing measures the thing that costs money.** `.bee/logs/dispatch.jsonl` records dispatches and *never* non-dispatches — it cannot answer "how many inline reads did the orchestrator do".
5. **The advisor can write.** The live command is `codex exec … --yolo … workspace-write`. Advice-only is already the law in prose; nothing enforces it at the transport.

## The Cost Model (load-bearing — do not re-derive)

A real host session billed **$24** on the ceiling model against **$0.41** across three subagents. The first diagnosis in this conversation ("the orchestrator reads too many bytes inline") was **overturned by an adversarial cross-family advisor**. The corrected model:

- The bill is `Σ over turns ( context_size_at_turn ) × cache-read rate`. **Every orchestrator tool call re-reads the entire context.** At ctx 73% of a 1M window that is a fixed per-turn cost before the call does anything.
- The first-order term is therefore **turn count**, with context size as the multiplier. Bytes-returned-per-read is second-order.
- **The `$0.41` is not evidence that delegation is cheap — it is evidence that delegation barely happened.** The session was *under*-delegated.
- Root cause in bee's own lane table: tiny/small Execute is *"direct, in-session (solo)"*, so the orchestrator runs the read → edit → test → read → fix loop inside its own window, billed every turn, with source accumulating permanently.

*(Note: the "0 subagents" phrasing is not the culprit — `bee-hive/SKILL.md:116` already reads "0 **ceremony** subagents (I/O-offload workers exempt)". The obstacle is the **Execute** column.)*

## Locked Decisions

Fixed. Planning implements them exactly — cited, never reinterpreted.

| ID | Decision | Rationale (where it changes implementation) |
|----|----------|---------------------------------------------|
| AO1 | The full package ships as **one feature**: measurement (tools logger + the payload probe spike), both guard-hole fixes, pinned agent types, the orchestrator advisor path, and worker-ising cell execution for **every lane including `tiny`**. | Worker-ising is the only part with leverage on the bill, **and** it is what carries the advisor down into tiny/small — the two goals turn out to be the same change. |
| AO2 | **Triggers.** The worker-level trigger is **unchanged** (first serious failed verify, budget 2, `[BLOCKED]` on exhaustion). This feature adds exactly **one** orchestrator-level trigger: **(b)** hard-gate / high-risk before Gate 3. Trigger **(c)** — two locked decisions in conflict — is **deferred behind the `structured-decisions` feature** (AO9), not dropped. Trigger **(d)** — scope creep past a declared file list — is **dropped from v1**. | (d) has no source of truth: cells carry `files` only as *cap output*; nothing declares an expected file list at claim time. (c) has no **detector**: `decision`/`rationale` are free prose with no structured claim, `scope` is the default `"repo"` in **106 of 135** records and absent entirely from `supersede` events, and the store's only mechanical relation (`supersedes`) is the *resolution* of a conflict, not its detection — a superseded decision is no longer active, so two actives can never be in a machine-visible contradiction. See AO9. |
| AO9 | **AO2(c) is deferred, not dropped.** A prerequisite feature — **`structured-decisions`** — gives decision records a machine-readable claim (subject / predicate / value) so conflict becomes mechanically detectable. It gets its **own exploring**: it is a data-model change to an append-only log with 135 existing events (schema, migration, CLI shape, compatibility with `activeDecisions`/`supersede`). This feature ships with **AO2(b) only**. | Owner's call: build the foundation rather than drop the trigger or ship a flaky proxy. A proxy on the current shape (keyword overlap, same-scope pair, embedding similarity) would fire constantly on the 106 same-scope records — and **a flaky trigger is strictly worse than none**, because it destroys the rarity that is the advisor's entire value. `SPLIT RECOMMENDED` was answered, not silently shrunk. |
| AO10 | **`.claude/agents/` MUST NOT join `REPO_SKILL_TARGETS`** (`onboard_bee.mjs:256-259`). It ships through a **separate flat managed-file sync** with its own version marker — the same class as the `.claude/settings.json` hook merge. | Adding it would **brick onboarding permanently and non-forceably on every host**: the three-version preflight resolves a target's version from `<targetRoot>/bee-hive`'s marker, and an agents root has no `bee-hive` *directory* — a target with any `bee-*` presence but no readable marker resolves as `"unknown"`, which is refused and **never forceable**. Also `SKILL_DIR_RE` assumes *directories* named `bee-*`; agents are *files*. `plan.md` proposed exactly this forbidden change. |
| AO11 | **Codex gets a documented asymmetry on pinned agent types, not parity.** | Codex has no per-agent model selection (`DEFAULT_MODELS.codex` is all-`null` **by design**, `state.mjs:96-97`); it enforces a tier as a read budget + output cap in the worker prompt. A `model:` pinned in frontmatter is a **no-op file** for that runtime. Faking parity ships a file that does nothing and implies an enforcement that does not exist. |
| AO12 | **AO5's config validation is hosted in `bee status`**, backed by a shared validator in `state.mjs`, and also exposed as `bee config validate` for CI. **`resolveTier` is disqualified as the host.** | `resolveTier` is called from inside hooks, and every bee hook is **fail-open by contract** (`catch → return 0`): a throw there is swallowed and logged as a crash — **a refusal that refuses nothing** — and it would put a throw on the write-guard's hot path. Onboarding alone is also disqualified: it runs once, and `.bee/config.json` is hand-edited afterwards. `bee status --json` is the **mandatory first call of every session** and already reads the models block. Damage today: `normalizeTierValue` returns `undefined` for any unrecognised shape and the key is **silently dropped** — one typo (`{"advisor": {"modle": …}}`) disables the advisor entirely and nothing says so. |
| AO13 | **An `advisor_ref` is stale** if any of: its feature differs from `state.feature`; the newest active decision id changed since the consult; `sha256(plan.md)` changed; or the ref predates the most recent revocation of the execution gate. **Explicitly not a time-based TTL.** Gate 3 checks it as a precondition inside `handleStateGate`: when `--name execution --approved true` **and** `state.mode === 'high-risk'`, require a non-stale `advisor_ref` — else **throw**, never warn. | A TTL is an invented number, and this feature already burned itself on one ("two red verifies"). Every condition above is a real event with a real record. Hard-gate work is *defined* as routing to high-risk, so `mode === 'high-risk'` over-covers **in the safe direction**. A warning is the anti-pattern AO3 exists to escape. |
| AO3 | **Enforcement point, new triggers only:** Gate 3 does not open for hard-gate/high-risk work without an `advisor_ref`. Nothing is blocked mid-flight. The worker close point stays exactly as shipped (`[BLOCKED]`), and is **not** moved to `cap`. | Removes the choice at a *discrete* event. Moving the worker close point from `[BLOCKED]` to `cap` would be strictly weaker than what already ships. |
| AO4 | **Call paths.** The worker loop is kept as shipped (`Advisor` line, first-serious-failure trigger, budget 2 per claim, model- or cli-shaped transport, consults in the cap trace, `[BLOCKED]` on exhaustion) — **except** that the orchestrator no longer second-guesses the configured advisor at dispatch (per AO5). The **new** path is the orchestrator's own consult, for AO2(b) and AO2(c). | A worker holds the problem context but holds neither the gates nor the decision log; an orchestrator holds the gates but would have to reload technical context the worker already has. Split by trigger class, not by preference. |
| AO5 | **Config is the authority; the model does not get a vote.** The **configured advisor IS the advisor** — consulted whenever a trigger fires, with no family test, no strength test, no self-judged skip. The rule generalises to tiers: a dispatch declaring `generation` or `extraction` **must run on the model configured for that tier**; a same-family fallback is chosen **only** when that tier is unconfigured. **Consequence:** the degenerate check at `bee-swarming/SKILL.md:43-45` — which ranks models by a hardcoded `haiku < sonnet < opus` order and **silently skips the configured advisor** when it judges it not stronger — is **removed**, narrowed at most to the one honest no-op (advisor resolves to literally the same model as the worker). **Consequence for the guard:** `bee-model-guard` must validate that the `model` param **equals the model configured for the declared tier**, not merely that it is a non-empty string. | The owner configured a model on purpose; **no runtime heuristic gets to overrule that**. The hardcoded strength ladder is the model second-guessing its owner — that is not a feature, it is the bug. This replaces the earlier "advisor must be cross-family" rule: cross-family was only ever a *proxy* for "the advisor should be a real second opinion", and it dissolved on contact with reality (under the `claude` runtime the Agent `model` param only accepts claude names, so enforcing it would have made every model-shaped advisor unreachable). This frame needs no escape hatch, and it gives the guard a **principled definition of "valid"** instead of an allowlist of model names. |
| AO6 | **Guiding principle, adopted repo-wide:** mechanisms that **remove** a choice are lean; mechanisms that **punish** a choice are ceremony wearing enforcement's clothes. Hooks are good at **discrete events** and worst at **continuous resources**. *Not a wall, a floor.* | Compatible with critical rule 12, not an exception to it. This is the principle that killed the byte-budget hook (see *Explicitly Not Built*). |
| AO7 | Decision IDs for this feature are prefixed **`AO`**, never `D`. | The earlier advisor feature's `D1`–`D3` are cited verbatim in live code and skills. |
| AO8 | The advisor runs **read-only**, like every review-class slot. The current `--yolo … workspace-write` advisor command is brought under that rule. | Advice-only is already the law in prose but nothing enforces it at the transport. The mechanism meant to catch a mistake must not be able to make one. |

| AO14 | **The lane table gives way; AO1 stands.** `bee-hive/SKILL.md:116`'s tiny-lane Execute column changes from *"direct, in-session (solo)"* to **a dispatched worker**, and `bee-swarming/SKILL.md:22` (*"no workers are spawned"* for tiny/small) is amended in the same slice. **The orchestrator authors the done-report**, and its evidence is the worker's verbatim diff **plus the orchestrator's own independent re-run of the verify** — never the worker's word. The Delegation contract gains a second named class: an **execution worker**, which (unlike an I/O-offload worker) **does** register in the swarm registry and **does** take reservations. | The `ao-spike-tiny` spike returned a bare **NO** and closed its own loophole: a dispatched worker fails all three words of *"direct, in-session (solo)"* independently; the *"I/O-offload workers exempt"* parenthetical sits in the **Validate** column, not Execute; and the Delegation contract defines an I/O worker as a digest-returning gather that **does not** register in the swarm registry — so a cell-executing worker is, by that contract's own line, not one. AO1 and the lane table were in direct contradiction; the owner chose the lane table, because worker-ising tiny execution is **the only part of this feature with leverage on the bill** and it is what carries the advisor into the lane bee runs most often. The done-report clause changes nothing mechanical — the orchestrator already **must** re-run every verify under the goal-check rule (decision 0018); it only stops the contract from pretending the executing agent writes it. |

### Explicitly Not Built (binding, per AO6)

- **Any byte-budget or token-budget hook throttling `Read`/`Grep`.** It meters the second-order term while the bill is driven by the first-order one; a well-meaning model under context pressure routes around it with `Bash("cat file")`; putting `Bash` in the matcher breaks verify/test/git; the threshold is invented; and worst, it **inverts critical rule 12** by teaching read-until-blocked, which makes *"an unblocked read is not an approved read"* false.
- **Any check that the model name must appear in the Agent `description`.** Theater — it enforces a string nobody validates, and pinned agent types subsume it.

### Agent's Discretion

- The mechanical proxy for AO2(c) "two locked decisions in conflict", and its false-positive budget. Semantic conflict is not countable; planning must find a cheap honest detector **or say plainly that it cannot, and narrow the trigger to hard-gate only**.
- The `advisor_ref` record shape, and how Gate 3 verifies that a ref is *fresh* (belongs to this feature's current state) rather than stale.
- Whether the tools logger writes one row per tool call or one aggregated row per turn.
- Whether the tiny-lane worker is a full `bee-swarming` dispatch (claim/reservation machinery) or a lighter direct Agent dispatch under the same execution contract.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| **Advisor** | A cross-family model consulted **adversarially**. It **advises, never decides**: its output is *data, not instructions*, and accept/reject stays at decide-altitude (critical rule 13). If the advisor decides, you have not removed a blind spot — you have swapped it for another model's and lost the accountable party. |
| **Trigger** | An **observable event** — a failed verify, a lane flag, a decision conflict — never a model's self-reported uncertainty. |
| **Close point** | The discrete place a trigger is allowed to block: `[BLOCKED]` for the worker path (as shipped), **Gate 3** for the new orchestrator path. |
| **Control plane** | What the orchestrator's window becomes after AO1: cells, digests, cap results, decisions. **Never file bodies.** |
| **Decorrelated error** | Why a *different* advisor is worth more than a *stronger* one: a different failure mode, not a smaller one. It is the reason an owner configures a foreign advisor — **but it is the owner's call, not the runtime's** (AO5). |
| **Degenerate check** | The shipped dispatch-time test that skips the advisor when it judges it no stronger than the worker. **Removed by AO5** — it is the model overruling its owner's configuration with a hardcoded strength ladder. |

## Existing Code Context

### Reusable Assets — do not rebuild

- `skills/bee-executing/SKILL.md:72-101` — the whole worker Advisor Consult protocol: trigger, budget, evidence bundle, transport, attribution, `[BLOCKED]` semantics. **Kept verbatim.**
- `skills/bee-swarming/SKILL.md:42-46` — the `Advisor` dispatch line stays; the **degenerate check inside it is removed** (AO5). Do not layer a new rule on top of it — it is the thing being deleted.
- `state.mjs` `resolveAdvisor` (~:753) — already resolves the slot; `advisor` is deliberately outside `CONFIGURABLE_SLOTS` (`:75-83`).

### Integration Points

- `hooks/bee-model-guard.mjs:123-146` — both guard-hole fixes. The mirror at `.bee/bin/hooks/bee-model-guard.mjs` is byte-identical and **must move with it**.
- `skills/bee-hive/templates/lib/state.mjs:65,69,93,~708,~753` — tiers, defaults, `resolveTier`, `resolveAdvisor`. AO5's validation lands here.
- `skills/bee-hive/SKILL.md:116-117,125` — the lane table's **Execute** column ("direct, in-session (solo)") and the tiny fast path's in-session done-report. **This is what AO1 rewrites, and it is the feature's biggest risk.**
- `.bee/bin/lib/cells.mjs:365-378` — `recordVerify` overwrites a single scalar. Any counting of verify history needs a new field **and a CLI verb** (hive law 12).

### Established Patterns

- **Fail-open hooks**, with the standing warning that fail-open turns a crashed fixture into universal green (`critical-patterns.md`, 2026-07-14). The new logger needs a test that **fails when the logger is broken**.
- **CLI executor transport**: prompt via stdin from `.bee/workers/<id>.prompt.md`; a CLI that does not read stdin is wrapped `bash -lc '… $(cat)'`. Review-class slots are read-only — AO8 puts the advisor on that side.
- **Never hand-edit `.bee/*.json(l)`** (hive law 12).

## Canonical References

- Decision `c6cd0f3b` and cells `adv-1..3` — the shipped advisor v1. Read before touching the worker loop.
- Decision `0016` — the degenerate check.
- Decision `0015` — `ceiling` is never configured; it means "inherit the session model".
- Decision `0023` — why the `[bee-tier:]` marker is anchored.
- Decision `c2c46488` — "an unblocked write is not an approved write"; the failure AO3 and AO6 exist to avoid repeating.
- `docs/model-presets.md`, `.bee/config-sample-cli-executors.json` — working cross-family CLI configs.

## Outstanding Questions

### Resolve Before Planning

- [ ] **AO1's tiny clause is locked on an unknown, and that is acknowledged, not hidden.** `bee-hive/SKILL.md:116` (tiny Execute = *"direct, in-session (solo)"*) and `:125` (the fast path closes on an in-session done-report) are exactly what AO1 rewrites. **Binding condition:** the very first cell of this feature is a **spike** that answers "can a tiny-lane cell execute through a worker without breaking the merged Gate 2+3 question and the done-report contract?" — no other cell derived from AO1's tiny clause is planned until it returns. A NO returns to the **user**, never to the planner's discretion: planning may not reinterpret a locked decision, and it may not build speculative cells on top of one. This is the feature's largest risk and it is scheduled first, not deferred.

### Deferred To Planning
- [ ] **The hook payload probe (unverified, load-bearing):** can a `PreToolUse` payload distinguish an *orchestrator* tool call from a *subagent* one (`session_id`? `transcript_path`? a sidechain field)? Settle with a probe hook that dumps its stdin payload, bound on `Read`, run once at top level and once inside a dispatched subagent, then diff. **Gates the logger's `agent` column.** Spike it; do not assume it.
- [ ] A mechanical proxy for AO2(c) conflict detection, with a false-positive budget — or an honest narrowing of the trigger.
- [ ] How Gate 3 verifies an `advisor_ref` is fresh rather than stale. **Note this is net-new plumbing:** `handleStateGate` (`.bee/bin/bee.mjs:805-820`) validates a gate's *name* and writes the flag — **no gate anywhere checks a precondition today**. AO3 needs a new state field *and* a CLI verb (hive law 12), not just a rule in a skill file.
- [ ] **Where AO5's validation lives.** There is no config-validate stage today: `normalizeModels`/`normalizeTierValue` (`state.mjs:108-124`) **silently ignore invalid shapes** and drop unknown keys, and `bee.mjs` has no `config validate` verb. The only precedent is the passive `STALE_ADVISOR_NOTICE` (`state.mjs:679-689`) — a warning, not a refusal. Planning must pick the host (onboarding? `bee status`? `resolveTier` itself?) and say so.
- [ ] **Migration:** any repo configuring `models.claude.advisor` as a plain model string keeps working under AO5 (config is the authority — it is used as configured). But the removal of the degenerate check means an advisor that was previously *skipped* will now actually be **consulted**. Blast radius is small (shipped presets ship `advisor: null`), but the behavior change is real and must be called out in the release note.

## Deferred Ideas

- **Turn-count discipline as an explicit rule** (batch tool calls; one compound `Bash` beats five `Read`s) — real leverage on the first-order cost term, but it is prose guidance, and this feature is deliberately about mechanism over exhortation. Revisit once the logger can prove the effect. → backlog P33.
- **Threshold tuning from measured data** — "two red verifies" was an invented number and has now been dropped; the shipped "first failure" rule is also unmeasured. Re-derive from real sessions. → backlog P34.
- **A session cost snapshot at close**, so spend is attributable to lanes and cells. → backlog P35.

## Handoff Note

CONTEXT.md is the source of truth. `AO1`–`AO8` are stable and cited, never reinterpreted. The user asked for a **spec** as the deliverable, so planning should expect `bee-scribing` to produce a `docs/specs/` area spec covering the advisor protocol *as a whole* — the shipped worker loop **and** the new orchestrator path — not just a `plan.md`. That spec is also the artifact that would have prevented this document's first draft from being wrong.

The one thing a downstream agent must not lose: **the first diagnosis was wrong, the first draft of this very document was wrong, and in both cases an adversarial reviewer with no stake in the conclusion is what caught it.** That is not an anecdote — it is the feature's own argument for existing.

And the one thing that must not be softened: **AO5 says the model does not get a vote on its own configuration.** The degenerate check was written in good faith and it is exactly the failure it was meant to prevent — a model quietly deciding that the owner's choice did not apply. Deleting it is the point, not a side effect.
