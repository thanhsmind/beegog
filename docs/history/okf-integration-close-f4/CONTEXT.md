# okf-integration-close-f4 — CONTEXT

**Mode:** standard · **Opened:** 2026-07-22

## Why this feature exists

`okf-switchover-f3` flipped the system of record: new knowledge is authored as concepts in the
knowledge bundle, the legacy spec tree is fenced read-only, and the profile that defines the bundle
was migrated into it. A mechanical audit after the close found the **core** correct and guarded —
and the **edges** still teaching the old model.

Two gaps were confirmed by direct observation of this session's own startup preamble, not by
inference:

- The preamble's `### Critical patterns (digest)` section printed the *pointer stub's* boilerplate
  as if it were the patterns. The digest builder still reads the retired file, which is now a
  redirect carrying no lessons.
- The preamble's `### Project map` section printed `Specced areas: 11 (docs/specs/ — read the spec
  before the code)` — counting the compatibility surface and instructing the reader to do exactly
  what G4 replaced.

And the sharpest documentation gap: `skills/bee-hive/references/routing-and-contracts.md` and
`references/go-mode.md` — the two files `bee-hive/SKILL.md` explicitly defers to for "the full
routing table" and "the full pipeline" — contain **zero** occurrences of `docs/knowledge` (measured:
0 vs 4 and 0 vs 1 for `docs/specs`). An agent that follows the full instructions is taught the
reading order the switchover replaced.

This is the silent-rot class the switchover itself was built to prevent: no suite is red, but every
new session is taught a little of the retired model.

## Locked decisions

**D1 — The critical-patterns digest resolves through bundle mode, like every other doc-tree
consumer.** In bundle mode the preamble digest is built from the bundle's own generated root index
(`docs/knowledge/index.md`, its `## Critical patterns` section — the live equivalent D21/D34
established), never from the retired file. With no bundle, the behavior is **byte-identical to
today**: read `docs/history/learnings/critical-patterns.md`. Same line cap in both branches. The
predicate is `bundleMode`, never an `existsSync` and never re-derived in prose (G12/G13 carry
forward).

**D2 — The project-map section branches on bundle mode.** In bundle mode it names the bundle as the
thing to read before the code and counts what the bundle actually holds (areas and concepts);
`docs/specs/` is described as the read-only compatibility surface, never as "specced areas — read
the spec before the code". With no bundle, byte-identical to today, including the missing-map
warning branch and the PBI line in both branches. The 2–5 line cap (D5/D10 of the preamble
contract) holds in both branches.

**D3 — The scribing-debt nudge names the resolved target,** bundle or spec tree, instead of
hardcoding `docs/specs/`.

**D4 — The two `bee-hive` reference files are brought to parity with `bee-hive/SKILL.md`'s own
bundle branch,** not rewritten wholesale. The contradicting passages are named: the State Bootstrap
critical-patterns line, the Scout Contract's area row, the per-area reading-order line, the Chaining
Contract's scribing row, the File Quick Reference (which lists no bundle path at all), and
`go-mode.md`'s bootstrap step plus its scribing step. Each gets the same both-branches treatment the
SKILL already uses: bundle present → bundle first; no bundle → today's guidance, unchanged.

**D5 — `bee-grooming` gains a bundle dimension to its debt hunt.** Today its entropy score measures
only spec-tree drift, so a rotting bundle is invisible to the one skill whose job is finding rot.
It must count what the bundle can already prove mechanically — the conformance check's findings and
areas that have code but no concept — never a hand-maintained list.

**D6 — `bee-planning`'s tiny/small bootstrap names the knowledge-context command** when the active
feature has a work item, as the standard/high-risk bootstrap already does. Lanes scale ceremony,
never the context an agent is allowed to have.

**D7 — `bee-compounding`'s ownership prose is corrected** from "bee-scribing owns `docs/specs/`" to
owning the state layer generically. The mechanical check it performs is already layer-agnostic; only
the prose misdescribes it.

**D8 — No new content lands in `docs/specs/`.** The fence must stay green; every rewrite in this
feature is to skills, references, or the bundle.

**D9 — The last cell owns the derived-artifact regeneration for the WHOLE feature,** and the full
chain runs after the final edit. Directly applying the lesson recorded at f3's close (pattern
`20260715`, fourth recurrence): one `templates/lib/` touch drags four artifacts — the `.bee/bin`
mirror, the rendered plugin skill trees, the release manifest, and the onboarding managed-hash
ledger — and a cap-time verify expires the moment anything else is edited.

## Terms

- **Bundle mode** — the single predicate deciding whether this repo's state layer is concepts or
  spec files; true only when the knowledge tree holds at least one concept that parses.
- **Preamble** — the injected session-start block every agent reads before doing anything.
- **Compatibility surface** — the legacy spec tree, kept alive so old citations resolve, read-only
  for new content.

## Out of scope

- Deleting pointer stubs (D20 forbids it; a separate future feature).
- A `knowledge stale` verb (backlog P68) — D5 uses only what the conformance check already proves.
- Migrating long-form decision records or feature CONTEXT files into the bundle (backlog).
