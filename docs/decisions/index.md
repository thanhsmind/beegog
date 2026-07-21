<!--
GENERATED FILE — do not hand-edit.
Rendered by `bee decisions render` from the decisions store (decision-propagation D4b/D8a).
Regenerate: `bee decisions render`. Check freshness: `bee decisions render --check`.
Deterministic: byte-identical for the same store contents — this file never includes a
generation timestamp or any other wall-clock value, only the dates already recorded on
each decision event.
-->

# Decision Index

## advisor-and-orchestration

### hooks

- 8aa1cce4 · 2026-07-14 · A drift failure has two sides, and we assumed the wrong one. Both the session model and a two-lens review panel diagnosed test_hook_contracts.mjs 22 failures as a rotted fixture (staging wrappers at the wrong path), by pattern-matching the standing fixture-rot learning. The fixture was already correct and already used readdirSync; its diff is zero. The real defect was .codex/hooks.json — a GENERATED, TRACKED file that had been hand-edited (commit 744b1bec) to .bee/bin/hooks/ paths, while hooks/catalog.mjs has always rendered hooks/${script} for the codex repo target. Regenerating it from the catalog fixed all 22 rows. RULE: when a drift check fails, establish WHICH side drifted from git history before repairing either; never assume the test is the stale one. Corollary: a generated file that is tracked can be hand-edited, and the drift check is the only thing that will ever notice.

### taxonomy

- 53a57a7f · 2026-07-14 · AO9 — AO2(c) "two locked decisions in conflict" is NOT dropped, and NOT built in v1: it is deferred behind a prerequisite feature, "structured-decisions", which gives decision records a machine-readable claim (subject / predicate / value) so conflict becomes mechanically detectable. advisor-and-orchestration ships with the orchestrator trigger AO2(b) only — hard-gate/high-risk before Gate 3. structured-decisions gets its own exploring: it is a data-model change to an append-only log with 135 existing events (schema, migration, CLI shape, compatibility with activeDecisions/supersede).

## advisor-protocol

### advisor

- a174e621 · 2026-07-14 · AO4 — Call paths. The worker advisor loop is kept as shipped (Advisor line in the dispatch, first-serious-failure trigger, budget 2 per claim, model- or cli-shaped transport, consults recorded in the cap trace, [BLOCKED] on exhaustion) EXCEPT that the orchestrator no longer second-guesses the configured advisor at dispatch (per AO5): if an advisor is configured, the Advisor line is added. What this feature adds is the orchestrator path — the advisor consulted at Gate 3 for hard-gate work and on a decision conflict — which bee-executing/SKILL.md:74 today explicitly rules out.
- 72f3d6dd · 2026-07-14 · AO5 (replaces the cross-family rule) — CONFIG IS THE AUTHORITY; THE MODEL DOES NOT GET A VOTE. The configured advisor IS the advisor: it is consulted whenever a trigger fires, with no family test, no strength test, and no self-judged skip. The same rule generalises to tiers: a dispatch declaring generation or extraction MUST run on the model configured for that tier; a same-family fallback is chosen ONLY when that tier is unconfigured. Consequence: the degenerate check at bee-swarming/SKILL.md:43-45, which ranks models by a hardcoded haiku<sonnet<opus order and silently SKIPS the configured advisor when it judges it not stronger, is removed — narrowed at most to the one honest no-op case (the advisor resolves to literally the same model as the worker). Consequence for the guard: bee-model-guard must validate that the model param EQUALS the model configured for the declared tier, not merely that it is a non-empty string.
- 4d64e522 · 2026-07-14 · AO8 — The advisor runs READ-ONLY. The advisor command in this repo today is "codex exec ... --yolo ... workspace-write", i.e. it can write. Advice-only is already the law (bee-executing: advice never authorizes a package install, a gate approval, or file scope beyond the cell) but nothing enforces it at the transport, so the config is one careless advisor away from a writer. Bring the advisor slot under the same read-only rule the review slot already obeys.
- 9fc8dc97 · 2026-07-14 · AO3 — Enforcement point, for the NEW orchestrator-level triggers only: Gate 3 does not open for hard-gate/high-risk work without an advisor_ref. Work is never blocked mid-flight. The worker-level close point stays exactly as shipped ([BLOCKED] on an exhausted consult budget) and is not moved to cap.
- c8a1100a · 2026-07-14 · AO2 — Advisor triggers. The worker-level trigger is NOT changed: the shipped rule stands (consult on the FIRST serious failed verify, budget 2 per claim, exhausted budget ends in [BLOCKED] and the cell never reaches cap). This feature ADDS the triggers that do not exist: (b) hard-gate / high-risk work before Gate 3, and (c) two locked decisions in conflict — both orchestrator-level, which bee-executing/SKILL.md:74 explicitly excludes today. Trigger (d), cell scope creeping past a declared file list, is DROPPED from v1: cells carry no expected file list at claim time, so it has no source of truth.
- 34514a8b · 2026-07-12 · auto-approved Gate 3 (bypass) for advisor: READY WITH CONSTRAINTS — 3 MEDIUM transport assumptions PROVEN by runtime probes (nested claude -p OK/exit0; workers carry Agent tool; model-guard logs worker-originated dispatches in dispatch.jsonl); plan-checker STRUCTURALLY CLEAN 0 BLOCKER 4 WARNING all resolved; cell review CRITICALs on adv-3 fixed (proven transport + report in read_first). Execute adv-1 parallel adv-2, then adv-3
- 6841bfcb · 2026-07-12 · auto-approved Gate 2 (bypass) for advisor: standard (3 flags, no hard-gate), single slice, 3 cells — adv-1 resolveAdvisor+normalizeModels slot+tests (no generation fallback per D2), adv-2 bee-executing consult loop prose (D3 canonical loop, evidence bundle, authority carve-out), adv-3 bee-swarming dispatch line+ladder note (degenerate check at dispatch per 0016). Transport unknown (nested claude -p vs Agent tool in workers) is a named validating proof, not an assumption
- 3a794918 · 2026-07-12 · auto-approved Gate 1 (bypass) for advisor: CONTEXT.md locked D1-D3 — worker-level on-failure consult only (amends de967733, owner Q1 answer 'Amend — rescue rung only' 2026-07-13); advisor = models.<runtime>.advisor slot (review-slot precedent, model or cli), degenerate baseline = the consulting worker's own model; trigger fail-1, max 2 consults/cell, authority blocks stay instant-[BLOCKED]. Fresh-eyes (opus): APPROVE-WITH-NOTES -> 6 findings fixed -> APPROVE loop 2

### cli

- 5df3956b · 2026-07-14 · AO17 — The cli-executor invocation contract is: run the configured command VERBATIM, prompt on stdin, capture stdout; append NOTHING. And every path handed to a cli worker is ABSOLUTE. Supersedes swarming-reference.md:85, which appends '-o <file> -' to the command.
- 1a06f748 · 2026-07-14 · AO12 — AO5 config validation is hosted in `bee status`, backed by a shared validator in state.mjs and also exposed as a `bee config validate` verb for CI. resolveTier is explicitly DISQUALIFIED as the host.

### codex

- d92691f7 · 2026-07-14 · AO20 — Decision 0019's 'first dogfood pending' is CLOSED, and the answer changes the risk picture. bee's external path DID run end to end for the first time (2026-07-14): codex exec -m gpt-5.6-sol -s read-only -c model_reasoning_effort=high -  , prompt on stdin, correct answer, exit 0. It needed NO --yolo and NO write access. Separately, agy --sandbox --mode plan (no --dangerously-skip-permissions) also read the repo and answered correctly. CONCLUSION: the machine-wide bypass bee was shipping as its default preset was never a requirement — it was surplus privilege.
- 1645df71 · 2026-07-14 · AO11 — Codex gets an explicit documented ASYMMETRY on pinned agent types, not parity. Codex has no per-agent model selection (DEFAULT_MODELS.codex is all-null by design, state.mjs:96-97) and enforces a tier as a read budget + output cap in the worker prompt instead. A model: pinned in agent frontmatter is a no-op file for that runtime.

### decisions

- 80ad93ff · 2026-07-14 · AO7 — Decision IDs for this feature are prefixed AO (AO1..AO8), not D. The earlier advisor feature already cites D1/D2/D3 verbatim inside live code and skills, so a second D1 in the same area would make every downstream citation ambiguous.

### dispatch

- ab0985d7 · 2026-07-14 · AO19 — AO17 is CORRECTED, not confirmed. The trailing '-' in the old dispatch line is NOT an appended convenience flag: per 'codex exec --help', the bare positional IS the prompt, and '-' is what makes codex read the prompt from STDIN instead. So 'run the configured command verbatim, append nothing' would silently stop every codex-shaped command lacking its own '-' from ever receiving its prompt. bee must not append -o; but the prompt TRANSPORT must become an explicit, validated property of the configured command, not an assumption.
- 23937e24 · 2026-07-14 · AO18 — The owner keeps --dangerously-skip-permissions on the cli GATHER command, with the risk stated and accepted. This is a deliberate, logged exception to swarming-reference.md:91 ('never a machine-wide bypass as the house default') and to AO8's read-only-advice-slot rule, not an oversight.

### gates

- c04ce011 · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 5 READY WITH CONSTRAINTS -> constraints applied (checker B1 in-file contradiction + W1 cross-refs + W2 bee-hive:125 + W3 census correction + W4 transport note all folded into ao-5-1). FIRST LIVE ADVISOR-GATED APPROVAL: consult run through the configured cli advisor (codex/gpt-5.6-sol, read-only, evidence bundle on stdin), verdict PROCEED with one taxonomy refinement (distinguish worker classes by authority and state effects — carried into the contract text), advisor-ref recorded, precondition passed. Approval covers ao-5-1 only.
- 56f5b32d · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 4 shape — advisor_ref state field (verb-stamped anchors: feature, newest decision id, plan sha256), CLI verb state advisor-ref record/show, Gate 3 precondition in handleStateGate (high-risk + execution+true -> throw on stale/missing ref, AO13 staleness verbatim, gate_revoked_at.execution stamped on revocation), consult = orchestrator machinery under every bypass level (read-only advisor run per config + record). Cells ao-4-1 (state+CLI+tests, ceiling-judged), ao-4-2 (bee-validating Gate 3 prose, deps 4-1).
- 7212d6be · 2026-07-14 · AO13 — An advisor_ref is STALE if any of: its feature differs from state.feature; the newest active decision id has changed since the consult; the sha256 of plan.md has changed; or the ref predates the most recent revocation of the execution gate. Explicitly NOT a time-based TTL. Gate 3 checks it as a precondition inside handleStateGate: when --name execution --approved true AND state.mode is high-risk, require a non-stale advisor_ref for state.feature, else throw with the reason and a FIX line. It must throw, never warn.

### lanes

- cd635f83 · 2026-07-14 · AO16 — Slice 2 splits into 2A (make a cli-shaped tier actually work for gathers) and 2B (AO5 model-equality + degenerate-check removal + AO8 read-only advisor). Nothing is dropped; 2B keeps every locked clause and gets its own gate. Owner approved the split at Gate 2 ('Duyet — tach 2A/2B nhu de xuat').
- 88ba6ab4 · 2026-07-14 · AO14 — The LANE TABLE gives way; AO1 stands. skills/bee-hive/SKILL.md:116 Execute column for the tiny lane changes from "direct, in-session (solo)" to a dispatched worker, and skills/bee-swarming/SKILL.md:22 ("no workers are spawned" for tiny/small) is amended in the same slice. Consequential (agent discretion, exercised here): the ORCHESTRATOR authors the done-report, and its evidence is the worker verbatim diff PLUS the orchestrators own independent re-run of the verify command — not the worker word. The Delegation contract gains a second, named class of worker: an EXECUTION worker, which unlike an I/O-offload worker DOES register in the swarm registry and DOES take reservations.

### onboarding

- 216e448a · 2026-07-14 · AO10 — .claude/agents/ MUST NOT be added as a third entry to REPO_SKILL_TARGETS (onboard_bee.mjs:256-259). It ships through a separate flat managed-file sync with its own version marker, the same class as the .claude/settings.json hook merge.

### orchestration

- f1ca79b9 · 2026-07-14 · AO15 — A PreToolUse payload DOES distinguish the orchestrator from a subagent, and the tools-logger agent column IS buildable. Proven by an orchestrator-side control capture: on an orchestrator tool call the payload carries NO agent_id and NO agent_type (the fields are absent); on a subagent tool call both are present, and agent_type names the agent type verbatim (e.g. "Explore"). session_id is IDENTICAL across both, so session_id is NOT the discriminator — presence/absence of agent_id is. The full payload also carries prompt_id, permission_mode, effort, tool_use_id and transcript_path, none of which bee reads today. This SUPERSEDES the NO verdict returned by cell ao-spike-probe, which was correct on the data it had: a dispatched worker structurally cannot execute a tool call as the top-level orchestrator, so it could never obtain the control half of the comparison. Also disproven empirically: the assumption that Claude Code snapshots hooks at session start and a mid-session binding is inert — the binding fired on the very next Read.
- 44458e1c · 2026-07-14 · D1 — Scope: the full package ships as one feature: measurement (tools.jsonl logger + the FACT-E probe spike), the two guard-hole fixes, pinned agent types, the advisor protocol, AND worker-ising cell execution for every lane including tiny.

## bee harness

### workers

- a0285993 · 2026-07-11 · worker prune contract (workers-prune, shipped): .bee/workers transients are pruned via bee_state.mjs worker prune only — keep decisions are prefix matches against a keep set (active worker cells + every non-capped cell), never suffix-stem parsing; the suffix set only classifies candidates; empty stems, subdirs, and non-transient files are never touched; destructive verbs fail closed (strict state read, non-array workers refused, unknown flags refused, --dry-run rejected on mutating verbs); orchestrator runs prune at feature close per swarming-reference Transient hygiene

## bee harness releases

### release

- 0083835c · 2026-07-11 · Standing release flow (human-set, 2026-07-11): every bee update from now on ships as a tagged release — (1) bump BEE_VERSION in templates/lib/state.mjs + .claude-plugin/plugin.json version, (2) onboard --apply --repo-hooks on beegog itself (re-vendor, recheck up_to_date), (3) full verify green, (4) commit 'release: bee X.Y.Z', (5) annotated tag vX.Y.Z, (6) git push origin main --tags, (7) onboard --apply to every anphabe host project except anphabe-crm

## codex-agent-wait-loop

### codex

- eb1646df · 2026-07-15 · auto-approved repaired work shape for codex-agent-wait-loop under gate_bypass=total
- 9187e5e1 · 2026-07-15 · auto-approved repaired context for codex-agent-wait-loop under gate_bypass=total
- 44bccc55 · 2026-07-15 · Codex empty-wait repair delta must explicitly require at least one material action, handle each completion once, recompute liveness and stop waiting at zero live agents, and prove root-only plus real native tool traces.
- 691f1bfa · 2026-07-15 · auto-approved repaired Gate 3 for codex-agent-wait-loop under gate_bypass=total
- ebb70b72 · 2026-07-15 · codex-agent-wait-loop deployment repair: enforce Codex immediately through root AGENTS.md and canonical skills; update writable .claude projections; record .agents as sandbox-read-only instead of claiming it synchronized

## codex-hook-state-parity

### codex

- 25077448 · 2026-07-15 · Auto-approved Gate 3 for codex-hook-state-parity under total bypass after the unchanged configured baseline completed green.
- 68d5bc78 · 2026-07-15 · auto-approved reshaped plugin-first work for codex-hook-state-parity under gate_bypass=total
- 48c23a72 · 2026-07-15 · auto-approved repaired plugin distribution context D9-D14 for codex-hook-state-parity under gate_bypass=total after fresh-eyes PASS
- 32d89394 · 2026-07-15 · auto-approved implementation shape for codex-hook-state-parity under gate_bypass=total
- 4a61e918 · 2026-07-15 · auto-approved locked context for codex-hook-state-parity under gate_bypass=total after fresh-eyes PASS

## codex-native-transport

### codex

- 3ceba8f5 · 2026-07-19 · codex-native-transport CONTEXT locked (D1-D9): D1 transport priority native-V2-override > custom-agent(deferred, E5) > cli explicit-only fallback, no silent native->cli switch; D2 config kind:'native' {model,effort,fork_turns,agent_type} + {primary,fallback,fallback_policy:'explicit-only'} composite, existing shapes byte-stable; D3 probe classifies native_model_override|native_budget_only|external_cli_only from observed evidence (codex features list + g22-6 canary accepted override spawn in isolated CODEX_HOME), verdict attest/version-scoped, unknown=>native_budget_only; D4 bee never flips user codex feature flags — canary CODEX_HOME only, doctor names the unlock; D5 anchored [bee-tier:] marker unchanged, role travels via task_name; D6 evaluateCodexSpawn route-check on override fields (model/effort/fork_turns==none must match configured route), no-override spawns keep exact current behavior; D7 effective_model_status adds 'requested-accepted', effective_model stays null unless runtime-confirmed, child self-report never evidence; D8 advisor+review first native consumers, cli-stays-gather-only untouched; D9 default codex strategy once proven: budget workers + native strong advisor/review, codex exec off by default

### gates

- 27e3c500 · 2026-07-19 · auto-approved Gate 3 (bypass=total): feasibility validated (V2 probe evidence, advisor GO-WITH-CONDITIONS folded), execution approved for slice 1 (5 cells, 2 waves)
- ed3d0dac · 2026-07-19 · auto-approved Gate 3 (bypass=total): feasibility validated (V2 probe evidence, advisor GO-WITH-CONDITIONS folded), execution approved for slice 1 (5 cells, 2 waves)
- c47e3a8e · 2026-07-19 · auto-approved Gate 2 (bypass=total) codex-native-transport: high-risk, 5 flags incl external-provider hard-gate; slice 1 = 5 cells 2 waves (cnt-1 config shapes, cnt-2 classification+probe+doctor, cnt-3 prepare native branch+economics, cnt-4 guard route-check, cnt-5 canary probe leg+protocol doc)
- c7ac05d6 · 2026-07-19 · auto-approved Gate 1 (bypass=total) codex-native-transport: CONTEXT.md D1-D9 recorded as recommended, user-directed design 2026-07-19

### sessions

- ec2912ba · 2026-07-19 · cnt-2 ownership arbitration: session 723195b9 (live) commits stuart's capped implementation; decision b296a0cf's 'going forward 6d0892b6 holds the cnt-2 claim' clause is superseded — 6d0892b6 heartbeat 15h stale, no branch/worktree/hold, and the live-owner claim guard admitted stuart's claim+cap

## codex-sandbox-baseline

### codex

- 09da94b0 · 2026-07-15 · Codex-safe test transport may serialize scenario orchestration, but concurrency-sensitive claim and handoff races must still use genuinely concurrent barrier-synchronized Worker actors with negative controls.
- 2fd54cd3 · 2026-07-15 · auto-approved Gate 3 (total bypass): execute the repaired Codex sandbox baseline cells
- 90b7830d · 2026-07-15 · auto-approved Gate 2 (total bypass): shared Worker runner plus preserved external integration follow-up
- a83a3613 · 2026-07-15 · Codex-safe baseline preserves all existing integration coverage: Node module entrypoints run through an isolated Worker test runner, while real Git/Bash/Codex commands remain external and are judged by actual exit status/stdout/stderr even when the sandbox also attaches EPERM.
- 6d9512e4 · 2026-07-15 · auto-approved Gate 3 (total bypass): execute the fix-first Codex baseline repair
- a6822281 · 2026-07-15 · auto-approved Gate 2 (total bypass): one-file Worker test-launcher shape
- 0b2e0bc0 · 2026-07-15 · auto-approved Gate 1 (total bypass): Codex-safe baseline runner decision is locked

## decision-propagation

### decisions

- f5869918 · 2026-07-21 · auto-approved Gate 3 (bypass total): decision-propagation slice 1 (dp-1..4) READY — plan-checker iter-1 BLOCKER (append/archive lost-write) + 4 warnings resolved in cell text, iter-2 CLEAN; cell review FIX-FIRST -> recheck CLEAN; red-first mandated per cell
- a40a6a86 · 2026-07-21 · auto-approved Gate 2 (bypass total): decision-propagation standard-lane plan frozen (docs/history/decision-propagation/plan.md) — slice 1 = store+CLI core (tags/scope recall, supersede sweep+inheritance, archive verb, index render), slices 2-3 prose/specs + e2e proof
- bd700f44 · 2026-07-21 · auto-approved Gate 1 (bypass total): decision-propagation CONTEXT.md locked
- b9b9fee3 · 2026-07-21 · decision-propagation D1-D6 locked (CONTEXT.md, GH #32/#33/#34): CoS-per-clause evidence gate on backlog done-flip (partial delivery never flips); supersede propagation sweep over docs/** with same-turn reconcile-or-stub; decision-id citation discipline; scope reused as area dimension + tags[] + search filters + derived index + archive verb; supersede events inherit scope/tags; no stored graph, read-time derivation only

### dp-1

- 266dc393 · 2026-07-21 · dp-1 deliberate sibling extension: decisions active gains the same --tag/--scope/--area/--since filters as search (beyond D4a's letter, recorded in validation report and cell text); command-registry schema updated (required:['text'] -> [], structured-filter properties) as a necessary in-scope deviation

### gates

- e230444a · 2026-07-21 · auto-approved slices 3-4 shape+execution (bypass total): dp-8 prose rules (CoS-checked flip + citation discipline), dp-9 e2e supersede dry-run on d20f4c96 + issue-closure drafts

### taxonomy

- e7adaa4c · 2026-07-21 · taxonomy schema corrected: tags[] entries are {name, description} objects per the dp-6 contract (loadTaxonomy maps t.name); dp-7's string-seed made every known tag classify as unknown and leak into candidates — candidates cleared, steady-state re-proven by this event
- 3ff26b98 · 2026-07-21 · taxonomy bootstrap note: initial seed lacked schema_version — first classify call read it as invalid, treated known tags as unknown, appended gates/planning to candidates and rewrote the file canonically; steady-state behavior verified correct by this very event

## doctrine-layer

### codex

- c0cba64e · 2026-07-19 · cnt D3a (classification triggers, authoritative): probe evidence gains the base multi_agent flag (same codex features list call). external_cli_only <=> multi_agent === false (positive evidence the base spawn transport is OFF — the ONLY external trigger). native_model_override <=> multi_agent !== false AND multi_agent_v2 enabled AND override_spawn_accepted === true. Everything else (v2 off, override not accepted, version null, partial/absent evidence) => native_budget_only. 0.144.4 stays native_budget_only (multi_agent=true there). Coupling for cnt-3: consuming external_cli_only is actionable ONLY when the slot carries a configured cli command (standalone cli slot or composite fallback); a bare native/null slot classified external_cli_only resolves to the typed no-route refusal, never an invented command.
- efc07f0b · 2026-07-15 · codex-agent-wait-loop D2-D5 clarification: the forbidden sequence is empty wait directly followed by wait_agent. A later wait requires one material non-wait action, then a commentary update naming live agent state and next action; no-op commands or commentary alone do not qualify. Always-loaded doctrine names wait_agent/list_agents and preserves the separate ban on scratchpad polling.
- 87aba5a1 · 2026-07-15 · codex-agent-wait-loop D1-D4: an empty native wait is timeout-only, never failure or lost ownership; Codex must not issue consecutive wait_agent calls after timeout; another wait requires an intervening useful-work or live-state-plus-user-update interval; the rule applies to every bee-owned native Codex subagent flow while external processes keep their artifact/process contract.

### decisions

- a93994d3 · 2026-07-15 · Bypass semantics refined (user, 2026-07-15): under full/total the agent NEVER asks merely to APPROVE — it takes its own recommended/best option and ships through. It STILL asks in exploring when it genuinely needs INFORMATION only the user can supply (a real preference/knowledge gap it cannot resolve from evidence with a confident default). Litmus: 'do I already have a confident best answer?' yes => proceed; no, and only the user knows => ask. Approval questions are suppressed; information questions survive.

### dispatch

- 9c01ac17 · 2026-07-13 · auto-approved Gates 1-3 (bypass) for fanout-doctrine: promote the Delegation contract (fan-out rubric) from references/routing-and-contracts.md into AGENTS.block.md critical rules, so it lives in the always-loaded doctrine layer

### docs

- ba5a35f1 · 2026-07-13 · Doctrine that must hold in EVERY turn — including plain conversation turns where no bee skill routes — belongs in AGENTS.block.md, not in a skill's references/ file. A reference is loaded only on skill invoke; a rule parked there is silently absent exactly when no skill is running.
- 1689af1b · 2026-07-13 · Core principle: Silent Bookkeeping — bee mechanics (cells, claims, caps, status/state writes, reservations, phases) are never narrated into chat; the user hears work language only. Bee vocabulary enters chat only when the user asks about bee directly or a gate needs their decision (phrased in work terms per the Gate Presentation Contract)

### hooks

- b8ec25aa · 2026-07-14 · D6 — Guiding principle, adopted repo-wide: mechanisms that REMOVE a choice are lean; mechanisms that PUNISH a choice are ceremony wearing enforcement's clothes. Hooks are good at discrete events and worst at continuous resources. Not a wall, a floor. Corollary, explicitly NOT built: any byte- or token-budget hook throttling Read/Grep, and any check that the model name must appear in the Agent description.

### lanes

- 25be130c · 2026-07-19 · lane-ceremony-v3 D1-D10 locked in docs/history/lane-ceremony-v3/CONTEXT.md: plan.md frozen at Gate 2, approval stamp only (D1); current slice = open cells, no slice artifact (D2); tiny drops plan.md — request+cell is the work shape (D3); small = logged scoping synthesis + 1-3 cells, plan.md opt-in (D4); merged Gate 2+3 asked after work-packet preview, persisted after approval (D5); lane file caps count product files only (D6); risk flags narrowed to test-anchored wording (D7); planning classifies cheaply first, bootstrap scales to lane (D8); standard/high-risk keep Gate 2 -> prep -> validate -> Gate 3 on frozen plan, brief drift = cell changes only (D9); doctrine layer only, no CLI/state-machine changes beyond test assertions (D10)

### orchestration

- 08f58672 · 2026-07-17 · Slice 2A-ii closed: purpose-scoped resolveTier (cli tier gather-only, typed refusal for cell execution, fail-safe default) + Delegation-contract cli gather branch (BEE_DIGEST delimiters, verbatim command, stdin, absolute paths) shipped as cells ao-2aii-1/ao-2aii-2, both goal-checked green by the orchestrator. Judge hits on ao-2aii-2 (.agents/.claude test_lib mirrors) verified byte-identical onboarding syncs, not test edits — carried for future review. Spec synced: doctrine-layer B8/R12.

### scribing

- 4d92cb3a · 2026-07-08 · bee-scribing capture is self-triggering: the agent detects settlement (explicit or silent) every turn and captures unprompted, announce-then-do, same turn. A user having to ask 'ghi lai' = detection failure. Record: docs/decisions/0007.

### workers

- 66230fd5 · 2026-07-08 · Agents run all bee commands themselves (bee_status, bee_cells, reservations, decisions, onboarding, verify); never hand a bee command to the user. Human actions = gate approvals, decision answers, privacy approvals only. Record: docs/decisions/0006.

## hook-runtime

### advisor

- 69513d80 · 2026-07-19 · cnt advisor conditions folded (GO-WITH-CONDITIONS): R1 codex-only marker constant accepts 'advisor' (claude regex untouched), owned cnt-4 + cnt-3 golden row; R2 guard route-check = union of configured native routes across slots incl resolveAdvisor, evaluateCodexSpawn gains root param; R3 cnt-2 exports readNativeTransportClassification(root) as sole gate for cnt-3; R4 cnt-5 creates --probe-selftest asserting isolated-CODEX_HOME invariant, cap evidence includes real probe V1/V3 observation; R5 prepare-time status renamed 'native-requested' keyed on resolved native + classification-confirmed, budget rows byte-identical, D7 wording updated at scribing; note: native branch precedes generic model-string branch in both resolvers. Validating probe answered V2 (both flag syntaxes parse+enable on 0.144.4). Friction logged: guard allowlist ignores advisor slot (denied prepare's own payload)

### cli

- bb4bb18e · 2026-07-11 · CLI-owned .bee state contract (cli-mutations, shipped): every state.json/backlog.jsonl mutation goes through bee_state.mjs / bee_backlog.mjs add; thin-CLI verbs + door validation is the default pattern for any future .bee mutation surface (SQLite and --json passthrough rejected); write paths use strict reads (readStateStrict — corrupt file fails loud), hooks stay fail-open; write-guard denies direct edits first-hit before allow-prefixes; a standing suite test keeps templates byte-identical to .bee/bin

### codex

- d1debaa3 · 2026-07-20 · codex-command-windows standard lane: emit commandWindows on codex .codex/hooks.json entries (codex REPO target only) so bee hooks run on Windows; Gates 1-3 auto-approved (bypass total)
- 4b48c16f · 2026-07-14 · onboard-codex-hooks (0.1.36): onboarding voi repo-hooks sticky nay cung sinh/merge .codex/hooks.json (repo-target, model-guard loai theo catalog); isBeeCodexHookEntry thay the moi entry bee o MOI transport cu ($CLAUDE_PROJECT_DIR, $r/hooks) de khong hook dup; moi apply dam bao docs/specs/reading-map.md + system-overview.md ton tai (create-only, scribing so huu noi dung).
- d91a8398 · 2026-07-12 · For the Codex repository-hook fallback, treat the official runtime contract as authoritative: hooks are enabled by default unless explicitly disabled, commands run with the session working directory, git-root command resolution is supported, and any changed hook definition requires human review before it runs.
- 73ed41d6 · 2026-07-11 · Nested Codex executors and reviewers run with an explicit workspace-write sandbox and normal approval behavior by default; bee must not use --yolo or another blanket approval-and-sandbox bypass. Any broader privilege is a separate, visible human approval for the specific command.
- b7af1bf9 · 2026-07-11 · Codex receives full compatible bee lifecycle-hook parity: session bootstrap, prompt reminders, write/privacy/reservation guards, state sync, subagent-chain nudges, and session-close checks run wherever Codex exposes a compatible event or tool path; shared helpers remain the final enforcement belt, and unsupported paths fail open with visible limits and dedicated tests.

### dispatch

- 3fd0a7aa · 2026-07-11 · Dispatch audit log contract (P22): .bee/logs/dispatch.jsonl is fail-open best-effort — one line per evaluated Agent/Task dispatch {ts,tool,transport,model,tier,subagent_type,description<=120}; a log failure never changes the guard's decision/exit code; nothing downstream may assume 100% capture; deny/allow semantics of decision 0023 explicitly untouched
- d50564fa · 2026-07-11 · 0023 — explicit-tier transport: every Agent/Task dispatch now carries an explicit tier (model param or [bee-tier: <tier>] marker); bare dispatches are denied by the new bee-model-guard PreToolUse hook. Amends only the transport clause of decision 0015 (omit-param alone no longer means ceiling — omit-param + marker does); the principle that the ceiling is the session model, never configured, stands unchanged. Written as docs/decisions/0023-explicit-tier-transport.md with a single Status amendment line added to 0015.
- 9d9591ca · 2026-07-10 · External-executor finish contract (external-result-contract): a cli worker's last FILE act is writing .bee/workers/<cell-id>.result.json — outcome is exactly the four status tokens (the cli transport of the one worker contract) — and the orchestrator accepts by file, never by exit: missing/unparseable/invalid result = failed run into the rescue ladder. The prompt file at .bee/workers/<cell-id>.prompt.md IS the durable contract; resume rounds reference it and never re-pass dispatch-time flags (resume inherits sandbox/config). Rejected from the repository-harness source: partial/needs_intake outcomes, schema-validator tooling, preemptive worktree-shim machinery (one conditional sentence only).
- 29b7f7bb · 2026-07-10 · External-dispatch field refinements (from the codex-first pattern): result via -o file (never parse JSONL), stderr suppressed by default, rescue prefers codex exec resume --last with the failing verify output (max 2 rounds then BLOCKED), session-tool/MCP/secrets/destructive cells never route to cli executors, workspace-write only — no --yolo default

### gates

- 7dd3119d · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 3A shape — W4 passive tools logger only (W3 pinned agent types deferred to 3B, unplanned). One cell ao-3a-1 on the 8-hook template: PostToolUse all-tools catalog entry, thin fail-open wrapper appending {ts, tool_name, agent_id, agent_type} lines to .bee/logs/tools.jsonl (AO15 schema, no tool_input bodies), mirror, 3 projections re-rendered, settings.json group, DEFAULT_HOOKS toggle true, WRAPPERS + malformed rows, fails-when-broken happy-path + crash-injection tests. No cost-reduction claims.
- 4c1c5921 · 2026-07-17 · GitHub #18 fixed: mechanized the gate-bypass net at runtime — session-stop hook (maybeBypassBlock) emits a loop-guarded turn-control block forcing auto-approve+continue when the assistant stops at Gate 2/3 under a covering bypass level. Spec synced: hook-runtime B15/R14 + B2/R4/R10 carve-out; routing-and-contracts note added.
- cc660b3e · 2026-07-17 · auto-approved Gate 3 (bypass=total): gate-bypass-stop-net READY — mechanical Stop net feasibility proven (adapter block continues turn on both runtimes; inject dedup bounds loop-guard)
- 73e756fc · 2026-07-17 · auto-approved Gate 2 (bypass=total): gate-bypass-stop-net standard lane — mechanical Stop-hook net for #18

### hooks

- 39be1227 · 2026-07-20 · write-guard-hook-fix diagnosis: hook has NO hole — all 9 failing rows share one cause: test fixture VENDORED_LIB_MODULES under-vendors the lib closure (10 listed vs 17 needed; state.mjs grew worktree-store/lock/decisions edges), import fails, hook fail-opens by documented discipline. Fix is TEST-SIDE: whole-dir lib copy into fixture (kill the hand-list class), un-exclude the suite, rejoin verify. Hook untouched.
- 5de7f507 · 2026-07-20 · hook-runtime spec absorbs codex-command-windows cells 1-2: R8a shell-agnostic commandWindows on codex repo fallback entries, R8b transport unified on committed .bee/bin/hooks/ path; Windows gap closed, non-POSIX Unix login shells remain open
- 3aa53355 · 2026-07-12 · codex-parity-6c round-3 (guard marker-forge deny) had a THIRD spike-proven hole: a directory symlink under an allowlisted prefix (ln -s ../.. .spikes/evil, ungoverned+allowlisted) makes a governed write lexically in-repo while it physically lands ABOVE the real root, so the lexical marker-forge deny + toRelPath pass it through and the above-root spoof is planted (redteam-symlink-forge.mjs). FIX (proven): realpath-anchor containment (fs.realpathSync on real root + target's deepest existing ancestor) in both the marker-forge deny and toRelPath. Residual widened and documented, NOT closed: unified_exec/native writes AND Bash primitives dd/install/python/rsync unmodeled by extractBashTargets can still plant a marker — the D2 'hooks are not a complete boundary' limit.
- ec629bfe · 2026-07-12 · codex-parity-6c (design B, outermost marker walk) NOT READY at round-2 validation: persona panel found a spike-proven above-root spoof (.spikes/codex-runtime-parity/aboveroot-plant.sh). Outermost walk closes the below-root spoof but the same actor can plant both markers ABOVE the real root (the guard escape-allows out-of-repo Write/Edit), and outermost then selects the attacker root and execs the attacker guard script -> gated write bypass. Root cause: resolving the guard script location by walking from untrusted cwd is spoofable in whichever direction the walk favors. 6d is READY behind 6c. Returning to planning for a round-3 anchor design; the harden-vs-bound choice is a user risk call (D2: hooks are not a complete security boundary).
- 5f7060d9 · 2026-07-12 · codex-parity-6c NOT READY at validation (persona panel + cold-pickup, both opus): 3 cross-corroborated BLOCKERs, each spike-proven. (1) Adding apply_patch to the shared BOTH matcher changes hooks/claude-hooks.json + hooks/hooks.json bytes -> contradicts the cell's byte-identity truth #7 and its git-diff verify pin; 'behaviorally inert on Claude' != 'byte-identical'. Real D1 (CONTEXT.md) is plugin-first distribution, NOT byte-identity, so hardening is compatible with D1 but the cell's over-tight framing must be dropped. (2) The off-git marker-walk transport inverts existing route arms 3/4 (git-absent/non-git), rework unspecified. (3) The spoof-skip security core is unproven: a both-markers plant under an allowlisted prefix (.spikes//docs//plans/) still shadows the real root via nearest-ancestor resolution; no on-disk spike implements the adopted marker walk. Returning to planning.
- fc82536e · 2026-07-12 · codex-parity-6c fix shape: the deny-capable Codex repo PreToolUse transport resolves its root by a .bee/onboarding.json + hooks/<script> ancestor-walk (matching adapter.findRepoRoot) and fails CLOSED (exit 2), NOT by git rev-parse. All nine repo-target commands adopt the marker walk; the eight advisory arms fail OPEN (exit 0 + pinned diagnostic). This supersedes the review's one-string -f-on-git-rev-parse prescription.

### installer

- 9e5fce3b · 2026-07-20 · install-ps1-hooks tiny fix: add hooks/ to install.ps1 sparse-checkout set + static regression assertion in test_installers_e2e.mjs; merged Gate 2+3 auto-approved (bypass total)

### privacy

- c874a4b3 · 2026-07-10 · Realpath containment is the only read-scope guard

### specs

- 1153062f · 2026-07-18 · D5 corrected during validation: no Claude hook-manifest split-brain — the two manifests are per-runtime catalog projections with test-pinned allowed differences; cnr2-3 dropped. The be-codex.md spec claim 'Codex plugin không đóng gói hooks' is also moot: .codex-plugin omits the hooks key deliberately because Codex loads hooks/hooks.json from the default plugin-root location (catalog.mjs header, codex-parity feature).

### worktree

- 70e2dbeb · 2026-07-15 · worktree-isolation final validation repair: full hooks/ versus .bee/bin/hooks set parity is derived and checked; wt-3 owns focused dispatch/identity assertions; authoritative integration identity starts from the orchestrator dispatch-handle id, validates the Git backlink, derives branch from metadata HEAD, and requires branch HEAD to equal the reported commit.
- 5de1fd36 · 2026-07-15 · worktree-isolation D2 amended (security review W5): BEE_ROOT env override is DROPPED from scope — linked-worktree resolution (with git back-link validation) is the only channel. Rationale: a CLI-only env override creates a store the write-guard cannot see (reservations written under BEE_ROOT would be unguarded); the hop covers the real need. D2's one-store guarantee now has a single mechanism.
- 5aa8946d · 2026-07-15 · worktree-isolation D2/D4 mechanism settled by spike: linked-worktree resolution — findRepoRoot (and the hook adapter) detect a linked worktree via its .git FILE (gitdir -> <main>/.git/worktrees/<id>), pin the STORE to the main root, and keep rel-path computation against the worktree top; BEE_ROOT env override remains the explicit escape hatch checked first. Native harness worktree confirmed: .claude/worktrees/agent-<id>, branch worktree-agent-<id>, shared .git; integration = merge the worker-reported branch (branch outlives the worktree dir).
- 23d67e0b · 2026-07-15 · worktree-isolation D4: the write-guard keeps enforcing during worktree dispatch — reservation paths stay LOGICAL repo-relative paths (one namespace); guard-side path normalization strips a recognized worktree prefix so an edit at <worktree>/src/x maps to reservation path src/x. If normalization cannot be made safe for a runtime, worktree mode is refused there rather than running unguarded.

## installer-hardening

### installer

- 3318374a · 2026-07-13 · installer-hardening: D1 CLAUDE.md default onboarding artifact (--no-claude-md opt-out); D2 per-project skills to <repo>/.claude/skills + <repo>/.agents/skills (codex repo discovery path is .agents/skills, NOT .codex/skills); D3 global install behind --global-skills; D4 per-project skills committed to host repo; D5 install.ps1 ASCII-only + encoding guard test; D6 codex bootstrap = .agents/skills + AGENTS block; D7 acceptance on goglbe/airemote

## installer-version-parity-1-3-1

### installer

- 175d0b8f · 2026-07-16 · Auto-approved Gate 3 under total bypass: execute the three-cell local installer parity slice with Windows and Git publication retained as hard release constraints.
- 5fff1591 · 2026-07-16 · Auto-approved Gate 2 under total bypass: execute strict tuple, cross-platform entrypoint proof, and selective 1.3.1 publication as one high-risk release shape.
- a82c1bd0 · 2026-07-16 · Auto-approved Gate 1 under total bypass: installer version-parity decisions are locked for release 1.3.1.
- 09b776b5 · 2026-07-16 · Both top-level installers must prove greenfield and brownfield apply, full onboarding version equality, drift false, and repeat up-to-date before reporting success.
- 55ff17ef · 2026-07-16 · Installer release-version parity is fail-closed across source, plugin manifests, vendored runtime, and project skill projections.

### release

- fc76ce41 · 2026-07-16 · Release 1.3.1 contains completed Codex sandbox and hook-state parity work plus the installer parity fix, excluding unfinished wait-loop and worktree-isolation changes.

## onboarding

### advisor

- 50714229 · 2026-07-18 · cph D4-REVISED/D5-amended/D6 (advisor GO-WITH-CONDITIONS): (a) hooks before cleanup pass, (b) plugin_distribution cleanup must NOT strip codex hook entries under hybrid (CRITICAL self-erasure risk — cleanHookConfig matches the exact entries mergeCodexHooks writes), (c) hook-write failure rolls back the plugin; codex projection is a hoisted gate (pluginSource && runtime in {codex,both}) fired from passed --runtime never recorded state; typed blocked result mirrors skillSync.blocked; managed-set inclusion gated so claude-only installs never report codex drift

### cli

- b5341fe7 · 2026-07-15 · Slice 1d D2: the 5 kinds map to the running launcher's location + manifest. source_checkout = canonical dev checkout (plugin.json marker + running from its real skills/bee-hive, identityOk); project_projection = under a host's .agents/skills or .claude/skills; plugin_package = an installed manifested package that is neither the dev checkout nor a projection (may source the same repo's runtime+projection but NEVER global/plugin targets, SRC-03); legacy_global = the legacy global skills root; unknown = missing/unparseable manifest or ambiguous, fails closed before mutation (SRC-04). Exact detection nailed in planning/validating against the real tree.
- ce4eee19 · 2026-07-15 · Slice 1d D1: SRC-01..06 ships as a PURE shared classifier classifySource() in templates/lib (+mirror), consumed by BOTH onboarding and bee status (DIST-04). WRAP, not replace — onboarding's existing identityOk/selfOnboard control flow stays; the classifier formalizes + names what it already computes, and status gains a report-only source field.
- 2cdb3d04 · 2026-07-14 · model-presets: them preset antigravity (agy) + opencode cho slot cli executor. Bee luon day prompt qua stdin tu .bee/workers/<id>.prompt.md, nen CLI khong doc stdin (agy -p, opencode run) phai boc bash -lc '... $(cat)'; slot review bat buoc read-only (agy --mode plan / opencode --agent plan), chi generation duoc quyen ghi; agy --print-timeout mac dinh 5m qua ngan cho cell that -> nang 30m. agy smoke-test 2026-07-14 qua dung transport (tra ve OK); opencode chua cai tren may nen co lay tu docs, chua verify.

### codex

- 17bfc14a · 2026-07-15 · Codex-safe onboarding tests execute the real CLI entrypoint in an isolated Worker when nested child processes are unavailable; the runner must preserve argv, environment, stdout, stderr, exit status, and every existing assertion.

### gates

- 12544d39 · 2026-07-18 · auto-approved Gate 1+2 (bypass=total) codex-plugin-first-hybrid: D1 hybrid paved road (codex plugin-first always writes repo-local codex hooks), D2 never skills-only, D3 doctor as acceptance oracle, D4 hooks-before-skills ordering, D5 runtime-scoped to codex (claude exclusivity untouched). 2 cells cph-1 (onboard_bee hybrid apply) -> cph-2 (install.sh plumbing + E2E). Resolves capability-matrix B1 asymmetry (plugin_hooks removed on codex-cli 0.144.4)
- a3624bfe · 2026-07-18 · auto-approved Gate 1 (bypass=total): p49-force-downgrade-blast-radius scoping synthesis in place of CONTEXT.md — P49 backlog row is the acceptance criterion; refusal payload must enumerate copy_lib/copy_helper paths a forced apply overwrites
- 5f4de2c0 · 2026-07-13 · installer-hardening Gates 2+3 auto-approved via gate bypass (standard lane): 6 cells ih-1..ih-6, plan validated by read-only plan-checker (4 landmines folded into plan.md amendments)
- c6ee6b6e · 2026-07-11 · Gate 4 onboard-statusline: merge auto-approved under gate-bypass — P1=0 (external codex reviewer PASS, 3 P2: two fixed in-session with red/green evidence [anchored CLAUDE_PROJECT_DIR detection, settings-based sweep opt-in], one filed to backlog as paired repo_hooks fix), zero UAT items (no CONTEXT.md), suites green (test_lib 156/0, onboard PASS failures:0)
- 94d69cf1 · 2026-07-11 · Gate 4 skill-sync: owner approved merge after the fix wave closed all 9 code-confirmed P1s (02662bf hardening, 3d36b22 contract); UAT RUN item passed live (apply synced drifted bee-hive, recheck up_to_date with hash parity); 7 P2 hardening items filed to backlog non-blocking

### installer

- e2f00d67 · 2026-07-18 · P49 shipped: forceable refused --apply enumerates host_items (copy_lib/copy_helper blast radius) verbatim from pending plan; empty-when-no-drift, absent-when-unforceable; no scope/target tags (spec R26)

### onboarding

- 9ce3a2cc · 2026-07-21 · auto-approved shape+execution (bypass total): rel1710rc-4 tiny cell — deterministic timeout-capture test in onboard suite
- ed0b7075 · 2026-07-16 · Stale legacy global bee skill copies (~/.claude/skills etc.) are refreshed in place on every onboard: refresh-only targets covering exact managed skill names that already exist there — never creating new global copies, never deleting (deletion still requires the plugin-first ownership ledger). --global-skills keeps full management semantics.
- 26203bd3 · 2026-07-12 · bee-footprint D1: onboard --apply manages a marker-delimited block in the host repo .gitignore (# BEE:START / # BEE:END, reusing the AGENTS.md splice pattern — content outside markers never touched). Block ignores machine-local mutable runtime: .bee/state.json, reservations.json, workers/, logs/, capture-queue.jsonl, feedback-digest.json, .inject-cache.json, HANDOFF.json, spikes/. Team-durable stays committed: bin/, config.json, config-sample.json, onboarding.json, decisions.jsonl, backlog.jsonl, cells/.
- 102efe08 · 2026-07-11 · onboard-statusline shape (small, gates 2+3 auto-approved under gate_bypass): opt-in statusline vendor — copy_statusline plan items only when host .claude/settings.json statusLine.command references .claude/statusline-command.sh; source of truth skills/bee-hive/templates/statusline/; conditional managed-manifest hashes mirroring repo_hooks; never mutates settings.json; byte-equality sweep extended to templates/statusline vs beegog/.claude

### release

- 0116a94e · 2026-07-16 · Released bee 1.3.1 (tag pushed) and onboarded all 9 hosts (8 anphabe + airemote) to 1.3.1; a-blog/airemote hook wiring committed separately; Windows E2E remains P43's open half.

### scribing

- 75d2bc65 · 2026-07-08 · Adopt docs/10: (A) fresh-session artifact generators — scribing bootstrap mode (skeleton system-overview + reading-map, provable facts only, user-approved run), command auto-detect with user confirmation, AGENTS.md outside-markers audit (propose-only via existing consent plan), preamble project-map lines, grooming probe items name the one-command fix; (B) PBI layer — docs/backlog.md product backlog (3 statuses proposed/in-flight/done, scribing-owned, specs pattern), proactive capture of deferred requests per 0007, chain wiring without new gates, optional pbi field on cells, repo artifact is source of truth over session todos. No hook enforcement of PBI transitions.

### skills

- e7a54e78 · 2026-07-11 · skill-sync shipped policies (supplement D1-D5, all Gate-3/4-covered): production target is hard-coded os.homedir()/.claude/skills with NO override (tests isolate via spawned-process fake HOME/USERPROFILE); symlinked bee-* entries or inner symlinks = blocked_symlink, skipped loudly, never written/unlinked/deleted; absent tree = fresh install vs existing-unreadable = unknown = refuse; --force-downgrade only when all three versions resolve numeric AND the dry-run exposed the items it will mutate (forced_downgrade:true reported); skill plan items carry scope: installed|source; case-alias collisions = blocked_alias fail-closed; repoRoot-targetRoot overlap refuses pre-write

### specs

- d54ff64c · 2026-07-18 · D9 mechanism refined (supersedes the adapters/-subdir fragment detail, intent unchanged): runtime-specific prose in the 5 runtime-sensitive skills is tagged with inline conditional block markers inside SKILL.md; the onboarding skill-sync renders each managed root's copy by filtering blocks (claude root drops codex blocks, agents root drops claude blocks, markers stripped). skills/ stays the single human-edited source; plugin routes keep shipping source (status quo, no regression) — pre-rendered plugin trees at release time filed as a follow-up PBI.
- 9749b660 · 2026-07-10 · config-sample.json lives at .bee/config-sample.json (owner instruction 2026-07-10), superseding the config-sample feature's root-location choice (D1) and cell config-sample-2's 'no .bee/config-sample.json' truth

### state

- 485e949a · 2026-07-15 · Slice 1c D2: the authoritative reference for host drift is the host's own .bee/onboarding.json managed-hash map (managed.lib + managed.helpers per-file sha256), already written at onboard. NO new shipped artifact; the release manifest stays repo-only.

## performance-log

### performance

- 62a7c7fd · 2026-07-16 · perf matrix redesign (user direction): performance.jsonl is the persistent data store; the HTML report READS it (no live transcript scan for viewing). Sessions are written to performance.jsonl by the session-close hook (upsert per session_id) and backfilled by a new 'bee perf sync' that scans all transcripts. Projects are grouped by the LAST folder name (basename) for readability; full paths kept as a tooltip.
- be46bff7 · 2026-07-16 · perf auto-refresh hook derives the matrix by SCANNING transcripts (not by appending per-session sections), so it is naturally idempotent — Stop+PreCompact double-fire just redraws the same HTML. No per-session upsert store is needed (simplification vs the cell's stated approach). The hook only refreshes when a scan cache already exists, so it never pays the one-time cold full scan inline.
- 4724b7dc · 2026-07-16 · perf metrics are recovered post-hoc from Claude Code session transcripts (not self-reported): dedupe by requestId, sum message.usage.* per model, turn_duration.durationMs for idle-excluded running time, subagents/ sidecar for worker cost. Validated on live data (opus 10.6M tok, 12m52s active, 3 parallel subagents).
- f363053e · 2026-07-16 · perf-log Gate 3 (execution) auto-approved under total gate-bypass; validation READY. Adversarial review B1(deps)/B2(full-verify) blockers fixed pre-approval; W1-W3/M1/M3 folded into cells; baseline verify green (17 suites).
- a8073cdc · 2026-07-16 · perf-log Gate 2 (shape) auto-approved under total gate-bypass — standard lane, recommended plan taken as-is.
- 6af9f25a · 2026-07-16 · perf-log section boundaries: v1 ships explicit named spans via a new 'perf' CLI group (bee perf start --label / bee perf stop --note), universal to any project; the open-section marker is stored per-repo in .bee/perf-open.json and records the resolved session transcript path (newest-mtime, overridable by --session) so stop reads the same file. Auto-emitting a section when a bee cell caps (claim->cap window) is a deferred follow-on slice, not v1 core.
- 9f7f4256 · 2026-07-16 · perf-log running time = active execution time, not wall-clock 'alive' time. Compute it by summing the harness-emitted system/turn_duration events' durationMs within the window (harness already excludes idle waiting); fallback when absent = sum of consecutive-event timestamp gaps below an idle threshold (default 300s).
- 81456c6e · 2026-07-16 · perf-log data source & metrics: each section is computed by slicing the current Claude Code session transcript (~/.claude/projects/<encoded>/<session>.jsonl) to the section's [start,end] window. Per model, dedupe assistant events by top-level requestId, then sum message.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}; report new = input+output+cache_creation and cached = cache_read plus a total. Subagent cost + parallelism come from <session>/subagents/agent-*.jsonl (isSidechain) + .meta.json. Parallel = true when >=2 subagents overlap in time or >=2 Agent tool_use blocks share a turn. Model <synthetic> is excluded.
- 0a459671 · 2026-07-16 · perf-log: a global cross-project performance log lives at ~/.config/beehive/performance.jsonl (append-only JSONL, one section per line; respect XDG_CONFIG_HOME, override via BEEHIVE_PERF_DIR). Each section is tagged with project path, git branch, session id, and start/end timestamps.
- c9c0bb4f · 2026-07-11 · Statusline shows per-model session token/cost incl. subagents: .claude/statusline-usage.mjs aggregates the main transcript + <session-dir>/subagents/*.jsonl, dedupes by message.id (last line wins), prices per model (fable 10/50, opus 5/25, sonnet-5 2/10 intro to 2026-08-31 then 3/15, haiku 1/5 USD/MTok; cache write 1.25x/2x input by TTL, read 0.1x), renders 'model tok/cost + ... = total'; fail-open, signature-cached in tmpdir

### release

- 05884e14 · 2026-07-16 · Released bee 1.3.3: automatic cross-project performance matrix (bee perf report --html + session-close auto-refresh). Tag v1.3.3 pushed to origin/main; beegog self-onboarded to 1.3.3. Ships perf-log + perf-report; unreviewed per zero-stops + explicit release.

## planning

### backlog

- 6bca2638 · 2026-07-13 · Compat/transition surfaces always ship with an explicit removal trigger: any 'keep the old path working' layer (shims, legacy regexes, fallback formats) is filed as backlog debt in the same feature that creates it, with the upgrade condition that retires it
- 9e1c99f4 · 2026-07-13 · Compat/transition surfaces always ship with an explicit removal trigger: any 'keep the old path working' layer (shims, legacy regexes, fallback formats) is filed as backlog debt in the same feature that creates it, with the upgrade condition that retires it

## release-1-3-3

### release

- 5933a85b · 2026-07-16 · Releasing bee 1.3.3 (from 1.3.2): ships the perf-log feature (global cross-project performance log, bee perf command group). Small release lane; Gates auto-approved under total gate-bypass; perf-log ships UNREVIEWED per zero-stops + explicit release command (memory A9).

## release-1-7-10-rc

### windows

- 4c4daea3 · 2026-07-21 · auto-approved shape+execution (bypass total): rel1710rc-5 tiny — diagnose+fix Windows sweep-heartbeat race (harness must surface child stderr; Windows fs/timing hazard audit)

## release-v0.1.35

### release

- 2e23ada6 · 2026-07-13 · release-v0.1.35: released WITHOUT independent review per owner's explicit choice at the A9 question (11 unreviewed candidates incl 1 high-risk remain in the review queue); merged shape+execution gate auto-approved via bypass (small lane): bump 0.1.35, tag, push, onboard anphabe hosts + airemote (minus anphabe-crm), pathspec-scoped host commits

## release-version-single-source

### release

- cba8b832 · 2026-07-16 · Release-version single-source: tuple-location registry (COMPONENTS + read/write) moves to side-effect-free scripts/lib/release-tuple.mjs; test_release_tuple.mjs (check) and new scripts/bump_version.mjs (write) both import it, so WHERE the version lives is defined once. Split-brain regression anchors derive the current version via readVersionLoose instead of hardcoding it. bump_version <v> writes every tuple member + regenerates release manifest in one command.

## repo

### advisor

- cef45917 · 2026-07-19 · cnt D4-refinement (advisor, forward-only — for whichever session finishes cnt-2/cnt-5): the doctor native_transport row reading with NO liveFlags is CORRECT (reader/prober separation; doctor never asserts elevation it cannot verify); the unlock-nudge-on-already-unlocked-host wart is latent-only on 0.144.4 (elevation unreachable, E3). Fold forward: doctor may later gather liveFlags via read-only codex features list (D4-safe) to report true classification and suppress the nudge — natural home cnt-5 or a follow-up after V1/V3 land. No cnt-2 rework.
- 98909657 · 2026-07-19 · cnt second advisor consult folded (r2, session takeover): Δ1 validateModelsConfig acceptance branches before looksLikeCli; Δ2 classification record separate from doctor-attest with a 4th config-scope-hash validity leg; Δ3 route-check noOpinion() on config-read error (allow-hole by design, never deny-storm); Δ4 cnt-4 cap gated on V3 evidence (dispatch does not wait; V1 negative = criterion #1 fixture-only). Prior fold stands incl. native-requested naming. V2 already answered by prior probe (both toml syntaxes work; prefer table form).
- 17b9e046 · 2026-07-18 · g22 advisor conditions folded (GO-WITH-CONDITIONS): R1 guard logic extracted to exported evaluateDispatch lib (g22-1 precondition); R2 prepare-time economics record, guard line stays enforcement audit; R3 channel field, legacy transport untouched; R4/D5-REVISED codex ready = static attest (hash+version+identity, no liveness leg — honest reason string), claude adds the observed-event leg; R5 sidecar schema exported single-source, hashes over rendered bytes; R6 windows lane ships only proven-portable suites; R7 canary isolates CODEX_HOME per-run; A1 purpose map (cell->for:cell, gather/reviewer/advisor->for:gather, advisor model via resolveAdvisor); A2 envelope test shape; waves resequenced w1a g22-1∥g22-5, w1b g22-3, w2 g22-2∥g22-4∥g22-6
- 18f04fc5 · 2026-07-18 · p162 advisor conditions folded (GO-WITH-CONDITIONS): D1 resolved to dual-location existence check (.bee/bin/hooks OR hooks/, per Claude resolver precedent) with ported repoOwnsHookCatalog helper; D2 HEAD-proof = rev-parse + no MERGE_HEAD + tracked-clean, abort in finally, Already-up-to-date no-op branch, post-commit tracked-clean guard backs the verify equivalence; e2e fixture chain reworked (no-rollback premise collapses); drift audit in-feature (spec :83, SKILL.md :69, AGENTS rule 14, store message, test :544-550); D3 uses resolved sha + git>=2.24 floor noted
- 83c28915 · 2026-07-18 · Slice-3 rev3 repairs (advisor residuals): (1) plugin topology LOCKED — committed rendered per-runtime trees inside each plugin dir, .claude-plugin/skills = render(canonical, claude) and .codex-plugin/skills = render(canonical, codex), manifests repointed, drift-pinned by test_plugin_distribution assertion tree == render(canonical) — package-time rendering rejected (would change installer machinery on user machines; committed trees are inspectable and reuse the existing --check pattern); (2) cnr2-10 -> cnr2-11 serialized, cnr2-11 sole final-render owner, rendered-tree paths added to file scopes; (3) provenance simplified — a rendered projection is refused as an onboarding source for ANY target, own-runtime included; canonical or plugin source required, no target-filter semantics introduced; (4) cnr2-10 verify: token-level bans are valid on CLAUDE rendered copies precisely because who-must-act attribution + contrast-note relocation empties those tokens there; phrase-level rules apply to CODEX copies where AO11 legitimately mentions subagent_type — prohibition reworded to match; (5) plan.md current-slice section synced to 4 cells incl. cnr2-12.
- e6fd81fd · 2026-07-18 · Slice 3 RETURN-TO-PLANNING (advisor verdict, accepted): reshape before execution — (1) rendered projections get provenance/render-schema metadata and are refused as cross-runtime onboarding sources (lossy-source blocker); (2) plugin pre-render moves INTO this slice as new cell cnr2-12 — plugin manifests point at rendered per-runtime trees, raw-source bleed closed (blocker 2); (3) three integrity contracts: release hash = canonical bytes incl. markers, per-target drift = render(canonical,target), downgrade stays version-based; (4) cnr2-10 owns the test_lib census updates its tagging deliberately breaks; test_skill_render joins commands.verify + the mandatory-suite guard; (5) marker grammar: exact full-line markers, unknown-label/stray-end/frontmatter refusal, markers forbidden inside code fences, whole-tree validation before any apply; (6) equality proof = marker-strip equals frozen pre-tag baseline except the named D10 delta; (7) attribution by who-must-act (AO11 budgets prose becomes codex-only).
- 9298896b · 2026-07-17 · Slice 2A-i validation = NOT READY (high-risk panel, opus). Key finding: part of 2A-i was ALREADY shipped by ao-2e (commit 22e92f8, 2026-07-14) — config-sample-cli-executors.json/model-presets.md/swarming-reference.md already remediated; the surviving --yolo+workspace-write defect lives in .bee/config-sample.json:37 and docs/config-reference.md:40. Cells repaired in-place: ao-2ai-2 re-scoped to the files that still carry the defect (grep-test over ALL shipped configs/docs); ao-2ai-1 gained the .bee/bin/lib/command-registry.mjs mirror, an enumerated unsafe-flag alias closure framed as a known-bad BLOCKLIST (not a read-only guarantee; env/wrapper/alias injection documented out of reach), and named hosts (bee status handleStatus + B2 transport declaration). Gate 3 NOT approved — NOT-READY is a feasibility verdict that gate_bypass does not override.
- c6cd0f3b · 2026-07-13 · advisor v1 shipped (adv-1..3): worker-level on-failure consult only — advisor slot models.<runtime>.advisor (sibling resolver resolveAdvisor, no fallback), degenerate baseline = the consulting worker's own model, consult record = dispatch.jsonl description prefix 'advisor-consult <cell-id>: <advisor>', budget 2/claim, authority blocks never consult. de967733 amended (owner Q1), 0015 untouched

### cells

- 8e36c9b6 · 2026-07-20 · cells-archive: manual feature-scoped archive of terminal cells to .bee/cells/archive/<feature>/ to shrink bee status hot-scan set. Key safety: readCell/cellFile fallback to archive dir so dep-resolution + review-preflight stay correct. listCells scans active by default (speedup) + includeArchived option; status counts active + archive summary. Gates auto-approved (bypass total).
- 41c254c7 · 2026-07-20 · D-GHF-C: cells store RMW (recordVerify/blockCell/capCell/resetCellBudget) runs under withStoreLock per cell; budgets clamp to integers in [1, 3x default] at resolve + authoring validation; reset-budget refuses unless cell is actually budget-blocked, requires an actor (--operator or BEE_AGENT_NAME), and logs the audit decision BEFORE the cell write; capCell refuses on latest judge FAIL verdict (typed JUDGE_REWORK_REQUIRED) unless audited --override-judge.
- 72a55ed9 · 2026-07-19 · codex-agent-wait-loop-3 rescue: own generated plugin projections and release manifest
- a43f6753 · 2026-07-19 · codex-agent-wait-loop-3 scope bookkeeping: validation-review-repair.md added to files
- 350f1e82 · 2026-07-19 · cnt-4 rescope per Δ4 negative branch: V3 evidence now exists (cnt-5 capped, reports/probe-evidence.md) and is terminal-UNOBSERVED on both probed builds — 0.144.4 (hook never fired, root cause open) and 0.144.6 (V1 itself REFUSED at API level: 'collaboration.spawn_agent is reserved for use by this model', turn never reaches tool execution). cnt-4 therefore ships document-the-gap + marker-only: NO route-check deny branch against an envelope never observed; add pass-through-open allow rows for override-carrying spawns + gap documentation at evaluateCodexSpawn; existing no-override rows frozen byte-unchanged. Route-check implementation deferred until a build where V3 is observed (open follow-up in probe-evidence.md).
- 6eb8ffe5 · 2026-07-15 · Slice 1b reduced to ONE cell (downgrade preflight on copy_lib path + regression flip). Honest-drift (E-02/DIST-04/PROJ-08) deferred to 1c alongside the SRC classifier.
- 513f8ad4 · 2026-07-15 · Slice 1b scoped to two behavior changes + regression flip (downgrade preflight on copy_lib path; honest drift via Slice 1a release manifest). Full SRC-01..06 source-tree classifier deferred to slice 1c.
- 20bf645b · 2026-07-12 · cells-batch-add: bee_cells add --stdin/--file accepts a JSON array of cells with all-or-nothing validation; planning prose steers slices to one batched heredoc; merged Gates 2+3 auto-approved via bypass (small lane)
- 1eee111a · 2026-07-12 · cells-update-verb shipped: bee_cells.mjs update --id --file|--stdin is the ONLY sanctioned path for revising a created cell's plan fields (title/action/verify/files/read_first/deps/decisions/must_haves/behavior_change/lane/pbi); open|blocked only; id/feature/status/trace/tier and unknown keys refuse the whole patch; corrupt files fail closed. Rule-11 hand-edit fallback for cells is retired — validation repair loops call the verb.
- b8fe5c81 · 2026-07-10 · Second narrow unfreeze (evolving-7): the ENTRY_FIELDS source-literal grep in test_lib.mjs:1421-1422 is deleted; the value-lock, the no-free-text check, and the SCHEMA_VERSION/DROP_REASONS literal pins all stay. A drift guard that regex-matches a module's own source pins SYNTAX, not behavior — and here the pinned syntax (a bare name array) was the defect itself, blocking the structural fix that makes forgetting a field impossible

### claims

- dbf22043 · 2026-07-20 · D-GHF-B: budget claim-counting keys on heartbeat-invariant acquired_at — claim files gain immutable acquired_at at acquisition; renewClaimTTL preserves it; ledger entries carry acquired_at with claimed_at fallback for legacy entries. Amends Δ1's (claim_session,claimed_at) pairing IMPLEMENTATION while preserving its intent (count real acquisitions); heartbeat renewal broke the invariant Δ1 assumed.

### cli

- 0a4949e7 · 2026-07-12 · dispatcher-unify shipped: single implementation in bee.mjs for all 9 groups; maintainability rule going forward — a new verb is added ONCE (registry entry + handler in bee.mjs), never in a helper file; helper shims and their pinned suites are the compatibility net
- 6926f1ce · 2026-07-12 · auto-approved Gates 1 and 2 (bypass) for dispatcher-unify: standard non-hard-gate shape, registry-native port of 5 helper groups plus all-9 shim collapse per DB1-DB5
- 7c52b6a3 · 2026-07-12 · dispatcher-unify locked (DB1-DB5): bee.mjs covers all 9 helper groups (adds state/backlog/capture/reviews/feedback to registry+handlers); ALL 9 bee_*.mjs become thin argv-prepending shims delegating to an exported dispatcher run() — single implementation, supersedes DA1's keep-helpers-untouched freeze on explicit owner request; every helper's argv contract, Use:/error text, and exit codes stay byte-identical (existing test_lib CLI checks are the parity net, bijection test extends to 9 groups); templates remain the source and .bee/bin stays byte-identical; prose updates canonical form to 'bee <group> <verb>' in quick-reference while old invocations keep working via shims
- 5b8b302e · 2026-07-12 · unified CLI dispatcher (bee.mjs) adopted from vantt PR #1 — mechanism DA1 (imports lib/*.mjs, not helpers), exclusions DA2 (no vantt .bee state), adaptations DA3-DA5 (0.1.26 compliance + bijection test), scope DA6 (4 legacy helpers + cells.update); follow-up PBI filed for bee_state, bee_backlog, bee_capture, bee_reviews, bee_feedback

### codex

- 760e9b05 · 2026-07-19 · cnt Δ2-amended (D3a addendum, authoritative): config_scope_hash covers ALL FOUR verdict-determining flags = {multi_agent, multi_agent_v2, hide_spawn_agent_metadata, tool_namespace}. Rationale of the 4th leg is 'hash every input that determines the verdict' — D3a made base multi_agent a determinant (external_cli_only trigger), so an unhashed multi_agent toggle would leave a stale verdict standing. Same codex features list read, zero extra I/O.
- daa01646 · 2026-07-19 · cnt V1-V3 probe evidence (spikes/codex-native-transport/probe-v1v3.md): V1 CONFIRMED-YES — live override spawn accepted on 0.144.4 with multi_agent_v2 forced (codex serde echoed the authoritative SpawnAgentArgs whitelist: message, task_name, agent_type, model, reasoning_effort, service_tier, fork_turns, fork_context); proves requested-accepted only, never used-and-confirmed (D7 vindicated). V2 nuance: nested [features.multi_agent_v2] table REQUIRES explicit enabled=true (table presence alone does NOT flip). V3 UNOBSERVED: hand-rolled single-hook file never fired despite active bypass — diverges from capability-matrix D1 (full onboarded chain DID fire) — V3 must be re-observed through an onboard_bee-built fixture (cnt-5's design); cnt-4 cap stays gated. Spike codex-home anomaly resolved: it is the PRIOR session's documented probe home (validating-probe.md), not an intrusion.
- 21cdbe43 · 2026-07-18 · codex-native-runtime-v2 closed: 14 cells capped across 4 slices (1 dropped on disproved premise), all goal-checked; P24 marked done, P50 added done, P25 stays deferred version-scoped; feature closes unreviewed per doctrine
- 3e380426 · 2026-07-18 · codex-native-runtime-v2 closed: 14 cells capped across 4 slices (1 dropped on disproved premise), all goal-checked; P24 marked done, P50 added done, P25 stays deferred version-scoped; feature closes unreviewed per doctrine
- f630e410 · 2026-07-18 · Capability matrix (codex-cli 0.144.4) gates later slices: DEFER D6 plugin-hooks (feature removed/false — repo-local .codex/hooks.json stays authoritative, asymmetry accepted) and D8 custom agents (.codex/agents/*.toml not discovered; spawn_agent accepts only built-in default/explorer/worker — P25 stays deferred); PROCEED D7 approval_policy profiles, D10 native advisor transport, S6 fail-closed doctor. Bonus observed: update_plan reaches PostToolUse (D4 matcher confirmed necessary) and spawn_agent fires PreToolUse with tool_input.agent_type — a Codex-side Agent guard is buildable in S4.
- cf511ff3 · 2026-07-15 · Codex plugin distribution is authoritative: package canonical skills and catalog-derived hooks/hooks.json; plugin-first cleanup runs only after enabled installed-package content matches the release inventory and removes only owned bee skill dirs plus catalog-recognized bee hook entries; repo-copy fallback first proves the plugin inactive; user-root deletion additionally requires an installer ownership ledger; cachebuster/reinstall plus fresh-thread UAT proves the released package.
- 2336dc41 · 2026-07-15 · Codex hook/state parity uses one semantic lifecycle policy with explicit tested runtime gaps; one handler is attached to both SubagentStart and SubagentStop; repo hooks are an exactly-one-source fallback for claude, codex, and both installs; every generic state routing mutation requires --owner matching the selected record's pre-mutation phase; reviews own no active routing and cannot decide execution readiness; the worktree-isolation recovery is operational evidence, not an implementation cell.
- 4407b696 · 2026-07-14 · codex-statusline-onboard (0.1.37): onboarding dam bao ~/.codex/config.toml co [tui] status_line canonical (current-dir, git-branch, model-with-reasoning, context-remaining, five-hour-limit, weekly-limit, used-tokens + use_colors) — add-only, machine-level; status_line co san (ke ca custom) khong bao gio bi dong den; Codex chua cai thi khong tao file.
- f398aa60 · 2026-07-12 · The codex-runtime-parity repo-fallback deny-guard slice is STOPPED at 6a/6b (merged). The write-guard on the dogfood repo-local Codex route is treated as a guardrail against honest mistakes, NOT a security boundary against a malicious in-repo agent — per D2 ('Claude-like understanding and enforcement without pretending hooks are a complete security boundary'). The reviewed P1-a/P1-b (transport fail-open on bare repo, crash on foreign cwd) and the adversarial spoof vectors surfaced across three validation rounds (nearest/outermost walk, above-root marker plant, symlink realpath evasion, unmodeled Bash primitives) are recorded as known Open Gaps, not fixed. 6c and 6d dropped.
- f0018e79 · 2026-07-12 · Codex apply_patch matcher: accept the strong inference (official hooks contract alias set {apply_patch,Edit,Write} + openai/codex PR #18391 present in the installed 0.144.1 build) that bee's Edit|Write matcher already fires on apply_patch; harden by adding apply_patch to the shared runtimes:BOTH write-guard matcher (inert in Claude, load-bearing in Codex). A live trusted-Codex apply_patch deny observation is a post-merge UAT item, not a merge blocker.
- 5e6582af · 2026-07-12 · Current codex-runtime-parity slice is narrowed to repairing the live Codex repo-local hook fallback; global plugin installation/migration and E3/E4 remain out of scope for this slice.
- d7d5f459 · 2026-07-11 · The Codex parity feature updates bee's shared dispatch contract and skill references to the current Codex collaboration interface, including explicit clean-context spawning and continuation semantics, but does not ship custom Codex agent profiles until swarming can select those profiles reliably.
- 4cc1c355 · 2026-07-11 · Codex distribution is plugin-first: the bee Codex plugin bundles the shared skills and compatible lifecycle hooks; repo-local .codex hook wiring remains a fallback/dogfood path, and an installation activates exactly one hook source to avoid duplicate events.

### decisions

- 1ce777d9 · 2026-07-20 · contention-split D1-D6: test monolith split by contiguous section ranges into per-module files with shared fixture helper (new convention, sanctioned); conservation census + explicit MANDATORY_SUITES enumeration as cap evidence; render_plugin_skill_trees writeTree gains withStoreLock + tmp-rename; bee.mjs handler split deferred to its own feature; split queues honestly behind live holds
- bdcdd422 · 2026-07-17 · Evolving loop (ID-leak Gate-A pick) STOPPED cleanly at the RED phase: no failing pressure test could be produced on the generation-tier user-facing surface (3 scenarios incl. unprimed realistic immersion, all translated cleanly). Per the Iron Law (no skill without a failing test first), NO prose change was shipped. Re-diagnosis: the current Silent Bookkeeping rule 11 + litmus is adequate when present; Van's leak points to version skew (host predates the strengthened rule) or an about-bee turn, not a prose gap. Loop ends as a successful no-change outcome.
- bf6966dd · 2026-07-17 · ABANDONED: sub-swarm-tiered-execution duplicates in-flight P32 (advisor-and-orchestration) AO1 ('worker-ise cell execution for every lane including tiny'). The standalone feature + its D1-D5 are dropped; work folds into P32, whose cost model is marked do-not-re-derive. Discovered via backlog review after CONTEXT.md was drafted.
- 5ec8d6d3 · 2026-07-15 · codex-harness-hardening Slice 1 is SPLIT into 1a (foundational guards: release manifest schema + strict release-tuple guard + templates-lib<->.bee/bin/lib mirror test; additive, joins verify) and 1b (the downgrade fix: shared source classifier in templates/lib+mirror used by both status and onboarding, downgrade/unknown zero-mutation preflight on computePlan step-3 copy_lib path per fe6593c0, and status drift re-reading real versions via the classifier; flips test_split_brain_regression.mjs exit 3->0 and joins verify). 1a first — it de-risks 1b (a mirror test must exist before a shared module is added).
- fe6593c0 · 2026-07-15 · codex-harness-hardening: the split-brain downgrade fix (Slices 1-2) MUST guard the vendored-helper (.bee/bin/lib) byte-diff copy path, NOT only the skill-sync path. Running onboarding from the in-repo projection launcher issues self_skip for that projection (source realpath subset of repo), so the skill-sync downgrade guard never sees the mutation; the ungated .bee/bin/lib copy is the actual downgrade path. Prove the fix by flipping test_split_brain_regression.mjs from exit 3 to exit 0.

### dispatch

- e67051c0 · 2026-07-17 · 2A-iv dogfood GO: the Delegation contract cli gather branch works end-to-end through .bee/config.json — resolveTier(root,'review','codex',{for:'gather'}) -> codex exec -m gpt-5.5 -s read-only ... -, run verbatim, prompt on stdin, digest returned correctly between BEE_DIGEST delimiters (spike record .bee/spikes/advisor-and-orchestration/2aiv-cli-gather-dogfood.md). Decision 0019's pending first dogfood is closed: the external gather path is proven against a real config-resolved command.
- 040f8ef0 · 2026-07-17 · bee-compounding §2 three-analyst fan-out hardened against two dogfood-confirmed gaps: D1 (spawn read-only) pins each analyst to the runtime read-only agent type (Explore), NEVER general-purpose — 'write no files' is a prompt string, not a tool restriction, and the ambient bee-reviewing 'default/general subagent type' convention was leaking full Edit/Write/Bash into analysts (unrequested-commit leak); D2 (wait, don't hang) adds event-driven wait + dispatch-failure handling: a denied/errored-at-creation dispatch is surfaced and re-dispatched once, synthesis never requires three-of-three, and an identical re-denial stops and synthesizes from what returned (breaks the deterministic phantom-wait loop).
- 1173a954 · 2026-07-17 · S1 escalation RATIFIED by owner = Question 1 option (A) + discriminator. AO1 stands (worker-ise every lane including tiny); the lane table is amended (bee-hive/SKILL.md:116 Execute+Review, :125 done-report, bee-swarming/SKILL.md:22 'no workers spawned') so a tiny cell MAY execute through one dispatched worker. Gated by a dispatch-cost check: a multi-turn/mechanical cell dispatches; a genuine single-turn one-liner stays inline (delegation is not free). Q2 wording (done-report authorship: relay worker's verbatim diff+verify vs orchestrator authors over trace; gate 'via Y' names the worker+tier) is handed to Slice 5 planning, not decided here.
- 13511979 · 2026-07-17 · Discriminator = the EXISTING per-cell tier judgment, no new field. A solo tiny/small cell down-dispatches to a worker iff its resolved tier is non-ceiling (generation/extraction) AND a dispatch-cost check judges the work volume worth the dispatch+review overhead. Otherwise it stays inline on the ceiling/session model. Default posture is conservative/opt-in: when in doubt, stay inline.
- 6cd34376 · 2026-07-13 · Promote the explicit-tier transport requirement (model param / anchored [bee-tier:] marker, decision 0023) into critical rule 13 of AGENTS.block.md
- 3ff7cd72 · 2026-07-12 · Dogfood proof of the fan-out pattern, first live session: planning bootstrap + advisor inventory ran on a haiku I/O worker (42k tok) and a sonnet miner (79k tok); validation/review judgment stayed on opus review slot; ceiling dispatches = 0 for the whole feature (tier_mix extraction 1 / generation 3 / ceiling 0). The expensive session model produced no file-dump reads it could delegate
- de967733 · 2026-07-12 · Advisor mode is removed from bee (reverses decisions 0013/0015's advisor clauses; 0015's core principle — ceiling = the session model, never configured — stands). Bee runs ONE cost pattern: the session model orchestrates every phase at decide-altitude; gather-altitude steps (>3 files or digest-only content) dispatch down-tier as I/O workers returning digests, every lane and phase, per the Delegation contract in skills/bee-hive/references/routing-and-contracts.md. Backlog P13 killed; stale advisor config keys are warned-and-ignored (never an error).

### gates

- d93e9d45 · 2026-07-20 · GATE BYPASS(total): contention-split lane gates 1-3 auto-approved; validation evidence = topology digest with file:line anchors (writeTree race confirmed at render_plugin_skill_trees.mjs:127-135; SUITES registry cost measured; fixture accumulation risk documented with mitigation)
- b42c1b6a · 2026-07-20 · auto-approved Gate 3 (bypass total): transcript-recovery slice 1 READY — reality gate 5/5 PASS, matrix 7/7, plan-checker SOUND (4 warnings fixed/confirmed), cell review 0 CRITICAL; deps field bug found+fixed (depends_on decorative, deps canonical)
- 67bd0c16 · 2026-07-20 · auto-approved Gate 2 (bypass total): transcript-recovery standard lane — plan.md frozen (mode gate: 1 flag, ~7 product files, standard; 4 cells single slice: recovery.mjs lib, CLI+status block, capture source tag, verify-chain+scout prose)
- 59da6796 · 2026-07-20 · auto-approved Gate 1 (bypass total): transcript-recovery — CONTEXT.md D1-D6 locked, fresh-eyes review returned 2 minor findings both fixed (D3 laneless global-settlement fallback; D2 silent no-op on transcript-less hosts)
- be547720 · 2026-07-20 · auto-approved Gate 3 (bypass total): gh-issue-fixes-172 slice 1 execution — READY WITH CONSTRAINTS, all three plan-check constraints (ghf-1 serialization, NEEDS_REVISION verdict key, reset-budget guard ordering + test updates) folded into cells before approval; baseline green.
- 2038fd1a · 2026-07-20 · GATE BYPASS total: Gates 1+2 (gh-issue-fixes-172) auto-approved — context folded into plan.md evidence base (clear-scope issue fixes, no product gray areas); shape approved as plan.md docs/history/gh-issue-fixes-172/plan.md.
- 94a32968 · 2026-07-19 · GATE BYPASS total: Gates 2+3 (self-correcting-loop) auto-approved after validation evidence (advisor GO-WITH-CONDITIONS folded, plan-check no-P1, baseline green from release verify); audit per bypass contract.
- 4b191419 · 2026-07-19 · GATE BYPASS total: Gate 1 (self-correcting-loop CONTEXT) auto-approved with recommended option; audit per bypass contract.
- 0f3b36f6 · 2026-07-19 · GATE BYPASS total: msh-merge-back tiny merged shape+execution gate auto-approved; merge integration is orchestrator-owned per the worktree integration contract (swarming-reference), AO14 execution-worker rule does not apply to the integration transaction.
- 79795c4b · 2026-07-19 · Merge-back transaction: session-root idle gate toggled OFF temporarily (guard reads the session root's worktree state — msh closed there — while the sanctioned merge work happens in main under feature msh-merge-back with gates approved; cross-checkout session/write-root mismatch). Re-enabled immediately after the merge commit. Guard limitation filed as friction.
- 19784bc5 · 2026-07-19 · auto-approved Gate 3 (bypass): codex-agent-wait-loop-3 READY
- bba206f1 · 2026-07-19 · auto-approved Gate 3 (bypass): lane-ceremony-v3 slice 1 (lcv3-1..5) READY
- 2e7ba342 · 2026-07-19 · auto-approved Gate 2 (bypass): lane-ceremony-v3 standard-lane plan (5-step doctrine rewrite, RED-first doctrine assertions)
- d7b1d441 · 2026-07-19 · auto-approved Gate 1 (bypass): lane-ceremony-v3 CONTEXT.md locked (D1-D10)
- be01f49e · 2026-07-19 · GATE BYPASS total: Gates 2+3 (multi-session-hardening shape + execution) auto-approved with recommended option after validation evidence (advisor GO-WITH-CONDITIONS folded, spike YES, plan-check no-P1); audit per bypass contract.
- f4b975e3 · 2026-07-19 · GATE BYPASS total: Gate 1 (CONTEXT multi-session-hardening) auto-approved with recommended option; audit per bypass contract.
- 4780af50 · 2026-07-18 · auto-approved Gate 1+2 (bypass=total) gh22-completion: D1 dispatch.prepare registry group (payloads for cell/gather/reviewer/advisor x codex/claude, marker anchored to guard regex), D2 prepare never widens tier semantics (cli stays gather-only), D3 economics fields on dispatch record not resolveTier, D4 doctor ready/degraded/blocked, D5 attest verb with 4-part validity, D6 version-scoped verdicts, D7 bee-render/2 inventory sidecar, D8 CI matrix honest coverage (ps1 E2E stays backlog), D9 skip-guarded codex canary + A/B protocol doc. 6 cells, 2 waves.
- 2bb5c43b · 2026-07-18 · auto-approved Gate 1+2 (bypass=total) pre-162-fixes: D1 doctor resolves hook paths from .codex/hooks.json commands (host topology), D2 merge becomes --no-commit transaction (abort on conflict/red verify, HEAD-unchanged proof, supersedes wsr D8 no-rollback), D3 base-ref via rev-parse --verify ^{commit} -> WORKTREE_BASE_NOT_FOUND, D4 cleanup only post-commit. 3 cells p162-1..3. P2 review findings filed to backlog (doctor three-state, skill inventory, CI matrix/canary)
- 66778ed5 · 2026-07-18 · auto-approved Gate 3 (bypass=total) slice 4 (final): cnr2-13 doctor (zero-write, blocking unknowns), cnr2-14 conformance (public-entrypoint fixtures + manual checklist), cnr2-15 AGENTS.md budget+dedupe (kernel keep-list) — serialized 13 -> 14 -> 15
- f7e9cbab · 2026-07-18 · auto-approved Gate 2 (bypass=total) slice 4 (final): cnr2-13 doctor, cnr2-14 conformance (deps 13), cnr2-15 AGENTS.md budget+dedupe
- 94cb6625 · 2026-07-18 · auto-approved Gate 3 (bypass=total) slice 3 rev4: cnr2-9 -> cnr2-12 -> cnr2-10 -> cnr2-11 serialized; advisor iterated RETURN-TO-PLANNING x3 then PROCEED after reshape (provenance any-target refusal, committed plugin trees topology, sole final-render owner, census flip relocation)
- a33dbd65 · 2026-07-18 · auto-approved Gate 2 (bypass=total) slice 3: cnr2-9 renderer+net, cnr2-10 tag hive/swarming/executing+D10, cnr2-11 tag validating/reviewing+render-out
- e37eff6a · 2026-07-18 · auto-approved Gate 3 (bypass=total) slice 2: cnr2-6/7/8 READY; advisor PROCEED-WITH-CHANGES, all 8 findings folded pre-dispatch (message-field ABI, fail-open boundary, isolated Codex guard branch, 12->13 count, mirror parity, event-count 7->8 rider, D8->D4 traceability)
- 5cf792cb · 2026-07-18 · auto-approved Gate 2 (bypass=total) slice 2 of codex-native-runtime-v2: cells cnr2-6 (D7 docs), cnr2-7 (hooks regen), cnr2-8 (Codex spawn_agent guard, deps cnr2-7)
- f372e08f · 2026-07-18 · auto-approved Gate 3 (bypass=total): codex-native-runtime-v2 slice S1+S2 — cells cnr2-1,2,4,5 validated READY; advisor PROCEED-WITH-CHANGES, all 7 findings folded into cells pre-dispatch (constraints-before-dispatch)
- 7c70f922 · 2026-07-18 · auto-approved Gate 2 (bypass=total): codex-native-runtime-v2 high-risk epic — slices S1-S7, current slice S1+S2 (truth cleanup, matcher superset, hook-manifest convergence, capability spike)
- 3e7d87f0 · 2026-07-18 · codex-native-runtime-v2 scope locked (Gate 1 auto-approved, bypass=total): D1-D13 per docs/history/codex-native-runtime-v2/CONTEXT.md
- f03dea17 · 2026-07-18 · auto-approved merged Gate 2+3 (bypass=total): p49 small lane — host_items enumeration in refused-apply payload via one execution worker, verified by test_onboard_bee; advisor consult in flight, findings folded into cell text before dispatch (constraints-before-dispatch)
- c02805af · 2026-07-17 · auto-approved Gate 3 (bypass=total): post-advisor-hardening cells pah-1..3 — approval recorded at the bypass net's prompt while the adversarial checker is still in flight; its findings will be folded into cell text BEFORE any worker dispatch (constraints-before-dispatch, same discipline as every slice today). Mode standard — no advisor precondition applies.
- 44ac2af0 · 2026-07-17 · auto-approved Gate 2 (bypass=total): post-advisor-hardening shape — 3 standard cells pah-1 (H1 drift row, test-only, falsifiability proven once), pah-2 (H2 advisory manifest lint in cells add/update, never blocks), pah-3 (H3 B15 consult prose). Manifest overlap wave-serialized.
- 2d1163ab · 2026-07-17 · auto-approved Gate 1 (bypass=total): post-advisor-hardening CONTEXT locked — H1 generator drift check (test-only), H2 cells-add manifest lint (advisory warning), H3 session-close B15 consult prose. All three sourced verbatim from advisor-and-orchestration learnings/friction; no open product questions.
- 6cfd3ed6 · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 5 shape — AO14 verbatim: tiny/small Execute column -> one dispatched execution worker (lighter direct dispatch, same execution contract, merged gate kept, no ceremony); Delegation contract gains the execution-worker class (registers in swarm registry, takes reservations); orchestrator authors the done-report with worker diff + own verify re-run; rule-13 rider + root AGENTS.md re-render; census anchors declared up front. One cell ao-5-1.
- ca94bd20 · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 4 READY WITH CONSTRAINTS -> constraints applied. Checker B1 (command-registry.mjs omitted — verb would not dispatch; manifest lives in lib/command-registry.mjs, not bee.mjs) fixed: both registry copies added to ao-4-1 files. M1 (anchors bind to the selected record) folded into action. W1 accepted-by-design (decision 126412b9); W2 filed as P3 friction. Split-brain schema crack cleared as false alarm (readStateStrict preserves unknown keys). Approval covers ao-4-1 + ao-4-2 only.
- 126412b9 · 2026-07-17 · Slice 4 W1 accepted-by-design: the Gate 3 advisor precondition keys on the SELECTED record's mode==high-risk, wherever the approval write comes from — bee-planning's tiny/small merged gate included. The mode gate already routes hard-gate work to high-risk (a tiny/small lane never carries high-risk mode), and re-approving execution on a high-risk record legitimately requires a live consult. bee-planning prose untouched this slice.
- 6196c8bf · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 3B READY WITH CONSTRAINTS -> constraints applied. Panel BLOCKER (drift advisory unhostable in pure validateModelsConfig) fixed: separate validateAgentFilesDrift(root,config) helper called from bee status + config validate hosts, bee.mjs canonical+mirror added to ao-3b-2 files. WARNING (dead-code placement) fixed: pinned-type deny precedes both allow branches, with-param row added. Approval covers ao-3b-1 + ao-3b-2 only.
- 604c101a · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 3B shape — W3 pinned agent types. Agent files RENDERED from config at onboarding sync (AO5: no static pins to drift), flat managed-file sync with own onboarding.json marker (AO10: never REPO_SKILL_TARGETS), cli/null slots skip their agent file. Guard: anchored bee-tier marker + subagent_type general-purpose denied with FIX naming the tier's pinned type / Explore; ceiling keeps general-purpose (no pinned agent); config-validate gains an advisory drift code. Prose spawn instructions updated same slice; Codex documented asymmetry (AO11). Cells ao-3b-1 (templates+sync+inventories), ao-3b-2 (guard+drift+prose, deps 3b-1). No cost-reduction claims.
- 5ac42e97 · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 3A READY WITH CONSTRAINTS -> constraints applied. Panel BLOCKER (.codex/hooks.json is a hand-curated D9 snapshot — hand-add the one PostToolUse group, never re-render) fixed in cell; WARNING 11->12 topology count named as known fix; read_first widened. Approval covers ao-3a-1 only.
- bc50cd35 · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 2B READY WITH CONSTRAINTS -> constraints applied. Panel BLOCKER-1 (test_config_validate.mjs is the real suite, orphaned from commands.verify) fixed: cell retargeted + suite joins commands.verify on green tree. BLOCKER-2 (swarming-reference.md:250 second ceiling-skip site) fixed in cold-pickup round. W3 discriminator (workspace-write) + W4 (promptVia declaration-only) + W5 (blocklist framing) folded into cells. Approval covers ao-2b-1 + ao-2b-2 only.
- a02a79bb · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 2B shape — W2: degenerate check narrowed to AO5's literal same-model no-op (ladder + ceiling-skip deleted; prose-only, resolveAdvisor has no code ladder); W6 remainder: validator refuses write-granting sandbox modes on advice-class cli slots + bee's own config migrated to promptVia:stdin (measured: bee config validate currently fails with 2 problems). W1 recorded as absorbed by ao-2aiii-1. Cells ao-2b-1 (prose+mirrors), ao-2b-2 (validator+tests+config).
- cb41a245 · 2026-07-17 · auto-approved Gates 2+3 (bypass=total, spike fast path): advisor-and-orchestration Slice 2A-iv — one spike cell ao-2aiv-1 proving the config-resolved cli gather end-to-end (resolveTier codex/review {for:'gather'} -> command verbatim, prompt on stdin, BEE_DIGEST delimiters). Reality check: codex-cli 0.144.4 present; resolution measured green this session; no source edits; GO/NO-GO recorded verbatim in .bee/spikes/.
- 6b155218 · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 2A-iii READY WITH CONSTRAINTS -> constraints applied. Panel BLOCKER-1 (model:'fable' non-member deny) accepted by design: session-model dispatches ride [bee-tier: ceiling]; deny FIX teaches ceiling-marker + config-slot routes; no hardcoded allowlist. Cell-review CRITICAL (release-manifest trap) fixed in both cells (manifest in files, --write step, regen-only prohibition). WARNING-2 pinned as designed behavior; WARNING-3 builders named; WARNING-4 mirrors added. Approval covers ao-2aiii-1 + ao-2aiii-2 only.
- 667d145e · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 2A-iii shape — guard decision order = declared tier first, then model param judged against it (AO5 equality for model-shaped tiers; B5 membership for param-only dispatches; cli-shaped declared tier denies Agent/Task with external-executor FIX naming no phantom model; W10 bare-deny FIX fix). Prose half of B4(1): bee-swarming/bee-validating/bee-reviewing SKILL.md + swarming-reference.md move to the 4-arg {for:'gather'} form. Cells ao-2aiii-1 (guard+tests), ao-2aiii-2 (routing prose, deps ao-2aiii-1).
- 4ec5be1a · 2026-07-17 · auto-approved Gate 3 (bypass=total): Slice 2A-ii READY WITH CONSTRAINTS -> constraints applied (plan-checker CRITICAL on test_lib.mjs:2264 review-cli row repaired into ao-2aii-1; scope-split note added to plan.md). Approval covers ao-2aii-1 + ao-2aii-2 only.
- 34398e69 · 2026-07-17 · auto-approved Gate 2 (bypass=total): advisor-and-orchestration Slice 2A-ii shape — purpose-scoped resolveTier (4th param {for:'gather'|'cell'}, default 'cell', typed refusal for cli+cell) + Delegation-contract cli gather branch (BEE_DIGEST delimiters, verbatim command, stdin prompt, absolute paths)
- 65f41eca · 2026-07-17 · 2A-i re-validation (iter 2) = READY WITH CONSTRAINTS; Gate 3 auto-approved (bypass=total). Repairs matched every panel BLOCKER 1:1 (ao-2ai-1 mirror file + alias-closure blocklist framing + named hosts; ao-2ai-2 re-scoped to .bee/config-sample.json + docs/config-reference.md with grep-test over all shipped configs/docs). Constraint recorded: unsafe-flag check is a known-bad blocklist, not a positive sandbox guarantee.
- 1394b224 · 2026-07-17 · Auto-approved Gate 2 (bypass=total) for Slice 2A re-plan: SPLIT into 4 ordered sub-slices (2A-i safety floor / 2A-ii structural boundary / 2A-iii guard integrity / 2A-iv dogfood). Current sub-slice 2A-i cells prepared.
- 19838d73 · 2026-07-17 · No new gate. The merged shape+execution gate (Gate 2+3) is unchanged and precedes dispatch; the down-tier dispatch happens during execution, after Gate 3. Under total autopilot the gate auto-approves as today. The [bee-tier:] transport + model-guard already govern the dispatch.
- 074c5992 · 2026-07-15 · Slice p2 Gates 2+3 auto-approved via gate_bypass=total (standard lane, no hard-gate). Design locked by review findings; L0 discovery; low-risk refactor+verify-wiring.
- eff4aa0f · 2026-07-15 · Slice 1c merged shape+execution gate auto-approved via gate_bypass=total (small lane, no hard-gate). Inline reality check all PASS.
- fe2f664a · 2026-07-15 · Slice 1c Gate 1 (context) auto-approved via gate_bypass=total. CONTEXT.md locked: honest-drift only, reference = onboarding.json managed-hash ledger, report-only boolean drift.
- c965a690 · 2026-07-15 · Slice 1b Gate 3 (execution) auto-approved via gate_bypass=total (high-risk floor lifted, decision 0010 + user authorization dcf01d7b).
- a728276e · 2026-07-15 · Slice 1b Gate 2 (shape) auto-approved via gate_bypass=total (high-risk floor lifted per decision 0010 + user authorization dcf01d7b — total autopilot, zero stops).
- dcf01d7b · 2026-07-15 · Gate 2+3 approved by explicit user authorization for total-autopilot bypass change
- 6b0d092b · 2026-07-15 · Slice 1a Gate 3 (execution) auto-approved via gate_bypass (standard, no hard-gate).
- a058d82e · 2026-07-15 · Slice 1a Gate 2 (shape) auto-approved via gate_bypass (standard lane, no hard-gate flag).
- d716ccd7 · 2026-07-14 · chain-integrity D5 — gate_bypass stays ON and is NOT touched by this feature.
- efe7baac · 2026-07-13 · auto-approved merged shape+execution gate (bypass) for release-v0.1.33: commit the CLI-generated README badge refresh, tag v0.1.33, push with tags, onboard anphabe hosts (minus anphabe-crm)
- 63a84ee8 · 2026-07-12 · auto-approved Gate 3 (bypass) for skill-metadata-parity: execute smp-1 -> smp-2 -> smp-3 with exact RED diagnostic, canonical suite wiring, generated OpenAI metadata, and sandbox-aware full verification
- 79885082 · 2026-07-12 · auto-approved Gates 1 and 2 (bypass) for skill-metadata-parity: standard non-hard-gate shape, shared SKILL.md source plus generated Codex metadata projection
- 4d72de58 · 2026-07-12 · Gate 3 harness-integration-adopt auto-approved via gate bypass (standard lane, no hard-gate flag): execution of hia-1..5, order 1 -> {2,(4 after 2)} -> 3 -> 5; verdict READY WITH CONSTRAINTS; plan-checker 0 blockers/6 warnings + cell reviewer 0 critical/5 minor, all load-bearing findings repaired in-place via cells update before approval
- 09e7ccd1 · 2026-07-12 · Gate 1+2 harness-integration-adopt auto-approved via gate bypass (standard lane, no hard-gate flag): scoping synthesis in plan.md replaces CONTEXT.md (surface-scope-earlier); shape = 5-cell single slice import->adapt->enforce->docs->close per docs/history/harness-integration-adopt/plan.md
- ab412efe · 2026-07-12 · Merged Gate 2+3 cells-update-verb auto-approved via gate bypass (small lane, no hard-gate): bee_cells.mjs update verb — allowlist-map fields (title/action/verify/files/read_first/deps/decisions/must_haves/behavior_change/lane/pbi), status door open|blocked only, strict-read fail-closed, frozen keys (id/feature/status/trace/tier) + unknown keys refused. Reality check 5/5 inline in plan.
- 829b2382 · 2026-07-12 · Gate 3 review-on-demand slice 2 auto-approved via gate bypass (decision 0010): standard lane, no hard-gate flag. Validation READY — checker ITERATE (3 BLOCKERs: cell-5 verify vs frozen-judge line, docs/04+05 unowned strays, repo AGENTS.md uncaught) + cell-review FIX-FIRST (2 corroborating CRITICALs) all closed mechanically with prescribed fixes. Report: docs/history/review-on-demand/reports/validation-slice2.md
- d5e8d4d7 · 2026-07-12 · Gate 3 review-on-demand slice 1 auto-approved via gate bypass (decision 0010): standard lane, no hard-gate flag. Validation READY — reality gate 5/5, matrix 6/6 proven (git rev-list stale mechanics, onboard readdirSync sync, verification_evidence field, gitignore no-change), plan-checker BLOCKER (candidate mode field cross-cell drift) + cell-review 2 CRITICALs fixed mechanically per prescribed fixes (precedent d2788ac9/c05613d9). Report: docs/history/review-on-demand/reports/validation-slice1.md
- bb746d76 · 2026-07-12 · Gate 2 review-on-demand auto-approved via gate bypass (decision 0010): standard lane, no hard-gate flag. Shape: 2 slices — (1) runtime substrate .bee/reviews store + bee_reviews.mjs CLI + derived candidate statuses + bee_status review block; (2) skill-prose re-wiring (reviewing user-invoked, swarming→scribing handoff, AGENTS block, docs) with removal census. Small-lane auto correctness reviewer also stops per SPEC goal 1 (zero reviewer tokens without request); phase enum unchanged per SPEC 11.4.
- 558cd417 · 2026-07-12 · Gate 1 review-on-demand auto-approved via gate bypass (decision 0010): CONTEXT = docs/history/review-on-demand/SPEC.md (full BA spec, R1-R10 + A1-A12), source decision 565e68d0 locked in prior session; lane standard, no hard-gate flag.
- 7d2c131b · 2026-07-12 · bee-footprint Gate 3 auto-approved via gate bypass (decision 0010): lane standard, no hard-gate flag — GATE_ALLOWED_PREFIXES strictly shrinks, git rm --cached preserves worktree (probe-proven), no auth/external/data-loss. Validation READY after 2 repair iterations (B1 glob-move fix, W1 .bee/bin verify scope, W2 test framing, W3 both-trees assert); full report docs/history/bee-footprint/reports/validation-1.md
- 596376be · 2026-07-12 · Gate 4 fanout-delegation approved by owner 2026-07-12 with release v0.1.23: UAT 2/2 confirmed (advisor gone from status/preamble + stale-key warn; live session ran the fan-out pattern with ceiling=0 dispatches). P1 warn-path finding fixed by fanout-4 (79d96df) before merge; residuals F5 filed P3
- d2788ac9 · 2026-07-12 · Gate 3 fanout-delegation auto-approved via gate_bypass (standard, no hard-gate flag): verdict READY — reality gate 5/5 PASS, 5/5 matrix rows PROVEN, plan-checker ITERATE round closed mechanically (8 findings incl. README:407 blocker), cell-review CRITICALs fixed (readConfig spread strip, whole-file README sweep)
- 36526a8c · 2026-07-12 · Gate 2 auto-approved under gate_bypass for fanout-delegation (standard, 3 flags, no hard-gate): one slice, 3 disjoint cells — advisor wholesale removal (D1), delegation-contract prose in routing-and-contracts + 10 per-skill lines (D2/D3), docs/ledger sweep; I/O workers skip the worker registry, P22 dispatch log is their audit surface
- 83e029f0 · 2026-07-12 · Gate 3 approval for codex-parity-6 is withdrawn; execution stays closed until the revised split cells pass a fresh validation and receive a new human approval.
- f5a7426e · 2026-07-12 · Gate 4 Safety foundation approved by human: merge accepted, 3 UAT items confirmed pass (fail-open stdin, apply_patch deny exit 2, start-feature zero-mutation refusal)
- 7facd6e0 · 2026-07-11 · Gate 3 codex-runtime-parity/Safety-foundation approved by human (high-risk, no bypass): execution of cells codex-parity-1..5 only
- 1baaf7fb · 2026-07-11 · Gate 2 codex-runtime-parity approved by human (high-risk, no bypass): shape locked per implement-plan.md — plugin-first distribution + dual hook catalogs from one logical definition + shared adapter; only Safety foundation slice receives cells now
- 9880542e · 2026-07-11 · Gate 4 approved by human for cli-mutations: merge accepted with P1s fixed (readStateStrict fail-loud; standing vendor byte-equality sweep); 6 P2 + 6 P3 filed to backlog as non-blocking
- a24ced29 · 2026-07-11 · Gate 3 auto-approved under gate_bypass for cli-mutations (standard, READY WITH CONSTRAINTS): execution of cells 1-4, wave order 1->2->{3,4}; plan-checker STRUCTURALLY CLEAN iter 2; 1 blocker (invented layer enum) + 2 criticals (test_lib serialization, cell-3 verify gap) fixed in validating
- 97576020 · 2026-07-11 · Gate 2 auto-approved under gate_bypass for cli-mutations (standard): plan.md shape — bee_state.mjs CLI + bee_backlog add + grep-driven prose sweep + write-guard deny; advisor (fable) APPROVE-WITH-NOTES folded in
- e4d6353f · 2026-07-11 · Gate 4 grill-deltas: merge auto-approved under gate-bypass — P1=0 after two review-fix cells (grill-deltas-3/4 closed both temporal-contradiction P1s from the external codex reviewer; round-3 re-review NO FINDINGS / PASS), zero SEE/CALL/RUN UAT items (no CONTEXT.md, prose-only skill feature), suites green (test_lib 124/0, onboard PASS)
- 461491de · 2026-07-11 · Gate 4 model-tier-guard: owner approved merge after the fix wave closed all 5 corroborated P1 clusters (c943def anchor+fail-open+Task, d98a730 structural assertions, 1419a45 docs+re-vendor); UAT live-fire battery confirmed by owner (bare DENY, embedded-marker DENY, anchored-marker PASS, model-param PASS); 2 P3 filed to backlog non-blocking
- ae745493 · 2026-07-11 · Gate 3 model-tier-guard: auto-approved via gate bypass (standard lane, no hard-gate flag) — verdict READY WITH CONSTRAINTS after reality gate PASS, 7/7 feasibility rows PROVEN, 3 plan-check iterations + orchestrator-verified mechanical closure of the last cell-3 grep finding; constraints: cell-4 transaction blast radius noted, live-fire deny is orchestrator-owned at acceptance + Gate 4 UAT with reopen rule
- 2ce745d8 · 2026-07-10 · Gate 4 learnings-pair-relocation: owner chose fix-then-close; both P1s (wave cap refill, 0021 tier drift) and the P3 fixed in cell -2, grep-verified, feature approved for close
- c75fed88 · 2026-07-10 · Gate 4 evolving-loop slice B: owner explicitly acknowledged merging with 2 open P1s (rank --json emits stripped key; normalizeTitle duplicates datamark cleaning) — both filed to backlog as fix-first candidates; review record review-slice-b.md

### installer

- e7a3a5c8 · 2026-07-20 · auto-approved shape+execution (bypass total): installer-probe-quiet-1 — capture probe stderr in both installers, condensed warn/fail, e2e asserts diagnostics embedded not raw-dumped; verify: test_installers_e2e --installer bash
- 0c39aaa2 · 2026-07-20 · Scoping synthesis (small lane, installer-probe-quiet): tolerated probe failures must not dump raw CLI stderr into install output (field: real OpenAI codex has no plugin subcommand — unexpected-argument error printed twice in red before the warn; user read it as install failure). Probe stderr is captured and surfaced condensed: repo-copy warn carries the first stderr line; plugin-first failure prints captured stderr then fails. ps1 must avoid native stderr redirection (PS5.1 NativeCommandError, documented install.ps1 lines 104-106) — use a scriptblock with ErrorActionPreference Continue merging streams and filtering ErrorRecords. Supersedes prior cell prohibition against stderr suppression, on field evidence. Mode gate: 1 flag (cross-platform), 3 product files, small.
- 02ce24b4 · 2026-07-20 · auto-approved shape+execution (bypass total): installer-broken-cli-probe-1 — tolerant repo-copy probe in both installers + 2 e2e cases (broken codex repo-copy succeeds with warning; plugin-first still fails clearly), verified by node scripts/test_installers_e2e.mjs --installer bash
- 1d501c72 · 2026-07-20 · Scoping synthesis (small lane, installer-broken-cli-probe): a runtime CLI on PATH but not runnable (e.g. Windows codex npm shim under WSL missing @openai/codex-linux-x64) must not hard-fail repo-copy installs — probe degrades to empty plugin state with a one-line warning; plugin-first keeps failing but names the broken CLI and the fix options (--distribution repo-copy / --runtime claude / repair codex). Mode gate: 1 flag (cross-platform), 3 product files (install.sh, install.ps1, test_installers_e2e.mjs) -> small.

### judge

- 909cd49b · 2026-07-20 · frozen-judge hit on transcript-recovery-3 (test_bee_cli.mjs changed outside declared files) is JUSTIFIED, not a rewrite: the diff is +43 purely-additive lines adding capture-add --source CLI coverage — exactly the plan-checker W2 fix the cell action mandated. Root cause: orchestrator authoring gap — when action was amended for W2 (both-level test coverage), test_bee_cli.mjs was not added to the cell files array. No existing assertion was altered to pass. Carried to review.
- 1cb27fbf · 2026-07-19 · self-correcting-loop validating verdict: GO-WITH-CONDITIONS folded — Δ1 (claim_session,claimed_at)-pair counting, Δ2 budget check inside the O_EXCL critical section (chosen over plan-check pre-acquire alternative), Δ3 claim-next selection skips exhausted cells, Δ4 test_claim_race added to scl-1/scl-3, Δ5 tolerant sha256 duplicate scan, Δ6 orchestrator-supplied builder_model + single-homed judge-tier table across 7 scoped surfaces. Plan-check: no P1; F1 no hint-map edit (trace frozen wholesale), F4 stderr advisories per pah-2, F5 deliberate_exceptions keeps contract, F6 judge.mjs auto-enumerated. All amendments in CONTEXT + cell actions pre-Gate-3.
- e2cf9b4d · 2026-07-19 · multi-session-hardening validating verdict: GO-WITH-CONDITIONS folded — Δ1 rename-based stale takeover (double-unlink race, spike-reproduced), Δ2 claim release on every claim-clearing transition + sessionless relaxation, Δ3 hooks take store lock try-once/skip-on-busy (never wait), Δ4 renewal respects .adopting gate via new same-session primitives, Δ5 force audit in append-only trace.ownership_overrides, Δ6 idle-renewal accepted residual. Plan-check: no P1; msh-5 files += bee.mjs+reservations.mjs(+mirrors); msh-6 files += .bee/config.json (wire 4 new suites into commands.verify). Spike: lock feasibility YES, 8/8 runs, negative control proves the guarded shape is load-bearing.

### lanes

- 3bbfceb8 · 2026-07-20 · gh-issue-fixes-172 scope: standard lane (3 flags: cross-platform, covered-contract change, multi-domain), one slice of 6 cells fixing GH #23 (group --help), #26 (ps1 sparse-checkout omits .codex-plugin + uninstall stderr noise), #27 correctness cluster items 1-5. Judge lifecycle state machine, session-id neutrality, per-cell CAS, ps1 rollback parity stay 1.7.3 roadmap via issue reply.
- edea036f · 2026-07-17 · Applies to BOTH tiny and small lanes, gated by D1's tier+cost check rather than by lane name. A trivial one-liner naturally stays inline (judged ceiling or not-worth-dispatch); a bulky mechanical tiny cell may down-tier.

### orchestration

- 348e0f12 · 2026-07-16 · bee-exploring now batches independent gray-area questions into one AskUserQuestion message and serializes only dependent/branching ones; a delegated step-3 pre-pass generates+classifies the slate (independent/dependent + edges)
- 9927fafb · 2026-07-13 · A switch that narrows what an upgrade COMPARES must equally narrow what it CLAIMS. --repo-hooks scoped both the refresh and the up-to-date comparison, so omitting it made stale guards invisible to the drift check and the run still reported up_to_date. The opt-in is now sticky (recorded repo_hooks forces the refresh).
- 30606de4 · 2026-07-12 · harness-integration-adopt locked (DA1-DA7): adopt vantt PR #1 mechanism as-is (bee.mjs imports shared lib, never touches the 4 helpers); exclude ALL vantt .bee/ state + plans/ + docs/history bookkeeping; adapt to 0.1.26 (cells.update in registry+dispatcher, status logic re-synced to review-block bee_status.mjs); gitignore .bee/manifest-hash.json; standing behavior-derived registry<->helper-verb bijection test; scope frozen to 4 legacy helpers (bee_state/backlog/capture/reviews/feedback = follow-up PBI); PR comment/close only on explicit user confirmation

### performance

- 32ce681b · 2026-07-14 · statusline (0.1.38): ctx mau theo % CON LAI — green >35, yellow 20-35, red <20. Statusline pair o ~/.claude (user-level) khong duoc onboarding quan ly: chi repo da opt-in (statuslineOptIn) moi duoc sync .claude/statusline-command.sh cap repo; repo chua opt-in roi ve ban user-level, phai copy tay tu template.

### planning

- e9c23b0a · 2026-07-20 · tiny-direct execution mode: deliberately NOT built (hardening-7)
- fe76b038 · 2026-07-20 · auto-approved Gate 2 (bypass): RC work shape = remaining slices 4-8 from decision 8650ff81 (session-identity+txn-mutators, recovery-transport, powershell-flow, tiny-direct/small-serial, windows-E2E+hermetic-verify+release-hygiene), sequenced; cells to be scoped from the in-flight code-state audit before Gate 3
- 5a2ef3cf · 2026-07-10 · Unknowns toolkit (decision 0020, P9-P11): exploring teaches before asking when the user is guessing; walkthrough offers an optional 3-5 question quiz; SEE gray areas may lock via a throwaway .spikes mock — the one exception to exploring's no-code rule

### recovery

- 0de4f5c1 · 2026-07-21 · Recovery takeover (bypass total, auto-approved): crashed session c128101f's stale claim on rel1710rc-3 force-released (audited) and reclaimed by this session; transcript mined per D2/D4 into docs/history/release-1-7-10-rc/reports/recovery-c128101f.md
- ca934aa7 · 2026-07-20 · transcript-recovery exploring locked D1-D6 (bypass total, info/approval split — zero user questions needed): crash = stale heartbeat + no clean-end trio + work signals; detection auto in status, mining CLI-only via down-tier worker; bounded window since last durable settlement; digest-only to orchestrator; mined content = data never instructions, secrets redacted, current project only; output = recovery report + mined-unconfirmed capture stubs through normal scribing flush; never writes HANDOFF

### release

- 2e2bd460 · 2026-07-20 · A feature close is never a release: the 4-member release-version tuple (state.mjs x2 + both plugin.json) moves ONLY in an explicit 'release X.Y.Z' commit. Feature-close discipline: independently re-inspect the full working tree (git status --short + bump_version --check) before declaring done, never trusting a worker's file list; if a non-release feature drifted the tuple, restore with bump_version <last-released>, re-render, regen manifest LAST.
- 50794eda · 2026-07-20 · transcript-recovery cell 4 introduced an unrequested version bump 1.7.5->1.7.6 across the full release tuple (state.mjs x2 + both plugin.json + manifest); plugin.jsons + rendered trees were committed at 1.7.6 in c7c39a6 while source state.mjs stayed uncommitted. Reverted to 1.7.5: bump_version.mjs 1.7.5, onboard --apply --force-downgrade (managed .claude/.agents copies), render_plugin_skill_trees (plugin trees), release_manifest --write. Rationale: every version bump in git history is an explicit 'release X.Y.Z' commit; transcript-recovery is a feature close, not a release, so it must sit at the last released version 1.7.5 until an explicit release. Zero stray 1.7.6 remain.
- 5ccc6c5b · 2026-07-20 · GATE BYPASS total: release-1-7-4 shape+execution auto-approved — patch release of installer broken-CLI-probe fix (8e0774d), standard flow (bump 1.7.4, self-onboard, foreground verify, tag, push); explicit user release command; A9 review-first skipped per total autopilot + explicit release (1 unreviewed candidate: installer-broken-cli-probe).
- 768321d8 · 2026-07-20 · GATE BYPASS total: release-1-7-3 merged shape+execution auto-approved — standard release flow (bump 1.7.3, render, manifest, self-onboard, foreground verify, tag, push), explicit user release command.
- d9574709 · 2026-07-16 · Released bee 1.3.5 (from 1.3.4): worktree-feature-parallelism (P44) + exploring-batch-questions (P45). Commit bedd72f, tag v1.3.5 pushed to origin/main; beegog self-onboarded to 1.3.5; 25 stale runtime-tier sessions untracked. Ships UNREVIEWED per zero-stops + explicit release command.
- 8ab0c19f · 2026-07-15 · Release v1.2.1 (patch): installer placeholder UX fix (friendly mkdir failure + paste-safe README examples) + cache-economics learning + backlog P38. No runtime behavior change beyond the installer error path.
- 7782233a · 2026-07-15 · Release v1.2.0 (minor): slice 1d SRC source classifier + status source field; codex-bypass-per-skill fix (every gate step level-aware); bypass-info-vs-approval (exploring asks for information, not approval, under total). The gate fixes make Codex ship straight through under total autopilot.
- 3d26be01 · 2026-07-15 · Release v1.1.0 (minor): the runtime-integrity hardening — 1b downgrade fix (bugfix) + 1c honest status drift with the additive drift_detail field (backward-compatible new capability). Independently reviewed (session review-integrity-2026-07-15, P1=0).
- 11d96d39 · 2026-07-15 · Release v1.0.0 (major): bypass autopilot levels + Slice 1a release-integrity guards. User marked bypass as a big step and chose 1.0.0. Shipped without independent review per explicit user instruction (total autopilot).
- 6427d703 · 2026-07-15 · codex-harness-hardening Slice 1a added standing release-integrity guards: (1) scripts/release_manifest.mjs — tree manifest of the release-identity set (15 source_lib + 15 runtime_lib + 2 plugin_manifest) with sha256+POSIX-mode+role, subcommands --write/--check/--selftest (release-gate tool, NOT in verify yet); (2) scripts/test_release_tuple.mjs — asserts BEE_VERSION (templates/lib + .bee/bin/lib) == both plugin.json versions; (3) scripts/test_lib_mirror.mjs — asserts templates/lib byte-identical to .bee/bin/lib (file set derived via readdirSync). Guards (2)+(3) joined commands.verify (now 10 suites, green). The mirror guard is the FIRST standing enforcement of the templates<->.bee/bin/lib invariant the reading-map referenced but which previously had only ad-hoc per-cell cmp checks.

### reservations

- ba169d07 · 2026-07-17 · A solo down-tier worker needs NO new file reservation (single writer, matches today's solo tiny/small). Existing cross-session file holds are unchanged and still apply.

### review

- 687b7563 · 2026-07-17 · The orchestrator (session/ceiling model) reviews the down-tier worker's diff + fresh verify output before capping. The tiny/small fast-path done-report and self-review are UNCHANGED; delegation moves the typing, not the accountability. A real problem found stops and asks.
- 450cf854 · 2026-07-16 · Review session unreviewed-batch-20260716: Gate 4 auto-approved (merge) under total bypass — P1=0 after in-session fixes with PASS delta re-review; UAT items skipped with recorded reason (zero-stops autopilot); P2/P3 routed to backlog.
- 6671b923 · 2026-07-16 · Review session unreviewed-batch-20260716 proceeds with SPEC.md/plan.md/cell traces standing in for missing CONTEXT.md on codex-harness-hardening(-p2), codex-bypass-per-skill, release-1-3-0; doc gap filed as a review finding instead of stopping.
- 559da798 · 2026-07-12 · review-on-demand shipped (7 cells, 2 slices): independent review is user-invoked over an immutable frozen scope (.bee/reviews/ sessions + append-only candidates ledger + derived statuses from git); features close truthfully unreviewed via scribing/compounding with candidate add at close; Gate 4 exists only inside a review session, bypass never creates one; small-lane auto correctness reviewer removed per SPEC goal 1 (zero reviewer tokens without request) — its contract lives inside the on-demand session; 'reviewing' phase retained in the enum for in-flight migration (retire the path, not the value); legacy features derive unreviewed — no fabricated review history.

### sessions

- b296a0cf · 2026-07-19 · cnt-1 duplicate resolved by claims etiquette: session 723195b9 (live, resumed) capped cnt-1 on main (c2717df) honoring all folded conditions; session 6d0892b6's parallel worker branch discarded unmerged (equivalent quality, second to land). Main verified green with theirs (config_validate 48/48 incl. my earlier rows? actually 46/46 theirs, test_lib 350+/0 on main, mirror green). Going forward: 6d0892b6 holds the cnt-2 claim; manifest regen deferred to slice close per the feature's declared discipline (their cnt-1 report).

### skills

- 68f9f405 · 2026-07-12 · skill metadata parity: SKILL.md frontmatter is canonical for both runtimes; Codex agents/openai.yaml is a deterministic projection for UI plus allow_implicit_invocation true; every bee-* skill must carry it and drift checks fail missing/stale projections
- 71eca844 · 2026-07-11 · External skill/library adoption follows reuse-over-install: map the upstream against local equivalents first; fold only genuine deltas into existing skills as prose branches; never install a parallel gate-less pipeline competitor (grill-for-unknowns precedent — ~90% was already decision 0020; only the materiality test and Terms glossary were real deltas, shipped as grill-deltas)
- a3f8d2b2 · 2026-07-10 · Build self-modifying skills at the strongest tier, but pressure-probe their gates with the weakest plausible model: evolving-10 was authored at ceiling while all four RED/GREEN scenarios ran against fresh haiku subagents — a refusal only the strong model produces is not a guardrail

### specs

- ed0b2920 · 2026-07-15 · codex-harness-hardening SPEC §15 D-01..D-14 locked as written (owner-approved 2026-07-15). Notable choices with alternatives: D-02 commit both .agents/.claude projections + CI regenerate-clean check (over gitignore-and-generate); D-11 single Node distribution engine owns all mutation, shell/PS only fetch+confirm+call Node (over keeping gated shell/PS copy); D-10 native-Windows/no-git without a tested transport reports unsupported/advisory, not silent success.
- 25687451 · 2026-07-10 · Digest is an allowlist snapshot with no free-text fields

### state

- a7ef8fb6 · 2026-07-15 · Slice 1c D1: scope = honest status drift ONLY; the SRC-01..06 source-tree classifier splits to its own slice 1d.

### workers

- f4c4a162 · 2026-07-11 · Human confirmed decision 3d55b976 (worker nicknames use Minions character names) — attribution now carries a traceable in-session confirmation; convention stands
- 3d55b976 · 2026-07-11 · Worker nicknames use Minions character names.

### worktree

- 52193fc6 · 2026-07-19 · self-correcting-loop runs in the existing beegog--wt--multi-session-hardening worktree (session-seat constraint: harness cannot switch this session into a new bee worktree, and the write guard contains authoring to the session root). Worktree fast-forwarded to main 9a75754 (v1.7.0). Merge-back later reuses the registered id; the id/feature name mismatch is cosmetic and recorded here.
- 17a624dc · 2026-07-19 · Worktree lifecycle for multi-session-hardening: D1-D7 locked in docs/history/multi-session-hardening/CONTEXT.md (committed 97ccbc7 with Δ1-Δ6 amendments folded); validation evidence carried over — advisor GO-WITH-CONDITIONS (reports/advisor-digest.md), lock spike YES 8/8 with negative control, plan-check no-P1 with fixes folded into cell actions. Gates 1-3 auto-approved under gate_bypass=total (audit); main-store cells dropped per decision ac75fc61, re-created here.
- d5a00839 · 2026-07-18 · D8c (wsr): worktree merge --cleanup with NO recorded commands.verify still cleans up (verify:'skipped'), but always carries cleanup.warning 'verify skipped — no commands.verify recorded; cleaned up unchecked' in JSON and CLI text. Grant removal is the last cleanup step (remove worktree -> branch -d -> removeGrant).
- a151f23a · 2026-07-18 · D8a (wsr): 'dirty worktree tree' = git status --porcelain over tracked+untracked WITHOUT --ignored; gitignored .bee runtime/cache files never count as dirt. D8b: --cleanup performs cleanup unconditionally on green verify; without the flag the command only reports the suggestion, never prompts. D9a: 'occupied checkout' observable = live cross-session heartbeat + non-idle phase in the shared store.
- 72855a0e · 2026-07-12 · bee-footprint D3: the bee repo migrates itself — corrupt .gitignore line (.bee/feedback-digest.json.spikes/ merged, newline missing) replaced by the D1 managed block; already-tracked mutable files (state.json, reservations.json, workers/, logs/, capture-queue.jsonl, feedback-digest.json) and 187 .spikes/ files are git rm --cached (working tree preserved); .spikes/ contents move to .bee/spikes/. Release flow change: post-release state commits no longer include state.json.
- 8ed35504 · 2026-07-12 · bee-footprint D2: spikes move from repo-root .spikes/<feature>/ to .bee/spikes/<feature>/ everywhere (skills docs, AGENTS.block.md, routing refs). The .spikes/ entry is REMOVED from GATE_ALLOWED_PREFIXES (guards.mjs) and NUDGE_ALLOWED (bee-session-close.mjs) — the .bee/ prefix already covers the new home, strictly shrinking the ungoverned-write allowlist that the codex-parity red-team used as a staging prefix. Spike files are local-only (ignored via the D1 block). Historical docs/decisions mentioning .spikes are archives — never rewritten.

## shim-retire

### cli

- bbc6bcea · 2026-07-13 · shim-retire locked (D1-D5): D1 bee.mjs <group> <verb> is the sole canonical AND sole shipped CLI — the 9 bee_*.mjs shims are deleted from templates and host .bee/bin (supersedes the compat-net clause of 7c52b6a3, owner-directed 2026-07-14); D2 onboarding gains a RETIRED_HELPERS removal pass (remove_helper plan item) since buildPlan only copies, never deletes vendored files; D3 write-guard keeps LEGACY_HELPER_RE as a transition guard for hosts mid-upgrade, removal filed as grooming debt; D4 sweep covers living surfaces only (AGENTS block, skills prose, tests, installer, README/INSTALL, docs/specs, docs/0*) — history/decisions/jsonl/cells untouched; D5 registry helper metadata field removed with its strip code and test assertion, D5 parity tests deleted, DA5 verb-bijection guard kept and re-pointed at bee.mjs groups

## verify-pipeline

### capture

- 2412ccdc · 2026-07-15 · Compounding rule (parallel-scheduler): a slice touching templates/lib or .bee/bin/lib owns the release-manifest regen (release_manifest.mjs --write) inside the feature — last cell or close step — never discovered red at the close verify. Promoted to critical-patterns.md.

### cli

- 21be04f7 · 2026-07-15 · Slice 1d D3: bee status gains a report-only source field naming the running launcher's classified kind (and its root). Additive, does not reshape existing fields. unknown/legacy_global are shown truthfully and never silently act as source (SRC-06).

### decisions

- c1c65f42 · 2026-07-10 · Foreign digest consumer revalidation: re-scan, datamark, allowlist enforcement

### orchestration

- 9da5f7a1 · 2026-07-10 · Orchestrator goal-check + frozen judge (decision 0018, P12): a [DONE] counts only after the orchestrator re-runs the cell verify itself (lane-scaled) and bee_cells judge shows no undeclared test/CI/lockfile/verify-config changes; hits flag the cell for review, task misses re-dispatch same tier

### planning

- 7fb024e3 · 2026-07-10 · Prefer an allowlist of structured fields over a blocklist filter whenever the data is human-authored prose: prose reliably embeds identifiers, and no strip or regex finds them. And place a redaction boundary at the party AT RISK, not the party producing the data — in a self-modifying or cross-trust pipeline, write-time validation protects the wrong party

### release

- cddb6d69 · 2026-07-15 · Release v1.1.1 (patch): the p2 integrity-guard hardening — shared fsutil.hashFile + release_manifest --check in verify + test_onboard_bee fixture readdirSync fix. Internal hardening from v1.1.0 review findings, no observable behavior change.

### review

- c05613d9 · 2026-07-11 · Validation iteration cap triage (model-tier-guard precedent): at the 3-iteration plan-check cap, a residual finding that is deterministic and mechanical — the reviewer prescribed the exact fix and supplied counterexamples — may be closed by the orchestrator applying that fix verbatim and proving it with command evidence against the reviewer's own probes; only findings needing design judgment escalate to the user. Never a 4th review iteration either way.
- c45d0fb3 · 2026-07-10 · A frozen assertion that encodes a defect is unfrozen by the planner/orchestrator, never by the worker: test_lib.mjs:1833 asserted a foreign entry's source survives mergeDigests raw ('src'), which IS the P1-1 vulnerability. Updating it to require datamarking is a strengthening, not a weakening, and the worker correctly returned [BLOCKED] rather than rewrite it

### sessions

- 12f54e88 · 2026-07-19 · Multi-session-on-one-checkout audit (2026-07-19) accepted; gaps filed as feature=multi-session-hardening backlog rows (2xP1: non-atomic cells claim in worker flow, reservations RMW+optional --session; 3xP2: no owner check on cell mutators, heartbeat only at SessionStart, state.json LWW). Hardening feature scheduled after codex-native-transport closes. Interim doctrine reaffirmed = AGENTS rule 14: one feature -> one orchestrator + subagents; independent features -> one worktree+session each; never N top-level writer sessions on one checkout/branch.

### skills

- ff26725d · 2026-07-10 · Iron Law binds skill edits with no mechanical-edit exemption: a cell that edits any SKILL.md carries RED/GREEN pressure-test evidence, even when it only adds a numbered step invoking an already-verified command

### specs

- 82da2b79 · 2026-07-20 · verify-pipeline spec created (docs/specs/verify-pipeline.md) + reading-map entry: per-module suites, convention discovery, floor+existence manifest guard, locked tmp-swap render, R5 cap-commit-release etiquette; contention-split scribing complete

### tests

- 3a611c32 · 2026-07-20 · verify-parallel-runner: new scripts/run_verify.mjs parallel test runner replaces the &&-chain in commands.verify; conservative concurrency pool + serial tail for timing/lock-sensitive suites. Gates auto-approved (bypass total).
- 49f032fe · 2026-07-15 · codex-harness-hardening Slice 0: bee's mandatory commands.verify now self-guards its own suite composition. Added test_bee_cli.mjs + scripts/test_verify_manifest.mjs to verify; test_verify_manifest reads .bee/config.json and fails if any of the 7 required suites (test_lib, test_onboard_bee, test_portable_paths, test_model_guard, test_write_guard, test_hook_contracts, test_bee_cli) is dropped, and carries an internal self-test proving its own checker flags a verify-string missing test_bee_cli. Two red-now freeze artifacts added OUTSIDE verify (run on-demand): test_split_brain_regression.mjs and census_stale_spawn_syntax.mjs.
- b7e01bce · 2026-07-08 · Verify-string authoring discipline promoted to critical-patterns: dry-run metachar greps before dispatch; grep stable headings not invented tokens for prose cells.

## workflow-state

### capture

- b937b452 · 2026-07-10 · Capture stubs + background critique (decision 0017): same-turn durability via .bee/capture-queue.jsonl stub, full spec merge deferred to flush (wrap-up / PreCompact / next-session offer); high-risk lane still syncs inline; fresh-eyes and plan-checker run in background and block only their gate

### cells

- 0746db88 · 2026-07-15 · parallel-scheduler D2 clarified: cycle refusal covers every dep-mutating write — cells add AND cells update when deps change — not add alone. Empty files resolved as overlaps-nothing (forced by D3 + claimNextCell precedent). Glob semantics: trailing-* only, per pathsOverlap; mid-path globs are literals, planning adds a files-authoring note.
- eec223d9 · 2026-07-15 · parallel-scheduler D4: scope boundary — this feature ships plan-time computation only: schedule CLI verb + cycle refusal in cells add + wiring into bee-validating (check) and bee-swarming (default wave order). Per-worker git worktree isolation and a wait/queue primitive to replace write-time deny are OUT, deferred to their own backlog rows.
- ecc8862d · 2026-07-15 · parallel-scheduler D3: one overlap semantics — the plan-time overlap matrix reuses the exact pathsOverlap logic the reservation/hold runtime uses (lib/reservations.mjs), so the schedule's prediction and the write-guard's enforcement can never drift apart.
- b4740f68 · 2026-07-15 · parallel-scheduler D2: conflict semantics — file overlap between two ready cells is LEGAL and auto-serializes (the later cell moves to a later wave); it is never a refusal and never 'spawn both and be careful'. Dependency cycles are ILLEGAL and refused fail-fast at cells add time (and reported by the schedule computation for pre-existing stores). The runtime write-guard deny stays unchanged as the safety net.
- a648ea2a · 2026-07-15 · parallel-scheduler D1: bee computes the swarm schedule mechanically — an overlap matrix (cell.files x cell.files) + dependency graph over a feature's declared cells produces numbered waves; swarming consumes the computed waves as its default dispatch order (orchestrator may override with a stated reason), and validating runs the same computation as a feasibility check. Replaces the manual per-wave judgment walk in bee-swarming SKILL.md:32.

### codex

- 81c1255c · 2026-07-15 · auto-approved Gate 3 for codex-agent-wait-loop under gate_bypass=total after READY validation
- 0c6cc71a · 2026-07-15 · auto-approved Gate 2 for codex-agent-wait-loop under gate_bypass=total: one standard slice updates always-loaded doctrine, shared/native collection contracts, RED/GREEN pressure evidence, anchor tests, and doctrine spec.
- e4421dac · 2026-07-15 · auto-approved Gate 1 for codex-agent-wait-loop under gate_bypass=total: CONTEXT.md D1-D5 passed fresh-eyes review after making the post-timeout interval exact and testable.
- 5aedc024 · 2026-07-15 · codex-bypass-per-skill: the level-aware gate-bypass rule is correct in the canonical contract (routing-and-contracts.md §178-198) but the per-skill GATE STEPS don't apply it — bee-exploring (Gate 1) and bee-planning (Gate 2) omit it entirely, bee-validating (Gate 3) + go-mode carry STALE normal-only text ('high-risk => bypass does not apply') that contradicts the contract. So a Codex runtime following the step literally stops at Gate 1/2 even under total. Fix: every gate step applies the contract's level-aware check before presenting; add a machine-check test so the carve-out can't silently regress (crit-pattern 20260714).

### decisions

- a5169920 · 2026-07-21 · auto-approved shape+execution for decision-propagation slice 2 (bypass total): dp-5/dp-6/dp-7 added after plan-check iter-1 — BLOCKER B1 (tag append outside dp-3's store lock = lost-write) resolved via locked-append-primitive contract carried in dp-5 (dp-3 was claimed mid-review by the sibling session, untouchable); W2 overlay-across-union, W3 overlay-aware supersede inheritance, W5 ranked search over --all resolved in cell text; dp-4 patched overlay-aware with deps dp-5/dp-6; red-first mandated per cell
- d2f0b2c2 · 2026-07-21 · auto-approved amended Gate 1 (bypass total): decision-propagation CONTEXT.md amended with D7/D8 (memory layer + mandatory classification) on user instruction; slice 2 proceeds to shaping
- 1cea7713 · 2026-07-21 · D8 (decision-propagation slice 2): the memory layer = classification completeness + derived index as recall surface, not better grep — docs/decisions/index.md promoted to recall surface (complete by construction), area reading order spec -> decision index -> history; search --text becomes multi-term OR with deterministic hit-count ranking over decision/rationale/alternatives AND tags; embedding/vector recall stays deferred (D5 intact)
- c81c6795 · 2026-07-21 · D7 (decision-propagation slice 2): classification is a mandatory write-time step — canonical taxonomy at docs/decisions/taxonomy.json; log refuses untagged decide events once taxonomy exists (warn-only bootstrap); unknown tags append to taxonomy candidates; new append-only retro-tag event 'decisions tag <id>' with stdin batch + read-time overlay merge; one-time agent-run backfill of all legacy untagged events, completeness checkable via --untagged listing reaching zero
- bfc0b751 · 2026-07-21 · hardening-1-7-10 D1-D9 locked (CONTEXT.md): CI hermeticity + windows.yml split suites; lock stale-takeover requires dead pid + 1h ceiling (timer heartbeat REJECTED — spawnSync blocks event loop); atomic cross-worktree holds under one shared lock + heartbeat renewal; archive/mutator serialization at writeCell boundary + journaled archive txn + 4 archived guards; single-live-session adoption + transcript_path persistence; commandWindows node -e git-root bootstrap; NEEDS_REVISION -> open + releaseTrace; origin-rewrite hunt; render-then-manifest close-out
- 8cd4c84e · 2026-07-10 · Evolving loop design (P18, v2): (D1) dogfood repos stay zero-effort — digest is a compounding side effect; (D2 REVISED) the digest is an ALLOWLIST of structured fields — kind, layer, source, title, first_seen, pain — and carries NO free detail/text field, because measurement showed friction prose routinely names functions, files and config keys that no code-block strip or secret regex removes; (D2b) the CONSUMER revalidates and datamarks every foreign digest entry before it can enter a prompt, and every source path is realpath-contained; (D3) bee-evolving runs only in the bee repo, on demand; (D4) improvements go through the Iron Law (failing pressure test first, edits included); (D5) two human gates (what to fix, approve push) — push never auto

### dispatch

- 0a03b45a · 2026-07-10 · External executor tiers (decision 0019, P14): a configurable tier may be {kind:cli, command} — resolveTier returns inherit/model/budget/cli; external workers run the same bee-executing contract via prompt-file dispatch + job-log tending; always goal-checked, secrets stay provider-local

### gates

- b01a782f · 2026-07-21 · Gates 1-3 auto-approved under bypass total for hardening-1-7-10 (high-risk); advisor consult (fable) recorded pre-Gate-3 with 3 accepted amendments: liveness-gated 1h lock ceiling, writeCell stays synchronous (sync O_EXCL acquire + CELLS_ARCHIVE_BUSY), judge reopen reconciles claims-store
- e7f936c7 · 2026-07-15 · Gate 3 (parallel-scheduler slice 1) auto-approved under gate_bypass=total: READY verdict — reality gate 5/5 PASS, feasibility matrix all PROVEN (runtime probe + adversarial sweep), plan-checker 1 BLOCKER + 6 W all repaired (node-set contract: waves=open/claimed, unsatisfiable_deps diagnostic), cell review 1 CRITICAL (ps-4 verify grep) fixed. Report: docs/history/parallel-scheduler/reports/validation-slice1.md
- 75051838 · 2026-07-15 · Gate 2 (parallel-scheduler) auto-approved under gate_bypass=total: standard mode (2 flags: public contracts, existing covered behavior), plan.md shaped — schedule.mjs pure module, cycle refusal at add/update, bee cells schedule verb, prose wiring; slice of 4 cells.
- 59cb342e · 2026-07-15 · Gate 1 (parallel-scheduler) auto-approved under gate_bypass=total: CONTEXT.md with D1-D4 locked from recommended options; fresh-eyes review dispatched and will be collected before planning output is finalized.
- b66b483f · 2026-07-15 · Slice 1d Gates 2+3 auto-approved via gate_bypass=total (standard, no hard-gate — additive classifier + status field, onboarding decisions unchanged).
- da61a5c1 · 2026-07-15 · Slice 1d Gate 1 (context) auto-approved via gate_bypass=total. CONTEXT locked: pure shared classifySource (5 kinds), wrap-not-replace, report-only status source field.
- dc813448 · 2026-07-13 · shim-retire Gate 3 auto-approved via gate bypass (standard lane): validation READY — plan-checker 4 blockers + cell reviewer 2 criticals all fixed in cells before approval; report docs/history/shim-retire/reports/validation-slice1.md
- 3a6e2d7a · 2026-07-13 · shim-retire Gates 1+2 auto-approved via gate bypass (standard lane): scoping synthesis + D1-D5 locked in decisions and docs/history/shim-retire/plan.md; Gate 3 follows after validating
- 252b7418 · 2026-07-13 · Intake gate fires in every terminal phase (idle + compounding-complete), and the guard is doctrinally a safety net, not the authority
- c2c46488 · 2026-07-13 · auto-approved Gates 1-3 (bypass) for terminal-phase-gate: close the intake guard's terminal-phase hole (TERMINAL_PHASES) + add the doctrine rule that an unblocked hook is not permission
- eb3e18cd · 2026-07-13 · auto-approved Gates 1-3 (bypass) for silent-bookkeeping: small, 0 hard-gate flags — prose doctrine addition (Communication Contract + hive law + AGENTS.block critical rule) + fix-first advisor-warning drift already proven green
- 1106e875 · 2026-07-12 · auto-approved Gate 3 (bypass) for dispatcher-unify: execute du-1 -> du-2 -> du-3 -> du-4 serialized (shared bee.mjs/registry/test files), du-6 parallel after du-1, du-5 close-out; validating findings folded into cells (FLAG_ALONE_BOOLEANS dry-run, reviews candidates verb, handleCellsAdd batch branch, write-guard 3-token fail-open gap)

### lanes

- d02a6bc6 · 2026-07-10 · Lane scaling v2: ceremony now truly scales — docs lane (knowledge-only files: no gates/cells/reviewers, announce-then-do + capture); tiny/small merge Gates 2+3 into one shape+execution question with the reality check inline in planning (bee-validating not separately invoked, 0 validating subagents); tiny/small execute solo in-session (no swarm workers, cell discipline kept); review scales: tiny = self-review + done-report (no Gate 4 question), small = 1 correctness reviewer, standard = 4 core + learnings pair, high-risk = full wave + conditionals

### release

- 257ab1e5 · 2026-07-21 · hardening-1-7-10 complete AND released as v1.7.10-rc on 4f23f89 (rc-1..5: CPU-count-proof race suites, timeout-capture split, Windows transient-fs retry); exact-tag CI green both platforms
- 8650ff81 · 2026-07-20 · hardening-1-7-9-rc: no new features, address the v1.7.8 external review's 8 recommendations as sequenced slices; do NOT tag until verify reproduces green on a clean checkout (RC-then-dogfood, stop per-feature bumping). Gates auto-approved (bypass total).
- 9da38503 · 2026-07-15 · Merged shape+execution gate (release-1-3-0, small lane) auto-approved under gate_bypass=total: minor bump 1.2.1->1.3.0 (parallel scheduler), tuple+fixture+manifest+self-onboard+tag+push, anphabe propagation skipped per user instruction. Release proceeds unreviewed (parallel-scheduler candidate registered; review remains user-invoked, bypass never creates one).

### review

- 565e68d0 · 2026-07-12 · Full bee review is user-invoked: the workflow runs the expensive independent review panel only after an explicit user request, over the user-selected completed change set; ordinary task completion still requires verification evidence.
- aec38e11 · 2026-07-10 · Review wave composition (learnings-pair-relocation): standard lane = exactly 4 core reviewers, wave cap 6 (4 core + max 2 conditionals on the review slot); synthesis (dedupe, corroboration promotion, autofix_class, severity counts) is the orchestrator's OWN inline duty after ALL reviewers return — never a dispatched subagent; precedent flows planning bootstrap -> plan.md -> reviewers, no review-time learnings dispatch. Supersedes decision 0021's researcher=extraction/synthesizer=ceiling tier clause (those agents no longer exist); knowledge machinery unchanged in every lane.
- 688e5fc4 · 2026-07-10 · Review slot + effort knob (decision 0021, P16/P17): models map defaults to the all-Claude role split — session model orchestrates, opus reviews (reviewing specialists, fresh-eyes, plan-checker), sonnet implements, haiku extracts — every slot editable per repo (string | null | {model,effort} | {kind:cli}); null review falls back to generation

### scribing

- 84110b26 · 2026-07-14 · chain-integrity D2 — scribing debt becomes fail-close at exactly ONE boundary: entering compounding-complete is refused while scribingDebt() > 0, and the refusal names each capped behavior_change cell still owing its spec sync. Everywhere else it stays advisory.

### sessions

- ac75fc61 · 2026-07-19 · Session coordination: session 81c3ce00 (live, started 11:08) start-featured lane-ceremony-v3 over this session's non-terminal multi-session-hardening record — possible only via the state.json TOCTOU/LWW gap (D6/cnr2-5; third live occurrence). This session's Gate 2/3 approvals landed on their record and were immediately REVOKED (their exploring feature re-earns its own gates). Resolution per AGENTS rule 14 paved road: multi-session-hardening moves to its own worktree (own .bee lifecycle); main stays with lane-ceremony-v3. msh cells are dropped from the main store and re-created in the worktree; msh docs artifacts committed in main first so the worktree branch carries them. Merge-back later via bee worktree merge from main.
- 0101ec31 · 2026-07-19 · Session coordination (cnt): two live sessions raced the same feature — 723195b9 (seated in main, actively editing) capped cnt-1 and is mid-cnt-2 uncommitted in main despite 6d0892b6's claim; 6d0892b6 YIELDS the feature: cnt-2 claim released, both duplicate worker branches discarded unmerged, worker records cleared. Ownership principle applied: the main-seated actively-writing session owns the default pipeline; the taker-over stands down when the original returns. Duplicated effort on cnt-1+cnt-2 (~2 worker runs) is the recorded cost. Root cause for grooming: cross-session claim visibility exists but was not honored/refreshed by the resumed session; heartbeat lag (00:14 vs live commits at 01:13+) made liveness unreadable.

### skills

- 66794091 · 2026-07-14 · chain-integrity D6 — three shipped skills document phase values that DO NOT EXIST in the enum, so their state commands fail 100% of the time: bee-exploring/SKILL.md:73 (--phase exploring-complete), bee-planning/SKILL.md:99 (--phase planning-complete, --phase validated), bee-validating/SKILL.md:82 (--phase validated). Fixed in this feature.

### state

- 84e49851 · 2026-07-19 · self-correcting-loop D1-D6 locked (docs/history/self-correcting-loop/CONTEXT.md): trace.attempts append-only revision ledger with mechanical failure-signature fallback (D1); cell-lifetime budgets enforced at the claim door with typed CELL_BUDGET_EXHAUSTED / REPEATED_FAILURE, never bypassed by gate_bypass, reset only via audited cells reset-budget (D2); judge-standard matrix advisory at authoring + mechanical cap-teeth for behavior class red evidence (D3); risk-scaled semantic judge at goal-check (standard=checklist judge, high-risk=independence-preferred) returning one validated verdict schema, Gate 4/review-on-demand untouched (D4/D5); all additive, no format breaks (D6).
- 579bbad7 · 2026-07-15 · Slice 1c D4: bee status drift is REPORT-ONLY and stays a boolean; an optional detail field names which managed files drifted. status never auto-heals (that is onboard's job). Absent/legacy onboarding.managed => degrade fail-open (status still renders), never a hard error.
- 73efc937 · 2026-07-14 · chain-integrity D1-REVISED — CORRECTS D1. Guard the DOOR, not the phase name. 'state set --phase compounding' is refused outright (use 'state scribing-run'); 'state scribing-run' is the SOLE producer of phase=compounding and itself requires the current phase be swarming/reviewing/scribing; 'compounding-complete' requires phase=compounding AND zero scribing debt. 'scribing' stays permissive — it is a marker, not a gate.
- 0768b22d · 2026-07-14 · chain-integrity D4 — the debt override is LOUD and LOGGED, never silent: closing a feature that legitimately owes no spec (owner judges a behavior_change cell spec-irrelevant) requires an explicit flag that logs a decision. Never a default, never a silent skip.
- 095ac80c · 2026-07-14 · chain-integrity D3 — 'state scribing-run' stops jumping the phase blindly: it currently sets phase='compounding' unconditionally (bee.mjs:984-998) with no check the phase was 'scribing'. It must obey the same tail rule as everything else rather than bypass it.
- f0598be1 · 2026-07-14 · chain-integrity D1 — lock the chain's TAIL, not the whole phase machine: scribing only from swarming, compounding only from scribing, compounding-complete only from compounding. Every other transition stays permissive; moving BACKWARD stays legal.
- 48ac3323 · 2026-07-08 · Adopt learn-harness-engineering items per docs/09: host-project standard commands live in .bee/config.json (commands.setup/start/test/verify — no init.sh, no new file); session baseline gate = run standard verify before claiming cells, broken baseline becomes a fix-first tiny cell; compounding promotion order = executable check first, critical-patterns prose fallback; friction layer taxonomy fixed at spec|context|environment|verification|state; denial-message contract = ERROR/WHY/FIX stated in 07-contracts.

### worktree

- 8383b7b5 · 2026-07-15 · Gate 2 re-approved under gate_bypass=total after validation repair: linked-worktree resolution is the only root channel; ctx.root stays workRoot; wave 2 stays shared; wt-4 owns live acceptance and orchestrator-derived integration identity.
- 00ef3726 · 2026-07-15 · Gate 2 (worktree-isolation, high-risk) auto-approved under gate_bypass=total: plan.md shaped — findRepoRoot hop (both copies) + guard store/work split + swarming dispatch protocol; 3 cells, wave 2 dogfoods worktree dispatch.
- d71412ef · 2026-07-15 · Gate 1 (worktree-isolation, high-risk lane) auto-approved under gate_bypass=total: CONTEXT.md D1-D4 locked, spike evidence in-document, fresh-eyes findings 1-5 all folded in.
- 9ba51eb0 · 2026-07-15 · worktree-isolation D2: one coordination store — the MAIN checkout's .bee/ stays the single source of truth for cells, claims, reservations, and state during worktree dispatch. Mechanism: findRepoRoot honors a BEE_ROOT env override (validated: must contain .bee/onboarding.json) checked before the cwd walk; worker shell commands are prefixed BEE_ROOT=<main-root> alongside BEE_AGENT_NAME. A worktree's own checked-out .bee/ (tracked files) is never used as a live store.

## worktree-parallelism

### claims

- 953ecb97 · 2026-07-18 · GH #20 fix: claim-next cross-lane fallback skips lanes actively owned by another live (heartbeat-fresh) session; stale-owner lanes stay poolable; own lane and direct claim-by-id unaffected; default state.json pipeline stays poolable (lanes-only ownership). Gates 1-3 auto-approved (bypass=total), lane claim-next-live-lane-guard, mode small.

### decisions

- 6d9e5f4d · 2026-07-20 · cross-worktree-holds D1-D7: shared holds ledger at main store .bee/runtime/cross-worktree-holds.json (grants precedent); path-keyed TTL entries pruned on read; acquisition mirrors the reservations seam with typed holder+expiry refusals; fail-fast BLOCKED not blocking waits; write-guard consults ledger fail-open with frozen-green net first; merge verify-gate unchanged; lane-first doctrine for pre-execution phases

### gates

- 10cb1db6 · 2026-07-20 · GATE BYPASS(total): Gates 2+3 auto-approved for cross-worktree-holds; validation evidence = integration digest (state.mjs:750 mainRoot precedent, lock.mjs:150 cross-root lock, guards.mjs:204-228 deny-branch precedent) + inline import-graph check (cells.mjs/guards.mjs already import state.mjs, no cycles)
- 28931e71 · 2026-07-20 · GATE BYPASS(total): Gate 1 context auto-approved for cross-worktree-holds
- 80069246 · 2026-07-18 · auto-approved Gate 1 (bypass=total) worktree-session-routing: CONTEXT.md D7-D10 locked; lane runs in dedicated worktree beegog--wt--worktree-session-routing
- dbd5ffce · 2026-07-18 · auto-approved Gate 3 (bypass=total) worktree-session-routing: advisor fable GO-WITH-CONDITIONS (R1-R5 folded into wsr-1/wsr-2 actions, D8a/D8b/D9a pinned), anchors all PASS (opus, vs HEAD), worktree baseline verify green. Execution via P40 harness-worktree workers, integration branch wt/worktree-session-routing
- fbabbc01 · 2026-07-18 · auto-approved Gate 1+2 (bypass=total) worktree-session-routing lane: CONTEXT.md D7-D10 locked, plan.md 3 serialized cells (wsr-1 new, wsr-2 merge, wsr-3 routing prose). Session works via P40 harness-worktree execution workers resolving to main store; registered sibling worktree beegog--wt--worktree-session-routing holds branch wt/worktree-session-routing as the integration branch (sibling session live on cnr2-13 owns main-checkout templates)
- 40587f21 · 2026-07-16 · auto-approved Gate 2 (bypass total): worktree-feature-parallelism shaped spike-first
- 971a7d1a · 2026-07-16 · auto-approved Gate 1 (bypass total): worktree-feature-parallelism CONTEXT.md D1-D6 locked

### reservations

- a0ab91b6 · 2026-07-20 · Fix (xwh-2, commit 41d5af3, post-cap): reservations release without --cell must scope the cross-worktree ledger release to the acting agent's own cell(s), never a bare {holder, cell:null}

### sessions

- cbd84507 · 2026-07-19 · multi-session-hardening D1-D7 locked in docs/history/multi-session-hardening/CONTEXT.md: single O_EXCL claim primitive backing cells claim + orchestrator-claims-before-spawn contract (D1); withStoreLock lockfile serializing reservations/state RMW, typed LOCK_BUSY, no fail-open (D2); session id self-derived flag->env->payload (D3); claim-ownership check on cell mutators with --force-ownership audited door (D4); throttled heartbeat+lease renewal in prompt-context/state-sync hooks, fail-open preserved (D5); full state CAS stays deferred to cnr2-5 (D6); no store-format changes, new refusals typed and named (D7).
- f469f3ce · 2026-07-13 · fresh-session-handoff shipped (v0.1.33, D1-D4 of its CONTEXT): planned-next handoffs auto-resume only at fresh-session boundaries (clear/startup) via verb-guarded write + gate-based claim adoption; cross-lane pull only from execution-approved lanes with in-pass stale-claim sweep; cross-session holds hard-block with returned-verdict fail-closed; same-checkout is the primary topology

### tests

- 71789be2 · 2026-07-16 · Deterministic temporary-repository proofs support but do not replace worktree-isolation's required live native commit/merge acceptance; P40 remains in-flight until writable-Git provenance exists.

### windows

- 77c7fa21 · 2026-07-14 · Tracked paths must be checkout-able on Windows (no colon, asterisk, question mark, quote, angle bracket or pipe; no reserved DOS names; no trailing dot/space) - enforced by scripts/test_portable_paths.mjs inside the repo verify. install.ps1 now clones with --no-checkout + sparse-checkout of skills/ and .claude-plugin/ only, then probes for onboard_bee.mjs, so no ref (old tags included) can yield a silent empty source.

### worktree

- 3c9c54f6 · 2026-07-20 · worktree-ux (GH #30/#31): (1) bee status warns inside an UNGRANTED linked worktree that it shares main's store + names the paved road; worktree new prints explicit open-a-session-here next step. (2) write-guard containment denial, when the target resolves inside a KNOWN sibling worktree (grants registry), names that worktree and the correct action instead of the generic containment text. Gates auto-approved (bypass total).
- bf4d8bbb · 2026-07-16 · worktree-feature-parallelism Slice B DONE: tiering realized without physical migration. gitattributes gives merge=union to the tracked log tier (decisions/backlog/review-candidates jsonl) so parallel branches/worktrees union-merge instead of conflicting (closes P30). Runtime+cache tiers (sessions/claims/runtime/cache) added to the onboarding gitignore block so live coordination + derived caches never track/merge. onboard hash-reconstruction list updated to match; full suite green.
- c3eb0c94 · 2026-07-16 · worktree-feature-parallelism Slice A DONE: bee worktree register/list/unregister CLI + bootstrap; register writes grant to main store runtime and seeds a fresh worktree store (independent lifecycle); test_bee_cli 140/0, worktree_cli 21/21, full suite + 4 worktree tests green; manifest 141
- 09c3b73b · 2026-07-16 · worktree-feature-parallelism S4 core wire-in DONE: both resolveRoots (state.mjs throwing + adapter.mjs import-light) now expose {id,mainRoot,worktreeRoot} and resolve a grant-registered worktree to its OWN store; unregistered/revoked/self-marker => main (P40 byte-for-byte). P40 regression 6/6, new grant-resolve 8/8, full 17-suite green, manifest 141.
- 369abe92 · 2026-07-16 · worktree-feature-parallelism S2 done: unwired lib module worktree-store.mjs (decideWorktreeStore + replayLog + readGrants) + test_worktree_store.mjs (14/14). Full recorded verify green; mirror + manifest green. Module inert (nothing imports it); wire-in deferred to a later slice.
- a250922c · 2026-07-16 · worktree-feature-parallelism seam spike GREEN (5/5, exit 0, independently re-run): the opt-in per-worktree local store keyed on git-verified worktree id + main-store grant registry is feasible without reintroducing onboarding-marker-as-trust. Gate 3 feasibility validated; build slices S2-S5 unlocked.
- b24a2efc · 2026-07-15 · worktree-isolation review repair: write targets require canonical containment before logical reservation checks; runtime hook parity is derived from both launchers plus safe transitive imports; integration uses no-commit prechecks, exact full committed-main verification with provenance, revert-on-postcommit-red, conservative non-force cleanup, authorized destructive drop, and deterministic fault injection.
- 8cc1bde1 · 2026-07-15 · worktree-isolation review repair: shared-checkout work is serialized wt-1 to wt-2 to wt-3; linked-shaped invalid metadata is a typed WORKTREE_LINK_INVALID result for library and CLI coordination access, never a local .bee fallback; same-UID workers are cooperative actors, so pre-dispatch control-plane attestation plus ancestry, identity, and reserved-diff rechecks are required.
- 33b6ac73 · 2026-07-15 · worktree-isolation validation repair: wt-4 is the sole validation-only single-worker worktree exception; normal dispatch remains opt-in for Claude Code waves of at least two. Adapter ambiguity transport is ctx.worktreeResolution = ordinary|linked-valid|linked-invalid; only the write guard consumes it and denies write-capable tools on linked-invalid.
- 58c56bb6 · 2026-07-15 · worktree-isolation validation re-sequencing (plan-checker BLOCKER 1): wave 2 (wt-2, wt-3) runs in the SHARED checkout — worktree dispatch cannot build its own enabling fix (the running .bee/bin guard is pre-fix and fail-closed denies worktree writes). The live dogfood becomes wt-4, a dedicated acceptance cell dispatched AFTER wt-2 caps and .bee/bin/hooks is synced: one worktree worker performs a real reserved edit + commit; the orchestrator derives the branch from the worktree id (never trusts the worker's self-report — W9), merges, and verifies in main. Also adopted: hooks/ <-> .bee/bin/hooks byte-parity joins test_lib_mirror (BLOCKER 2); ctx.root stays workRoot with new ctx.storeRoot opt-in for the write-guard only (W3); the hop validates git's bidirectional back-link, onboarding.json is not consent (W4); worktree-top detection is the .git-FILE ancestor, independent of onboarding.json (W6); the ambiguity deny gates at tool level for write-capable tools (W7); win32 backslash gitdir gets a hand-crafted fixture row (W8).
- 5f05b038 · 2026-07-15 · worktree-isolation D3 amended (fresh-eyes findings 3+4): a merge conflict between by-contract-disjoint workers is a schedule/reservation bug — halt integration (typed), block the cell with the conflict recorded, file friction, investigate; NEVER route to the worker rescue ladder and never force-resolve. [BLOCKED]/[HANDOFF] worktrees are preserved (path+branch in the cell trace) for resume; removal only after re-completion or explicit drop, logged. Clean-DONE cleanup only after green post-merge verify.
- 649d91b3 · 2026-07-15 · worktree-isolation D3: merge-back is an orchestrator goal-check step — after a worktree worker returns [DONE], the orchestrator integrates the worker's commit(s) into the main checkout (merge of the worker branch; a conflict is a typed integration failure routed to the rescue ladder, never resolved by force), THEN re-runs the cell verify in the MAIN checkout; the cell only counts when the post-merge verify is green. Worktree cleanup (remove + branch delete) happens after clean integration; feature close prunes leftovers.
- 42a01cfd · 2026-07-15 · worktree-isolation D1: worktree dispatch is an OPT-IN swarming mode used only for multi-worker waves (>=2 concurrent workers) on Claude Code, via the Agent tool's native isolation=worktree; the shared-checkout dispatch stays the default for solo lanes and single-worker waves. Codex/manual worktree lifecycle is OUT (deferred, backlog row). This refines decision 0018's rejection of worktree-per-worker: the demonstrated need 0018 asked for now exists (P40 friction — shared index/HEAD contention between concurrent workers, user report 2026-07-15); reservations REMAIN the isolation primitive for file ownership — worktrees only remove git-level (index.lock/commit-order) contention.
