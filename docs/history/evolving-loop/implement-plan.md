---
feature: evolving-loop
pbi: P18
lane: high-risk
status: Shipped
slice: A (data plane)
rendered_from:
  - docs/history/evolving-loop/plan.md
  - docs/history/evolving-loop/approach.md
  - decision 20784de8 (2026-07-10)
---

# Implement Plan — evolving loop, slice A

> Projection of the truth artifacts. Truth lives in [`plan.md`](./plan.md), [`approach.md`](./approach.md),
> and decision `20784de8`. Feedback on this brief flows back into those first, then this re-renders.

## Review Status

| Gate | State |
|---|---|
| 1 — context | n/a (surface-scope-earlier; decision `20784de8` is the locked scoping synthesis) |
| 2 — shape | **Approved** — owner, at this document. Iron Law resolution: **(a) full**, decision `ff26725d` |
| 3 — execution | pending — `bee-validating` next |
| 4 — review | pending |

## Goal / Success

Bee learns from how it actually behaves in the repos that use it, and turns that into a shipped
improvement — without any effort from the host projects and without ever letting their code leave
their machine.

Slice A succeeds when: any repo running bee produces a safe `feedback-digest.json` as a **side
effect of closing a feature** (per D1), that digest provably contains no project code and no
secrets (per D2), and the bee repo can read the digests of every repo listed in `dogfood_repos`.

Cited decisions: **D1** zero-effort dogfooding · **D2** meta + short text only, never project code ·
**D3** `bee-evolving` is bee-repo-only, on demand · **D4** Iron Law on every improvement ·
**D5** two human gates, push never auto.

## Current State

Bee already records everything the loop needs — it just never reads it back:

- `.bee/backlog.jsonl` collects friction and findings (`bee-compounding` §7 files them).
- `.bee/decisions.jsonl` holds process decisions.
- `.bee/cells/*.json` traces carry `friction`, `deviations`, and `blocked_reason` per cell.
- `docs/history/learnings/*.md` hold dated learnings with frontmatter severity + Recommendation lines.
- `docs/history/<feature>/reports/residual-findings.md` holds anything a review failed to file.

Nothing aggregates these, nothing crosses a repo boundary, and no skill reads them to improve bee.
The known first candidate — workers leave `trace.friction` empty (gogl harvest, 2026-07-10) — is
exactly the kind of finding this loop is meant to surface and fix.

## Scope

**In (slice A):** the collector library, the `bee_feedback.mjs` CLI, the `dogfood_repos` config key,
and the `bee-compounding` refresh step.

**Out (slice B, planned next):** the `bee-evolving` skill itself, its ranking/gating protocol, hive
routing, `07-contracts.md` + `config-reference.md` updates, decision `0022`, backlog flip, version
bump `0.1.19`. Split at the 4/5 boundary on the advisor's recommendation: the skill's pressure tests
and its Gate-A ranking are only honest when run against **real digests produced by slice A**.

**Out (permanently):** shipping digests off the machine; auto-applying a ranked fix; letting
`bee-evolving` read a host repo's raw `.bee/` (the digest *is* the redaction boundary).

## Proposed Approach

Three layers, each mirroring a pattern that already exists in this repo rather than inventing one.
Rendered from [`approach.md`](./approach.md); alternatives rejected there (central service, raw
cross-repo reads, auto-apply, append-log digest) are not re-litigated here.

1. `lib/feedback.mjs` — collect + redact + build the digest snapshot.
2. `bee_feedback.mjs` — thin CLI in the exact shape of `bee_capture.mjs`.
3. `dogfood_repos` in `.bee/config.json` — the bee repo's list of digest sources.

Plus one step appended to `bee-compounding` so the digest refreshes itself at feature close.

## Technical Design

**Flow.** `bee-compounding` finishes writing its learnings file, then calls
`bee_feedback.mjs digest`. The CLI calls `buildDigest(root)`, which walks the five bee-owned
sources above, normalizes each entry into a common shape, runs it through the safety pipeline, and
atomically writes `.bee/feedback-digest.json`. In the bee repo, `bee_feedback.mjs collect` reads
`dogfood_repos` from config, loads each repo's already-written digest, and merges them into one
in-memory view keyed by cluster. Slice B's skill consumes that view; nothing else does.

**Data shape.** The digest is a **snapshot**, regenerated each close — never an append log, because
an append log would re-count every re-observed friction and corrupt the `frequency` term. Each
entry carries: `kind` (friction | finding | deviation | blocked | learning | residual), `layer`,
`title`, `normalized_title`, `text` (safe prose), `pain`, `first_seen`, `source` (cell id or file
path), and `repo_label`. The digest carries `schema_version`, `generated_at`, `counts`, and
`dropped` (entries the safety pipeline could not make safe).

**Ranking terms live in the schema, not in the skill.** The plan pins them because `pain` does not
exist in the raw data — friction rows carry no severity, only `finding` rows do. So the digest
computes: `pain` from `finding.severity` (P1→3, P2→2, P3→1) or a learnings file's frontmatter
severity, defaulting to **1** for plain friction rows; `frequency` deduped across repos on
`(layer, normalized_title)`; `corroboration` as the count of contributing repos plus 1 when a
learnings Recommendation matches the key. Clustering beyond exact key match is explicitly out of
scope for v1. An LLM-judged `pain` at read time would make the ranking non-deterministic, which the
test matrix forbids.

**Security surface — see the dedicated section below.** It is the reason this feature is high-risk.

**What the artifacts do not decide** (Open Questions, below): the exact `dogfood_repos` value shape,
the digest's gitignore posture in host repos, and whether slice B's WSL deploy is scripted.

## Security / Permissions (mandatory — high-risk)

The collector reads **another repository's tree**. Two invariants, enforced in code, not prose:

**Invariant 1 — read scope.** No path outside `.bee/` and `docs/history/` is ever opened. Project
source is never touched, so it can never be read.

**Invariant 2 — text safety.** Read scope alone does *not* make the digest free of project code,
because workers paste code into `trace.friction` and backlog `detail` routinely — this repo's own
`.bee/backlog.jsonl` today contains shell fragments (`grep -q '['`) and function names
(`readBacklogCounts`). The original plan's claim of "never project code" was therefore stronger
than anything the code could enforce. The honest, enforced pipeline, in order:

1. strip fenced **and** indented code blocks → replace with `[code omitted]` + a path reference;
2. reject on `SECRET_CONTENT_PATTERNS` and `INJECTION_PATTERNS` (reused verbatim from
   `lib/decisions.mjs`, already proven by `lib/capture.mjs`);
3. truncate to a hard character cap, marking the truncation;
4. **drop and count** any entry that cannot be made safe (`digest.dropped`) — never silently swallow.

`residual-findings.md` is referenced **by path**, never inlined. The digest never leaves the
machine: it is a local file, read locally, by a skill that runs only in the bee repo (D3).

The contract wording in slice B's `07-contracts.md` will state this enforced invariant — *no project
files opened; code blocks stripped; short prose fragments bounded by cap* — not the unenforceable
stronger claim.

## Affected Files

Projected from `approach.md` (cells do not exist yet; re-projected from cell `files` after prep).

| File | Change |
|---|---|
| `skills/bee-hive/templates/lib/feedback.mjs` | **new** — collector, safety pipeline, digest builder |
| `skills/bee-hive/templates/bee_feedback.mjs` | **new** — `digest` / `collect` / `count` CLI |
| `skills/bee-hive/templates/lib/state.mjs` | `readConfig` normalizes `dogfood_repos` |
| `skills/bee-hive/templates/tests/test_lib.mjs` | new assertions for every test-matrix row |
| `skills/bee-hive/scripts/test_onboard_bee.mjs` | asserts `bee_feedback.mjs` + `lib/feedback.mjs` copied verbatim |
| `skills/bee-compounding/SKILL.md` | one step: refresh the digest at close (D1) |
| `.bee/config.json` | `dogfood_repos` recorded for this repo |

No manifest edit is needed for the new helper — `onboard_bee.mjs` copies `templates/*.mjs` and
`templates/lib/*.mjs` by directory scan.

## Implementation Steps

Projected from the created cells (authoritative). Only `evolving-1` is `ready`; the rest unlock as
their deps cap.

1. **`evolving-1` (standard, no deps)** — `lib/feedback.mjs`: `collectFeedback(root)` +
   `buildDigest(root)`, read scope hard-limited, code-block stripping, redaction, truncation,
   drop+count, `pain` computed, `SCHEMA_VERSION` pinned.
2. **`evolving-2` (small, deps: `evolving-1`)** — `bee_feedback.mjs` CLI (`digest` / `count` /
   `collect`) + the two onboard copied-verbatim assertions. No business logic in the CLI.
3. **`evolving-3` (small, deps: `evolving-1`)** — `dogfood_repos` normalization (both value shapes),
   `mergeDigests` with the `(layer, normalized_title)` cluster key and deterministic rank +
   tie-break. Parallel-safe with step 2.
4. **`evolving-4` (standard, deps: `evolving-2`)** — `bee-compounding` refresh step; a failing
   refresh warns and **never blocks a host project's close** (D1). A *skill edit*, so it carries the
   **full Iron Law**: RED pressure scenarios recorded before any SKILL.md content, then GREEN.

## Validation Plan

Describes what **will** run. Nothing has run yet; no result is claimed.

Baseline for this session is green (70/70 `test_lib.mjs`, `test_onboard_bee.mjs` PASS — recorded at
session start, before any cell was claimed).

Cells 1–3 verify with the repo's recorded verify command:
`node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`

The suite must gain assertions for each row of `plan.md`'s test matrix. The four that carry the
high-risk weight:

- a friction field holding an **API key** → entry dropped, `dropped === 1`, the key absent from the digest bytes;
- a friction field holding a **fenced** and an **indented code block** → both replaced by `[code omitted]`, prose retained;
- the collector pointed at a repo containing project source → **no path outside `.bee/` + `docs/history/` opened**;
- `digest` run twice on unchanged inputs → **byte-identical** output.

Plus: empty repo, malformed JSONL line, cell without `trace`, missing `dogfood_repos` entry,
truncation boundary, deterministic tie-break on oldest `first_seen`, `SCHEMA_VERSION` drift pin, and
a compounding close that survives a throwing digest refresh.

## Risks & Mitigation

| Component | Risk | Mitigation / proof at validating |
|---|---|---|
| `lib/feedback.mjs` read scope + pasted code (D2) | **HIGH** | The four security assertions above; `dropped` is counted and surfaced, never silent |
| Cross-repo paths under WSL / Git Bash | **MEDIUM** | Critical pattern `[20260708]`: node cannot resolve MSYS `/tmp`. All `dogfood_repos` entries go through `path.resolve` + existence check; a missing repo warns and is skipped |
| Digest schema is a public contract | **MEDIUM** | `SCHEMA_VERSION` pinned by a drift test, mirroring `BACKLOG_STATUSES`; contract text lands in slice B |
| `bee-compounding` chain change | **LOW** | Existing suite + an assertion that a throwing refresh does not fail the close |
| Ranking determinism | **MEDIUM** | `pain` / `frequency` / `corroboration` computed in the digest; ties broken by oldest `first_seen`; no LLM judgment at read time |

## Rollback Plan

The digest is a **generated artifact**, not state: there is no migration, no schema to reverse, and
nothing outside the repo to undo. Rollback of slice A is therefore complete and cheap:

1. `git revert` the slice's cell commits (each cell commits with its id, so the set is exact).
2. Delete `.bee/feedback-digest.json` in this repo and in any dogfood repo that generated one —
   deleting it costs nothing, because the next feature close regenerates it from scratch.
3. Remove the `dogfood_repos` key from `.bee/config.json`. `readConfig` treats it as absent, and
   `collect` returns the local digest only.
4. Re-run the verify command to confirm the suites return to the pre-slice baseline.

The `bee-compounding` refresh step is the only edit to an existing behavior; reverting its commit
restores the previous close chain exactly. **No host project can be left broken by a rollback**,
because a failing or absent digest was already specified to warn rather than block (D1).

## Open Questions

1. ~~Iron Law vs. mechanical skill edits~~ — **RESOLVED at Gate 2.** Owner chose **(a) full Iron
   Law, no exemption carved**. Decision `ff26725d-bbf8-49b5-99cf-ed8edbc26b0d`. `evolving-4` and
   every slice-B wiring cell carry RED/GREEN pressure-test evidence.
2. `dogfood_repos` value shape — bare string array, or `{path,label}` objects? *(`evolving-3`
   assumes: accept both, normalize to objects. Confirm at validating.)*
3. Is `.bee/feedback-digest.json` gitignored in host repos, or committed as a visible artifact?
   *(Plan assumes: bee writes it and never touches the host's gitignore.)*
4. Is slice B's "WSL deploy" a scripted step or the existing manual copy into `~/.claude/skills/`?
   *(Plan assumes: named, not scripted. Resolve before slice B, not now.)*
