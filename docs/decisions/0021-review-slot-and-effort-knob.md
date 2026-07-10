# 0021 — Review slot + effort knob: the editable role split (backlog P16/P17)

- **Status:** active — owner-approved 2026-07-10 ("lấy ý tưởng này vào, default là vậy nhưng cho phép edit"); built in 0.1.18.
- **Date:** 2026-07-10
- **Source:** owner shared a role-split setup (Fable orchestrates · Opus xhigh analyzes/reviews · Sonnet max implements · GPT 5.5 adversarial-reviews · the human decides) and asked bee to adopt it as the **default**, with every slot editable to whatever models the user actually has — all-Claude when only a Claude subscription exists.
- **Confidence:** 0.7 (resolver + defaults tested; the reviewer-model upgrade's cost/quality trade needs dogfood confirmation).

## Decision

### P16 — the `review` slot

`models` gains a third configurable slot beside `extraction`/`generation`: **`review`** — the model for review work, consumed by bee-reviewing's specialist reviewers, exploring's fresh-eyes, and validating's plan-checker + cell-reviewer.

- **Default (all-Claude role split):** `claude.review: "opus"` — the model that reviews should not be the model that implemented; an independent, stronger reviewer catches what self-review structurally cannot.
- `null` → falls back to the `generation` tier (the pre-0021 behavior, and the codex default).
- `{ "kind": "cli", "command": "codex exec -m gpt-5.5 ..." }` → the pictured GPT adversarial review, first-class via decision 0019's External Executors protocol.
- `learnings-researcher` stays `extraction`, `learnings-synthesizer` stays `ceiling` — the slot covers judgment reviewers, not the mechanical/synthesis ends.

### P17 — the effort knob

Any configurable slot value may be `{ "model": "...", "effort": "low|medium|high|xhigh|max" }`. `resolveTier` returns the effort beside the model; it is applied where the runtime has a per-agent effort switch and silently recorded where it does not (no fake enforcement). Invalid efforts drop; the model survives. Cli executors carry effort inside their own command string.

## Rationale

- **Default = the good setup, edit = the reality check.** Most users will not hand-tune a role split; shipping the strong default (orchestrator ≠ implementer ≠ reviewer) gives them the pattern's value for free, and the map stays a plain config edit for anyone with a different model portfolio.
- **One resolver, four shapes.** `resolveTier` already spoke inherit/model/budget/cli (0019); review-as-slot and effort-as-field extend the same seam without new machinery.
- **Scarcity discipline unchanged:** review is a bounded set of dispatches per feature (one wave of reviewers + two checkers), so a stronger review model does not erode the ceiling-scarcity lever the way a stronger worker would.

## Alternatives considered

- **Review as a 4th tier for cells.** Rejected — cells are work units routed by the extraction/generation/ceiling rubric (0016); review is a *role* orthogonal to cell tiering. Mixing them would let planning tier a cell "review" and confuse the scarcity math.
- **Default review = generation (opt-in upgrade).** Rejected — the owner asked for the pictured split as default; a default nobody flips is a feature nobody gets.
- **Full per-role map (analysis/spec/quality as separate slots).** Deferred — those are personas within the review wave, one model serves them; more slots = more config surface without evidence it changes outcomes.

## Scope (built)

- `lib/state.mjs`: `CONFIGURABLE_SLOTS` (+`review`), `EFFORT_LEVELS`, `normalizeTierValue` accepts `{model, effort}`, `resolveTier` handles the review fallback + effort, `modelForTier` delegates; version 0.1.18. `DEFAULT_MODELS.claude.review = 'opus'`.
- `bee_status.mjs`: `formatSlot` renders name / `model@effort` / `cli(cmd)` in the models line.
- Prose: bee-reviewing specialist table (Slot column + slot contract), bee-exploring fresh-eyes, bee-validating plan-checker + cell-reviewer, swarming reference models section (default split + editability + effort).
- Tests: `test_lib.mjs` review-slot fixtures (opus default, null fallback, codex budget, effort valid/invalid, cli in review slot, legacy resolver).

## Deferred

- Effort application on Claude Code subagents awaits a per-Agent-call effort switch in the runtime; until then the knob shapes cli commands and is recorded for model-selection-capable runtimes.
- Dogfood check: does opus-review change finding quality enough to justify its cost on `small` lanes? If not, a lane-scaled review slot (small → generation) is the follow-up.
