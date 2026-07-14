# Validation — advisor-and-orchestration, Slice 0 + Slice 1

**Lane:** high-risk (6 flags, two hard-gate). `gate_bypass` does not apply.
**Verdict:** **READY WITH CONSTRAINTS** — after a full cell rebuild. Every CRITICAL flag was fixed; one locked decision was amended by the user.
**Panel:** two independent lenses (feasibility + cold-pickup; security + unblocking research), both on the `review` slot (opus), neither given the other's findings.

## Reality Gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | **PASS** | 6 flags counted mechanically (`plan.md` Mode Gate). Two hard-gate. High-risk is mandatory. |
| REPO FIT | **PASS** | Every target file exists and was anchored by a reviewer who verified independently. |
| ASSUMPTIONS | **FAIL → repaired** | Two load-bearing assumptions were false. See Findings F1, F2. |
| SMALLER PATH | **PASS** | Slice 0 split into three cells so the verify-chain edit lands last, on a green tree. |
| PROOF SURFACE | **PASS** | Every cell's `verify` was executed, including its **negative** case. See Falsifiability. |

## Findings

### F1 — BLOCKER (fixed): a second hook suite is red, and it blocked the fix-first cell

`hooks/test_hook_contracts.mjs` exits **1 with 22 failures** at HEAD — the **same rot class** as `test_model_guard.mjs`, in a second file: its route fixture stages wrappers at `<fixture>/hooks/*.mjs` while `.codex/hooks.json` execs `.bee/bin/hooks/bee-*.mjs`, plus one `codex-repo-target-drift` row.

The original `ao-0` called this suite in its `verify`. **It could therefore never have capped.** Split into `ao-fix-1` (repair contracts) → `ao-fix-2` (repair model-guard) → `ao-fix-3` (wire the chain).

> The standing learning that describes this exact rot (`critical-patterns.md:6-18`) is dated **today**, and a second live instance of the class survived in a file its own author believed was fixed. **The learning was being cited as though it had been applied.** That is the finding worth keeping.

### F2 — WARNING (fixed): "silently green" was my invention

The plan and the cell both claimed `test_model_guard.mjs` "reads as passing". It does not: it prints `18 FAILURE(S)` and exits 1. The real defect is that **nothing runs it** — no verify chain, no CI. Corrected in `plan.md`, and the correction is written into `ao-fix-2`'s action so a cold worker cannot inherit the error. Consequence: the expect-deny rows **already are** sentinels under universal fail-open, so the planned "add a sentinel row" was a no-op justified by a failure mode that does not exist.

### F3 — BLOCKER (fixed): the fix-first cell contradicted itself

`ao-0`'s falsifiability step ("break the guard, watch it go red") required editing `hooks/bee-model-guard.mjs`, which its own `files` list omitted and its own prohibitions forbade. A worker under file reservations would have hit `[BLOCKED]` on a step the cell mandated. `ao-fix-2` now lists the guard **solely** to make break-and-restore legal, and its verify asserts `git diff --quiet hooks/bee-model-guard.mjs` at cap.

### F4 — BLOCKER (fixed): the verify-chain edit would have bricked the baseline

Adding a red suite to `commands.verify` makes the repo's baseline verify red **permanently**, for every session, in every host that syncs the config — and bee's own baseline gate then makes the next session's first act "fix the baseline". Sequencing is now explicit and prohibited from reordering: **the verify-chain edit is the last commit on a green tree, never the first on a red one** (`ao-fix-3`).

### F5 — BLOCKER (fixed): the tiny-lane spike was answerable "yes" by redefinition

The old question let a motivated agent answer "yes, with caveats" by redefining *in-session* as *relayed into the session* — rewriting the lane table, the feature's own stated biggest risk, with **no user in the loop**, on the authority of a spike written by an agent whose feature only works if the answer is yes. And the verify (`grep '^## Verdict'`) could not detect a hedge.

`ao-spike-tiny` now requires the verdict to be the bare token `YES` or `NO` on its own line, defines `YES` as *"no edit to `SKILL.md:116` or `:125` is required"*, declares every hedge to be a `NO`, and **escalates a YES to the user for ratification too** — a spike verdict does not license a lane-table rewrite.

### F6 — BLOCKER (fixed): the probe cell was unexecutable and unsafe

Three defects: (i) binding the probe requires `.claude/settings.json`, which is **tracked** — a hook entry pointing at a gitignored `.bee/spikes/` path would `ENOENT` on **every `Read` in every other clone, forever**; (ii) "dump the payload, redact home paths" leaks `cwd`, `transcript_path` (home path + session uuid + repo path), and the `file_path` of any secret-shaped read the privacy guard **denies** — both hooks are in PreToolUse and both run; (iii) the acceptance criterion demanded two captured payloads, so the most likely and perfectly valid answer (*hooks do not fire in subagents*) **could not cap its own cell**.

`ao-spike-probe` now binds in `.claude/settings.local.json` (git-ignored), mandates **teardown before cap**, replaces the dump with a **whitelist** (field names, value types, `hook_event_name`, `tool_name`, and `sha256(session_id)[0:8]` for the equality test), and accepts a documented absence as the finding.

### F7 — BLOCKER → user decision: AO2(c) has no mechanical detector

The trigger "two locked decisions in conflict" cannot be built against the current record shape. `decision`/`rationale` are free prose with **no structured claim**; `scope` is the default `"repo"` in **106 of 135** records and is **absent entirely** from `supersede` events; and the store's only mechanical relation, `supersedes`, is the **resolution** of a conflict, not its detection — a superseded decision is no longer active, so two actives can never be in a machine-visible contradiction.

**The user declined to drop the trigger** and chose to build the foundation: **AO9** defers AO2(c) behind a new prerequisite feature, `structured-decisions` (backlog **P36**), which gets its own exploring — it is a data-model change to an append-only log with 135 existing events. This feature ships with **AO2(b) only**.

### F8 — BLOCKER (fixed in plan): `.claude/agents/` must not join `REPO_SKILL_TARGETS`

`plan.md` proposed exactly the forbidden change. The three-version preflight resolves a target's version from `<targetRoot>/bee-hive`'s marker; an agents root has no `bee-hive` **directory**, so it resolves as `unknown` — **refused, and never forceable**. It would have made onboarding refuse **on every host, permanently**, the moment the first agent file landed. Locked as **AO10**; Codex asymmetry locked as **AO11**.

## Open Questions — answered with evidence

- **(a) AO5's validation host → `bee status`** (shared validator in `state.mjs`, plus `bee config validate` for CI). **`resolveTier` is disqualified:** it is called from inside hooks, every bee hook is **fail-open by contract**, so a throw there is swallowed and logged as a crash — *a refusal that refuses nothing*. Damage today: `normalizeTierValue` silently **drops** any unrecognised shape, so one typo (`{"advisor": {"modle": …}}`) disables the advisor entirely and nothing says so. Locked as **AO12**.
- **(b) AO2(c)** → see F7. Locked as **AO9**.
- **(c) Codex** → documented asymmetry, not parity. Locked as **AO11**.
- **(d) `advisor_ref` staleness** → feature mismatch, newest-active-decision change, `sha256(plan.md)` change, or predating the last execution-gate revocation. **Not a TTL** — this feature already burned itself on one invented number. Gate 3 checks it as a precondition inside `handleStateGate` and **throws**, never warns. Locked as **AO13**.

## Falsifiability of the verify commands

Every cell's `verify` was executed this session, **including its negative case** — a verify that cannot fail is not a verify:

| Command | Positive | Negative |
|---|---|---|
| `ao-spike-tiny` verdict grep | passes on a bare `YES` (exit 0) | **fails on `Yes, with caveats`** (exit 1) — this is the hole F5 closed |
| `ao-spike-probe` leak guard | passes on a clean file | **fails when a `/home/` path is present** (exit 1) |
| `ao-fix-2` | — | correctly RED at HEAD (18 failures); goes green on completion |
| `ao-fix-1` | — | correctly RED at HEAD (22 failures); goes green on completion |

## Scope Guard

The **Explicitly Not Built** list (AO6) held. Neither panel proposed a byte/token-budget hook or a model-name-in-description check; one explicitly recorded where it was *tempted* (nagging on every `Read` when the config is invalid) and cited AO6 to refuse — a continuous-resource hook wearing a config check's clothes.

## Current Slice — approved scope

`ao-fix-1` → `ao-fix-2` → `ao-fix-3` (sequential; the chain edit is last), plus `ao-spike-tiny` and `ao-spike-probe` (independent, parallel).

Slices 2–6 are **not** covered by this approval.
