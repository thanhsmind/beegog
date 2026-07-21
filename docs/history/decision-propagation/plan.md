---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-21 (auto-approved, gate bypass total)
---

# plan — decision-propagation

Source: `docs/history/decision-propagation/CONTEXT.md` (D1–D8, GH #32/#33/#34). **Amended 2026-07-21:** D7/D8 (reporter follow-up on #32) moved the non-semantic decision memory layer IN scope — mandatory classification + retro-tag backfill + index-as-recall-surface + ranked multi-term search; embedding recall stays deferred.

## Mode-gate record

Flags counted: **data model** (decide/supersede event schema gains `tags[]`, `scope` semantics; archive store split), **multi-domain** (CLI + skill prose rules + specs/backlog), public-contract adjacency (new CLI verbs/flags on bee's own surface). = 2–3 flags → **standard**. Smaller modes insufficient: the change spans the store library, the dispatcher, two skills' prose rules, and spec/backlog surfaces — more than 3 product files and story-sized behavior. No hard-gate flag (no auth/data-loss/external provider; append-only stores are extended, never rewritten).

## Discovery (L1 — cited precedent, no discovery.md)

- Archive split precedent: `cells archive`/`unarchive` verbs already exist (bee.mjs manifest) — reuse the shape for `decisions archive`.
- Read-time derivation precedent: `deriveCandidateStatus` (`lib/reviews.mjs:449-479`), `advisorRefStale` (`lib/state.mjs:1547-1580`) — sweep and index are derived, never stored state.
- Store/write path: `lib/decisions.mjs:54-141` (`logDecision`, `logSupersede`, `activeDecisions`); search/active handlers `bee.mjs:1407-1429`. Byte-mirror law: every `.bee/bin` change lands in `skills/bee-hive/templates/` too (`test_lib_mirror.mjs` enforces).
- Capture stub write path exists (`capture add`, decision 0017) — the sweep reuses it for unresolved hits.
- Test home: suite files under `scripts/test_*.mjs` + `skills/bee-hive/templates/tests/`, discovered by `run_verify` (54 suites). New `test_decisions_propagation.mjs` follows that pattern.

## Approach

**Chosen path:** extend the existing decisions module in place; all consistency derived at read/mutation time (per D5). Four behavior areas, each mechanically testable:

1. **Recall (D4):** `logDecision` accepts optional `tags: []`; `scope` becomes the area dimension (existing field, no migration — legacy `"repo"` groups under `repo`). `decisions search` gains `--tag`, `--scope` (alias `--area`), `--since`, `--all`; matching stays substring for `--text`, exact (case-insensitive) for tag/scope.
2. **Supersede propagation (D2/D6):** `logSupersede` accepts `--tags/--scope`, inheriting both from the superseded target when omitted. After writing the event, the handler runs the **propagation sweep**: scan `docs/**` (text files) for the superseded id (full uuid and short8); result `{hits: [{file, line, excerpt}]}` is printed and recorded in the supersede event (`sweep` field). For every hit the caller does not resolve in-turn, the CLI appends a capture stub (`source: "supersede-sweep"`) — a supersede with unreconciled hits is loud, never silent.
3. **Archive (D4c):** `decisions archive` moves superseded/redacted events plus decide events older than `--before <date>` (no default purge) to `.bee/decisions-archive.jsonl`, all-or-nothing under the store lock; `search --all`/`active --all` read the union.
4. **Index (D4b):** `decisions render` writes `docs/decisions/index.md` grouped by scope → tag, newest-first, superseded excluded, each entry `short8 · date · decision (first line)`; regenerated file carries a provenance header. Supersede events group per D6 inheritance.

**Prose layer (slice 2):** bee-scribing D11b gains the per-CoS-clause evidence rule (D1) — flip only when every clause has cited evidence; otherwise annotate `Delivered:`/`Remaining:` in the row and keep `in-flight`; bee-compounding fallback inherits the same rule. Citation discipline (D3) lands in scribing's reference (spec sections and backlog rows cite short8 ids). Specs sync + GH issue closure ride the normal scribing close.

**Rejected alternatives:** stored graph / relation store (recreates the two-sources-of-truth bug — D5); embedding/vector memory (still deferred — D8c; the non-semantic memory layer itself is now D7/D8 scope); a new `area` field (collides with existing `scope` — fresh-eyes P2, folded into D4).

**Risk map:**
- store lock + append-only integrity under archive split — MEDIUM → proof: concurrency test reusing `test_state_write_concurrency` pattern; all-or-nothing archive txn.
- short8 false positives in sweep (8-hex prefix matching an unrelated hex string) — LOW → word-boundary regex, tested.
- sweep runtime over large docs/ — LOW → single recursive scan, text files only.
- prose-rule change regressing existing scribing flows — LOW → prose only, no hook change.

**Open questions for validating:** exact CLI flag names vs existing conventions (`--json` shape parity); where the sweep excerpt length caps; whether `decisions render` belongs in the release-manifest render set.

## Slices

- **Slice 1 (in flight): store + CLI core** — 4 cells: (dp-1, capped) tags/scope + search filters; (dp-2) supersede inheritance + propagation sweep + stub fallout; (dp-3) archive verb + union search + shared locked-append primitive; (dp-4, patched overlay-aware) index render. Each: lib + dispatcher + template mirrors + manifest render + tests; `run_verify` green.
- **Slice 2 (shaped 2026-07-21, plan-checked): memory layer (D7/D8)** — 3 cells: (dp-5) retro-tag event `decisions tag` + overlay merge across union reads + locked-append routing; (dp-6) taxonomy + write-time classification enforcement + ranked multi-term search + `--untagged`; (dp-7) legacy backfill (agent-run extraction batches) + index re-render + recall-surface promotion in skill prose. Plan-check iter-1: BLOCKER B1 (tag append outside dp-3's lock) resolved via the shared-primitive contract in dp-3/dp-5; W2/W3/W5 folded into cell text; dp-4 gained deps dp-5/dp-6.
- **Slice 3: prose rules + specs** — scribing/compounding D1/D3 amendments, spec sync, backlog/issue closure.
- **Slice 4: end-to-end proof** — one real supersede dry-run in this repo exercising sweep→reconcile→stub→index, then GH #32/#33/#34 closed with evidence.

## Test matrix sketch (edge dimensions)

Empty store · store with only legacy events (no tags/scope) · supersede of missing id (typed refusal) · supersede inheriting from a metadata-less target (falls back `repo`) · sweep zero hits / multi-file hits / short8 word-boundary non-hit · archive on empty/missing archive file · archive idempotency (second run no-op) · `--all` union ordering · index render determinism (byte-stable given same store) · concurrent log-vs-archive under store lock · CRLF/whitespace tolerance in sweep scan.
