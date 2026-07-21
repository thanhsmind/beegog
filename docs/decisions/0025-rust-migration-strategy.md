# 0025 — Strategy for migrating bee's runtime from Node.js to Rust

**Date:** 2026-07-22 · **Status:** accepted (strategy; each phase still gets its own feature and gates) · **Owner request:** move all of bee to Rust, gradually, safely.

## What is actually being migrated

Measured surface (this repo, 2026-07-22):

| | lines | migrate? |
|---|---|---|
| `.bee/bin/**` runtime (26 lib modules + dispatcher) | 24,609 | yes |
| `hooks/**` (guards, prompt context, loggers) | 2,684 | yes |
| `scripts/**` (build, render, manifest, verify runner) | 1,984 | no — dev-side tooling, stays JS |
| Test suites | 43,092 | **neutralize, don't port** |
| `skills/**` doctrine (the product) | 6,307 | never — it is prose the model reads |

Two facts follow, and they set the whole strategy:

1. **bee's value is mostly not code.** The doctrine is Markdown; the runtime is ~27k lines of plumbing around JSON/JSONL files and git. A Rust migration does not make the *product* better — it makes its plumbing cheaper.
2. **The test suite is larger than the code it tests (43k vs 27k), and 35 of 56 suites already drive the CLI across a process boundary.** Those 35 validate *any* implementation as-is. The other 18 import JS modules directly and are the only thing structurally blocking a second language.

## Honest performance expectation

Measured: bare `node -e 1` = 21 ms; the write-guard hook = 42 ms, of which ~21 ms is module loading and ~0 ms is the actual decision; `bee status` = 245 ms, dominated by file I/O and `git` subprocesses.

So Rust buys **~20 ms per process spawn**, and buys nothing on I/O- or git-bound work. That is a large win where bee spawns constantly (a hook on *every* tool call) and a small one on the commands that already feel slow for other reasons. Nobody should expect "bee gets 10× faster"; expect "every invocation loses its start-up tax".

## Decisions

**D1 — The store format is the migration contract, and it never changes in the same step as an implementation.** Both languages read and write the same `.bee/**` JSON/JSONL files with the same semantics. Any format change is its own feature, in JS, shipped and settled *before* the corresponding port. This is what makes a half-migrated bee coherent at all.

**D2 — Phase 0 is making the tests language-neutral, and it comes before any port.** Convert the 18 module-importing suites to the process/vector shape the other 35 already use — inputs and expected outputs as data, executed against whatever binary is under test. Until this exists, every ported module needs new tests written blind, which is how a rewrite silently loses behavior. This phase has value even if the migration is abandoned.

**D3 — Port whole processes, ordered by (call frequency × simplicity), never by importance.** The order is: (1) hooks — highest frequency, smallest surface, already covered by a 147-check corpus; (2) read-only CLI verbs (`status`, `list`, `show`, `search`) — a bug costs a wrong answer, not corrupt state; (3) mutating single-writer verbs (`decisions log`, `capture add`); (4) **last: the concurrency layer** (lock, claims, reservations, worktree-holds). That layer produced three genuine correctness bugs in a single day (lost heartbeat write, stale-takeover identity, past-ceiling takeover) — it is simultaneously the least safe thing to rewrite and the least rewarding, because its cost is I/O and waiting, not CPU.

**D4 — One rule has one implementation. Port, prove, delete.** A ported unit's JS is removed in the same feature that lands its replacement. Bee does not keep two implementations of a rule "for safety" — this session alone produced four drift incidents (lib mirrors, hook mirror, three competing prose homes, a taxonomy schema mismatch), and every one of them was two copies of one truth. The only permitted duplication is the temporary fallback in D5, which is a *dispatch* choice, not a second rule.

**D5 — Fail toward JS.** A binary that is absent, incompatible, or unsure defers to the JS implementation rather than guessing. Unknown input shapes, unparsed commands, unresolvable state: defer. This keeps the guarantee that bee never becomes *less* safe on a platform the binary does not cover.

**D6 — Distribution is built before the second binary, not after the first.** bee ships today by copying files, with no build step anywhere. Before porting beyond the first hook: a CI cross-compile matrix (linux x64/arm64, macOS x64/arm64, windows x64), checksums, installer platform selection, and the D5 fallback. Skipping this makes every later port block on the same missing pipeline.

**D7 — Every phase is independently shippable and reversible by deleting a binary.** No phase may leave bee in a state that requires the next phase to be correct.

## Phase plan

| Phase | Content | Ends when |
|---|---|---|
| 0 | Language-neutral conformance corpus (18 suites converted; vectors as data) | Both a JS and a hypothetical binary can be validated by the same corpus |
| 1 | Rust write-guard hook as a deferring fast path (already scoped: `docs/history/rust-write-guard/CONTEXT.md`) | Hook ≤5 ms, corpus green, JS fallback proven |
| 2 | Distribution pipeline (D6) | A tagged release ships verified binaries for five targets, installer selects, fallback proven |
| 3 | Remaining hooks, then read-only CLI verbs | Each verb's JS deleted, corpus green |
| 4 | Mutating single-writer verbs | Same |
| 5 | Concurrency layer, with its race harnesses ported first | Forced-interleaving tests green in both languages |

## What would make me stop

If Phase 0 shows the behavior corpus cannot be expressed as data without encoding JS internals, the migration is more expensive than it looks and should be re-scoped to hooks only (where the win is concentrated anyway). If Phase 1's measured win is under ~15 ms per call in real sessions, stop after hooks — the remaining phases spend their risk on I/O-bound code.

## Cheaper alternative kept on the table

Trimming the hook's import graph (its 21 ms of module loading for a ~0 ms decision) reaches roughly 25 ms with no new language, no build step and no second implementation. Phase 1 must measure against *that* baseline, not against today's 42 ms, or it will overstate what Rust contributed.
