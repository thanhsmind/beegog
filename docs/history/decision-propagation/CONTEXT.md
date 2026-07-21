# CONTEXT — decision-propagation

**Feature slug:** `decision-propagation` · **Date:** 2026-07-21 · **Source:** GitHub issues #32, #33, #34 (reporters: thanhsmind, vantt)

## Boundary

In scope: bee's own decision lifecycle and backlog machinery — the `decide`/`supersede` event flow (`.bee/decisions.jsonl`, `lib/decisions.mjs`, `bee.mjs` decisions verbs), the backlog done-flip rule (bee-scribing D11b + bee-compounding fallback), and decision retrieval (`decisions search`/`active`). The fix is **generic bee behavior** — the concrete failing artifacts named in the issues (`STR64` row, decision pair `1178cfce`→`df90b761`) exist only in the reporter's host repo, not in beegog; zero grep hits here. Out of scope: P36's machine-readable claim/conflict detection (adjacent, stays `proposed`), embedding/vector recall (still deferred — D8), host-repo cleanups. **Amended 2026-07-21 (slice 2, reporter follow-up on #32):** a decision *memory layer* — mandatory classification (tags from a canonical taxonomy, retro-tag backfill of legacy events) plus the derived index promoted to the guaranteed recall surface — is now IN scope (D7/D8); grep/substring alone was re-confirmed insufficient for complete recall.

## Domain types

- `ORGANIZE` — decision event schema (tags/area), archive split, derived index.
- `CALL` — CLI surface: `decisions log/supersede/search/active`, new sweep/archive/index verbs, backlog flip helper.
- `RUN` — the supersede propagation sweep and done-flip evidence check as steps of existing scribing/compounding flows.
- `READ` — the derived decision index document.

## The three reported failures (evidence)

1. **#34 premature done-flip:** the flip rule binds to "scribing run closes a feature that matches a backlog row → flip to done" (`skills/bee-scribing/SKILL.md:96`; fallback `skills/bee-compounding/SKILL.md:81`). The CoS column (`docs/backlog.md:3` — `| ID | Story | CoS | Status | Feature |`) is defined but never compared against what the feature actually delivered → a feature delivering a subset of a row's CoS still flips the whole row to `done`.
2. **#33 supersede does not propagate:** a `supersede` event only copies the target id into its own `supersedes` field; resolution is read-time filtering in `activeDecisions` (`lib/decisions.mjs:124-141`). Nothing touches artifacts that *embody* the old decision (backlog row bodies, specs, CONTEXT/plan files) — every session entering through the artifact re-derives the dead conclusion. Repeated in the field per the reporter.
3. **#32 recall at scale:** 411 events / ~322KB; `decisions search` is a case-insensitive substring `.includes` over `decision`/`rationale`/`alternatives` (`bee.mjs:1418-1429`), no tag/area/date filters, no index, no archive. `bee-planning/SKILL.md:62` even *says* "tag-matched search" but no tag field exists.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Done-flip requires per-clause CoS evidence.** At flip time (scribing sync, or compounding fallback), every CoS clause of the matched row is enumerated with cited delivered evidence. Any clause without evidence → the row does NOT flip: it stays `in-flight` and its CoS text gains a `Delivered:`/`Remaining:` annotation naming the subset. Splitting the remainder into a new row is allowed when the delivered subset is independently shippable; silent full-flip on partial delivery is never allowed. | Feature-done ≠ PBI-done is exactly the #34 bug; the CoS column already exists as the acceptance bar — the fix is to make the flip *read* it. Stays prose-ruled (D7 of scribing) but gains a mechanical checklist so the rule is checkable, not vibes. |
| D2 | **A supersede is not finished until citing artifacts are reconciled.** `decisions supersede` gains a mechanical propagation sweep: scan `docs/**` (backlog, specs, history CONTEXT/plans/briefs, docs/decisions) for the superseded id (full and short8) and report the hit list. Each hit is edited same-turn or explicitly waived; every unresolved hit becomes a capture stub (`capture add`) so the next flush surfaces it. The supersede event records the sweep result. | #33's root cause verbatim: "thay đổi chỉ rơi vào decision-log, KHÔNG lan ngược về artifact nguồn." The store's read-time filter is correct but artifacts are the natural entry points; reconciliation must ride the same turn as the reversal. Grep-based sweep is cheap, deterministic, and matches bee's no-stored-index idiom. |
| D3 | **Citation discipline makes the sweep reliable.** When an artifact (backlog row, spec section, CONTEXT/plan) encodes a decision, it cites the decision id (short8 form). Scribing's existing `reconcile decisions` frontmatter step (`bee-scribing/SKILL.md:71`) inherits this; the sweep in D2 finds only what is cited — uncited embodiments are the residual risk and the reason citation is now a rule, not a style. | A propagation sweep can only reach what is reachable. This is the lean answer to #34's "graph to reach every constraint": edges are citations discovered by scan at supersede time, never a stored graph artifact to drift. |
| D4 | **Recall at scale = structured fields + filters + derived index + archive, not a memory layer.** (a) No new `area` field — the existing `scope` field (today defaulted to `"repo"` in most records) becomes the area dimension: it carries the spec-area slug going forward; `decide` events additionally gain optional `tags[]`. `search` gains `--scope` (alias `--area`), `--tag`, `--since` filters alongside substring. (b) A derived, CLI-rendered index (grouped by scope/tag, newest-first, superseded excluded; legacy `"repo"`-scoped events group under `repo`) lives under `docs/decisions/` — regenerated, never hand-edited. (c) An explicit archive verb moves superseded/redacted and aged-out events to `.bee/decisions-archive.jsonl` (same pattern as `cells archive`), keeping the active file small; `search --all` reaches the archive. | #32's ask ("memory layer để index và search") answered with bee's existing idioms: read-time derivation (cf. `deriveCandidateStatus`, `advisorRefStale`), CLI-owned stores, greppable text. Reusing `scope` avoids two overlapping navigation fields (fresh-eyes P2 finding; P36 documented the overlap). Semantic memory deferred until structured recall demonstrably fails. Optional fields → zero migration for the 411 existing events. **Amended by D7/D8 (2026-07-21):** the deferral clause is superseded — the reporter (#32) re-confirmed grep-based recall gives no completeness guarantee; parts (a)/(b)/(c) stand unchanged. |
| D6 | **Supersede events inherit navigation metadata.** `decisions supersede` accepts `--tags`/`--scope` and, when omitted, inherits both from the decision it supersedes — so `activeDecisions` (which treats supersede events as live decisions) always yields index-groupable records; legacy metadata-less supersede events group under their superseded target's scope at render time, `repo` as last resort. | Fresh-eyes P2: D4's index had no rule for active supersede events (today `scope` is absent from every one). Inheritance keeps the reversal discoverable exactly where the original lived. |
| D7 | **Classification is a mandatory write-time step, with retro-tag backfill for legacy events.** (a) A canonical tag taxonomy lives at `docs/decisions/taxonomy.json` — hand-curated vocabulary (seeded by the backfill classification), read by the CLI when present. (b) Once the taxonomy file exists, `decisions log` refuses a `decide` event with zero tags (bootstrap-safe: no taxonomy → warn only); unknown tags are accepted and appended to the taxonomy's `candidates` list, so vocabulary grows in the same call — never a refusal loop. (c) New append-only retro-tag event: `decisions tag <id> --tags … [--scope …]` (batch: stdin JSON array); `activeDecisions`/filters merge tag-event overlays onto their target at read time — jsonl lines are never rewritten. (d) One-time backfill: every legacy untagged event (active + archive) is classified by agent-run extraction-tier batches and applied via the batch verb; completeness is checkable (`decisions search --untagged` listing must reach zero). | The recall hole D4 left open is exactly the untagged event: `--tag` filters silently skip it, and substring text search is the only net under it. Classification enforced at write time plus backfill closes the hole for both directions of time. Read-time overlay reuses the supersede resolution idiom (D5) — append-only preserved, zero migration. |
| D8 | **The memory layer = classification completeness + the derived index as the recall surface — not better grep.** (a) `docs/decisions/index.md` (D4b/dp-4) is promoted from convenience doc to the recall surface: complete by construction (rendered from the store, never grepped), grouped by scope→tag, cited by skills — area reading order becomes spec → decision index (area section) → history. (b) `decisions search --text` upgrades from single-substring to multi-term matching (whitespace-split, case-insensitive, OR across terms) with deterministic hit-count ranking, matched over decision/rationale/alternatives **and tags**; `--all` unions the archive (D4c). (c) Embedding/vector recall stays deferred: no daemon, no external deps (D5 intact) — revisit only if classified+indexed recall still misses in practice. | "Grep không đảm bảo recall đầy đủ" is answered structurally, not probabilistically: the guarantee comes from every event being classified (D7) and the index being derived-complete, while ranked multi-term search improves the ad-hoc path without adding a second source of truth. |
| D5 | **No stored graph, no background daemon.** All consistency is derived at read/mutation time by the CLI verbs above, mirroring `deriveCandidateStatus` (reviews.mjs:449) and `advisorRefStale` (state.mjs:1547) — event-anchored, never TTL, never a second source of truth. | Two sources of truth is what caused #33; adding a third (a graph store) would recreate the bug one level up. |

## Pinned terms

- **Citing artifact** — any file under `docs/**` whose text cites a decision id; the unit the D2 sweep reconciles.
- **CoS clause** — one independently checkable proposition inside a backlog row's CoS column.
- **Delivered subset** — the portion of a row's CoS clauses with cited evidence at a flip attempt; recorded in the row when the flip is refused.
- **Propagation sweep** — the mechanical scan-and-reconcile step riding `decisions supersede`.

## Scout paths

- `.bee/decisions.jsonl` (411 events; 400 decide / 11 supersede / 0 redact), `lib/decisions.mjs:54-141`, `bee.mjs:1407-1429` (+ byte-mirror `skills/bee-hive/templates/bee.mjs`)
- `skills/bee-scribing/SKILL.md:45,96` · `skills/bee-compounding/SKILL.md:81` · `docs/backlog.md:3` (schema), row P36 (adjacent)
- Reusable staleness idioms: `lib/reviews.mjs:449-479`, `lib/state.mjs:1547-1580`
- Decision-lifecycle touchpoints inventory: bee-hive, bee-planning, bee-scribing, bee-compounding, bee-briefing, bee-grooming, bee-executing, bee-bypass-gate

## Open questions (for planning)

- Sweep root is pinned to `docs/**` (D2); `.bee/spikes/` is outside it and stays excluded — disposable proofs are never authoritative artifacts. Planning only tunes globs *within* `docs/**`.
- Archive age window and whether archive is offered automatically at a size threshold or stays manual.
- Whether the done-flip check gets its own CLI helper (`backlog flip --id … --evidence …`) or remains a rendered checklist inside the scribing turn.
- Index render target: one `docs/decisions/index.md` vs per-area sections.

## Deferred ideas

- Embedding/vector decision recall (D8c: revisit only if classified+indexed recall — D7/D8, slice 2 — still misses in practice). The non-semantic memory layer itself moved IN scope 2026-07-21.
- P36 machine-readable claims + conflict detection (already a backlog row; D4's `tags[]`/`area` are navigation metadata, not claims).
- Host-repo repair tooling (a doctor that finds stale embodiments in an already-drifted host repo) — the sweep only protects future supersedes.

## Canonical references

- GitHub issues: #32 (store structure/index), #33 (supersede propagation), #34 (premature done-flip)
- Recovery/staleness idioms: decisions 565e68d0 (review candidates), advisor-ref anchors (workflow-state spec)
