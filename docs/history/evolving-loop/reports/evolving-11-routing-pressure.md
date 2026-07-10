# Routing pressure — bee-evolving hive row (evolving-11)

Cell: evolving-11 | Decision: `ff26725d` (full Iron Law applies to any `SKILL.md` edit, including a
routing-table row — no mechanical-edit exemption). Format precedent: evolving-10
(`reports/evolving-10-pressure.md`). This cell owns this file; evolving-10's pressure report is
untouched.

**Scenario under test:** a request to evolve bee from its own dogfood feedback routes to the wrong
skill or nowhere. `skills/bee-hive/SKILL.md`'s routing table (and its mirror in
`references/routing-and-contracts.md`) currently carries only `Improve bee itself ->
bee-writing-skills` — a row written for *authoring/editing a bee skill*, which collides semantically
with the new `bee-evolving` skill's job (*running* the gated self-improvement loop over the
collected feedback digest). Before any row is added or reworded, this file records the routing
failing.

Method: a fresh haiku subagent, no memory of this session, is given the **current, unedited**
routing tables verbatim (the compact `SKILL.md` table and the detailed
`routing-and-contracts.md` skill catalog) and asked to route one request, strictly by table content
— no outside assumptions about what a skill "really" does. GREEN re-runs the identical request
against the tables **after** the edit.

## Ordering proof (captured before any row existed)

Verbatim shell capture, 2026-07-10T10:06:36Z, before either routing surface was touched:

```
$ date -u +"%Y-%m-%dT%H:%M:%SZ" && grep -c "bee-evolving" skills/bee-hive/SKILL.md skills/bee-hive/references/routing-and-contracts.md
2026-07-10T10:06:36Z
skills/bee-hive/references/routing-and-contracts.md:0
skills/bee-hive/SKILL.md:0
```

`bee-evolving` appears in neither routing surface at this timestamp. Everything below is dated
after this capture and before the GREEN edit landed.

## RED — 2026-07-10 (no `bee-evolving` row exists)

**Request phrase (one a user would actually type):** "bee tu cai thien tu feedback" — Vietnamese,
typed without diacritics ("bee, tự cải thiện từ feedback" / "bee, self-improve from feedback"): the
user asks bee to read the friction/feedback it has already collected about itself and ship an
improvement to its own behavior based on that data.

**Tables given to the agent:** the current `SKILL.md` routing table (11 rows, including `Improve bee
itself -> bee-writing-skills`) and the current `routing-and-contracts.md` skill catalog (13 rows,
`bee-writing-skills` described as "TDD-for-skills, pressure testing").

**Agent route (fresh haiku subagent, no bee-evolving skill/row present):**

> ROUTE: `bee-writing-skills`
>
> REASONING: The request is asking bee to self-improve based on collected feedback about its own
> behavior. This directly matches the routing table row "Improve bee itself" → `bee-writing-skills`,
> which is described as handling "TDD-for-skills, pressure testing" — the infrastructure for bee to
> evolve based on friction/feedback signals.

**Verdict: FAIL.** The request lands on `bee-writing-skills` — a skill for authoring/editing bee's
own skill files (TDD-for-skills, pressure testing), not for running the gated dogfood
cluster-rank-Gate A-Gate B-push loop over the feedback digest that already exists
(`skills/bee-evolving/SKILL.md`, shipped by evolving-10). A user asking bee to evolve from its own
collected feedback is routed to the wrong skill — exactly the failure mode this pressure test names
("routes to the wrong skill or nowhere"). `bee-writing-skills` has no bee-repo-only guard, no Gate A,
no Gate B, and no push discipline; running it here would either stall (no digest/rank surface to act
on) or, worse, invite an agent to hand-edit skill files without the D3/D4/D5 gates `bee-evolving`
enforces.

## GREEN — 2026-07-10 (row added, existing row disambiguated)

Edits made to close the RED failure (three-spot mirror, per the cell's global constraint):

1. `skills/bee-hive/SKILL.md` routing table: reworded `Improve bee itself -> bee-writing-skills` to
   `Author or edit a bee skill (SKILL.md content) -> bee-writing-skills`, and added
   `Evolve bee from its own dogfood feedback (rank friction, ship a self-improvement) ->
   bee-evolving`.
2. `skills/bee-hive/references/routing-and-contracts.md` skill catalog: `bee-evolving` added as row
   **#12** (`bee-briefing` and `bee-bypass-gate` renumbered to #13/#14), described as "Run bee's
   gated self-improvement loop over its own collected feedback digest (cluster → rank → Gate A →
   Iron Law hand-off → Gate B → push). Bee repo only, human-invoked, never auto-runs."
3. `routing-and-contracts.md`'s separate "First-Skill Routing" (Request-type) table: same
   disambiguation of the `Improve bee itself` row plus the new `bee-evolving` row, worded to match.

Same method, same phrase, same fresh-haiku-subagent protocol, run against the **edited** tables
(pasted in full, post-edit).

**Agent route (fresh haiku subagent, edited tables — actual run, verbatim):**

> ROUTE: `bee-evolving`
>
> REASONING: The request matches the first routing table's row "Evolve bee from its own dogfood
> feedback (rank friction, ship a self-improvement) → `bee-evolving`". The user is asking bee to read
> its collected feedback and ship a self-improvement based on it, which is exactly what
> `bee-evolving` does according to the second table: "Run bee's gated self-improvement loop over its
> own collected feedback digest (cluster → rank → Gate A → Iron Law hand-off → suites green → Gate B
> → push)."

**Verdict: PASS.** The same phrase that failed RED now lands on `bee-evolving`, and the agent
explicitly names why the old collision is resolved: `bee-writing-skills` is now scoped to
*authoring/editing* a skill, `bee-evolving` to *running* the dogfood self-improvement loop.

## Summary

| Phase | Route chosen | Verdict |
|---|---|---|
| RED (row absent, `Improve bee itself` row ambiguous) | `bee-writing-skills` | FAIL — wrong skill |
| GREEN (row added, existing row disambiguated) | `bee-evolving` | PASS |

The Iron Law's ordering claim (decision `ff26725d`): the RED entry above and the "Ordering proof"
shell capture were both recorded while `bee-evolving` was absent from both routing surfaces
(`grep -c` returned 0/0 at `2026-07-10T10:06:36Z`); the GREEN entry was recorded only after the
three-spot edit landed. No routing content was written before its failing pressure test existed.
