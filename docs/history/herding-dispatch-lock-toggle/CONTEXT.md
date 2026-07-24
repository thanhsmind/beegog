# Dispatch Lock Toggle — Context

**Feature slug:** herding-dispatch-lock-toggle
**Date:** 2026-07-23
**Exploring session:** complete
**Scope:** Quick
**Domain types:** CALL

## Feature Boundary

Add a `bee herding` CLI verb group (`enable` / `disable` / `status`) to `bee.mjs` that performs the exact same filesystem operation as today's manual `touch`/`rm` of the owner enable marker (`<main-root>/.bee/tmp/bee-herding.enable`), so the owner can toggle the dispatch loop's lock with a bee command instead of hand-editing the marker file — nothing about `dispatch-interlock.mjs`'s read-only check or the loop's polling behavior changes.

## Locked Decisions

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Ship a `bee.mjs herding` CLI verb group only; defer any herdr/cockpit keybinding shortcut. | Backlog CoS says "CLI verb **or** cockpit shortcut" — either satisfies it. A herdr-side shortcut would touch the external `herdr` tool and is out of scope for this `small` lane; every other bee state mutation already goes through `bee.mjs` (AGENTS.md critical rule 12), so the CLI verb is the paved-road choice. |
| D2 | Verbs are `bee herding enable`, `bee herding disable`, `bee herding status` — no bare "toggle" verb. | Mirrors the existing `bee-bypass-gate` skill's `on`/`off`/`status` convention already used in this repo for exactly this shape of binary owner-gesture switch. A bare toggle can't be used safely without first checking current state. |
| D3 | The verbs perform byte-for-byte the same operation as today's manual gesture: resolve the MAIN checkout root the same way `dispatch-interlock.mjs` does (`git rev-parse --path-format=absolute --git-common-dir`, then strip `/.git`), then `enable` creates `<main-root>/.bee/tmp/bee-herding.enable` and `disable` removes it. No extra state, no extra confirmation prompt, no new file. Both verbs are idempotent — `enable` on an already-enabled marker and `disable` on an already-disabled (absent) marker are no-ops, not errors. | Backlog CoS: "behavior matches today's manual marker-file toggle." `touch` is naturally idempotent; `rm` is not, so `disable` must explicitly tolerate a missing marker to stay a safe, repeatable owner gesture. Adding a confirmation step or side-state would be new, undiscussed behavior. |
| D4 | The new verbs are a convenience for the **human owner's own terminal action only** — they must never be called from `dispatch-interlock.mjs`, bootstrap, dispatch, merge, or any other bee automation/skill/agent code. | `dispatch-interlock.mjs`'s own header comment: "It is an OWNER gesture, never created by any agent or by this script — this script only ever reads it." This is the documented containment boundary for the whole dispatch loop (also the subject of the repo's top-ranked critical pattern on splitting automation at the irreversibility boundary — `docs/knowledge/patterns/20260723-split-automation-where-an-action-becomes-irreversible.md`). The CLI verb only changes *how* the human types the gesture, never *who* may invoke it. |
| D5 | No runtime guard on `bee herding enable`/`disable` — no TTY/interactivity check, and the verb group is NOT hidden from `bee.mjs --help --json`'s machine manifest. Safety stays convention-only (D4), same level of enforcement as today's plain `touch`/`rm`. | User decision (2026-07-23), explicit trade-off accepted after fresh-eyes review flagged that the verb is more *discoverable* to an in-session agent than the current path-knowledge gesture: user chose simplicity/parity with today's behavior over adding a runtime guard. Not an agent judgment call — do not silently revisit without asking the user again. |

### Agent's Discretion

Exact `bee herding status` output formatting (marker path, enabled/disabled + main-root) is left to planning/implementation — no product decision hinges on its wording.

## Existing Code Context

### Reusable Assets

- `.claude/skills/bee-herding/scripts/dispatch-interlock.mjs` — the read-only check the new verbs must stay behaviorally compatible with (`ENABLE_BASENAME = 'bee-herding.enable'`, `resolveMainRoot()` via `git rev-parse --git-common-dir`).

### Established Patterns

- `.bee/bin/bee.mjs` single-dispatcher CLI (all bee state mutations go through it, AGENTS.md critical rule 12) — the new `herding` verb group follows this pattern.
- `bee-bypass-gate` skill's `on`/`off`/`normal`/`full`/`total`/`status` verb shape — precedent for a small owner-facing on/off/status CLI surface for a safety-relevant toggle.

### Integration Points

- `.claude/skills/bee-herding/README.md` — documents today's manual `touch`/`rm` gesture; needs a doc update once the CLI verb ships (planning's call whether this lane's file cap absorbs it or it's a follow-up doc pass).

## Canonical References

- `.claude/skills/bee-herding/scripts/dispatch-interlock.mjs` — defines the marker path and the containment invariant this feature must preserve.
- `docs/knowledge/patterns/20260723-split-automation-where-an-action-becomes-irreversible.md` — the critical pattern backing D4.

## Outstanding Questions

None — all gray areas resolved (D1-D5); the one genuine information question (runtime guard vs convention-only, D5) was put to the user and answered 2026-07-23.

## Deferred Ideas

- Cockpit/herdr keybinding shortcut for the same marker toggle — would require changes to the external `herdr` tool; out of scope for this CLI-only small lane (see D1). Proposed as a new backlog row if wanted later.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references. D4 is the safety-critical constraint: the new verbs are documented/built for direct human invocation only, never called by any bee automation.
