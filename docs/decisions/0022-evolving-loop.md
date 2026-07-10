# 0022 — Evolving loop: dogfood feedback, the allowlist, and the gated self-improvement skill (P18)

- **Status:** active — shipped in two slices; built in `0.1.19`.
- **Date:** 2026-07-10 (slice A design `20784de8` 2026-07-10T05:04Z, superseded by the allowlist
  `8cd4c84e` 2026-07-10T05:37Z after validating measured the real corpus; Iron Law binding
  `ff26725d` 2026-07-10T05:22Z; slice B shape approved at Gate 2 2026-07-10; this record written at
  slice B's close).
- **Source:** owner discussion 2026-07-10 — bee should learn from its own collected friction (its
  own backlog, learnings, and cell traces) and ship itself improvements, gated the same way any
  self-modification in this repo is gated.
- **Confidence:** 0.7 (the loop, its two human gates, and the security boundary are shipped and
  pressure-tested; `corroboration`'s real-world value is unmeasured beyond one foreign repo with
  zero overlapping clusters today — see Deferred).

## Decision

### D1 — dogfood repos stay zero-effort

The feedback digest is a side effect of `bee-compounding`'s close-time refresh (evolving-4), not a
separate chore. A repo running bee produces `.bee/feedback-digest.json` automatically at every
compounding close; nothing extra is asked of a host project to participate.

### D2 (revised) — the digest is an allowlist, not a redaction filter

**Supersedes `20784de8`'s original D2** (a free-text `detail` field with a code-block strip + secret
regex), via `8cd4c84e`. Validating measured the real corpus across five bee repos and found the
original D2 unenforceable: friction `detail` prose routinely names functions, files, and config keys
(`readBacklogCounts`, `COMMAND_KEYS`, `approved_gates.shape`, internal call graphs) that pass a
code-block strip, pass the secret/injection regexes, and fit inside the length cap — every one of
them would ship. Rather than advertise a guarantee the pipeline could not keep, the owner chose to
**drop the free-text surface entirely**. The digest now carries only a closed allowlist of
structured fields per entry — `kind`, `layer`, `source`, `title`, `first_seen`, `pain` — plus a
`dropped[]` array of `{kind, layer, source, first_seen, reason}` for anything unsafe. There is no
`detail`/`text`/`outcome`/`deviations` field to redact because none is ever read into the digest
object in the first place.

### D2b — the consumer revalidates, never the producer alone

Added alongside the D2 supersede. The original design put the redaction boundary at the *producer*
(the repo generating its own digest, scanning its own workers' text). But `bee-evolving` reads a
**foreign** repo's digest — a file this repo does not control — to decide edits to **this repo's own
source**. A hand-edited, stale, or hostile digest is just JSON on disk; trusting it as written
reopens every injection path the allowlist closed. So `mergeDigests` **re-runs both the secret and
injection pattern sets** against every configured `dogfood_repos` digest and **wraps every surviving
foreign `title` in `datamark()`** before it can enter a prompt — the redaction boundary sits at the
party at risk (the repo consuming the data), not the party producing it. Every `source` path is also
`fs.realpath`-contained, closing the symlink escape a string-prefix check would miss.

### D3 — bee-evolving runs only in the bee repo, on demand

The self-improvement loop never runs in a host repo, never triggers automatically, and never runs
from a schedule or another agent's dispatch. `skills/bee-evolving/SKILL.md` step 0 is a hard guard
(`test -f skills/bee-hive/templates/lib/feedback.mjs && test -f skills/bee-writing-skills/SKILL.md`)
that refuses outside the bee repo — including the "rank read-only here, patch on a branch, upstream
later" variant, which is still running the loop in a host repo. Pressure-tested RED-first under the
full Iron Law (`docs/history/evolving-loop/reports/evolving-10-pressure.md`, Scenario 1).

### D4 — improvements go through the Iron Law, no exceptions

Every fix `bee-evolving` produces is handed to `bee-writing-skills`'s full discipline (failing
pressure test recorded first, then the minimal change, then green) — `bee-evolving` itself never
implements inline. This composes with `ff26725d` below: a skill edit inside the loop carries the
same RED-first evidence as any other skill edit.

### D5 — two human gates, push never automatic

**Gate A** (what to fix): the human picks one ranked cluster to fix, or stops — both are complete,
successful outcomes. No trust statement, standing delegation, or "the rank is deterministic so the
top item is obviously right" substitutes for the human's choice. **Gate B** (the diff): the human
reviews the complete, current diff and gives an explicit per-diff approval before any push; a
standing rule, a green suite, or a prior plan approval never pre-grants it. **Push is a named manual
step** — no runbook, scheduler, or "scratch branch isn't really a push" framing authorizes it
automatically. All four adversarial scenarios (host-repo run, Gate A skip, Gate B skip, auto-push)
were pressure-tested RED (skill absent) then GREEN (skill present) with zero remaining
rationalizations; see `docs/history/evolving-loop/reports/evolving-10-pressure.md`.

### The Iron Law binds skill edits, no mechanical-edit exemption (`ff26725d`)

Decided at Gate 2 of slice B: a cell that edits any `SKILL.md` — including this loop's own hive
routing row — carries RED/GREEN pressure-test evidence, even when the edit is "only" a numbered step
or a routing row invoking an already-verified command. The owner explicitly declined to carve an
exemption for mechanical-looking edits; `bee-writing-skills` already names "it's just one step" as
the exact rationalization a worker reaches for under pressure. This decision is why `evolving-11`'s
routing-table row required its own RED-before-GREEN evidence
(`docs/history/evolving-loop/reports/evolving-11-routing-pressure.md`), just as `evolving-10`'s
whole skill did.

### The datamark trap — resolved at the comparison key, not the merge contract

Foreign titles are stored `datamark`-wrapped (`«…»`), local titles are stored bare, and `datamark`
double-wraps on re-merge — so naive title equality never clusters a foreign entry with its local
twin, and clustering by the wrapped string alone is not idempotent across merges. The fix stays
local to ranking: the **cluster key** is `normalizeTitle(title)` — repeatedly strip the `«…»`
wrapper to a fixed point (defusing both the asymmetry and the double-wrap case), apply the same
cleaning transforms `datamark` itself applies (fences, role tags, control chars, trim — without them
a bare local title never matches its datamarked foreign twin), then casefold and collapse whitespace.
**Stored entries stay wrapped** (D2b's neutralization is untouched); only the *comparison key* is
stripped, and the key is an internal handle that **no rendering surface ever shows** — Gate A and
every prompt render the stored, still-wrapped `title`, never the stripped `key`. The rejected
alternative — moving `datamark` to render time instead — was rejected because it reopens slice A's
`mergeDigests` contract and its 20+ existing merge assertions to solve a problem the comparison key
already solves locally.

### Corroboration ships defined, measured, and inert today

`rank = pain(max) × frequency(cluster size) × corroboration(distinct contributing repos)`, with a
deterministic tie-break (earliest `first_seen`, then cluster key). `corroboration` is fully
implemented and unit-tested against synthetic foreign digests (wrapped/bare/double-wrapped titles
correctly unify into one cluster). Measured against the one real foreign repo configured at
validating — **anphabe-gogl's 59-entry digest, merged live, 2026-07-10** — real cross-repo cluster
collisions today are **0**: no anphabe-gogl title clusters with a bee-repo title, so `corroboration`
evaluates to 1 for every cluster in the current corpus, same as the null-`dogfood_repos` case. The
term is shipped rather than deferred again, because slice A's own ranking-deferral finding (`[R1]`)
was "nothing consumes it yet" — that is no longer true once `bee-evolving`'s Gate A renders `rank`.
It is honestly labeled measured-inert rather than claimed meaningful; real cross-repo overlap will
only appear once bee-authored friction repeats across two independently-run bee repos.

## Rationale

- **A weakened promise is worse than a smaller surface.** Revision 1's D2 read as a security
  guarantee ("never project code") that the real corpus falsified on first measurement. The owner's
  call — cut the field rather than keep a check that does not check anything — is the same discipline
  `docs/09` item 5 asks of refusal messages: never claim more than what is actually enforced.
- **The redaction boundary belongs to the party at risk.** `bee-evolving` edits *this* repo's source
  from *foreign* data; write-time validation in the foreign repo protects that repo, not this one.
  D2b moves the boundary to where the risk actually sits — the read side, immediately before a
  prompt.
- **A self-modifying loop earns the highest lane and the strictest edit discipline in the repo.**
  `ff26725d`'s no-exemption ruling and D5's two gates both trace to the same worry: the exact
  machinery capable of editing bee at scale is the machinery most tempting to exempt from bee's own
  rules "just this once."
- **Solve the trap at the smallest correct boundary.** The comparison-key fix touches only ranking's
  own new code; it does not reopen a slice already shipped, tested, and capped.

## Alternatives considered

- **Keep D2's free-text field with a stronger strip/regex.** Rejected — validating's per-field sweep
  showed no mechanical strip removes identifiers from unfenced human prose; every improvement
  attempted on the strip left real leaks. The allowlist removes the surface instead of chasing it.
- **Render-time `datamark` instead of a stripped comparison key.** Rejected — it reopens
  `mergeDigests`'s 20+ merge assertions from slice A to solve a problem local to ranking; the
  comparison-key fix is scoped to the new code only.
- **Mechanical-edit exemption for SKILL.md step-only additions.** Rejected by the owner at Gate 2 —
  see `ff26725d`; the cost (one pressure scenario per skill edit) is bounded and the loop being built
  is precisely the machinery that will edit skills at scale.
- **Defer `corroboration` again to a future slice.** Rejected — slice A's own deferral rationale
  ("nothing consumes it") no longer holds once Gate A renders `rank`; shipping it measured-inert with
  an honest label is more useful than deferring a second time.

## Scope (built)

- **Slice A (evolving-1..8):** `lib/feedback.mjs` (`resolveInScope` chokepoint, `realpath`
  containment, `normalizeKind` alias map, `buildDigest`, `mergeDigests` with D2b revalidation +
  datamark); `bee_feedback.mjs digest|count|collect`; `dogfood_repos` config normalization in
  `lib/state.mjs`; `bee-compounding` close-time digest refresh (warns, never blocks).
- **Slice B (evolving-9..11):** `normalizeTitle`/`clusterEntries`/`rankClusters` in
  `lib/feedback.mjs`; `bee_feedback.mjs rank`; `skills/bee-evolving/SKILL.md` (guard → rank → Gate A
  → Iron Law hand-off → suites green → Gate B → push), pressure-tested RED-first
  (`reports/evolving-10-pressure.md`); hive routing row (three-spot mirror: `SKILL.md` table,
  `routing-and-contracts.md` skill catalog #12, its Request-type table), pressure-tested RED-first
  (`reports/evolving-11-routing-pressure.md`); `docs/07-contracts.md` (`bee_feedback.mjs` CLI surface
  + the `bee-evolving` enforced-invariants contract); `docs/config-reference.md` (`dogfood_repos`);
  `BEE_VERSION` `0.1.19`.

## Deferred

- **Real cross-repo `corroboration`.** Measured at 0 collisions against one configured foreign repo
  (anphabe-gogl, 59 entries) as of this record. Re-measure once a second independently-run bee repo
  configures `dogfood_repos` and its friction titles start to overlap with this repo's own.
- **A "fetch the full entry" Gate-A escape hatch.** Slice B's real-corpus reality check
  (33 entries, titles carrying usable signal plus the `source` field) answered open question 4 from
  `plan.md`: not needed today. Revisit if a future corpus's titles prove too thin for a human to
  judge at Gate A.
- **WSL/scripted deploy for `bee-evolving` itself.** Named, not scripted, per the plan's open
  question 3 — the existing manual copy into `~/.claude/skills/` is unchanged by this feature.
