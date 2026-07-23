# Backlog Auto-Triage Pipeline Split — Context

**Feature slug:** backlog-auto-triage
**Date:** 2026-07-23
**Exploring session:** complete (decisions imported verbatim from the `herdr-gateway--wt--backlog-auto-triage` exploring session — see Canonical References; not re-derived)
**Scope:** Standard
**Domain types:** ORGANIZE

## Feature Boundary

Split today's `bee-exploring` into three cooperating bee-skill stages — an automatic
triage stage, a shared CONTEXT.md-writing stage, and a narrowed human-interactive
exploring stage — so a clear backlog item can flow unattended from submission to
"ready for pickup" while an ambiguous item is parked with a gathered brief instead
of blocking on a synchronous human question. This feature locks the architecture
and behavior; skill names are already locked (D11); implementation happens in this
repo (`beegog`, bee's real source tree) under `skills/`.

## Locked Decisions

Imported verbatim from the source-of-truth exploring session (see Canonical
References). Fixed. Planning must implement them exactly — cited, never
reinterpreted.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Split `bee-exploring` into three stages: (1) an automatic triage stage that runs the moment a backlog item exists, no human involved; (2) a shared CONTEXT.md-writing stage used by both the auto path and the human path; (3) a narrowed `bee-exploring` that only runs when a human explicitly picks up a parked item. | Today `bee-exploring` is the only entry point and always blocks on Socratic questions for ambiguous items — this stops any pipeline (herdr-orchestrating's dispatch loop, or any future orchestrator) from running unattended. |
| D2 | The triage stage first does a real gather step (reads the backlog row plus related code/docs/specs) before assessing anything — never assesses from the raw backlog text alone. | Matches exploring's existing "quick scout" discipline; a decision made without gathering evidence first is not trustworthy. |
| D3 | Clarity/size assessment in triage is an LLM self-assessment over the gathered evidence, explicitly NOT a keyword/regex classifier. | User rejected script-only classification, citing `herdr-orchestrating`'s `classify-lane.mjs` as the anti-pattern to avoid: it fails open on any row whose danger isn't spelled in its keyword list (proven live against both an English and a Vietnamese unsafe row in that feature's own validation). |
| D4 | Clear-item path: triage hands its locked decisions to the shared CONTEXT.md-writing stage, then auto-approves Gate 1, runs `bee-planning`, then auto-approves Gate 2, then marks the item ready/in-flight for an orchestrator to pick up — subject to D7's gate-bypass coupling (no synchronous human step only on lanes `gate_bypass_level` actually covers; otherwise this path still stops and asks, same as today). | Deliberate automation increase for the case triage judges genuinely unambiguous, bounded by D7 so this table can't be implemented divergently from it. |
| D5 | Ambiguous-item path: triage does NOT ask the human synchronously. It writes a brief (what was gathered, what's unclear) into the feature's own `docs/history/<slug>/` via the shared CONTEXT.md-writing stage (reusing CONTEXT.md's existing `Outstanding Questions` section rather than inventing a new brief file format), then stops — the item is "parked". | Reuses existing CONTEXT.md structure (YAGNI/DRY) instead of a second artifact format; headless-mode exploring already writes gray areas into `Outstanding Questions` instead of asking, so this path has direct precedent in the current skill. |
| D6 | Any item carrying a hard-gate risk flag (auth, authorization, data loss, audit/security, external provider, validation removal — same flag set as the mode-gate's risk-flag list) is always parked for a human, regardless of how confidently triage can self-assess it. | Mirrors the precedent this same user already set in `herdr-orchestrating`'s dispatch role (decision D6 of `agent-pane-orchestration`): "when unsure, refuse — refusal is the safe default," extended here to "hard-gate is never auto-cleared, full stop," so an unattended stage never silently walks past auth/data-loss/security work. |
| D7 | Triage's auto-approval of Gate 1 and Gate 2 on the clear-item path is coupled to the existing `gate_bypass_level` switch — it only auto-approves when the level covers that lane (matching the rest of the system), never as an independent bypass mechanism. When `gate_bypass_level` is `off`/`normal` on lanes it doesn't cover, triage's clear-item path still stops and asks at Gate 1/2 like today's `bee-exploring`/`bee-planning` do. | Explicit user answer to the one genuine open question: avoids a second, parallel safety-control source: turning the global bypass off must also stop triage's auto-approval, not leave a separate always-on channel. |
| D8 | The shared CONTEXT.md-writing stage is the single place that writes `docs/history/<feature>/CONTEXT.md`, regardless of whether the input decisions came from triage's self-assessment or from a human-resolved Socratic session. | Avoids two divergent implementations of "how CONTEXT.md gets written" (DRY) — explicit user requirement. |
| D9 | The narrowed `bee-exploring` (human path) loads the brief triage already gathered when a human picks up a parked item — it does not re-gather from scratch — then runs the interactive Socratic dialogue only over the still-unresolved gray areas, and hands the resolved decisions to the shared CONTEXT.md-writing stage. | Avoids redundant gather work; the brief is exactly the input exploring needs to resume. |
| D10 | The triage/shared-writer logic must live at the bee skill layer, tool-agnostic — never specific to `herdr-orchestrating`. Any orchestrator (herdr, or a future replacement) drives this only by invoking bee skills as sequential, non-overlapping stages. | Explicit user principle: "herdr là một tool orchestrating có thể được thay bởi tool khác, quan trọng là bee skill phải support cho dù dùng tool gì để orchestrate." `herdr-orchestrating`'s dispatch role becomes a caller of this pipeline, not its owner. |
| D11 | Final skill names: the automatic gather+judge stage (D1's stage 1) is **`bee-qualifying`**; the shared CONTEXT.md-writing stage (D1's stage 2) is **`bee-context-locking`**. Stage 3 keeps the existing name `bee-exploring`, narrowed per D1/D9. | User-run naming brainstorm, after CONTEXT.md D1-D10 were already locked. `bee-qualifying` was chosen because the stage does two things in one word — gathers/enriches evidence (D2) *and* judges go/no-go into the pipeline (D4/D5), the same dual sense as sales "lead qualification"; candidates rejected: `bee-triage`/`bee-context` (unsatisfying to user), `bee-clearing` (reads as delete/cleanup), `bee-screening`/`bee-assessing`/`bee-vetting`/`bee-triaging` (each captured only the judging half). `bee-context-locking` was chosen by the user directly, extending `bee-locking` (reuses `bee-exploring`'s own "Socratic Locking"/"Locked Decisions" vocabulary) with the object being locked, for symmetry with `bee-qualifying`. Naming avoided `gather`/`gathering` (collides with the `bee-gather` I/O-worker agent type) and `sizing`/`scoping`/`scouting` (collide with `bee-planning`'s mode-gate and `bee-exploring`'s own "Scope"/"quick scout" steps). |
| D12 | The trigger mechanism (what invokes `bee-qualifying` on a new backlog row, and when) is explicitly OUT OF SCOPE for this feature. `bee-qualifying` only defines correct behavior once invoked — orchestrator-agnostic per D10. Wiring an actual auto-trigger (extending a dispatch loop's Ready condition, a cron, or any other mechanism) is deferred to a future feature. | Investigation found the project's own orchestrator skill (`herdr-orchestrating`) has, in the meantime, been upstreamed and generalized into bee itself as `bee-herding` (with real safety redesigns: merge is no longer an auto-loop but an owner-invoked single-shot gesture; dispatch requires an explicit enable-marker interlock before it acts at all). Deciding whether to extend `herdr-orchestrating` or migrate to `bee-herding` is a separate decision the user explicitly deferred ("tạm thời không thay đổi herdr") — this feature must not assume either. |
| D13 | Backlog `Status` gains a 4th value: **`parked`** (extending `proposed → in-flight → done`). `bee-qualifying`'s park path (step 4b) sets a parked item's Status to `parked` via `bee-context-locking`, in the same commit as the brief. Any future dispatch-style Ready condition MUST exclude `parked` from auto-pickup — only a human explicitly invoking `bee-exploring` on a parked item may flip it forward (`parked → in-flight` once resolved), the same direction `bee-exploring` already flips `proposed → in-flight` (D11a). | Without a distinct status, a parked item revisited by any future auto-trigger would look identical to a never-touched `proposed` row once its worktree is cleaned up — re-triggering `bee-qualifying`, re-parking, forever, without ever surfacing to a human. Confirmed neither upstream `bee-herding` nor today's `herdr-orchestrating` has any equivalent 4th status — this is new, not a duplicate of anything upstream. |
| D14 | `bee-qualifying` always runs inside its own dedicated, isolated worktree — never directly against a shared/main checkout — for both the clear and park paths, since both write to files multiple concurrent items could touch (`CONTEXT.md`, `docs/backlog.md`). | Whatever mechanism eventually creates that worktree (per D12, deferred) is responsible for isolation; `bee-qualifying` itself only assumes it is already running inside one. Direct-to-main writes risk blocking every other worktree's merge (`WORKTREE_MERGE_MAIN_DIRTY`-style refusal) for the duration, and risk a real lost-update race if two qualifying runs land on the same shared file at once. |
| D15 | Any direct write to a shared checkout's `docs/backlog.md` (e.g. a human or session adding a raw backlog row outside any worktree) should be committed in the same turn it is written — never left lingering uncommitted. | Cheap (pure markdown, no build/test) relative to the cost of leaving main dirty: an uncommitted `docs/backlog.md` blocks every concurrent worktree's merge until committed or reverted. Scoped as general backlog-writing hygiene, not specific to `bee-qualifying`. |
| D16 | `bee-qualifying` never merges its own worktree back into main, on either the clear or park path. It only leaves the worktree in a mergeable state (clean tree, correct committed status/phase) for whatever merge mechanism eventually runs (per D12, deferred — human gesture or automated, undecided). | Matches upstream `bee-herding`'s hardening: merging into main is the one hard-to-reverse action in the whole pipeline, so no stage should assume it happens automatically or immediately after it finishes its own part. |
| D17 | Implementation happens in this repo (`beegog`, `/home/vantt/projects/research/beegog--wt--backlog-auto-triage`, worktree of the real bee source tree), under `skills/bee-qualifying/` and `skills/bee-context-locking/`, not as rendered copies in a host repo. Resolves the source CONTEXT.md's "Deferred To Planning" question #1. | This worktree was created for exactly this purpose (see Canonical References, Handoff doc) after the herdr-gateway session confirmed `beegog` is bee's real source tree and that repo's own `.claude/skills/bee-*` trees are gitignored rendered projections, not sources. |

### Agent's Discretion

D17 was locked by this session (not the source session) to resolve the source
CONTEXT.md's own "Deferred To Planning" question #1, using evidence already in
the handoff doc and this worktree's own existence — not re-litigated with the
user, since the handoff doc already carries the answer as settled fact ("must be
authored here, under `skills/`, not as rendered copies in any host repo").

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| `bee-qualifying` | The new automatic stage (D11) that gathers evidence for a backlog item and self-assesses whether it can proceed unattended or must be parked. |
| `bee-context-locking` | The new shared stage (D11) that writes `docs/history/<feature>/CONTEXT.md` from either path's resolved decisions. |
| Parked | An item triage judged too ambiguous/large to auto-resolve: its brief is written, and it waits for a human to pick it up — not blocking, not retried automatically. |
| Ready / in-flight | The state a clear item reaches after triage's auto path completes planning and both gates auto-approve — the same state an orchestrator's dispatch logic (e.g. `herdr-orchestrating`'s D1 dispatchability check) already looks for today. |

## Specific Ideas And References

- User's own prior design in `herdr-orchestrating`'s dispatch role §6 (Lane-safety filter, D6 of `agent-pane-orchestration`): a two-key gate (script classifier + the agent's own reading) that refuses on any doubt. Cited directly as the precedent behind D6 above and as the anti-pattern behind D3 (script-only classification is explicitly rejected as the *sole* signal, even though the two-key idea of "never trust a keyword list alone" carries over).

## Existing Code Context

From the quick scout (source session) plus this session's own read of this repo's
current `bee-exploring`. Downstream agents read these before planning.

### Reusable Assets

- `skills/bee-exploring/references/context-template.md` (this repo) — the exact CONTEXT.md template the shared writing stage (D8) must keep producing; both the auto and human paths write through this same shape.
- `skills/bee-exploring/SKILL.md` step 5 ("Context Assembly"), this repo — today's only implementation of CONTEXT.md-writing; this is the logic D8's shared stage extracts out.
- `skills/bee-exploring/SKILL.md` step 0 ("Enter the feature atomically"), this repo — the atomic `state start-feature` pattern `bee-qualifying` must mirror when it starts a feature from `idle` (per the handoff doc's fix #2).
- `skills/bee-exploring/SKILL.md` Headless section, this repo — already writes gray areas into `Outstanding Questions` instead of asking; direct precedent for D5's park-with-brief behavior.
- `skills/bee-briefing/` (this repo) — precedent for "a skill that renders one artifact for multiple callers, never originates content," the shape `bee-context-locking` (slice 2) must follow.
- `docs/backlog.md` (host repos) — the PBI table triage watches for new/`proposed` rows and flips per the existing `D11a` "backlog flip" convention (`bee-exploring/SKILL.md` step 1).
- `/home/vantt/projects/herdr-gateway--wt--backlog-auto-triage/.claude/skills/bee-qualifying/SKILL.md` — slice 1's finished, pressure-tested draft (139 lines), to be ported here with the 2 fixes named in the Handoff Note below.
- `/home/vantt/projects/herdr-gateway--wt--backlog-auto-triage/docs/history/backlog-auto-triage/reports/bee-qualifying-red.md` — slice 1's RED-phase + GREEN re-test evidence (4 mandatory scenarios, 4/4 pass), read before treating the ported skill as validated.

### Established Patterns

- Gate-bypass information-vs-approval split (`bee-exploring/SKILL.md` step 4, this repo) — the pattern the new triage stage's Gate 1/2 auto-approval (D7) plugs into.
- `bee.mjs state gate --name <gate> --approved true` + `decisions log` — the existing CLI-driven mechanism today's bypass-driven auto-approval already uses; D7's coupling means triage reuses this unchanged, not a new mechanism.
- `bee-writing-skills`' Iron Law (RED before GREEN, no exceptions) — this repo dogfoods bee on itself; slice 1 already followed it once (evidence above), slices 2/3 need their own RED/GREEN/REFACTOR/VALIDATE cycles.

### Integration Points

- `.bee/bin/bee.mjs` (`worktree`, `cells`, `decisions`, `state gate`/`state start-feature` verbs) — triage's clear-item path (D4) drives the same CLI surface `bee-exploring`/`bee-planning` already drive.
- `docs/backlog.md` Status column (`proposed`/`in-flight`/`done`, gaining `parked` per D13) — triage's clear path and park path both need to read/write this same table today's exploring already flips (D11a).
- `skills/bee-hive/SKILL.md` routing table (this repo) — slice 3 wires a new routing row so an unclassified/new request routes through `bee-qualifying` first (deferred to slice 3's own planning; not built yet).

## Canonical References

- Handoff doc (source of truth for this session's task list): `/home/vantt/projects/herdr-gateway--wt--backlog-auto-triage/docs/history/backlog-auto-triage/HANDOFF-to-beegog-session.md`.
- Source-of-truth locked decisions D1-D16 (imported verbatim above): `/home/vantt/projects/herdr-gateway--wt--backlog-auto-triage/docs/history/backlog-auto-triage/CONTEXT.md`.
- Upstream `bee-herding` (`skills/bee-herding/SKILL.md`, this repo) — the generalized, now-canonical successor to this project's own `herdr-orchestrating`. Informed D12/D16; adopting it is explicitly out of this feature's scope (D12).

## Outstanding Questions

### Resolve Before Planning

None. All decisions from the source session are locked (D1-D16); this session
locked D17 to resolve the source doc's only remaining planning-blocking question
under Agent's Discretion above.

### Deferred To Planning

- [ ] Exact gather-step scope for `bee-qualifying` (which files/how much to read before self-assessing) — implementation detail, not a product decision; slice 1's already-built draft (Existing Code Context) is the starting answer to validate against.
- [ ] Exact brief format inside CONTEXT.md's `Outstanding Questions` section for a parked item vs. a normal in-progress one — needs to stay distinguishable to whichever process later resumes it; slice 1's draft should already answer this — verify during port.
- [ ] Slice 2 (`bee-context-locking`) exact extraction boundary from `bee-exploring` step 5 — planning's job when that slice starts.
- [ ] Slice 3 (`bee-exploring` narrowing + `bee-hive` routing wiring) exact scope — planning's job when that slice starts.

## Deferred Ideas

- None captured this session — this feature is itself the deferred-idea follow-through from the `agent-pane-orchestration`/`herdr-orchestrating` work; no further spin-off ideas surfaced during the source session's locking.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.

Three slices, in order:

1. **Slice 1 (this session's first job):** port `/home/vantt/projects/herdr-gateway--wt--backlog-auto-triage/.claude/skills/bee-qualifying/SKILL.md` into `skills/bee-qualifying/SKILL.md` here, with 2 fixes: (a) add the missing `Status: parked` write (D13) to the park branch, via `bee-context-locking`, same commit as the brief; (b) replace hand-written `state set --owner exploring` feature entry with the atomic `bee.mjs state start-feature` pattern (mirror current `bee-exploring` step 0, this repo). Then render `.claude/skills/bee-qualifying/` / `.agents/skills/bee-qualifying/` via this repo's normal render step.
2. **Slice 2 (not started):** build `bee-context-locking` — factor the `Context Assembly` logic out of `bee-exploring` step 5 into its own callable skill, precedent `bee-briefing`.
3. **Slice 3 (not started):** narrow `bee-exploring` to only run on a human-picked parked item (loads the brief instead of re-gathering, D9) + wire `bee-hive`'s routing table so a new/unclassified request routes through `bee-qualifying` first.

Each slice follows `bee-writing-skills`' Iron Law (RED before GREEN) independently.
