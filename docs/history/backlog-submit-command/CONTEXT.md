# bee backlog propose — a direct backlog-promotion command — Context

**Feature slug:** backlog-submit-command
**Date:** 2026-07-23
**Exploring session:** complete
**Scope:** Quick
**Domain types:** CALL, ORGANIZE

## Feature Boundary

A new `bee backlog propose` CLI verb lets a human directly register a new work item in `docs/backlog.md` (the product PBI table) with an auto-assigned PBI ID, without having to hand-write a table row. Ends at writing the `proposed` row — it does not start work on the item, and it does not touch `.bee/backlog.jsonl` (a separate store).

## Locked Decisions

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | `/bee:submit` is implemented as a new CLI verb, `bee backlog propose --story "<title>" --cos "<acceptance criteria>" [--feature <slug>] [--json]`, invoked through this repo's existing natural-language routing (a human asks to submit/propose an item, the agent runs the verb) — not a Claude-Code-only slash command. | User confirmed the existing verb family (`bee backlog add --type proposal ...`) is the right base to build on, not a new Claude-Code-specific mechanism; this repo has zero `.claude/commands/` today and is dual-runtime (Claude + Codex) everywhere else — a literal slash command would only work on one runtime. |
| D2 | The verb auto-assigns the next PBI ID as `(highest existing P-number in docs/backlog.md) + 1`. The existing P58 gap in the table is never backfilled. | Matches the convention already used when P79 and P80 were hand-assigned this session (simple max+1, gaps left alone). |
| D3 | After the row is written, the command stops — it does **not** auto-start `bee-qualifying`/`bee-exploring` for the new item. Pickup happens later through the normal `bee-hive → bee-qualifying/bee-exploring` flow, same as every other `proposed` row today. | User confirmed: keep "register the idea" separate from "start doing it" — the command never claims work on the user's behalf. |
| D4 | Scope is standalone-submission only: the verb takes Story + CoS directly from the caller. Importing/mapping an existing `.bee/backlog.jsonl` proposal entry (its `type`/`severity`/`layer`/`detail` fields) into Story/CoS is **not** built in this feature. | The two schemas don't map cleanly (a friction-style entry has no natural "CoS"), and nothing in the original request needs the link. Deferred — see Deferred Ideas. |
| D5 | Implemented as a new shared function in `skills/bee-hive/templates/lib/backlog.mjs` (e.g. `proposePbiRow`) plus a new `backlog.propose` entry in `lib/command-registry.mjs`, mirrored to `.bee/bin/**` via the established `onboard_bee.mjs --apply` sync. `bee-exploring`'s Backlog-flip step (D11a) and `bee-scribing`'s Deferred-Ideas step (D8) are **not** refactored to call this new function in this feature — they keep hand-editing the table via their existing prose instructions. | Scout confirmed no shared row-creation code exists today (D11a/D8 are prose-ruled, agent hand-edits the table via the Edit tool) — this is the first real implementation. Refactoring the two existing skills to call it is a real but separate consolidation, not required for this feature's own acceptance criteria. |

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| PBI ID | The `P<n>` identifier in `docs/backlog.md`'s ID column (already established, e.g. P79, P80) |
| promote | Turning a raw idea (or, in the future, a `.bee/backlog.jsonl` proposal — not built here per D4) into a numbered `docs/backlog.md` row |

## Existing Code Context

### Reusable Assets

- `skills/bee-hive/templates/lib/backlog.mjs` — `readBacklogCounts`, `BACKLOG_STATUSES`, `backlogPath`/`resolveProductRoot` helpers already resolve `docs/backlog.md`'s location and parse its table rows; the new `proposePbiRow` function belongs here, reusing `backlogPath`/`resolveProductRoot` rather than re-deriving the file location.
- `skills/bee-hive/templates/lib/command-registry.mjs` — existing `backlog.counts`/`backlog.rank`/`backlog.badges`/`backlog.add` entries are the schema/registration pattern to follow for the new `backlog.propose` entry.
- `skills/bee-hive/templates/bee.mjs` `handleBacklogAdd` (~L2533) — the closest sibling handler (flag parsing, validation-before-write discipline) to model the new `handleBacklogPropose` on, though it targets a different file and schema.

### Established Patterns

- Table-row edits to `docs/backlog.md` today go through a fixed 5-column format (`| ID | Story | CoS | Status | Feature |`) — the new verb must emit a row byte-compatible with `readBacklogCounts`'s parser (`lib/backlog.mjs`), i.e. a bare `proposed` status token, not an annotated one (the parser bug found during P79's close only affects `done` rows with trailing annotations, but the new row must still emit a clean, parseable status cell).
- `bee.mjs` mirrors to `.bee/bin/bee.mjs` via `onboard_bee.mjs --apply`, confirmed working in this session's P79 close.

## Canonical References

- `docs/history/backlog-auto-commit/CONTEXT.md` (P79, merged to main) — prior art for a scoped, gated CLI addition to the backlog surface; D1 there added `--queue-submit` to `bee backlog add` for the *separate* `.bee/backlog.jsonl` store.
- `docs/backlog.md` rows P77/P78 — existing precedent showing a row's CoS text citing `"promoted from .bee/backlog.jsonl proposal <timestamp>"` — today that promotion step is manual; this feature does not change how *that* citation style works, it only adds a way to create a fresh row without it.

## Outstanding Questions

### Deferred To Planning

- [ ] Exact validation rules for `--story`/`--cos` (length caps, required-ness) — mirror `handleBacklogAdd`'s `BACKLOG_MAX_TITLE`-style caps or define new ones for this table's longer free-text cells.
- [ ] Whether `--feature` is required, optional, or defaults to `—` (several existing rows use `—` for unassigned) — check existing table convention before deciding.

## Deferred Ideas

- Linking a new PBI row directly from an existing `.bee/backlog.jsonl` proposal entry (auto-importing its fields) — deferred by D4; revisit only if manually copying title/detail from a jsonl proposal into `--story`/`--cos` becomes real friction.
- Refactoring `bee-exploring`'s D11a and `bee-scribing`'s D8 to call the new `proposePbiRow` helper instead of hand-editing the table — deferred by D5; a real consolidation but out of this feature's acceptance criteria.
- A thin Claude-Code-only slash-command wrapper (`.claude/commands/bee/submit.md`) around the new verb, for users who want to literally type `/bee:submit` — deferred by D1 (the option not chosen); revisit only if Codex parity stops mattering or a wrapper becomes clearly worth the two-places-to-maintain cost.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and the deferred-to-planning questions above.
