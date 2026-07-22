# Advisor consult digest — okf-switchover-f3 (pre-Gate-3, AO2b)

Advisor: fable (models.claude.advisor). Read-only. Advice, never approval.
Every number below was measured against the live bundle, not predicted.

## Findings

1. **G1's fallback rots through its predicate, not its prose.** `bundleDir()`
   (`.bee/bin/lib/knowledge.mjs:119`) is a bare `path.join` with no existence semantics, so every
   rewired skill re-invents "has a bundle" in English. A host repo where a stray `.gitkeep` creates
   `docs/knowledge/` flips to bundle mode with an **empty** bundle: scribing writes concepts nobody
   reads while `docs/specs/` quietly stops updating. Ships working, rots in one release, no error.
   Compounding it: `grep` over the conformance, skill-render and verify scripts finds **no**
   reference to either tree — the fallback would be entirely unasserted prose, and bee's own
   checkout (which has a bundle, and where G2 forbids new prose under `docs/specs/`) structurally
   cannot exercise the fallback end to end.
2. **G3 deletes the anti-fork mechanism.** Today's quality comes from structure, not diligence:
   `bee-scribing/SKILL.md:56` ("one area = one file, forever"), `:121` (no second spec), `:60` (the
   nine-section skeleton), `:22` (the rebuild bar). G3's "new subject in an existing area → author a
   new concept" removes it — two concepts on one subject both parse, both list in the index, and no
   reader can tell which is true: the exact `-v2` failure `:121` bans. And `okf-profile.md:378`
   leaves concept body sections to the author's discretion, so the only automatic grade is
   frontmatter canonicality: **format-green would read as quality-green.**
3. **G5's headline oracle passes by construction — the F2 lesson recurring verbatim.** Measured:
   the work item carries **no `bee.areas`**, only **2 of 50** patterns carry any, and tag overlap
   against its five tags hits **1 of 50**. So 49 patterns tie at score 0 and "ranking" is a
   path-sorted arbitrary prefix wearing a relevance label. Worse, the plan's stated acceptance
   ("the 5 relevant entries survive") holds even if *every* pattern were dropped: those five are
   the work item, its plan, and `required_context` at ranks 1-3, and the budget cut is a prefix
   cut. The test cannot fail.
4. **On ordering:** a real argument exists for flipping the write half first — G3 *is* the switch
   and sits third of four, so if S1's ranking work (an open experiment, not a design) eats the
   budget, the feature ships as a manifest tweak and the 8-vs-0 scribing drift survives another
   release. The contamination premise is also weaker than claimed: ranking moves only ranks 4-5,
   while "is the bundle helping?" is judged on ranks 1-3. Net advice: **keep read-first — S1 is one
   cell — but make S2 explicitly non-droppable.**
5. **Most likely regretted: G5.** It converts a *loud* failure (13k tokens of visible noise) into a
   *silent* one — a pattern that would have prevented a bug is simply absent, and once cut before
   truncation it is not even named in `truncated`. Guard: emit every excluded critical as
   `{path, score, reason}`, assert `entries + truncated + excluded == all criticals`, and fail when
   zero-score patterns exceed a pinned threshold. Runner-up: G1, guarded by finding 1.

ADVISOR DIGEST: G1 rots through an unasserted, re-invented "has a bundle" predicate in a repo that
can never run the fallback — pin one `bundleMode()` and a permanent bundle-less fixture suite.
G5's named oracle passes by construction and its signals are empty on the live fixture (1/50 tag
overlap, 0 area overlap) — test discrimination and zero-signal count, not survival. G3 removes the
anti-fork mechanism while the profile enforces frontmatter only, so format-green will read as
quality-green; gate on `authoritative_for` and keep read-first with S2 non-droppable.

## Orchestrator disposition

All five accepted, recorded as **G8-G11**. The plan's S1 exit-state wording is superseded by G10 —
the slice shape stands, its acceptance test does not.
