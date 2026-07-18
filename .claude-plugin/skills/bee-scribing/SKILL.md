---
name: bee-scribing
description: >-
  Keep technology-agnostic BA specs of every area current, so a human understands the system without the code and an agent can rebuild it on another stack. SELF-TRIGGERING: invoke this yourself, unprompted, the moment any discussion-test-adjust loop settles a rule, behavior, or value — the user should never have to ask for knowledge to be recorded. Also use when execution completes (chain), when the user asks to document a screen/API/job/area, or when a legacy area has code but no spec.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads cell traces and logs decisions via the vendored .bee/bin helpers.
---

# Scribing (scribe bees)

Scribing is bee's BA. It owns the state layer: `docs/specs/<area>.md` (one BA-grade functional spec per long-lived area), `docs/specs/system-overview.md` (the cross-area glue — area map, shared entities, global roles, cross-area flows; decision 0003), `docs/specs/visuals/<area>/` (settled screen snapshots for UI areas), and `docs/specs/reading-map.md`. An **area is domain-general**: a screen or form, an API, a background job, an integration, a data pipeline, a CLI command, a business process — any unit with observable behavior that outlives features. Code is the implementation; the spec is the *meaning* — it must survive a full rewrite on a different stack (decision 0002).

§1 gather sources, §2 map deltas, §3 render sections, harvest inventory, and §7 reading-map refresh delegate as extraction/generation-tier I/O workers per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); any other ad-hoc subagent dispatch scribing makes (for example, a harvest research pass) defaults to the generation slot model, and ceiling requires the [bee-tier: ceiling] marker plus a one-line justification.

**The rebuild bar (acceptance test for every spec):** a competent agent given ONLY this spec — with the Pointers section deleted — rebuilds the same observable behavior on a different technology. A human reading it understands every field, behavior, rule, and role without opening the code.

**The tech-agnostic rule:** outside the final `Pointers (implementation)` section, a spec names NO language, framework, library, class, table, component, or file. Fields, screens, roles, actions, jobs, and messages are named in business vocabulary. "The React hook debounces and PATCHes /api/jobs" is a violation; "edits are saved automatically shortly after typing stops" is the spec. "A Celery beat task scans the `applications` table" is a violation; "every night, applications idle for 30 days are marked expired and the applicant is notified" is the spec.

## Modes

| Mode | Trigger | Does |
|---|---|---|
| **sync** (chain default) | execution completed with `behavior_change` cells capped (scribing follows execution directly — a feature may be scribed and closed while unreviewed; independent review is a separate, user-invoked session) | merge the feature's behavior deltas into the touched areas' specs |
| **capture** | any discuss → build → test → adjust loop **settles an outcome**, any phase — a rule agreed, a behavior confirmed by test, a threshold/tuning value chosen, an error policy adjusted; an explicit user settlement signal ("chốt", "final", "ok ship it") makes capture **mandatory in the same turn** (decision 0003) | log the decision same turn, then: **high-risk lane → merge into the spec immediately**; every other lane → append a capture stub (`node .bee/bin/bee.mjs capture add`) and keep working — the merge happens at flush (decision 0017) |
| **flush** | capture queue non-empty at a flush point — session wrap-up, the PreCompact/close warning, or the session-start offer (decision 0017) | drain the queue oldest-first: full merge of each stub into its area's spec, mark it flushed (`bee.mjs capture flush --id <id> --into <spec>`), record the scribing run |
| **harvest** | user asks to document an existing area, or grooming files a missing-spec item | write the first spec for an area built before/outside bee |
| **bootstrap** | `docs/specs/` lacks `system-overview.md` or `reading-map.md` — typically right after onboarding | **offer — never auto-run** (D2 of harness10) a bounded skeleton pass creating ONLY the missing map file(s) from mechanically provable facts; an existing map file is never touched. Full binding rules + skeleton shapes: the reference's Bootstrap section |

Bootstrap is inventory, harvest is meaning: bootstrap writes only what code, tree, and verbatim README extracts prove, marks every meaning as an Open Gap (`coverage: partial`), and asks no interview questions — its loudly stated gaps are harvest's worklist.

## 1. Gather Sources — and What Each May Feed

| Source | May feed | Never feeds |
|---|---|---|
| capped `behavior_change` cells + `verification_evidence` (`node .bee/bin/bee.mjs cells list --feature <feature>`) | Entry Points & Triggers, Data Dictionary, Behaviors & Operations, Actors & Access | — |
| gate-locked `CONTEXT.md` + active decisions (`node .bee/bin/bee.mjs decisions active`) | Business Rules (cited by D-ID); the `Terms` section seeds the Data Dictionary | Behaviors stated as current reality, unless also evidenced |
| worker reports, UAT records in `docs/history/<feature>/reports/` | Behaviors ("what each actor sees") | — |
| code reading (harvest mode) | observable behavior, field inventory | field *meanings* and rules — code shows what, not why |
| user answers (harvest/capture) | any section, after confirmation | — |

**NEVER invent.** A claim backed by neither verification evidence nor an approved decision enters the spec only as an Open Gap (or becomes a question in interactive mode). Plans describe intent, not reality — never copy from `plan.md`.

## 2. Map Deltas to Areas — Update in Place, Never Fork

Map each delta to an area by the files/screens it touched. Area names are kebab-case, chosen at first write, stable forever.

**One area = one file, forever.** A modified area is ALWAYS an in-place update to its existing spec — that is what keeps the doc permanently current. Before creating any spec, check `docs/specs/reading-map.md` and the existing `docs/specs/*.md` for an area that already covers this surface (it may be named differently than you'd name it today — search by what it describes, not by the name you expect). Only when no existing spec covers the surface, create one from the template in `references/scribing-reference.md`. Never create `-v2`, `-new`, `-updated`, or date-suffixed spec files: two documents describing one area is worse than a stale one — readers cannot tell which is true.

## 3. Merge — BA-Grade Sections

Spec sections (full template + per-section rules in the reference): **Purpose → Entry Points & Triggers → Data Dictionary → Behaviors & Operations → Actors & Access → Business Rules → Edge Cases Settled → Open Gaps → Pointers (implementation)**. The same sections fit every area shape — for a UI area the triggers are links and clicks and the data is form fields; for a backend area the triggers are schedules, events, and calls, and the data is inputs, outputs, and stored elements.

Merge rules:

- Present tense only. "Was", "previously", "changed from" are banned — history lives in git and `docs/history/`.
- A delta that contradicts an existing line **replaces** it; never keep both.
- Every enum value in the Data Dictionary carries its business meaning ("`paused` — hidden from applicants, still editable by the owner"). A value without a meaning is an Open Gap, not a table row.
- Every Behavior block answers: what triggers it, what blocks it, what changes, what side effects fire, and **what each actor or consuming system observes afterwards**.
- Business Rules are numbered (R1, R2…) and cite the active D-ID that decided them.
- UI areas: refresh the settled snapshot under `docs/specs/visuals/<area>/` when the screen visibly changed (ask the user for one if you cannot produce it); a UI area with no current snapshot records that as an Open Gap, never silently (decision 0003).
- If the feature added or removed an area, or changed shared entities, the role model, or a cross-area flow: sync `docs/specs/system-overview.md` in the same pass (template in the reference).
- Update frontmatter: `updated`, append to `sources`, reconcile `decisions`, set `coverage: full | partial` honestly.

## 4. Capture Mode — Settled Outcomes from the Vibe Loop

The trigger is **settlement**, not subject matter: whenever a discuss → build → test → adjust loop lands on an outcome that is now "how it works" — a business rule agreed, a behavior confirmed by a test run, a retry/threshold/tuning value chosen after experiment, an error-handling policy adjusted — capture it in the same session. When the user says the settlement out loud — "chốt", "final", "ok ship it", any equivalent — capture happens **in that same turn**, never deferred (decision 0003). What "capture" costs in that turn is lane-scaled (decision 0017): high-risk = the full spec merge; every other lane = decision log + a one-line queue stub, with the merge at flush — the flow is never held hostage to the elaboration. The session-close hook warns when a decision exists that no spec update followed, and when queued stubs await their flush.

**The debt signal backs this up (decision 0011).** Every `behavior_change` cell capped since the last scribing run is counted as *scribing debt* and surfaced mechanically — in the session preamble, in `bee_status`, and in the chain-nudge fired when a worker returns during swarming. Debt > 0 means a settlement already landed in a capped cell and belongs in a spec **now**, not at feature close. Self-detection is still the first duty; the debt count is the backstop for the settlements the agent's own watching missed. Running capture (or sync) and recording the run in state clears it.

**Detection is the scribe's duty, unprompted (decision 0007).** The explicit signal is the *loud* case; most settlements are silent — the user confirms a behavior works, accepts an explanation, picks an option, moves on. The agent watches for these itself, every turn, and captures without being asked. Do not ask "should I document this?" — announce in one line what settled and where it goes ("chốt: X — ghi vào `docs/specs/<area>.md` + decision log"), then do it in the same turn. Capture writes only `docs/` and `.bee/` — allowed in every phase, no gate. A user having to say "ghi lại" means detection already failed once:

1. Log it first: `node .bee/bin/bee.mjs decisions log --decision "..." --rationale "..."` — the decision log is the durable anchor; the rationale records *why* this outcome won over what was tried. This is always same-turn, every lane.
2. **High-risk lane:** merge the settled truth into the area's spec now (Business Rules for policy; Behaviors & Operations for confirmed behavior; Data Dictionary for a value's meaning) citing the new D-ID, same message. A spec lagging high-risk behavior even briefly is dangerous — never queue it.
   **Every other lane (decision 0017):** append a stub instead — `node .bee/bin/bee.mjs capture add --outcome "..." --did <D-IDs> [--area <area>] [--files ...]` — one line, seconds, then keep working. Durability now, elaboration at flush.
3. If it contradicts current shipped behavior, record it as a rule with a note "not yet implemented — see backlog" and file a backlog item; do NOT state it as current behavior.

Litmus: if the session ended right now, would this outcome exist anywhere but the chat? If no — capture it now. (A queued stub passes the litmus — the chat can die and the stub survives into the next session's preamble.)

### Flush — draining the queue (decision 0017)

Flush points, whichever comes first: **wrap-up** (the working session is ending), the **PreCompact/close warning** (the hook fires when the queue is non-empty), or the **session-start offer** (bee-hive surfaces a non-empty queue before new work). At flush: `node .bee/bin/bee.mjs capture list`, then oldest-first give each stub the full capture treatment — merge into its area's spec per the section-3 rules, `bee.mjs capture flush --id <id> --into <spec>` — and record the scribing run in state (section 8). A stub is never dropped, summarized away, or flushed without its merge; if a stub's meaning is no longer reconstructable, ask the user rather than invent — that cost is the signal to flush earlier next time.

### Deferred requests → product-backlog rows (D8, decision 0007 pattern)

The same unprompted-capture duty covers **deferred work**, not just settled truths. When the user pushes work out of the current scope — "để sau", "phase 2", "later", "not now" — or a Deferred Idea leaves exploring, the agent appends a `proposed` row to `docs/backlog.md` (the product backlog) **in the same turn, announce-then-do**: "ghi vào backlog: <story> (proposed)", then write it. A user having to say "ghi vào backlog" means detection already failed once. Backlog writes are `docs/`-layer — allowed in every phase, no gate. The row's ID/columns/merge rules live in the reference's Product Backlog section; do not duplicate the table schema here. This is prose-ruled, never hook-enforced (D7).

At sync, close the loop the other way: when this scribing run closes a feature that matches a backlog row, flip that row to `done` and link `docs/history/<feature>/` (D11b) — the sync pass owns the done-flip. After any row flip, run the mechanical passes so the surfaces stay honest: `node .bee/bin/bee.mjs backlog rank --write` (in-flight rows float to the top, done sinks — P2) and, when README carries the badge block, `node .bee/bin/bee.mjs backlog badges --write` (P3).

## 5. Harvest Mode — Backfill Without Inventing

1. Inventory the area from code and running behavior: screens, fields, actions, roles — or for backend areas: triggers, inputs, outputs, consumers, failure paths.
2. Draft the spec with everything code can *prove*; every meaning or rule code cannot prove becomes a question — Socratic style, one question per message, outcome-framed.
3. Unanswered questions → `## Open Gaps`, `coverage: partial`. A partial spec that states its gaps beats an invented-complete one.

## 6. Rebuild Self-Check

Before finishing, re-read the spec with the Pointers section covered and ask: could a stranger rebuild this on another stack? Any "you'd have to look at the code" answer is a hole — fix it or file it as an Open Gap.

## 7. Refresh the Reading Map

`docs/specs/reading-map.md`: add lines for locations created or repurposed, fix lines made wrong, delete lines for removed locations. One line each; a map, not documentation.

## 8. Update State

Record the scribing run: `node .bee/bin/bee.mjs state scribing-run --feature <feature> --areas "<a,b>" --next-action "<next action>"`. This stamps `last_scribing_run` (`feature`, `date`, an **ISO-precise `at` timestamp**, `areas_synced`, `next_action`) and mirrors `next_action` plus advances `phase` to `compounding` at the top level. The `at` stamp is what clears **scribing debt** (decision 0011): the harness counts `behavior_change` cells capped *after* it, so a missing or day-only stamp leaves just-synced cells still showing as debt. No `behavior_change` cells and nothing to capture → still run it (`--areas "none"`, `--next-action` reflecting "scribing: no sync needed") so the debt signal resets.

## Hard Gates

- Do NOT skip scribing when `behavior_change` cells were capped — in ANY lane, tiny included; lanes scale ceremony, never memory (vision principle 11). An unsynced spec is measured entropy (grooming counts it).
- Do NOT name technology outside Pointers. The rebuild bar is the acceptance test, not a slogan.
- Do NOT state unverified claims as behavior. Evidence → behavior; approved decision → rule; neither → Open Gap.
- Do NOT create a second spec for an existing area. Modification = in-place update of the one true file; check the reading map before every create.
- Do NOT let a settled outcome die in the chat log — capture mode exists precisely for it, whatever the domain (UI, backend, integration, process).
- Secrets and PII never appear in specs.

## Headless

`mode:headless`: apply mechanical merges (deltas straight from `behavior_change` cells + evidence) and reading-map fixes; log capture-mode decisions only when the user's wording is verbatim-quotable. Harvest questions, ambiguous merges, and any rewording beyond the delta go to an `Outstanding Questions` section of the structured terminal report.

## Red Flags

- a framework, library, or file path in any section above Pointers
- a status/enum value listed without its business meaning
- a Behavior block that never says what each actor or consumer observes
- spec content copied from plan.md or written from memory
- a `-v2`/`-new`/date-suffixed spec file, or a fresh spec created without checking the reading map for the existing one
- harvest answers invented from field or symbol names instead of asked
- "I'll write the spec after compounding" — scribing runs first, while evidence is fresh
- a settled outcome (rule, confirmed behavior, chosen value) that exists nowhere but the chat
- the user said "chốt"/"final" and the turn ended with no decision logged and neither a spec merge nor a queued stub (decision 0017: the stub is the same-turn minimum outside high-risk)
- a high-risk settlement queued as a stub instead of synced inline
- a capture stub surviving past a flush point (wrap-up, PreCompact warning, session-start offer) without being flushed
- a capture that ran only because the user asked "ghi lại" — a silent settlement the agent should have caught itself (decision 0007)
- the user deferred work ("để sau", "phase 2", "later") and the turn ended with no `proposed` row appended to `docs/backlog.md` — the missed-capture failure applied to backlog items (D8)
- asking "should I document this?" instead of announcing the capture and doing it
- a UI screen that visibly changed while its snapshot under `docs/specs/visuals/` did not (and no Open Gap says why)
- an area added or removed with `system-overview.md` left unsynced
- treating scribing as UI-only — backend jobs, APIs, integrations, and processes are areas too

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Scribing complete: <N> area specs synced (<coverage>), <M> open gaps, reading map refreshed. Invoke bee-compounding skill.

| Reference | When to Load |
|---|---|
| `references/scribing-reference.md` | full spec template, per-section rules, field-dictionary and visibility-matrix formats, harvest interview protocol, bootstrap rules and skeleton shapes, rebuild checklist |
