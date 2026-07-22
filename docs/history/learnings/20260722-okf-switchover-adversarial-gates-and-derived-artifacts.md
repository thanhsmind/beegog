---
date: 2026-07-22
feature: okf-switchover-f3
categories: [pattern, decision, failure]
severity: critical
tags: [knowledge-bundle, anti-fork, adversarial-validation, derived-artifacts, migration, relevance-ranking]
---

# Learning: okf-switchover-f3 — attacking your own gates, and the artifacts an edit drags behind it

Five cells flipped the system of record: new knowledge is written into the knowledge bundle,
the legacy spec tree became a read-only compatibility surface, and the profile that defines the
bundle was migrated into it. Four findings are worth keeping.

## Learning 1: A uniqueness gate over free text is only as strong as the attacks run against it

**Category:** failure
**Severity:** critical
**Tags:** [adversarial-validation, identity, unicode, fail-closed]
**Applicable-when:** implementing or reviewing any gate that decides "is this the same thing as
that?" over human-authored text — ownership claims, dedupe keys, idempotency keys, slugs, names.

### What Happened

Cell f3-2 shipped an anti-fork gate: no two concepts may claim the same subject via
`bee.authoritative_for`. The author verified it by trying case and whitespace variants — the two
transformations the normalizer already handled — and reported the gate closed. An independent
judge then broke it **four ways in one sitting**: a trailing period, a Cyrillic homoglyph, a
non-string (array) claim that was silently skipped by a `typeof !== 'string' → continue`, and an
empty/null subject with a new-concept intent that skipped the gate entirely and routed the write
to the area's `overview.md` — the exact outcome the gate existed to prevent. It found a fifth
latent class (two pre-existing owners of one subject resolving to whichever the directory walk
reached first, with no detection) and a sixth blind spot (all three fixtures were single-root, so
the divorced-product-root topology was never exercised). The verdict was NEEDS_REVISION, 8 PASS /
2 FAIL, and a whole repair cell (f3-3) was needed.

The cited backstop made it worse: `duplicate_authoritative_for` already existed — as a **profile
warning**, and the chain runs the conformance check without `--strict`. A control that is only
computed and never promoted to a failing bucket has never blocked anything. It was defended on
paper only.

### Root Cause

The author tested the **positive** space (variants they had thought of) and never the
**adversarial** space (variants an attacker or an accident produces: confusables, wrong types,
empty input, pre-existing conflicts). Exact-normalized string matching over free text can never be
sufficient on its own, and a single-layer gate has no second chance when layer one is fooled.

### Recommendation

**When a gate exists to make one thing unique over free text, write the adversarial fixture set
BEFORE the implementation, and make it cover four axes every time: (1) confusables and
normalization — NFKC, case, accents, cross-script look-alikes, trailing punctuation, collapsed
whitespace; (2) wrong shapes — non-string, array, boolean, null, empty, whitespace-only; (3)
pre-existing conflicts already in the data before your gate ran; (4) the topologies your fixtures
do not have (a single-root fixture set cannot see a divorced-root bug).** Then build the gate in
depth — a hardened match, fail-closed refusals on malformed input, and a whole-corpus backstop —
because layer one can never catch a genuine paraphrase.

**And: a finding that only warns is not a backstop.** Before citing any check as the thing that
catches what your gate misses, confirm it lands in a bucket the chain actually fails on, with no
opt-in flag required. Promote it in the safe order — prove the corpus is currently clean, *then*
promote warning to error, then pin the clean measurement — so you never red your own repo with
the promotion.

## Learning 2: An edit drags four derived artifacts behind it, and a cap-time verify expires the moment you edit again

**Category:** failure
**Severity:** critical
**Tags:** [derived-artifacts, close-out, mirror, manifest, ledger]
**Applicable-when:** any session that edits a mirrored, rendered, hashed, or manifested source
file — especially an edit made *after* the last cell's verify already passed.

### What Happened

The session that ran f3-5 edited `skills/bee-hive/templates/lib/inject.mjs` (a citation rewire) and
ended leaving the repo **red**: four failing suites — the lib mirror parity check, the release
manifest check, the plugin distribution check, and a preamble-contract suite. The next session
opened on a red baseline and spent its first stretch repairing it: re-sync the `.bee/bin/lib/`
mirror, re-render the four committed plugin skill trees, re-write the release manifest, re-run
self-onboard to refresh the managed-hash ledger. It also left a cross-session file hold from a
dead session, which hard-blocked the next session's first write.

Every one of those checks was **already a standing mandatory suite in the chain**. Nothing new
needed to be built. The chain was simply never run after the last edit.

### Root Cause

Two compounding causes. First, the derived-artifact set for one `templates/lib/` touch is now
known to be **four** deep — the runtime mirror, the rendered plugin trees, the release manifest,
and the onboarding managed-hash ledger — and it is one deeper than the last time this class
recurred. Second, and more important: the edit was made *outside a tracked cell*, after that
cell's cap-time verify had already gone green. A cap-time verify is evidence about the tree as it
stood at that moment; it says nothing about a tree edited afterwards, and treating it as a
session-level guarantee is what let a red tree get committed and handed on.

### Recommendation

**Treat a cap-time verify as expired the moment any further edit lands, and run the full chain
once more before ending the session — no exceptions for "it was just a citation" or "the cell
already passed."** When the edit touches `templates/lib/**`, run all four regens explicitly
(mirror copy, plugin tree render, manifest write, self-onboard) rather than trusting memory of how
many derived artifacts there are; the count has grown three times now. And release a file hold
only *after* the commit lands — cap, commit, then release — never before.

## Learning 3: A named exception with an expiry date is deleted when it expires, never relabelled

**Category:** decision
**Severity:** standard
**Tags:** [guards, allowlists, silent-rot]
**Applicable-when:** a guard carries a by-name exception that exists only to cover an interval.

### What Happened

The read-only fence (f3-4) recognises migrated files **structurally**, by a marker in their own
frontmatter, never by filename — because a filename allowlist rots the first time an area is added
or renamed, and a rotted allowlist stops fencing *silently*. It nevertheless carried one temporary
by-name exception: the profile spec itself, which was awaiting its own migration. When f3-5
migrated it, the exception could have been cheaply relabelled to point at the new verdict. It was
**deleted** instead, and both directions were then asserted in the self-test: the real file passes
structurally, and the same filename *without* its marker fails as new content.

### Root Cause

Relabelling would have preserved a name-based pass that keeps saying yes if the marker is ever
dropped or the frontmatter ever breaks — reintroducing, under a new label, exactly the silent rot
the structural branch exists to close. A named exception that outlives its interval is a standing
permission for that filename to hold anything at all.

### Recommendation

**When a by-name exception exists to cover an interval, write its expiry condition into the code
beside it, and when that condition is met, DELETE the exception rather than updating it — then
assert both directions (the real artifact passes structurally; the same name without its structural
marker fails).** Relabelling an expired exception is how a guard keeps its shape and loses its
teeth.

## Learning 4: A migration refuses to force a scheme it cannot honestly derive, and pins the gap

**Category:** pattern
**Severity:** standard
**Tags:** [migration, coverage-gates, never-invent]
**Applicable-when:** extracting structured anchors, ids, or rules out of prose.

### What Happened

The profile source has nine business-rule bullets and not one carries a rule id. Inventing nine ids
would have made the coverage gate report a fuller, prettier number. Instead the migration reported
`rules: 0` as a **measured** fact, counted those nine blocks in the unparsed bucket, and migrated
them verbatim into the concept whose subject each states — carried, but never anchor-gated. The
unparsed count was pinned at 17 with every block identified by line, including three produced by a
known blind spot in the extractor (it does not track code fences, so a template's own fenced
heading opens a spurious accounting section).

### Root Cause

An earlier migration in this programme had already produced a false-green coverage gate by forcing
a scheme onto content that did not carry it, hiding seventeen real business rules. Pinning the
imperfection is what converts a future extractor improvement from a silent reshaping into a loud,
reviewable failure.

### Recommendation

**When extraction cannot honestly derive the structure a scheme expects, report the shortfall as a
measured number, never invent identifiers to fill it, and PIN the unparsed count with each block
identified — so that a future, smarter extractor fails loudly against the pin instead of quietly
changing what the gate counts.**

## Learning 5: The ranking signal was chosen by measurement, and its imperfection was shipped visibly

**Category:** pattern
**Severity:** standard
**Tags:** [ranking, measurement, conservation]
**Applicable-when:** any prioritization or cut where intuition would otherwise pick the signal.

### What Happened

The plan's original design ranked critical patterns by tag and area overlap. Measured against hand
labels over the live corpus, tag overlap scored AUC 0.550 with 48 of 49 items tied at zero, and
area overlap 0.500 with all 49 at zero — a path sort wearing a relevance label. Six candidate
signals were scored; the shipped one (IDF-weighted coverage of a concept's distinctive vocabulary
across two field groups) scored 0.805 with no ties and no zeros. The acceptance criterion was
also replaced: the plan's "five relevant entries survive" oracle passes trivially, so it was
swapped for discrimination, conservation (every candidate accounted for exactly once across
included, truncated, and excluded), and a typed failure when too many items tie at zero.

Separation is total on the labelled fixture but only 0.805 live — two labelled-relevant patterns
fall below the cut in real use. They are **named in the excluded list with their scores** rather
than vanishing.

### Root Cause

A ranking's plausibility is not evidence of its discrimination, and an acceptance test that a
broken implementation also passes is not an acceptance test.

### Recommendation

**Score every candidate signal against hand labels over the real corpus before committing to one,
and reject any signal whose scores mostly tie — a tie is a sort order, not a ranking. Pick an
acceptance criterion a wrong implementation would fail, and when the shipped signal is imperfect,
make the imperfection enumerable (name what was excluded and why) rather than invisible.**
