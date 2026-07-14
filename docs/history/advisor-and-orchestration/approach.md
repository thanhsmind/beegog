# advisor-and-orchestration — Approach

High-risk lane earns this file (decision 0009 fan-out table). Read `plan.md` for slices, `CONTEXT.md` for AO1–AO8.

## Chosen Path

**Repair the instrument, then prove the unknowns, then change the enforcement surface, then move the cost.** In that order, because each step is unverifiable without the one before it.

1. **Slice 0 — fix the guard's own suite.** `hooks/test_model_guard.mjs` is red *right now* and reads as green: a hand-kept vendored-lib list rotted, `state.mjs` throws inside the fixture, the hook fail-opens, and all 18 deny rows report *allowed*. Every later slice edits this guard. Changing it while its suite fail-opens is changing a lock while holding a broken key.
2. **Slice 1 — two spikes.** S1 answers whether AO1's tiny clause is deliverable at all. S2 answers whether a hook can tell an orchestrator's tool call from a worker's. Both are cheap; both are load-bearing; neither can be assumed.
3. **Slices 2–4 — the enforcement surface** (guard holes, config-is-authority, read-only advisor, pinned agents, logger, orchestrator advisor path).
4. **Slice 5 — the cost lever**, once S1 says it is safe.
5. **Slice 6 — the spec**, which is what stops this class of mistake recurring.

## Rejected Alternatives

| Alternative | Why rejected |
|---|---|
| **A byte-budget / token-budget hook throttling `Read`/`Grep`** | Binding rejection (AO6, "Explicitly Not Built"). It meters the second-order term (bytes) while the bill is driven by the first-order one (turns × context); a well-meaning model routes around it with `Bash("cat file")`; adding `Bash` to the matcher breaks verify/test/git; the threshold is invented; and it **inverts critical rule 12** by teaching read-until-blocked — which makes *"an unblocked read is not an approved read"* false. |
| **"Model name must appear in the Agent description"** | Theater (AO6). It enforces a string nobody validates against reality, and pinned agent types subsume it. |
| **Advisor must be cross-family (the earlier AO5)** | Superseded. Cross-family was a *proxy* for "the advisor should be a real second opinion", and it broke on contact: under the `claude` runtime the Agent `model` param only accepts claude names, so enforcing it would have made every model-shaped advisor unreachable. The owner named the real principle: **config is the authority; the model does not get a vote.** |
| **Advisor consults on the *second* red verify, blocking at `cap`** | Superseded (AO2/AO3). The shipped rule is **stricter**: consult on the *first* serious failure, budget 2, `[BLOCKED]` on exhaustion — the cell never reaches `cap` at all. Adopting the proposal would have been a regression, and would have needed a red-streak counter that does not exist (`cells.mjs:365-378` overwrites a single scalar). |
| **Trigger on "cell scope creeping past the plan"** | Dropped from v1 (AO2). Cells carry `files` only as *cap output*; nothing declares an expected file list at claim time, so the trigger has no source of truth. Inventing one is a separate feature. |
| **Route as `standard`** | 6 risk flags, two of them hard-gate. Routing a hard-gate change below high-risk is bee's own worst red flag. |

## Risk Map

| Component | Risk | Proof required before execution |
|---|---|---|
| **AO1 tiny clause (Slice 5)** | **HIGH** | **S1 spike.** It rewrites `bee-hive/SKILL.md:116` (tiny Execute = "direct, in-session (solo)") and `:125` (the fast path's in-session done-report), and may collide with the merged Gate 2+3 question. A NO **returns to the user** — planning may not reinterpret a locked decision, nor build speculative cells on one. |
| **AO2(c) conflict detection** | **HIGH** | Semantic, not countable. Needs a cheap honest proxy with a stated false-positive budget — **or an explicit "cannot", narrowing the trigger to hard-gate only.** A flaky detector is worse than no detector: it teaches the orchestrator to ignore the advisor, which destroys the one property (rarity) that makes advice land. |
| **AO3 gate precondition** | **MEDIUM-HIGH** | Zero precedent: `handleStateGate` (`bee.mjs:806-823`) checks a gate's *name* and writes the flag; **no gate anywhere checks a precondition.** New state field + CLI verb (hive law 12) + a freshness rule so a stale `advisor_ref` cannot satisfy the gate. |
| **AO5 validation host** | **MEDIUM-HIGH** | There is **no config-validate stage**. `normalizeModels`/`normalizeTierValue` (`state.mjs:108-124`) silently ignore invalid shapes and drop unknown keys; `bee.mjs` has no `config validate` verb. Validating must **name the host** (onboarding / `bee status` / `resolveTier`) — AO5's "cheap because it's decidable at config time" is only true once that host exists. |
| **W1 guard change** | **MEDIUM** | Blocked on Slice 0. The guard is a control channel hardened against marker forgery (decision 0023); its regression rows must survive, including "marker embedded mid-content → rejected". |
| **W4 logger** | **MEDIUM** | 9-file surface (catalog + wrapper + mirror + 3 projections + settings + contract-test `WRAPPERS` + toggle default). Fail-open is mandatory *and* is the trap: needs a test that **fails when the logger is broken**. |
| **W3 pinned agents → host repos** | **MEDIUM** | `.claude/agents/` is unknown to skill-sync: `REPO_SKILL_TARGETS` (`onboard_bee.mjs:256-259`) manages only `.claude/skills/bee-*` and `.agents/skills/bee-*`. A third managed root drags in the version-preflight and deletion-root guards that walk that array. Codex has no native "agents" concept — decide what Codex gets. |
| **Degenerate-check removal** | **MEDIUM** | Verified by **invariants, not by grepping the deleted names** (learning 20260711). Behavior change is real: an advisor previously *skipped* will now be **consulted**. |
| **Mirror drift** | **LOW-MEDIUM** | `hooks/*.mjs` ↔ `.bee/bin/hooks/*.mjs` byte-identity; catalog ↔ rendered projections. Already covered by `test_hook_contracts.mjs:579-705` — keep it that way. |
| **Slice 0 itself** | **LOW** | Mechanical, and its own falsifiability is the proof: break the guard deliberately, watch the suite go red. |

## Relevant Learnings (mandatory, cited)

- **`critical-patterns.md:6-18` (20260714)** — hardcoded fixture file-lists rot silently, and fail-open makes rot look like PASS. **This is not a precedent; it is the live defect Slice 0 repairs**, in the one file that never got the fix.
- **`critical-patterns.md:167-184` (20260711)** — a control token in free text is injectable by construction; a fail-open contract needs malformed-input rows. Both apply directly to W1 and W4.
- **`critical-patterns.md:327-338` (20260714)** — a fail-open host swallows fail-closed throws into an allow. Any guard branch that must fail closed **returns** a typed deny; it never throws.
- **`critical-patterns.md:138-150` (20260711)** — a removal is verified by its invariants, not the names it deletes. Applies to the degenerate check.
- **`critical-patterns.md:313-325` (20260713)** — a guard that tests one state is a law with a hole; an unblocked write is not an approved write. This is the principle AO6 generalises.

## Open Questions For Validating

1. **Name the host for AO5's validation.** Onboarding, `bee status`, or `resolveTier` — pick one and justify. Until then AO5 is a rule with no enforcement point.
2. **Can AO2(c) be detected mechanically at all?** An honest "no, narrow to hard-gate" is the preferred answer if the proxy would be flaky.
3. **What does Codex get from W3?** Claude has `.claude/agents/`; Codex has no equivalent concept. Parity or an explicit asymmetry — decide, do not drift.
4. **Freshness rule for `advisor_ref`.** What makes a ref stale, and what does Gate 3 check?
