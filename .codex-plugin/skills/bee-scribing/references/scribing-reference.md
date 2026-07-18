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
- Update `updated`, append the feature to `sources`, reconcile `decisions` against the active set (`node .bee/bin/bee.mjs decisions active`).
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

Budget the interview: batch the inventory first, then ask only the questions whose answers change the spec. Unanswered → Open Gaps + `coverage: partial`. Confirmed answers in harvest/capture mode are decisions — log them (`bee.mjs decisions log`) and cite the new D-ID in the spec.

## Bootstrap Mode (D2 of harness10)

Bootstrap exists for one situation: `docs/specs/` lacks `system-overview.md` or `reading-map.md` — typically a repo fresh from onboarding, before any harvest has run. It is **offered, never auto-run**: the agent names the missing file(s) and asks; only user approval starts the pass. Bootstrap creates ONLY the missing map file(s) — an existing `system-overview.md` or `reading-map.md` is never touched by bootstrap (in-place-never-fork holds; improving an existing map belongs to sync or harvest).

Binding rules:

- **Sources:** code/tree inspection and verbatim README extracts only. Nothing else feeds a skeleton — no plan.md, no memory, no inference from file or symbol names.
- **Never invent:** every meaning, purpose, or rule that code cannot mechanically prove is an Open Gap line, never a written claim. A plausible-sounding guess is worse than a stated gap.
- **`coverage: partial`, always:** every bootstrap output carries `coverage: partial` in frontmatter — a skeleton by definition fails the rebuild bar, and says so.
- **No interviews:** bootstrap asks the user nothing about meaning. Meaning-filling belongs to harvest mode — bootstrap is inventory, harvest is meaning.
- **Loud gaps:** the output states its own gaps explicitly — a populated Open Gaps section plus `[unknown]` markers inline — so the Fresh Session Test probe (grooming) and harvest inherit a concrete worklist, never a silent hole.

**Tech-agnostic collision rule (binding):** directory paths live only in reading-map lines and Pointers sections. A system-overview area-map line whose purpose cannot be stated in business terms carries an `[unknown]` gap marker instead of a path-derived guess. A README quote that names technology goes to Pointers or becomes a gap — never into the Purpose paragraph.

**Skeleton shape — `system-overview.md`** (standard overview template, filled only where provable):

- Purpose: the README's first paragraph as a quoted extract with stated provenance ("README, opening paragraph, verbatim") when it speaks in business terms; otherwise one `[unknown]` gap line — never a paraphrase presented as fact.
- Area Map: one stub line per top-level structural unit and entry point the tree proves, phrased in business terms where provable; a line that cannot be carries `[unknown — see Open Gaps]`.
- Shared Entities, Actors & Roles, Cross-Area Flows: section headers kept, containing only what code proves — usually a single Open Gap pointer each.
- Open Gaps: one line per unfilled meaning, naming who or what could answer it (usually "harvest interview").
- Pointers: the entry points and technology facts the tree proves.

**Skeleton shape — `reading-map.md`:** one line per top-level location, each with a mechanically derived one-liner (manifest fields, script names, an unambiguous README statement) or an `[unknown]` gap marker — never an invented description. `spec:` cross-references appear only for spec files that actually exist.

A completed bootstrap announces its gap count and offers harvest as the next step for meaning-filling.

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

## Product Backlog (`docs/backlog.md`, D6)

`docs/backlog.md` is the **product backlog** — the human-first list of product backlog items (PBIs): stories the product owner wants, ordered by priority. It is a different artifact from `.bee/backlog.jsonl`, which is the machine layer for friction and grooming/kill items (entropy-audit trend, kill proposals). Two backlogs, two owners, never merged: `docs/backlog.md` = product intent (PBI rows), `.bee/backlog.jsonl` = machine debt. Scribing owns `docs/backlog.md` the same way it owns specs — one file, forever, updated in place; never fork a `-v2` or a second backlog file.

**Structure — one markdown table, priority-ordered (highest first):**

```markdown
# Product Backlog

| ID | Story | CoS | Status | Feature |
|----|-------|-----|--------|---------|
| P1 | Owners can pause a posting without closing it | A paused posting is hidden from applicants but still editable by the owner | done | job-pause |
| P2 | Applicants get a weekly digest of matching postings | One email per week lists new matches; opt-out honored | in-flight | applicant-digest |
| P3 | Companies can archive closed postings out of the default list | Closed postings move to an Archive view, restorable within 30 days | proposed | — |
```

- **Columns:** `ID` (stable, `P<n>`, next free integer, never reused) · `Story` (one line, user-facing outcome) · `CoS` (Condition of Satisfaction — the one-line acceptance signal) · `Status` · `Feature` (the `docs/history/<feature>/` slug once opened, `—` while unstarted).
- **Status enum — exactly `proposed / in-flight / done`** (D6), no others. This enum is the same literal `BACKLOG_STATUSES` the parser (`.bee/bin/lib/backlog.mjs`) counts; do not invent a fourth status.
- **Priority order is the row order.** Highest-priority PBI at the top; reorder rows to re-prioritize — position is the signal, no separate rank column.

**Merge rules (scribing-owned, specs pattern):**

- **Append, never fork.** A new deferred request appends a `proposed` row with the next free `P<n>` ID at its priority position. There is never a second backlog file.
- **In place forever.** A PBI's row is updated where it sits; history lives in git, never in a "was proposed" note.
- **Flip triggers are the only status writes (D11), and they are prose-ruled, never hook-enforced (D7):**
  - **(a) exploring opens a feature matching a row** → that row flips to `in-flight` and gains the feature slug; if the request never passed through the backlog, exploring creates the row first, then flips it (D11a — owned by exploring).
  - **(b) feature close** (scribing sync, or compounding when no `behavior_change` cell ran) → the matching row flips to `done` and gains a link to `docs/history/<feature>/` (D11b — owned by scribing at sync).
- **No validation coupling.** A cell may carry an optional `pbi` field naming a row ID; a missing or stale reference is a grooming find, not a cap blocker (D9).

**Runnable surfaces already exist (shipped by harness10-6) — reference them, never re-describe machinery here:** `node .bee/bin/bee.mjs status --json` reports `pbi: { proposed, in_flight, done } | null`, and the session preamble carries one line `PBI: N done / N in-flight / N proposed` whenever `docs/backlog.md` exists. Drift (an `in-flight` row with no active feature, a `done` feature with no row, duplicate rows for one story) is caught by grooming's audit, not by any hook.

## State Record

```json
{
  "phase": "scribing",
  "summary": "Synced 2 area specs (job-posting-form full, applicant-inbox partial, 3 gaps)",
  "next_action": "Invoke bee-compounding."
}
```

`bee-compounding` checks this record as its state-layer guard; if scribing has not run for the feature, compounding invokes it rather than syncing inline.
