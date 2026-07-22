# Pinned pre-migration sources (okf-migration-f2, F8)

These files are **verbatim committed copies** of each migrated area's source as
it stood immediately before the commit that replaced it with a D37 pointer
stub. They are not documentation and must never be edited: each one is
content-addressed by the `blob_sha` recorded in `scripts/okf_migrate.mjs`'s
`PIN_REGISTRY`, and `okf_migrate` verifies that hash with `git hash-object`
before it will use the file.

**Why they exist.** The coverage gate derives its ground truth by extracting
anchors from the pinned blob, normally reached through
`git rev-parse <commit>:<path>`. That fails outright in a `--depth 1` clone —
the object simply is not there — and a gate that *skips* when it cannot read
its own ground truth is worse than no gate. So the gate falls back to the copy
here, verifies its hash against `blob_sha`, and refuses (exit 1) when neither
the git object nor a matching copy is available. A copy that has drifted from
its pinned hash is refused too.

| File | Pinned commit | Blob | Scheme | Anchors |
|---|---|---|---|---|
| `advisor-protocol.md` | `19c0e50` (okf-4, the commit before `a0ea0cc` stubbed it) | `f3f1231…` | `ba-nine-section` | 26 (4 B / 9 R / 6 E / 7 P) |
| `critical-patterns.md` | `a0ea0cc` (okf-5, the commit before `b0d495d` migrated it) | `2bf1120…` | `flat-pattern-list` | 47 (PAT1–PAT47) |
| `doctrine-layer.md` | `ed65720` (f2-4, the commit before f2-3 stubbed it) | `351bf72…` | `ba-nine-section` | 39 (10 B / 17 R / 5 E / 7 P), 2 unparsed blocks |
| `decision-memory.md` | `8710d03` (f2-3, the commit before f2-5 stubbed it) | `2e8ec59…` | `ba-nine-section` | 9 (0 B / 9 R / 0 E / 0 P), 0 unparsed blocks |
| `verify-pipeline.md` | `72fd828` (f2-5, the commit before f2-6 stubbed it) | `eab70d7…` | `ba-nine-section` | 14 (0 B / 5 R / 4 E / 5 P), 7 unparsed blocks |
| `performance-log.md` | `46a56a4` (f2-6, the commit before f2-7 stubbed it) | `efdc9f2…` | `ba-nine-section` | 23 (0 B / 11 R / 5 E / 7 P), 10 unparsed blocks |
| `feedback-digest.md` | `3d69a2d` (f2-7, the commit before f2-8 stubbed it) | `eeb447e…` | `ba-nine-section` | 29 (0 B / 15 R / 6 E / 8 P), 26 unparsed blocks |
| `onboarding.md` | `a06f59d` (f2-8 close, the commit before f2-9 stubbed it) | `c78ca9b…` | `ba-nine-section` | 58 (0 B / 28 R — `R20b` included / 15 E / 15 P), 20 unparsed blocks |
| `hook-runtime.md` | `ab8cf6e` (f2-9, the commit before f2-10 stubbed it) — **REPAIRED**, see below | `a8907ce…` | `ba-nine-section` | 81 (22 B / 24 R — `R8a`, `R8b`, `R14a` included / 17 E / 18 P), 8 unparsed blocks |

**One of these copies is not a byte copy of any commit, and says so.**
`hook-runtime.md` shipped the rule id `R14` **twice** — the gate-bypass
block-verdict rule and the write-guard command-shape rule, two genuinely
different rules. Anchors are keyed by id, so the first one's text was silently
overwritten by the second's: unmeasurable by the fidelity floor forever, and
invisible to a set-equality check as the pair's second member. A source in that
state cannot be migrated honestly and neither rule may be dropped or merged to
fix it, so the source was **repaired before the pin was captured**: the second
occurrence in document order was renumbered `R14a`, one token on one line.
Those bytes therefore exist in no commit's tree, and the pin declares that
explicitly — `repaired_from` names the provenance blob at
`ab8cf6e:docs/specs/hook-runtime.md` (still asserted exactly, so drifting
provenance stays as loud as a drifting pin) and `repair_reason` states why. For
this one file the copy here is not a shallow-clone fallback but the pin's only
content address.

Re-derive and re-assert every pin at any time:

```
node scripts/okf_migrate.mjs --verify-pins
```
