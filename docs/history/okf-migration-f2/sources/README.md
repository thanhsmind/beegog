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

Re-derive and re-assert every pin at any time:

```
node scripts/okf_migrate.mjs --verify-pins
```
