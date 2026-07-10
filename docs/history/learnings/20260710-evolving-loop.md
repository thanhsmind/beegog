---
date: 2026-07-10
feature: evolving-loop
pbi: P18
cells: evolving-1 … evolving-7 (evolving-8 open)
lane: high-risk
phase: completed
severity: high
categories: [security, verification, planning, orchestration]
tags: [trust-boundary, allowlist, frozen-assertions, real-corpus, iron-law, reservations]
---

# evolving-loop (slice A) — learnings

Bee learned to read its own tracks. Along the way it learned that a green suite can be a lie, that a
redaction filter can sit on the wrong side of a boundary, and that a plan written from documentation
is a plan written from fiction.

Seven cells shipped; three of them fixed what the first four got wrong. The suite went **70 → 108**.
Five of the eight lessons below are **structural** — they recur in this repo unless something changes.

> An earlier draft of this file, written mid-flight after `evolving-4`, described the consumer boundary
> as if it rejected every out-of-allowlist field. It did not: at that moment only `title` was guarded.
> That draft is superseded here. The belief it recorded is itself lesson #4.

---

## 1. A boundary that lists field names will leak the field you forgot

**What happened.** `mergeDigests` had to neutralize every field of an entry read from an untrusted
repo. Round 1 neutralized `title`; review caught it. Round 2 added `layer` and `source`; re-review
caught `first_seen`, gated only by `Date.parse` — and `Date.parse("Jan 1 2020 (payload)")` returns a
valid timestamp, because lenient date parsers treat parenthesised text as a comment. A role tag and an
AWS key rode into the merged view while the harmless fields sat dutifully wrapped in `«»`.

**Root cause.** Not "someone forgot a field" three times. `ENTRY_FIELDS` was a bare array of names, and
a name carries no obligation to own a validator. The shape made forgetting cost nothing and say
nothing; the suite could only ever test the fields an author remembered.

**Recommendation.** When a trust boundary enumerates fields, enumerate them as a **map from field to
validator**, and derive the name list from the map's keys. A field without a validator must be a red
test, not a hole. Then write the table-driven test that fires an injection payload and a live secret at
**every** key. The check and the fix are the same change — that test was structurally impossible to
write against the old shape.

## 2. Put the redaction boundary where the risk is, not where the data is born

**What happened.** The producing repo scanned its own records at write time — the reflex every security
reviewer has. But `bee-evolving` reads foreign digests to decide edits to **bee's own source**, and the
human gate downstream reviews the resulting *diff*, not the entry that steered the agent to it. A
hand-edited or hostile digest is just JSON on disk.

**Root cause.** The party producing the data and the party at risk from it were different, and the
design assumed they were the same. Neither the plan, the advisor, nor the first validation pass caught
it. A security lens explicitly asked "who is at risk" did.

**Recommendation.** In any self-modifying or cross-trust pipeline, ask who is *harmed* by the data
before choosing where to validate. **Never trust a boundary artifact you did not produce.** Logged as
decision `7fb024e3`.

## 3. Delete the surface before you sharpen the filter

**What happened.** The digest was to carry friction prose with code blocks stripped. Measured against
the real corpus, the strip removed **exactly zero characters**: real friction `detail` is ordinary
unfenced sentences naming `readBacklogCounts`, `COMMAND_KEYS`, `approved_gates.shape`. Past the strip,
past the secret regexes, inside the cap.

**Recommendation.** When the data is human-authored prose, prefer an **allowlist of structured fields**
over a blocklist filter — and do not spend a cycle sharpening the blocklist first. A filter that cannot
be trusted is worse than no field: it advertises a guarantee it cannot keep. Logged as `7fb024e3`.

## 4. A green suite can be proof of the wrong spec

**What happened.** Twice, a "frozen" assertion asserted the exact defect under repair.
`test_lib.mjs:1833` required a foreign `source` to survive **raw** — written by the very cell tasked
with building that boundary. A second frozen grep pinned the bare-name-array *syntax* that was itself
the defect, and so forbade the structural fix. **93 green assertions, and later 104, proved conformance
to a wrong spec, not safety.** Two opus reviewers reading the code missed both.

**Root cause.** Freezing protects an assertion's *text* from being weakened. Nothing checks whether the
assertion was *correct* when it was frozen. Both surfaced only because a worker hit one while fixing a
bug and returned `[BLOCKED]` quoting it, instead of rewriting it.

**Recommendation.** Treat "a worker stops and quotes a frozen assertion; only the planner unfreezes,
narrowly, with a logged decision" as an **invariant of the frozen-judge**, not a courtesy (decisions
`c45d0fb3`, `b8fe5c81`). Separately: a *value-lock* pins data and is healthy; a grep that regex-matches
a module's own source pins syntax, guards nothing, and eventually blocks the correct fix. That
anti-pattern is now **twice-seen** here — it was already logged against `BACKLOG_STATUSES`.

## 5. Validate a producer against its own output, not just against the reported bug

**What happened.** The P1 fix made `normalizeKind` non-idempotent: it maps alias *keys* to normalized
*values*, and a written digest already carries normalized values. The consumer began rejecting exactly
the vocabulary the producer emits. On the real corpus: **59 entries in, 52 out** — `audit`,
`correction`, `approval`, `closed` wiped out. Fail-closed, counted, and silent.

**Recommendation.** For any function pair that both produces and consumes one data shape, assert the
round trip: **produce, consume, lose nothing.** One fixture, one assertion. No such test existed for any
producer/consumer pair in this repo before this feature, and nothing forces one for the next.

## 6. Fixtures gave false confidence; the one real corpus falsified the plan

**What happened.** The plan ranked friction by `frequency × pain × corroboration`. Measured against
`anphabe-gogl`, the only repo with real history: `pain` is the constant 1 for ~90% of rows; `layer` —
the cluster key's first component — is present on **0 of 9** rows despite being "optional by contract";
one repo has data, so `corroboration` is 1 everywhere. And `trace.friction` is empty in **23 of 23**
cells: the loop's richest planned input does not exist. Ranking left slice A entirely. The regression in
#5 was also caught only by real data, never by fixtures.

**Recommendation.** Read "optional by contract" as a strong prior that the field is **usually absent**.
Validate any ranking or clustering key against real data *before* writing the logic. Pin the real corpus
(or a scrubbed snapshot) as a standing fixture, so it is a check rather than a ceremony the orchestrator
remembers at the end.

## 7. Trust observed state, never a signal about state

**What happened.** (a) The Iron Law's RED-before-GREEN ordering has **no mechanical proof**: the verify
greps for `## RED` and `## GREEN`, which `touch` satisfies, and both landed in one commit, so git proves
nothing either. The only evidence is that the orchestrator watched `pressure-tests.md` hold RED while
`git status skills/bee-compounding/` was clean. (b) A "stalled/killed" notification for a *live* worker
was trusted; its reservations were released, its cell reset, a duplicate spawned. Nothing corrupted —
the first worker finished, the second returned `[NOOP]` — but the reservation guard was defeated by the
orchestrator, not by a race.

**Root cause.** One mistake twice: a state transition driven by a signal rather than by verified evidence.

**Recommendation.** Iron Law cells commit **RED as its own commit** before the skill edit — mechanically
checkable from commit order. Before releasing another agent's reservations or resetting a claimed cell,
require observed absence of on-disk progress over an interval. Never a stall signal alone.

## 8. A NUL byte makes grep lie by omission

`sortKey` joins fields with a NUL separator — legitimate in itself. Side effect: `grep` and `rg` treat
the whole file as **binary and print nothing, not even a zero count**. It briefly convinced the
orchestrator that a landed fix had vanished.

**Recommendation.** No C0 control byte in vendored source. If a grep over a source file returns empty
rather than `0`, check for control bytes before believing it. And every grep-based guard should ship a
**mutation-style negative test** — reintroduce the violation it claims to catch, assert it fires. That
would have caught both this blindness and the wrong-thing-pinned guard in #4.

---

## Facts worth keeping (from execution, not intent)

- **`decisions.jsonl` is routed but never collected.** It passes through `resolveInScope` so the
  absent-source skip path is exercised, but emits no entries: decision prose names the exact identifiers
  the allowlist exists to remove. The plan assumed every listed source would be collected; a one-line
  note would have removed the ambiguity.
- **A plan that names a source must name the reader that can open it.** The cell mandated markdown
  frontmatter, restricted reads to JSON-only wrappers, forbade bare `fs` reads, and scoped two files. The
  worker widened `fsutil` (12 additive lines) rather than game the security grep — the honest choice, and
  a deviation the plan forced.
- **Scan before transform.** The secret/injection scan runs on the raw value, so a match is recorded as a
  security event rather than silently rewritten by a later cap or wrapper.
- **`datamark` asymmetry is a trap set for slice B.** Foreign titles are `«wrapped»`, local titles bare.
  Any clustering on title equality will silently never match across repos — which is exactly the
  cross-repo frequency slice B exists to compute. `datamark` is also not idempotent-safe.

## What got mechanized, and what stayed prose

Prose in `critical-patterns.md` taxes every session and relies on being read. Where a lesson could become
a check, it did:

| Lesson | Mechanized as |
|---|---|
| #1 field without a validator | `evolving-7`: structural guard + table-driven payload sweep over every field — **shipped** |
| #5 producer/consumer round trip | `evolving-6`: `buildDigest → mergeDigests` loses zero entries — **shipped** |
| #8 control bytes in vendored source | `evolving-8` — **open cell** |
| #6 real corpus as a standing fixture | filed to backlog |
| #8 grep guards need negative tests | filed to backlog |
| #7 RED as its own commit | filed to backlog |
| #4 the frozen-assertion escape hatch | prose only — a judgment rule about what a worker does when blocked |
| #2, #3 where to place a boundary | prose only — design judgment |

## Test coverage

`test_lib.mjs` 70 → **108** assertions. Onboard suite unchanged and green. Frozen judge intact on all
seven capped cells. Beyond the suite, verified by the orchestrator's own shell: a payload sweep over
every allowlist field (12 runs, all blocked), and a real-corpus round trip (59 → 59, zero dropped).
