# OKF Switchover F3 — Context

**Feature slug:** okf-switchover-f3
**Date:** 2026-07-22
**Lane:** high-risk
**Domain types:** RUN (skill behaviour), ORGANIZE (where knowledge lands), CALL (`knowledge context` ranking)

## Feature Boundary

Flip the system of record: **new knowledge is written into `docs/knowledge/`**, and the legacy trees
become a **read-only compatibility surface**. Ends when bee-scribing authors concepts, the reading
order points at the bundle, a guard prevents new content landing in `docs/specs/`, and the context
consumer stops drowning its own manifest. Deleting stubs is **not** in scope — they are the
compatibility layer.

## Locked Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| G1 | **Bundle-first with fallback — the skills must work in a repo that has no bundle.** Every rewired skill checks for `docs/knowledge/` first; when it is absent (an un-migrated host repo), behaviour falls back to today's `docs/specs/` path **unchanged**. The fallback is not a deprecation warning and never nags. | bee ships to other repos. Owner requirement: old projects keep working. A switchover that only works in bee's own checkout would break every host on the next release — the exact opposite of compatibility. |
| G2 | **`docs/specs/` becomes read-only for NEW content, enforced mechanically.** A chain check fails when a file under `docs/specs/` is neither a pointer stub, `reading-map.md`, nor `okf-profile.md` — i.e. when new prose lands there. Existing stubs are never touched, never deleted, and always resolve their anchors. | Prose alone rots: `bee-scribing` referenced `docs/specs/` eight times and `docs/knowledge/` zero while the bundle already held 116 concepts. Only a guard makes "read-only" true. In a host repo with no bundle the check is inert (G1). |
| G3 | **`bee-scribing` authors concepts.** For a subject already owned by a concept, it updates that concept; for a new subject in an existing area, it authors a new concept in that area and regenerates the index; for a brand-new area, it creates `areas/<slug>/` with an `overview` concept. Frontmatter is emitted through the canonical emitter, never hand-written. | This is the switch. Everything else in the OKF programme is preparation for it. Hand-written frontmatter was caught `not_canonical` by the round-trip guard three separate times this programme — including twice by the orchestrator. |
| G4 | **The reading order becomes bundle → decisions → history.** `bee-hive`'s Session Scout and `bee-planning`'s bootstrap read `docs/knowledge/` first; `docs/specs/` is named only as the compatibility surface. `reading-map.md` stays hand-written but points at the bundle. | An agent told to read the spec before the code must be sent to where the spec now lives. |
| G5 | **`context` ranks critical patterns by relevance and cuts (supersedes D27's include-every rule).** Ranking is tag/area overlap with the work item; a small guaranteed floor of the highest-relevance patterns is always included so a genuinely universal lesson is never evicted. | Measured on first real use: 40 of 45 manifest entries were critical patterns consuming 13,000 of 19,726 tokens, most irrelevant, with 7 further patterns truncated — so an irrelevant pattern could evict a relevant one. The consumer built to stop context waste had become its largest source. |
| G6 | **`okf-profile.md` moves into the bundle it describes**, migrated by the same loop and gate as every other area, leaving a pointer stub. | The spec defining the bundle sitting outside it is the last piece of the old model still pretending to be current truth. |
| G7 | **Stubs are never deleted in this feature.** Seven live citations in `skills/**` and `guards.mjs` resolve through them; deletion requires repointing those first and is its own later feature. | Already filed as a P2 finding. A stub deleted before its readers move is a silently broken doc — the failure this programme exists to prevent. |

## Existing Code Context

- `skills/bee-scribing/SKILL.md` — 8 references to `docs/specs/`, 0 to `docs/knowledge/`. The rewire target.
- `.bee/bin/lib/knowledge.mjs` — `emitFrontmatter`/`parseFrontmatter`, `collectConcepts`, `buildContextManifest` (G5's edit site), `renderKnowledgeIndexes`.
- `skills/bee-hive/SKILL.md` §Session Scout, `skills/bee-planning/SKILL.md` §2 — G4's edit sites.
- `scripts/okf_migrate.mjs` — the migration loop and its eleven pins; G6 reuses it unchanged.
- `docs/specs/` — 10 stubs + `reading-map.md` + `okf-profile.md` + a 7-line `system-overview.md`.

## Outstanding Questions

### Deferred To Planning
- [ ] Whether G2's guard lives in `okf_migrate.mjs` or its own script — turns on whether host repos need it (they do not, per G1, so a bee-repo-only script may be right).
- [ ] What relevance signal G5 uses beyond tags — the work item carries `tags`, `areas`, and `decisions`; measuring which of those actually separates the 5 relevant patterns from the 40 is a real experiment, not a guess.
- [ ] Whether `system-overview.md` (7-line unwritten stub) is written as a concept or left as an open gap — no content exists to migrate, so writing one means authoring, not migrating.

## Deferred Ideas
- Repointing the 7 stub-resolved citations, then deleting stubs (its own feature).
- Migrating the 27 long-form decision records into `bee.decision` concepts.
- Migrating active feature `CONTEXT.md` files into `work/<id>/work-item.md`.
