# 0024 — Cross-repo analysis: what bee should take from repository-harness

- **Status:** proposed (research synthesis — owner review pending; not run through `bee-exploring`/Gate 1, no code built)
- **Date:** 2026-07-11
- **Source:** conversational cross-repo research session comparing this repo (bee) against `../repository-harness` (Rust CLI + Symphony runner) — execution trust model, intake flow, and task-management substrate, read directly from both repos' source (not inference)
- **Confidence:** 0.6 — comparison claims are source-verified; the proposed combined sequence and "base on bee" call are design judgment, undogfooded

## Why this exists

docs/08 and docs/09 already cover what bee adopted from `repository-harness` and the `learn-harness-engineering` course as of v0.1.x. This record covers three gaps that surfaced in a later, closer comparison and were **not** in those two documents: (1) which execution model is actually more trustworthy end-to-end, (2) bee's missing durable/queryable task-management layer, (3) an optimal combined intake sequence that uses bee's `bee-exploring` and harness's input-type classifier for what each is actually good at.

## 1. Execution trust — verified from source, not docs

| Axis | repository-harness (Symphony) | bee (swarming) |
|---|---|---|
| Workspace safety | git worktree + copied `harness.db` per run — root untouched; run failure discards cleanly | same-checkout + `bee_reservations.mjs` (TTL file locks); no isolation from the root tree |
| State durability | changesets, transactional apply, replayable, idempotent `sync` (`SYMPHONY_SCOPE.md` §11.5) | per-file JSON in `.bee/cells/`, git-merge is the "replay" |
| Story/cell close gate | **advisory**: `harness-cli/src/interface.rs:933` prints `"Warning: Story {} has verify_command but verification has not passed."` and still allows the transition | **mechanical refuse**: `bee_cells.mjs cap` rejects without a passing verify + recorded output + non-empty `files_changed`; `behavior_change` cells also need a "before" (`red_failure_evidence`) |
| Agent self-report trust | `RESULT.json` accepted with `validation.commands[].result: unavailable` + a reason — no re-run required (`run.rs:548`, confirmed by its own test at `run.rs:825`) | orchestrator **re-runs verify itself** + `bee_cells.mjs judge` (frozen-judge: undeclared test/CI/lockfile edits flag the cell) before a wave counts clean (decision 0018) |
| Concurrency | one story/run at a time by stated scope (`SYMPHONY_SCOPE.md:47` — concurrent runs out of scope) | wave-parallel workers within one slice, gated by deps-capped + no-file-overlap |

**Verdict:** harness is safer against *blast radius* (a run cannot corrupt the working tree or the DB). bee is safer against *false "done"* (cap refuses without proof; the orchestrator never trusts a worker's word). For the question bee cares most about — "did the agent actually finish, or just say so" — bee's mechanism is strictly stronger; harness's is advisory with a documented escape hatch (`unavailable`).

## 2. Task-management substrate — bee has a real gap here

Confirmed in source: harness runs on one SQLite `harness.db` with real tables (`story`, `decision`, `intake`, `trace`, `friction`, `intervention`) and generic query surfaces:

```rust
fn query_matrix(&self) -> Result<Vec<StoryMatrixRecord>>   // SELECT ... FROM story ORDER BY id — all stories, any status, one call
fn query_sql(&self, sql: &str) -> Result<QueryTable>       // raw SQL escape hatch
```

Epics are durable folders (`docs/stories/epics/E01-.../`) independent of which story is currently being worked — many stories can sit at different statuses simultaneously with no artificial single-active constraint.

bee has **no equivalent**: `.bee/state.json.feature` is a single scalar (one feature in flight, by design — decision intent is "what am I doing right now stays unambiguous for a solo dev"), `docs/backlog.md` is a hand-maintained flat markdown table, and cells are scattered JSON files with no cross-feature query command. This gap is **not** covered by any existing "adopt now/later" item in docs/08 or docs/09 — it was missed in the original two-pass adoption review.

## 3. Proposed combined intake sequence

Neither system's intake fully covers the other's strength: harness's `FEATURE_INTAKE.md` classifies input type mechanically and only asks the human when "direction is ambiguous," and only requires that for `high-risk`. bee's `bee-exploring` runs a Socratic ambiguity-lock (gray-area probes, teach-before-ask) for every lane, but has no upfront input-type classification and no durable intake row before that dialogue starts.

```
User prompt
   │
   ▼
① [harness] Classify input type (mechanical, cheap) — new spec / spec slice /
   change request / initiative / maintenance / harness improvement.
   Decides WHERE the work lands before anything about risk or ambiguity.
   │
   ▼
② [harness] Write a durable intake row immediately — even for tiny work —
   {date, input_type, summary, feature/epic ref, status: draft}.
   Event-sourced like bee's decisions.jsonl, NOT a mutable status column
   (bee's own docs/08 already prefers event-sourced over harness's mutable column).
   │
   ▼
③ [bee] bee-exploring — conditional, not unconditional:
   IF the input type + summary leave no real gray area → skip the dialogue.
   ELSE → run the Socratic lock (gray-area probes, teach-before-ask) → CONTEXT.md decisions.
   This is bee's genuine addition: harness only asks the human when ambiguous,
   and only mandates it at high-risk; bee treats ambiguity resolution as a
   first-class step at every lane.
   │
   ▼
④ Mode/risk gate — merge the two risk checklists (near-identical flag sets),
   update the SAME intake row from ② with lane + flags + reason.
   ▶ GATE 1 (if new decisions were locked at ③)
   │
   ▼
⑤ [bee] Planning Pass 1 — epic map / phase plan, slice-cut by the epistemic
   boundary rule ("if you can write the next cell without knowing this
   slice's outcome, it's the same slice"). Epic becomes a durable record
   (harness-style folder/index row), not a table row that disappears when
   the feature markdown is done — this is what closes gap §2.
   ▶ GATE 2
   │
   ▼
⑥ [bee] Prep Pass 2 — cut cells for the current slice only (must_haves, verify, deps).
   ▶ GATE 3
   │
   ▼
⑦ [bee, optional harness] Execution — keep bee's cap-requires-proof +
   goal-check + frozen-judge unchanged (§1 shows it's the stronger side).
   Optionally add `--isolation worktree` (already scoped in docs/08 #7) for
   high-risk / wide-blast waves.
   ▶ GATE 4 — bee's review (P1/P2/P3 + EXISTS/SUBSTANTIVE/WIRED + UAT), unchanged.
   │
   ▼
⑧ Compounding — sync BOTH: docs/specs (bee, human meaning) AND the intake/story
   record from ② (status → done), so a cross-feature query stays accurate.
```

## 4. Which codebase should be the base

**Recommendation: base on bee, cherry-pick harness's behavior — not the reverse.**

Bee's own decision 0018 already set this precedent: *"Worktree-per-worker isolation (delegator's model). Rejected — bee's isolation primitive is reservations; switching to worktrees is a foundation swap without demonstrated need."* And docs/08 #7 explicitly skips harness's copied-DB + changeset machinery as unnecessary given bee's git-merge-as-replay model. This record generalizes that same judgment to the DB/task-management gap.

| | Base = bee, add harness pieces | Base = harness, add bee pieces |
|---|---|---|
| What's missing | one embedded query layer (SQLite or similar) + a matrix/sql view command | the entire discipline layer: gates, cap-requires-proof, goal-check + frozen-judge, cell-quality rules, exploring's ambiguity resolution, epistemic slice-cutting |
| Size of the gap | small — a 5th vendored helper alongside `bee_status/cells/reservations/decisions.mjs` | large — reimplementing a dogfooded, iteratively-hardened prompt/workflow layer (20 PBIs deep) in Rust, with real risk of silently dropping a subtle rule (e.g., "an assertion is not evidence") |
| What's lost by choosing this base | little — an embedded DB doesn't meaningfully break "zero npm dependencies" | bee's actual adoption pitch: `curl \| bash` install into any repo, no compiled toolchain, dual-runtime (Claude Code + Codex) — a Rust binary base raises the adoption bar |

## 5. CLI surface: one entrypoint, two audiences

Verified (not inferred): bee ships 4 independent `.mjs` entrypoints (`bee_status.mjs`, `bee_cells.mjs`, `bee_reservations.mjs`, `bee_decisions.mjs`, 121–237 lines each), invoked separately, with **no `package.json` anywhere in the repo** — no manifest, no unified `--help`. harness's two crates each carry a real `Cargo.toml` and use `clap` (derive) — a single binary whose `--help` is generated straight from the command definitions, so it cannot drift from what the code actually does. This is a second, independent gap from §2 (task management) and was not named in docs/08 or docs/09 either.

Proposal — collapse the 4 entrypoints behind one dispatcher, and split its help output by audience, reusing bee's own existing `--json` convention rather than inventing new vocabulary (e.g. a `--robot` synonym):

- `bee --help` — human prose: command tree, one-line purpose per command, one example each. Same role as harness's clap-generated help.
- `bee --help --json` — machine schema for an agent: an array of `{name, invoke, args[], description, output_shape, examples[]}` per command. Every helper already supports `--json` for its *own* output (README: "Helpers exit non-zero with a one-line `{error}` JSON on `--json`"); extending the same flag to `--help` needs no new flag name.

Both outputs must render from **one shared command registry** in `bin/lib/`, never hand-duplicated prose — this is the identical anti-drift discipline bee already uses for the session preamble: `bin/lib/inject.mjs` feeds the hook, the AGENTS.md block, and `bee_status` output from one module "so the runtimes can never drift" (docs/02-architecture.md). The help/manifest split is that same technique applied to command discovery instead of session state.

Integration with AGENTS.md: the Codex bootstrap block (`AGENTS.template.md`) already instructs the agent to run `bee_status.mjs --json` as its first step (docs/02, Seam 1). Extend the same startup instruction to call `bee --help --json` too (or bake a snapshot into the managed AGENTS.md block at `onboard_bee.mjs --apply` time, refreshed on every re-onboard like the rest of the managed content) — either way, a cold agent reading AGENTS.md gets the complete, current command surface without opening a single `SKILL.md`.

## Scope (not built — this is a proposal)

If accepted, concrete follow-on work would be:
- A new vendored helper (e.g. `bee_index.mjs`) backed by an embedded DB, rebuilt from `.bee/cells/*.json` + `docs/backlog.md` as a derived view (source of truth stays the JSON files — same policy-vs-operations split bee already has), exposing a matrix-style cross-feature query.
- Input-type classification step added to `bee-hive` routing, ahead of `bee-exploring`, writing the durable intake row into the new index.
- `--isolation worktree` flag for `bee-swarming` per the already-scoped docs/08 #7 (unchanged by this record, just sequenced alongside).
- Collapse `bee_status/cells/reservations/decisions.mjs` behind one `bee.mjs` dispatcher, backed by a single command registry in `bin/lib/`, exposing `bee --help` (human) and `bee --help --json` (agent/AGENTS.md), per §5.

## Alternatives considered

- **Do nothing — treat docs/08/09 as complete.** Rejected: the task-management gap was real and undetected by either prior review; leaving it means bee stays blind to its own multi-feature state without a human reading files by hand.
- **Rebase bee onto harness's Rust/SQLite substrate wholesale.** Rejected — see §4; the engineering cost and adoption-friction cost both fall on the more valuable, harder-to-replicate side (bee's workflow discipline).
- **Run `bee-exploring` unconditionally before any classification (current bee behavior).** Rejected as the optimal sequence — cheap, unambiguous requests pay the full Socratic-dialogue cost for no benefit; harness's input-type filter is a legitimate cheap gate to run first.

## Open questions

1. Should the new index be genuinely SQLite, or a simpler derived JSON aggregate rebuilt on demand (lower dependency risk, weaker query ergonomics)?
2. Does adding a durable intake row before `bee-exploring` change the `tiny`/`small` merged-gate fast path's token cost meaningfully? Needs a dogfood measurement, not a guess.
3. Who owns writing this through bee's own decision pipeline (`bee_decisions.mjs log`) if accepted — this record itself was written directly, not via `bee-exploring`, because no bee phase was active during this research session.
4. Should the `bee --help --json` manifest be baked statically into AGENTS.md at onboard time (consistent with other managed content, but can go stale if `.bee/config.json` commands change without a re-onboard) or discovered live every session (always current, costs a few tokens per session)?

## Adoption note (2026-07-12)

This record's §5 proposal ("collapse the 4 entrypoints behind one dispatcher... `bee --help`/`bee --help --json`") and its Scope item 4 were adopted from vantt's PR #1 ("harness-integration Phase 1") as `bee.mjs` under `skills/bee-hive/templates/`, per decision `30606de4` (harness-integration-adopt, DA1-DA7). The code mechanism (D5: `bee.mjs` imports the shared `lib/*.mjs`, never touches the 4 legacy helpers) was adopted as-is; the PR's own `.bee/` runtime state and `docs/history`/`plans/` bookkeeping were excluded, and the copy was adapted to 0.1.26: the command registry and dispatcher gained a `cells.update` entry (shipped in 0.1.26, absent from the PR's base), the copied status logic was re-synced against the current `bee_status.mjs` (review block, `POST_EXECUTION_REVIEW_PHASES`, reviews import), `.bee/manifest-hash.json` was gitignored (it is rewritten on every `bee.mjs` invocation, including read-only ones), and a standing behavior-derived registry↔helper-verb bijection test was added — none of which the PR shipped with. Scope stayed frozen to the 4 legacy helpers named above (`bee_status`, `bee_cells`, `bee_reservations`, `bee_decisions`); the 5 newer helpers (`bee_state`, `bee_backlog`, `bee_capture`, `bee_reviews`, `bee_feedback`) are a follow-up PBI, not part of this adoption. §§1-4 and the Open Questions above remain vantt's own research synthesis and are carried unedited; only §5/Scope-item-4 were built, and only as scoped by decision `30606de4`.
