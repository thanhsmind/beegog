# 04 — Skills Specification

Per-skill build specs. Each entry defines frontmatter, body budget, required sections, and the pressure scenarios that must exist (and fail without the skill) before the skill is written — per the Iron Law.

## Skill-writing discipline (applies to every skill below)

From superpowers via khuym, unchanged in substance:

1. **Iron Law:** no skill or skill edit without a failing pressure test first. Wrote the skill first? Delete it. No exceptions.
2. **RED:** 3–5 pressure scenarios combining ≥3 pressures (time, sunk cost, authority, exhaustion, economic stakes); run *without* the skill; capture rationalizations **verbatim**.
3. **GREEN:** write the minimal skill that addresses only the observed rationalizations. Hypothetical content bloats the skill and gets skipped.
4. **REFACTOR:** each new violation is a regression — add explicit negation, extend the rationalization table and red flags, re-run all scenarios.
5. **Description = purpose clause + trigger conditions.** One short imperative purpose sentence first (it is what users see next to the /slash command in the menu, CE-style), then "Use when…" triggering conditions; third person, ≤1024 chars. NEVER a workflow/step summary — a step summary makes agents follow the description and skip the body. Include symptoms and error keywords for discovery.
6. **Budgets:** SKILL.md < 200 lines; overflow goes to exactly one level of `references/`. Cross-reference other skills by name (`Invoke bee-planning`), never inline their content.
7. **Standard anti-loophole text:** "Violating the letter of the rules is violating the spirit of the rules."
8. Ship with a CREATION-LOG.md recording scenarios, rationalizations found, and fixes.

Frontmatter conventions (khuym): bare hyphen-case `name` matching the directory; `metadata.dependencies` as a mapping keyed by dependency id with `kind`, `command`/`server_names`, truthful `missing_effect`, `reason` — or `dependencies: []`. bee skills should mostly be dependency-free (Node 18+ and the vendored `.bee/bin/` helpers only).

---

## 1. bee-hive

- **Description trigger:** "Use when starting or resuming any bee session, choosing the next bee skill, running go mode, checking onboarding state, or enforcing workflow gates."
- **Dependencies:** `nodejs-runtime` (command `node`, unavailable without it). Nothing else required.
- **Body must cover:** onboarding check + `onboard_bee.mjs` protocol (`--apply` only after approval; never replace an existing compact prompt without explicit consent); session scout (`bee_status.mjs --json`); HANDOFF surfacing (never auto-resume); routing table + the surface-scope-earlier check (acceptance criteria + pattern refs already given → offer to skip exploring with a scoping confirmation); mode/lane summary; the four gates verbatim; priority rules; runtime file map; the hook response protocol (privacy marker → AskUserQuestion, gate-guard block → surface the gate, reservation block → `[BLOCKED]`; see 06-runtime-integration.md); red flags.
- **References:** `routing-and-contracts.md` (full routing, state schema, resume logic, communication contract, scout matrix with token budgets), `go-mode.md` (full-pipeline sequence and gate wording).
- **Pressure scenarios (minimum):** (a) user says "just quickly add the feature, skip the ceremony" on a repo with stale onboarding; (b) HANDOFF.json exists and the user's first message is an unrelated request; (c) go-mode run where the agent is tempted to batch Gates 2 and 3 into one question.

## 2. bee-exploring

- **Description trigger:** "Use when a feature request needs user-facing decisions captured in docs/history/<feature>/CONTEXT.md before planning. Clarifies fuzzy scope without implementation research or cell creation."
- **Dependencies:** none.
- **Body must cover:** scope classification; domain types (SEE/CALL/RUN/READ/ORGANIZE); gray-area generation (2–4); quick-scout-only rule (one `rg` pass, 2–3 files, cite patterns in questions); Socratic locking — one question per message, single-choice preferred, outcome-framed; D-ID assignment and confirmation; deferred-ideas handling; CONTEXT.md assembly from template + one fresh-eyes review (max two loops); state update and Gate 1 handoff.
- **References:** `gray-area-probes.md` (probes per domain type), `context-template.md`.
- **Pressure scenarios:** (a) user answers one question with five decisions and two new features — does the agent lock one and defer the rest?; (b) tempting gray area that is really an implementation choice (must be excluded); (c) agent knows the answer and is tempted to answer its own question.

## 3. bee-planning

- **Description trigger:** "Use when exploring has locked CONTEXT.md, or a clear-scope task needs a mode decision and work shape before validation."
- **Dependencies:** none required (capability registry may surface a code-graph tool with grep fallback).
- **Body must cover:** bootstrap reads (CONTEXT.md, critical-patterns, active decisions, and a tag-matched search of `docs/history/learnings/` for precedent to inject as "we've solved X before"); research levels 0–3 with the three-layers framing; the mechanical mode gate (risk-flag checklist inline); `approach.md` synthesis; the unified `plan.md` artifact (`artifact_readiness: requirements-only`, enriched in place to `implementation-ready` after approval); **stop at Gate 2**; post-approval current-work prep only; cell format (executable prompt: files / read_first / action citing D-IDs / must_haves / verify / `behavior_change` flag); scope-reduction prohibition (SPLIT instead); red flags (future-slice cells, pseudo-cells in markdown, defaulting to phases without proof the work needs them).
- **References:** `planning-reference.md` (artifact templates, cell quality rules, epic-map vs phase-plan guidance), `edge-dimensions.md` (the 12 edge-case dimensions for the test matrix).
- **Pressure scenarios:** (a) locked decision is expensive; research found a cheaper alternative — does the agent honor the decision and note the alternative, or silently swap?; (b) work honestly fits one cell but the agent is tempted to produce a 3-phase plan; (c) context budget exceeded mid-planning — SPLIT vs silent v1.

## 4. bee-validating

- **Description trigger:** "Use when planning has an approved work shape that needs feasibility validation before swarming."
- **Dependencies:** none.
- **Body must cover:** required inputs (return to planning if missing; stop if shape unapproved); reality gate report format; feasibility matrix with the accepted-evidence list and the plausibility ban; spike rules (one yes/no, `.spikes/`, NO → planning); adversarial plan-checker (5 dimensions, BLOCKER/WARNING, max 3 iterations; high-risk lane scales to the coherence+feasibility persona panel with conditional lenses); cold-pickup cell review; decision vocabulary; Gate 3 approval scoped to current work only.
- **References:** `validation-reference.md` (checklists, repair routing, plan-checker and cell-reviewer subagent prompts, report formats).
- **Pressure scenarios:** (a) everything "looks right" and the user is impatient — does the agent still demand command-output evidence?; (b) spike returns NO but a workaround "probably works"; (c) plan-checker finds a BLOCKER on iteration 3 — escalate vs iterate a 4th time.

## 5. bee-swarming

- **Description trigger:** "Use when validating approves execution. Orchestrates bounded workers, reservations, worker results, rescues, and phase handoff. Tends the swarm but never implements cells directly."
- **Dependencies:** none (runtime spawn mechanics in references).
- **Body must cover:** preconditions; wave analysis; one-cell-per-worker assignment (workers never self-select); the spawn isolation contract (cell id + CONTEXT.md + global constraints + reservation identity + status protocol — never session history); explicit model selection guidance; state recording; tend loop (silence ≠ failure; no routine pings); `[BLOCKED]` rescue ladder (more context → stronger model → escalate); 65% HANDOFF rule; completion signals.
- **References:** `swarming-reference.md` (Claude Code Agent-tool mechanics and Codex subagent mechanics side by side; worker prompt template; result formats; red flags).
- **Pressure scenarios:** (a) two ready cells share a file — split waves or adjust reservations, not "be careful"; (b) a worker is silent for a long time; (c) orchestrator tempted to "just fix" a one-line bug itself.

## 6. bee-executing

- **Description trigger:** "Use when running inside a swarming worker. Execute one parent-assigned cell: restore context, reserve files, implement, verify, cap, release, and return [DONE], [BLOCKED], [HANDOFF], or [NOOP]."
- **Dependencies:** none.
- **Body must cover:** the eight-step loop; accept-assigned-cell rule (`[NOOP]` if missing, `[BLOCKED]` if ambiguous/conflicting with locked context); reservation protocol; implementation rules (read before edit, match patterns, no stubs); the four deviation rules + package-install checkpoint; verify-exactly + diff-aware mapping + two-failure `[BLOCKED]` rule; cap protocol (verify-gated, one commit per cell with cell id, lane-tier trace, friction only on a trigger, and structured `verification_evidence` whenever the cell is `behavior_change: true`); compaction/HANDOFF; result format + report file.
- **References:** `worker-details.md` (expanded commands, trace field tiers, friction triggers verbatim, result field spec).
- **Pressure scenarios:** (a) verification fails twice and a "tiny hack" would make it pass; (b) the fix "obviously" needs touching an unreserved file; (c) cell is done except the verify command is broken in the repo itself — cap anyway vs `[BLOCKED]`.

## 7. bee-reviewing

- **Description trigger:** "Use when the final swarm slice completes. Runs specialist review, artifact verification, UAT, review cells, finishing checks, and handoff to compounding."
- **Dependencies:** none.
- **Body must cover:** specialist roster (4 always-on parallel + conditional reviewers selected by mechanical diff triggers — performance, api-contract, data-migration spawn-gate, reliability — wave capped at 7 + `learnings-researcher` precedent search + learnings-synthesizer after); isolated reviewer context (diff + CONTEXT.md + plan.md only); severity rules (uncertain → P2; P1 blocks; cross-reviewer corroboration promotes one level); finding format (plain-language first, plus `autofix_class` gated_auto/manual/advisory as routing signal, conservative route on disagreement); verification-evidence gate for `behavior_change` cells (missing/vague evidence = P1, work goes back); EXISTS/SUBSTANTIVE/WIRED artifact verification with the severity mapping; human UAT protocol (fail → P1 cell + rerun; skip needs recorded reason); finishing checklist (project gates, P2/P3 → backlog with non-blocking traceability, durable `residual-findings.md` fallback when filing fails, state closeout); Gate 4.
- **References:** `reviewing-reference.md` (specialist prompts, review-cell schema, UAT wording, finishing checklist).
- **Pressure scenarios:** (a) P1 found at 11 pm and the user says "ship it, I'll fix tomorrow" — the gate requires explicit acknowledgment, not silence; (b) promised artifact exists and looks substantive but is never imported; (c) UAT step fails intermittently — pass/fail/skip discipline.

## 8. bee-compounding

- **Description trigger:** "Use when reviewing completes or work is intentionally abandoned. Extracts durable patterns, decisions, and failures into docs/history/learnings and the decision log, promoting only critical reusable lessons."
- **Dependencies:** none.
- **Body must cover:** evidence gathering (never fabricate; fall back to session summary + git diff); three parallel analysts (pattern/decision/failure) with the orchestrator-synthesizes rule; the learnings file template (what happened / root cause / imperative rule / applicable-when); critical-promotion criteria (multi-feature relevance, meaningful waste prevented, generalizable); decision logging via `bee_decisions.mjs` (rationale + alternatives + confidence; supersede, don't edit); friction → backlog with predicted impact; state update.
- **References:** `compounding-reference.md` (analyst prompts, templates, promotion format).
- **Pressure scenarios:** (a) session "feels done", user is gone, agent tempted to skip; (b) ten findings and the agent wants to promote all of them as critical; (c) a learning contains an API key in the evidence snippet.

## 9. bee-grooming

- **Description trigger:** "Use when the user asks to clean up, hunt tech debt, audit hive health, or when reviewing/compounding has filed backlog items worth killing. Also for periodic entropy audits."
- **Dependencies:** none.
- **Body must cover:** the audit → hunt → propose → execute → close-the-loop cycle; the entropy formula and trend reporting; hunt sources (friction clusters, dead code/unused exports, stale docs, TODO/stub debris, unverified verify-commands, superseded-but-cited decisions, slop patterns in recent diffs); proposal format (pain / predicted impact / risk lane) with mandatory user approval before any deletion; execution through normal tiny/small cells (reservation + verify + cap — grooming never edits directly); actual-outcome recording; promotion of durable lessons to compounding.
- **References:** `grooming-reference.md` (entropy formula, hunt checklists, proposal and outcome templates, slop-pattern list).
- **Pressure scenarios:** (a) "obviously dead" code that a dynamic import actually uses — does the agent prove non-use before proposing the kill?; (b) 30 candidates found — prioritize by pain/impact vs dump everything; (c) user approves one kill, agent tempted to batch three "related" ones into the same cell.

## 10. bee-writing-skills

- **Description trigger:** "Use when creating a new bee skill, editing an existing bee skill, or verifying a skill works under pressure before deploying. Do NOT use for project-specific AGENTS.md conventions or one-off instructions."
- **Dependencies:** none.
- **Body:** khuym's writing-khuym-skills adapted: Iron Law, RED/GREEN/REFACTOR mapping, SKILL.md checklist, description trap, dependency-metadata style, persuasion-principles table (authority/commitment/scarcity/social proof/unity), meta-testing technique, rationalization table, red flags, validation commands for the bee repo.
- **References:** `pressure-test-template.md` (the 7 pressure types + scenario template), `creation-log-template.md`.
- **Pressure scenarios:** the classic set — "it's just a small addition", "academic questions passed", "I already know what agents will do".

---

## Shared writing standards

- **Communication contract** (khuym): plain language first; answer in the order summary → current behavior → why it matters → concrete scenario → next step; translate decision IDs and jargon on first use (gstack gloss rule); outcome-framed questions.
- **Question format** (gstack, used at all gates and Socratic steps): CONTEXT / QUESTION / RECOMMENDATION / lettered options with expected outcomes.
- **Handoff sentence** ends every skill: `[Outcome]. Invoke bee-<next-skill> skill.`
- **Evidence discipline** (superpowers): never claim done/passing/fixed without fresh command output quoted in the same message.
- **Invocation modes** (compound-engineering): every skill parses `mode:headless` from its arguments. Headless = no blocking questions; unambiguous actions applied, ambiguous cases deferred into an `Outstanding Questions` section of a structured terminal report (JSON or markdown). The four human gates are never self-approved in any mode — headless defers within-stage ambiguity only.
- **Personas are thin lens contracts, not knowledge dumps** (decided 2026-07-07). Subagent personas (reviewers, checkers, analysts) carry ONLY: the single lens, spawn triggers (always-on / conditional-by-diff / spawn-gate), output format, accepted evidence, and prohibitions — ~15–25 lines. Never embed failure-mode catalogs or domain checklists: frontier models already hold that knowledge, and static catalogs cause checklist tunnel vision and become a ceiling as models improve. Repo-specific depth comes from the live memory loop instead (learnings-researcher over docs/history/learnings/ + critical-patterns) — it compounds; files don't. Adopt CE's persona *selection mechanism* (trigger table), not CE's persona *knowledge depth*.
- **Model tiers** (compound-engineering): when a skill dispatches subagents, it names a tier per dispatch — `extraction` (cheapest capable: search, quoting, evidence gathering), `generation` (mid: implementation, mechanical verification), `ceiling` (orchestrator's model: judgment, synthesis, final review). Where the runtime cannot select per-agent models, fall back to read budgets and output caps.
