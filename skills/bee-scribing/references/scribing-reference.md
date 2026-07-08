# Scribing Reference

Load after `bee-scribing` is selected. The workflow lives in SKILL.md; the template, per-section rules, and protocols live here.

## Area Shapes

An area is any long-lived unit with observable behavior: a screen/form, an API, a background job, an integration with an external system, a data pipeline, a CLI command, a business process. The template below fits all of them — the sections stay, the content shifts:

| Section | UI area | Backend/job/API area |
|---|---|---|
| Entry Points & Triggers | links, menu paths, buttons | schedules, events, queue messages, endpoints, CLI invocations |
| Data Dictionary | form fields, display order | inputs, outputs, stored elements, config values, message payloads |
| Behaviors & Operations | user actions (Save, Publish…) | operations and runs (nightly expiry pass, webhook received, import batch) |
| Actors & Access | roles × what they see/do | roles AND consuming/producing systems × what they may call/receive |

A section with genuinely no content for the area's shape gets one line — "Not applicable — <why>" — never silently deleted, so absence reads as a statement, not an oversight.

## Area Spec Template (BA grade, decision 0002)

Path: `docs/specs/<area>.md`. Area name: kebab-case, chosen at first write, stable thereafter. Overwrite/merge freely — this file always describes *now*; history lives in git and `docs/history/`.

`docs/specs/` holds ONLY the state layer: area specs, `system-overview.md`, `reading-map.md`, `visuals/`. Never write other artifacts (scripts, exports, survey notes) here; when found, flag them for grooming to relocate — they pollute coverage counting and spec scans.

```markdown
---
area: <area-slug>
updated: YYYY-MM-DD
sources: [<feature-slugs that shaped current behavior>]
decisions: [<active D-IDs cited below>]
coverage: full | partial
---

# Spec: <Area Name>

<One paragraph: what this area is for and who uses it, in business terms.>

## Entry Points & Triggers

<One line per way this area is invoked: route/URL, menu path, link source,
schedule, event, incoming call → what appears or what runs. Business names,
not component or class names.>

- `/jobs/new` → the job posting form (empty)
- `/jobs/<id>/edit` → the same form, pre-filled; visible to the posting's owner only
- every night at 02:00 (posting timezone) → the expiry pass runs over all `active` postings

## Data Dictionary

<Every element a user sees, the area stores, or a consumer receives — form
fields in DISPLAY ORDER; inputs/outputs/config for backend areas.>

| # | Element | Meaning | Values | Required | Default |
|---|-------|---------|--------|----------|---------|
| 1 | Title | The headline applicants see in search results | free text, ≤120 chars | yes | — |
| 2 | Status | Lifecycle of the posting | `draft` — visible to the owner only, never searchable · `active` — publicly listed and accepting applications · `paused` — hidden from applicants, still editable by the owner · `closed` — read-only, kept for records | yes | `draft` |
| — | Expiry window (config, not shown) | How long a posting stays `active` before the expiry pass closes it | days, decided per D9 | — | 60 |

Rules: every enum value carries its business meaning inline; a value whose
meaning nobody can state goes to Open Gaps, not into the table. Derived,
hidden, and config elements get a row too, marked "(not shown)" in the # column.

## Behaviors & Operations

<One block per user action OR system operation. Given/when/then prose, no code.>

### Save (create)

- **Blocked when:** Title empty ("Title is required" shown at the field); …
- **What changes:** a posting is created in `draft`; the owner becomes its editor.
- **Side effects:** none. No notification is sent for drafts.
- **Afterwards:** the owner lands on the edit view with a "Saved" confirmation;
  applicants and other companies see nothing.

### Publish

- **Blocked when:** …
- **What changes:** status `draft` → `active`; the published date is set to today.
- **Side effects:** followers of the company receive a new-job notification (per R3).
- **Afterwards:** applicants find the posting in search; the owner sees it flagged "Live".

### Nightly expiry pass (system operation)

- **Runs when:** every night at 02:00; skipped entirely if the previous night's
  pass is still running (per R4 — never two passes at once).
- **What changes:** `active` postings older than the expiry window become `closed`.
- **Side effects:** the owner receives one summary notification per night, not one
  per posting; applicants with in-flight applications are notified their application
  is frozen.
- **On failure:** the pass stops at the first error, already-closed postings stay
  closed, and the failure is retried the next night; the owner sees nothing partial.

## Actors & Access

<Matrix: every actor — human roles AND consuming/producing systems — × what
they can see, do, call, or receive. Include anonymous visitors when relevant.>

| Capability | Owner | Company admin | Applicant | Visitor | Job-board partner (system) |
|---|---|---|---|---|---|
| See `draft` postings | ✓ | ✓ | — | — | — |
| Edit fields | ✓ | ✓ | — | — | — |
| Apply | — | — | ✓ (active only) | — | — |
| Receive posting feed | — | — | — | — | ✓ (active only, hourly) |

## Business Rules

<Numbered, one sentence each, citing the deciding D-ID. Rules live here even
when the code enforces them only implicitly.>

- **R1.** A posting can never return from `closed` to any other status (per D4).
- **R2.** … (per D7)
- **R3 (not yet implemented — backlog b-12).** …

## Edge Cases Settled

<Edge cases with a decided answer. An open question does not belong here — it
belongs in Open Gaps (harvest) or in exploring (new work).>

## Open Gaps

<Only in `coverage: partial` specs. One line per unknown: what is unknown, and
who/what could answer it. Empty section + `coverage: full` = the rebuild bar is met.>

## Visuals

<UI areas only (decision 0003). One line per settled screen:
`visuals/<area>/<screen>.png` — what it shows. Refreshed at sync when the screen
visibly changed. No snapshot available → say so here or in Open Gaps, never silently.
Backend areas: "Not applicable — no screen.">

## Pointers (implementation)

<THE ONLY technology-bound section. Key files/routes/tables: `path` — role.
Deleting this section must not remove any business meaning.>
```

## Per-Section Rules

- **Purpose:** who uses it and what for. No feature history.
- **Entry Points & Triggers:** if a link, screen, schedule, event, or call exists that this table doesn't explain, the spec fails the rebuild bar.
- **Data Dictionary:** display order is part of the spec for UI areas (the owner's requirement: "field nào trước field nào sau"). Validation limits live in the Meaning/Values cells in business terms ("≤120 chars"), not as regexes. Config values whose numbers were *chosen* (thresholds, windows, retry counts) cite the deciding D-ID — a tuned number without its why is half-lost knowledge.
- **Behaviors & Operations:** the four sub-answers (blocked-when or runs-when / what changes / side effects / afterwards-per-actor) are mandatory for every action and operation; "afterwards" must name what EACH affected actor or consuming system observes, not just the acting user. System operations additionally state their failure behavior (what happens mid-run, what retries, what stays consistent).
- **Actors & Access:** prefer one matrix; consuming/producing systems are actors too; footnote row-level subtleties ("owner of THIS posting, not any owner").
- **Business Rules vs Behaviors:** a Behavior is what the system observably does; a Rule is the policy behind it. A rule approved but not yet shipped is marked "not yet implemented" with a backlog id — never written as a Behavior.
- **Visuals:** the snapshot preserves what the spec cannot say — the settled *look* the vibe loop agreed on by eye. One current image per screen, stable filename, replaced in place (history lives in git). The agent asks the user for a screenshot when it cannot capture one; an absent snapshot is an Open Gap with a stated reason.
- **Pointers:** load-bearing few, not a file listing. This section is allowed to rot slightly; everything above it is not.

## Merge Rules (sync mode)

- **Locate before create:** resolve every delta to an existing spec via `docs/specs/reading-map.md` (and a scan of `docs/specs/*.md` frontmatter/Pointers) before considering a new file. A renamed screen, moved route, or refactored module is still the SAME area — update its spec and its reading-map line; do not fork a new one. Creating is the exception, reserved for genuinely new surfaces.
- Deltas come from `behavior_change` cells + `verification_evidence`, UAT records, and worker reports — never from plan.md, never from memory.
- A delta that contradicts an existing line **replaces** it; do not keep both.
- Update `updated`, append the feature to `sources`, reconcile `decisions` against the active set (`node .bee/bin/bee_decisions.mjs active`).
- Present tense only. "Was", "previously", "changed from" are banned words.
- If the feature added/removed an area, or changed shared entities, the role model, or a cross-area flow: sync `system-overview.md` in the same pass (decision 0003).
- UI areas: when a delta made a screen visibly different, refresh its snapshot under `visuals/<area>/`; cannot produce one → Open Gap with the reason.
- Standard commands are a Pointers-level fact: when a synced change alters how the project is set up, started, tested, or verified, update `.bee/config.json` `commands` in the same pass (docs/09 item 1) — one record, never a second location.
- After merging, run the rebuild self-check (below) on every touched spec.

## Harvest Interview Protocol

For each meaning/rule code cannot prove, ask in the standard question format — one per message, outcome-framed, single-choice preferred:

```text
CONTEXT: The job form has a Status field with values draft/active/paused/closed.
  The code only shows that `paused` postings are excluded from search.
QUESTION: When a posting is paused, what should the applicant who already
  applied see?
RECOMMENDATION: (b) — matches the exclusion already enforced in search.
  (a) The posting stays visible to them — their application is in flight
  (b) The posting shows as "no longer available" — applications freeze
  (c) Something else (describe)
```

Budget the interview: batch the inventory first, then ask only the questions whose answers change the spec. Unanswered → Open Gaps + `coverage: partial`. Confirmed answers in harvest/capture mode are decisions — log them (`bee_decisions.mjs log`) and cite the new D-ID in the spec.

## Rebuild Checklist (self-check before finishing)

Cover the Pointers section and verify:

1. Every entry point and trigger (link, screen, schedule, event, call) is listed with what appears or runs.
2. Every visible field, input, output, and chosen config value appears in the dictionary — display order for UI, meanings everywhere; every enum value has a stated business meaning.
3. Every user action and system operation has a Behavior block with all four sub-answers (operations also state failure behavior).
4. Every actor — human role or consuming system — appears in the access matrix.
5. No sentence requires reading the code to be understood.
6. No technology name appears above Pointers.
7. `coverage` and Open Gaps are honest.
8. UI areas: every settled screen has a current snapshot under `visuals/<area>/` — or an Open Gap saying why not.
9. If this spec's area is new, removed, or changed shared entities/roles/flows: `system-overview.md` reflects it.

Any failure: fix it now, or file it as an Open Gap with `coverage: partial` — silently shipping a hole is the red flag, not having one.

## System Overview Spec (decision 0003)

Path: `docs/specs/system-overview.md`. One file, singular — the cross-area glue no per-area spec owns. Same write discipline as any spec (present tense, overwrite to match reality, tech-agnostic above Pointers, never fork). Fresh sessions read it FIRST, before any area spec.

```markdown
---
area: system-overview
updated: YYYY-MM-DD
decisions: [<active D-IDs cited below>]
coverage: full | partial
---

# Spec: System Overview

<One paragraph: what the product is, for whom, in business terms.>

## Area Map

<One line per area: what it is for, where its spec lives. This is the
completeness ledger — an area with shipped behavior and no line here is a gap.>

- job-posting-form — where owners create and manage postings; spec: job-posting-form.md
- applicant-inbox — where applicants track applications; spec: applicant-inbox.md (partial)

## Shared Entities

<Business entities that two or more areas read or write, with their meaning and
which areas touch them. Per-area field detail stays in the area specs.>

| Entity | Meaning | Touched by |
|---|---|---|
| Posting | A job opening a company offers | job-posting-form (owns), applicant-inbox (reads), partner-feed (reads) |

## Actors & Roles (global)

<The role model stated ONCE: every human role and consuming system, one line on
what it is. Area specs reference these names; they never redefine them.>

## Cross-Area Flows

<One block per flow spanning two or more areas: trigger → step per area →
outcome each actor observes. Single-area behavior stays in the area spec.>

## Open Gaps

## Pointers (implementation)
```

Sync triggers: a feature adds or removes an area; a shared entity's meaning changes; the role model changes; a cross-area flow is created, removed, or rerouted. Anything else NOOPs — the overview is glue, not a duplicate of the area specs.

## Reading Map

Path: `docs/specs/reading-map.md`. One line per location, grep-friendly:

```markdown
# Reading Map

- `src/auth/` — session middleware and guards; spec: docs/specs/auth.md
- `scripts/build.mjs` — single build entry point; run with `node scripts/build.mjs`
```

At sync time: add lines for locations the feature created or repurposed, fix lines it made wrong, delete lines for removed locations. Keep it a map, not documentation — one line each, no prose blocks.

## State Record

```json
{
  "phase": "scribing",
  "summary": "Synced 2 area specs (job-posting-form full, applicant-inbox partial, 3 gaps)",
  "next_action": "Invoke bee-compounding."
}
```

`bee-compounding` checks this record as its state-layer guard; if scribing has not run for the feature, compounding invokes it rather than syncing inline.
