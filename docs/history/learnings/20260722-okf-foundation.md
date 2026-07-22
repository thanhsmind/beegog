---
date: 2026-07-22
feature: okf-foundation
categories: [design, planning, verification, tooling]
severity: high
tags: [okf, knowledge, migration, coverage, review, guards, propagation]
---

# Learnings — okf-foundation

Nine cells (okf-1..okf-9), all capped with green verify and a PASS semantic judge; the verify chain
went 60 → 65 suites. Shipped: an OKF v0.1 bundle at `docs/knowledge/` under a bee profile,
`bee knowledge check|index|list|context|promote`, a migrator with anchor-coverage gates, and a
startup bridge that makes the bundle load-bearing.

## What Happened

**Two fresh-eyes review loops killed two plausible plans before either reached code.** Round 1
withdrew a retrofit that would have stamped frontmatter onto all 593 `.md` files under `docs/`;
reframing "concept" as *any non-reserved `.md` inside `docs/knowledge/`* (D23) deleted the retrofit,
three incompatible legacy frontmatter schemas, 14 prose-header learnings, a filename-with-spaces
hazard, and a `timestamp` double-source conflict — in one move. Round 2 killed a five-way heading
split of `workflow-state.md`: its headings are a BA template, not a topic map, so the five names
left ~700 of 1464 lines homeless, with multi-session coordination — the second-largest cluster —
having no destination at all.

**A validation panel falsified a propagation assumption planning had never traced.** Editing
`skills/bee-hive/templates/**` silently stales the committed plugin render trees, which
`test_plugin_distribution.mjs:317-329` pins byte-for-byte. The plan named the ledger and the release
manifest but not the render step, so okf-1's own verify would have gone red. The panel found it by
running the downstream command, not by reading the plan.

**Three guards fired against their own users.** `BEE_AGENT_NAME` leaks into `run_verify`'s spawned
children and false-failed unrelated suites for two workers independently. The write-guard's
flat-text CLI-shape scanner blocked legitimate commands whose *text* merely contained a bee-CLI
fragment inside a heredoc or a `node -e` body — one worker, twice the orchestrator, and the fourth
recorded recurrence of the same parser-differential gap. The cap judge's `deliberate_exceptions`
door downgraded an otherwise-sufficient RED-failure standard on okf-7, unfixably, because a capped
cell cannot be re-capped.

**A wrong derivation direction contradicted three unrelated decisions at once and nobody noticed
while writing them.** D19 said `bee.id` is "never derived from the path" while D17 (`work/<id>/`),
D27 (`--work <id>` resolution) and D31 (area id = directory slug) all depended on the opposite. Only
a review that read the whole decision set at once caught it (fixed as D32: the path is derived from
the id, never the reverse).

## Root Cause

**Surface-structure planning.** Both killed plans were shaped from a document's *literal* structure
— its file count, its heading list — rather than from a content model of what governs what. Surface
structure always looks executable and cheap, right up to the moment execution discovers the mismatch
as scope blowup or orphaned content.

**Untraced consumers of a source-of-truth file.** `templates/` was treated as "the source, so editing
it is the whole job", without asking which *other* suites pin its downstream artifacts. The pinning
suite is not the suite the author was thinking about, which is exactly why plausibility reading
misses it.

**Guards built as flat-text scanners and multi-field judges with cross-wired branches.** The
write-guard's mini-parser diverges from real shell grammar and has been patched one symptom at a
time for four recurrences. The cap judge relaxes the evidence floor on the *presence* of an
unrelated field rather than on the thinness of the field the floor governs.

**Coverage proved by comparing two hand-authored lists.** `okf_migrate`'s `ANCHOR_REGISTRY` is a
hand-maintained constant, so the gate proves internal self-consistency, not actual coverage: shrink
the registry and the concepts together and it stays green.

## Recommendation

1. **When a plan's shape comes from a document's literal structure (file count, heading list, line
   count) rather than from a content model of what governs what, run a fresh-eyes review of that
   structural assumption BEFORE locking scope** — not at validation, not at execution. Two of two
   such plans in this feature were wrong, and both were cheap to kill at design time.
2. **When a coverage gate claims "everything in source X reached destination Y", derive the
   ground-truth anchor set by mechanically re-scanning X at check time, or diff it against a
   git-pinned reference — never from a hand-authored parallel list.** A gate that compares two
   hand-written lists proves consistency, not coverage, and drifts green.
3. **Before authoring a cell that edits a file, grep that path against every `test_*` suite to find
   who pins it.** If any suite pins it or its generated descendants byte-for-byte, the cell's action
   must name the regeneration command and its `files` must list the generated tree — and a
   validation panel must run that command before Gate 3, never assume propagation.
4. **When a suite or spawned child should be identity-agnostic, strip ambient identity env vars at
   the spawn boundary** rather than trusting the child not to read them, and add a fixture that runs
   the suite once *with* the var set so the regression is caught mechanically.
5. **When the write-guard must know what a Bash command touches, delegate to shell-grammar-aware
   tokenization that understands quoting, heredoc and here-string boundaries.** Stop extending the
   flat-text scanner one special case at a time; four recurrences have each cost independent workers
   real turns, and a guard that blocks legitimate work teaches people to route around guards.
6. **Diff `trace.files_changed` against the cell's declared `files` at cap time and force a deviation
   entry for any undeclared path.** Workers do not self-report scope creep on shared mutator files
   like `run_verify.mjs` — it reads as necessary plumbing, not as stepping outside scope.
7. **When a cap-judge standard depends on several independent evidence fields, evaluate each field's
   sufficiency independently.** A `deliberate_exceptions` note must never relax the floor on
   `red_failure_evidence`; only that field's own thinness may open that door. Add a pre-cap dry-run,
   because capping is irreversible.
8. **Ship a consumer with real data in the same feature as the format it consumes.** A format whose
   value proposition is "an agent consumes this to work better" is a filing scheme until something
   reads it; and verify any precedent cited to justify deferring — the `ledger_parity` "report-only"
   precedent used to defer this consumer was miscited (that suite is chain-failing).
9. **Prove a risky mechanism on the smallest artifact that shares the real artifact's STRUCTURE, not
   merely something small.** `advisor-protocol.md` (202 lines) carries the identical nine-section BA
   template as `workflow-state.md` (1464 lines), so it exercised every migration path at a seventh
   of the risk. And when a proposed decomposition leaves content homeless, the split axis is wrong —
   that is not a signal to try harder.
10. **When a system needs both spec-portable links and refactor-survivable identity, state explicitly
    which is derived from which.** An implicit or backwards derivation direction will contradict
    itself across unrelated decisions long before anyone notices reading them one at a time.
