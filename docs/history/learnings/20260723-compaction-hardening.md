---
date: 2026-07-23
feature: compaction-hardening
categories: [pattern, decision, failure]
severity: critical
tags: [guard-scope, asserted-not-measured, pattern-doc-drift, review-process, red-failure-evidence, concurrency, worktree-isolation, semantic-judge]
---

# Learning: A pattern doc's headline outranked its own corrective, and shipped the bug it was written to prevent

**Category:** pattern
**Severity:** critical
**Tags:** [pattern-doc-drift, guard-scope, asserted-not-measured, append-only-log]
**Applicable-when:** writing or reading a `docs/knowledge/patterns/*.md` pattern doc whose corrective was appended after a recurrence, or citing a pattern by name while under compaction/context pressure.

## What Happened

`compaction-hardening` failed independent review **three times at the shape stage**,
before any code was written, on **five instances of one defect class**: a guard's
scope was asserted rather than measured.

| # | Instance | What was asserted | What was true |
|---|---|---|---|
| 1 | Revision 1's manifest regen | "the regen is part of the FEATURE, owned by its last cell or its close step" (pattern doc headline, `templates/lib/`-scoped) | `release_manifest.mjs:131,133` hashes `skills/**` and `hooks/**` in full; deferring it builds four cells on a red shared baseline |
| 2 | Revision 1's doctrine gate | glob `**/AGENTS.block.md` sees the retired sentence everywhere it matters | the glob does not match the merged root `AGENTS.md` — the one file every session actually loads |
| 3 | Revision 2's D20 regen trigger | scoped to `templates/lib/` | `release_manifest.mjs` hashes `skills/**`/`hooks/**`; two cells carried the check that stays green and omitted the one that moves |
| 4 | Revision 2's doctrine gate | one hook count, "six hooks" | four true counts exist (9 scripts / 8 Codex events / 7 Claude events / 6 toggles); a naive gate would have ordered a worker to falsify a **true** "six toggles" claim |
| 5 | Revision 3's cz-5 capsule | `hooks/test_hook_contracts.mjs` covers the extraction | `handoffOutcome` was mandatory in the extracted renderer (D26) but not asserted at the call site — every pre-existing row matched only the WAIT heading |

The load-bearing root cause for instances 1 and 3 is not inattention: **the pattern doc
told the planner to do the wrong thing.**
`docs/knowledge/patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md`'s
headline read *"the regen is part of the FEATURE, owned by its last cell or its close
step,"* scoped to `templates/lib/`. The corrective — *"any lib-touching cell's verify
carries all three regen/checks explicitly"* — was buried three paragraphs down, in the
third recurrence note of an append-only log. Revision 1 cited the pattern **by name**
and followed its headline faithfully. Revision 2 inherited the same too-narrow trigger
scope from the same sentence.

## Root Cause

**An append-only learning artifact whose summary is authored once and whose
corrections are appended transmits its own obsolete advice with the authority of a
critical pattern.** Under compaction and under skim-reading, an agent loads the
summary and the citation line, not the tail. The pattern doc had already recorded its
own fix direction twice (recurrences 2 and 3) before revision 1 was ever planned — the
information existed in the file revision 1 cited by name, and revision 1 still
inherited the retired headline.

## Recommendation

When a pattern doc's fix direction changes on a recurrence, **rewrite the headline
sentence itself** — do not only append a new recurrence note below it. A pattern doc
is read top-down and skimmed under pressure; a corrective is not "recorded" if it sits
below a headline that still states the disproven version. (This is no longer only a
process note: `docs/knowledge/patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md`
now carries a `> SUPERSEDED —` block at its top naming exactly this failure and the two
revisions it caused, as the concrete example of the rule.) When citing any pattern doc
by name in a plan or CONTEXT.md, quote the current headline verbatim rather than
paraphrasing from memory — a paraphrase of an obsolete headline propagates the same
staleness one level further.

---

# Learning: A shape review that has not executed a command has not started

**Category:** failure
**Severity:** critical
**Tags:** [review-process, prose-review, measured-vs-asserted]
**Applicable-when:** running or writing a plan-stage / shape-stage review (validating,
scope-guardian, coherence lens) for any feature, especially high-risk.

## What Happened

Zero of the twelve blocking findings across compaction-hardening's three review rounds
came from reading the plan against `CONTEXT.md` for internal consistency. Revision 1
was internally consistent, cited its decisions correctly, and was wrong six ways (B1
through B6 in `reports/validation-slice1.md`) — every one of the six was caught only by
reading the actual source (`release_manifest.mjs:131,133`, `test_bee_cli.mjs:2558`,
`hooks/bee-session-init.mjs:44`, `Object.keys()` on the real `.codex/hooks.json`) or by
running a real command (`node scripts/test_lib_mirror.mjs`, the schedule dry-run).

## Root Cause

Prose-to-prose review checks that a plan is self-consistent and cites its own
decisions correctly. It cannot check that the plan is consistent with the repository,
because the repository is not prose. Every one of revision 1's six blocking findings
was a claim about what a script does, what a glob matches, or what a test asserts —
each falsifiable only by reading or running the artifact the claim was about.

## Recommendation

Treat a shape-stage review as unstarted until it has run at least one command or read
at least one line of the actual source file a claim depends on. Score a review's
coverage by the fraction of its findings that trace to a measurement (`grep`, `node
<script> --selftest`, a line-anchored read) versus the fraction that trace only to
cross-referencing the plan's own prose against `CONTEXT.md`'s own prose. A review
returning zero measured findings on a slice touching guards, gates, or derived
artifacts should be treated as incomplete, not as a clean pass.

---

# Learning: A red must fail for the reason under test, not merely appear

**Category:** failure
**Severity:** standard
**Tags:** [red-failure-evidence, test-quality, cz-6]
**Applicable-when:** authoring the red-first evidence for any `behavior_change` cell,
especially one wiring a new call site into an existing code path.

## What Happened

cz-6's first draft of the D27 row (`handoffOutcome` must reach the capsule through the
`SessionStart` hook) passed against the **un-wired** hook — the row appeared red for
the right reason on the surface, but its first assertion actually passed because
`buildSessionPreamble` (the pre-existing, un-wired path) **also** renders the
`- Adoption not applied:` line (D26). The row was strengthened to assert the line
rides the *capsule* specifically, and to compare `buildCompactCapsule(...with
outcome)` against `buildCompactCapsule(...without)`, which is what made it
discriminate. The recorded red-failure evidence (`.bee/tmp/cz-6/red.txt`, `12 passed,
2 failed`) is from the corrected version.

## Root Cause

The red-first ritual proves a suite *runs* against the un-fixed code. It does not by
itself prove the suite *fails for the reason under test* — a row can go red (or,
worse, pass) through a coincidental second code path that happens to produce the same
output, unrelated to the mechanism the row claims to check.

## Recommendation

When a red-first row's assertion could plausibly be satisfied by a different, already
existing code path (not only the one cell is wiring), name that alternate path in the
row's own comment and assert against something only the new mechanism can produce —
here, a byte comparison against the extracted builder specifically, not a substring
match against the hook's combined output. Treat a red-first draft that passes red "for
free" against the pre-existing behavior as a signal to strengthen the assertion, not
as confirmation the row is done.

---

# Learning: A repair invalidates the evidence that justified it

**Category:** decision
**Severity:** standard
**Tags:** [advisor-consult, confirming-consult, cz-5]
**Applicable-when:** applying an advisor's or reviewer's fix to a plan or cell after
Gate 2/3 evidence has already been gathered.

## What Happened

After D27 (the `handoffOutcome` call-site fix) landed based on the advisor's initial
pre-Gate-3 consult, a **confirming** consult run against the repaired state found a
new hole: the "no capsule byte varies with anchor presence" must-have had **no named
mechanism**, and could not have surfaced inside cz-5 as originally scoped — the row
that would have caught an anchor-correlated capsule (`hooks/test_hook_contracts.mjs:2740-2780`)
drives the *hook*, which only cz-6 wires, so during cz-5 that row exercises full
preambles and never touches the capsule builder at all.

## Root Cause

Fixing D26/D27 changed what the capsule's call site looked like, which changed which
gaps were reachable from it. Evidence gathered against the pre-repair state (the
initial advisor consult's "converging, execution-worthy" read) was evidence about a
plan that no longer existed the moment the repair landed. Re-stamping the original
verdict without a fresh look would have carried forward a verdict about code that had
since changed.

## Recommendation

After applying any repair a reviewer or advisor found, re-run that same review layer
against the post-repair state before treating the gate as satisfied — do not reuse the
pre-repair verdict. Explicitly check whether the repair moved a defect into a location
no existing verify/must-have was scoped to reach, the way fixing the renderer's
signature (D26) moved the live gap to the call site (D27), and fixing D26/D27 then
opened the anchor-independence gap. A confirming consult after a repair is not
ceremony; it is the only check that can catch a defect the repair itself introduced.

---

# Learning: Per-feature serialization is not concurrency control across sessions

**Category:** failure
**Severity:** critical
**Tags:** [concurrency, worktree-isolation, coordination, P1]
**Applicable-when:** running any bee work in a checkout another session might also
write to, or reaching for `bee worktree new` as an isolation fallback.

## What Happened

D21 serialized the eight cells of this feature strictly — one cell live at a time,
within the feature. That protected against **intra-feature** write collisions but did
nothing against a session working a **different** feature in the same checkout: a
concurrent session force-unclaimed the live `cz-5` cell mid-flight, and its merge
destroyed roughly ten minutes of verified-green work (two P1 friction entries filed,
layer `coordination`: "Force-unclaim + a concurrent merge silently destroyed a live
worker's claim, reservations and uncommitted work (cz-5)" and "A live session
force-unclaimed another live session's cell mid-flight and its merge destroyed 10
minutes of uncommitted work"). cz-5's own report records recovering from artifacts
preserved under `.bee/tmp/cz-5/` after re-deriving the anchors against the live tree.

The paved-road fallback — an isolated worktree via `bee worktree new` — then proved
**undriveable**: a dispatched subagent inherits the parent session's working
directory, so entering the worktree did not re-anchor write-guard path resolution
(backlog P1, layer `hooks`: "bee-write-guard enforces cross-worktree containment for
Edit/Write but not for relative Bash targets"). The worktree was discarded and cz-5
finished in the main checkout only after the owner explicitly confirmed no other
session would write (`.bee/state.json` summary).

## Root Cause

Isolation that is only reachable *before* contention exists is not isolation. The
worktree fallback exists as a mechanism, but a subagent dispatched from inside an
already-running session does not get a fresh working directory just because a
worktree was created for it — the mechanism requires a re-anchoring step
(`EnterWorktree`) that a plain `cd` or a dispatched worker does not automatically
receive, and by the time that gap is discovered, the collision has often already
happened.

## Recommendation

Do not treat "cells within this feature are serialized" as a substitute for
same-checkout coordination across features — check for other live sessions in the
same physical worktree before claiming a cell, not only other cells in the same
feature. When reaching for worktree isolation as a live mitigation (not proactively,
before contention), verify the dispatched worker actually re-anchored into the
worktree (confirm via a write-guard-visible path check) before trusting it as
protection — do not assume `bee worktree new` alone isolates a subagent's writes.
Both P1s above should be fixed at the mechanism level before this pattern is relied on
again as a mid-collision escape hatch.

---

# Learning: A negative must-have with no measured count is an order to break something

**Category:** failure
**Severity:** standard
**Tags:** [guard-scope, must-haves, cz-2, doctrine-gate]
**Applicable-when:** writing a cell must-have that asserts a claim's absence or
falsity ("no surviving six-hook claim", "never contains X") without deriving the
measured value the claim is being checked against.

## What Happened

Revision 2's doctrine gate carried a must-have along the lines of "no surviving
six-hook claim." Measured, `.bee/config.json` has exactly six hook config toggles —
`docs/06-runtime-integration.md:120`'s "all six hooks default-on" is **true** when read
as toggles. A gate built to satisfy that must-have literally would have ordered a
worker to falsify a correct statement, because the gate had no way to tell a true "six
toggles" claim from a false "six scripts" claim — it knew only one quantity. D25's
fix was to derive **all four** true hook-related counts (9 scripts / 8 Codex events /
7 Claude events / 6 toggles) and compare each prose claim only against the quantity it
actually names.

## Root Cause

A negative must-have ("this number must never appear as N") is only as correct as the
measurement behind "N is wrong." When the guard doesn't independently derive the true
value(s) a claim could be about, a negative must-have is really an assumption wearing
the shape of a proof obligation — and here the assumption itself (only one quantity
called "hooks" exists) was false.

## Recommendation

Before writing a must-have that asserts a claim's absence or wrongness, derive every
true value the claim's subject could refer to, not just the one the plan assumed.
When a domain has more than one countable quantity sharing a common noun (here:
"hooks" means scripts, Codex events, Claude events, or config toggles, four different
integers), a mechanical gate must classify which quantity a given piece of prose names
before judging it true or false — and must report "unchecked" rather than guess when
the surrounding prose does not disambiguate (as `test_doctrine_parity.mjs` does for
bare "N hooks" mentions).

---

# Learning: The orchestrator's own errors, unsoftened

**Category:** decision
**Severity:** standard
**Tags:** [orchestrator-discipline, self-review, decision-ledger]
**Applicable-when:** any orchestrator running a swarm in a shared checkout, deciding
when to commit verified-green work, or crediting one decision with consequences that
belong to a later one.

## What Happened

Three orchestrator-level errors, recorded without softening:

1. **It kept executing in a shared checkout after a live concurrent session was
   known**, rather than pausing or coordinating before the collision that destroyed
   cz-5's first attempts.
2. **It did not commit cz-5's verified-green work immediately** after capping — the
   work survived only because a worker had independently parked the patch outside the
   tree (`.bee/tmp/cz-5/`) on its own initiative, not because the orchestrator's own
   process protected it.
3. **It credited D19 with dropping two of revision 1's five mode-gate risk flags**
   ("changes behavior an existing test asserts" and "requires replacing existing
   proof"), when D23 — found four hours later, by a different route (the PreCompact
   additivity row, not the SessionStart one D19 addressed) — restored both flags for a
   different reason. The record briefly attributed a consequence to a decision that
   did not, on its own reasoning, produce it.

## Root Cause

All three share one shape: the orchestrator advanced (execution continued, capping
proceeded, a risk-count claim was recorded) on the strength of a state that had not
been independently re-checked at the moment the consequence was recorded — the
concurrent session's presence, the commit boundary, and D19's actual scope.

## Recommendation

Commit a cell's verified-green work as close to its cap as the workflow allows —
"a worker happened to preserve it elsewhere" is not a substitute for the orchestrator's
own commit discipline (see critical rule 8 and the tree-hygiene commit-before-release
doctrine). Before crediting a decision with a downstream consequence in a ledger entry
(a risk-count change, a "this is now resolved" note), re-derive the consequence from
that decision's own stated scope rather than from memory of what the decision was
supposed to fix — D19 fixed the *SessionStart* additivity row; the PreCompact row was
a separate, later-found defect that happened to land in the same risk category.

---

# What no check could have caught

**Category:** decision
**Severity:** standard
**Tags:** [design-judgment, semantic-judge, unmechanizable]
**Applicable-when:** deciding whether a finding belongs to "needs a check" or "needs a
documented judgment call" — and when consolidating two similar-looking code paths.

Four things in this feature were caught or settled by judgment, not by any mechanical
check, and none of them would have been caught if the judgment had gone the other way
silently:

- **The "six hooks" inversion** (see the must-haves learning above) — no verify can
  distinguish an instruction that is internally consistent and factually inverted from
  one that is correct; it took a human/advisor reading the actual claim's intended
  referent to see that "six" was sometimes true and sometimes false.
- **The `handoffOutcome` call-site contract** — D26 fixed the renderer's signature; the
  call site's omission was invisible to every existing suite (`test_hook_contracts.mjs`
  regexes only the WAIT heading) until the advisor's initial consult read the two call
  sites side by side.
- **The mode-gate correction (D23)** — recognizing that the PreCompact additivity row,
  not the SessionStart one, was the row D19 left unaddressed required re-deriving which
  fixture predicate (`readIntent` null in the control) the forced nudge would actually
  trip — an inference over two source files, not a test result.
- **Two design-shape calls the semantic judges made:** that `anchorMissing` must not
  call `markInjected` itself (folding dedup into the shared module would let the forced
  PreCompact path silently poison the deduped UserPromptSubmit cache — cz-3's judge
  caught this by tracing what would happen if dedup ownership moved); and that folding
  the nudge's dedup gate into `compaction.mjs` would make a read-only reporting verb
  (`state compact-check`, which also calls `anchorMissing` as a side-effect-free
  oracle) silently consume the 30-minute nudge budget on every inspection — a direct
  violation of D13's reports-never-repairs contract (cz-7's judge flagged this as "not
  a consolidation candidate" for a reason the worker itself had not given).

## Recommendation

When a semantic judge or reviewer makes a design-shape call like these — "do not
consolidate X into Y because Z" — record the *reason*, not just the verdict, in the
cell's trace or the module's own comments. A future worker who sees two similar
functions and reaches to "simplify" by merging them has no way to rediscover "this
would make a read-only verb consume a nudge budget" from the code alone; the reasoning
that prevented the bug is exactly what a later consolidation pass would need to see
again.
