---
date: 2026-07-11
feature: skill-sync
categories: [process, security, review, filesystem]
severity: high
tags: [stage-capability, mirror-delete, trust-boundary, case-insensitive, red-first]
---

# Learnings — skill-sync

## What Happened

High-risk feature (onboard apply gains a global skill-sync stage with a downgrade guard and
a fenced mirror-delete under `~/.claude/skills`). The pipeline worked exactly as designed —
and still taught a hard lesson: after Gate-1 exploring with 2 fresh-eyes rounds, a 3-iteration
validating persona panel (12 BLOCKERs raised and closed), an advisor consult, and a 232-check
red-first suite, the post-implementation review wave (5 isolated codex reviewers) produced 50
raw findings that distilled to **9 code-confirmed P1s** — including three genuine data-loss
paths (the mirror deleting its own output on dir→file transitions; a repo under
`~/.claude/skills` erasing itself, `.git` included; sync-then-delete of one physical dir on a
case-insensitive filesystem, reproduced on a real `/mnt/c` mount). All 9 were fixed red-first
in one wave (02662bf, 3d36b22) and re-greened; UAT passed live.

## Root Cause

**Stage-capability mismatch.** Every pre-code stage reviews *artifacts* (plans, briefs,
cells) — their catches were all specification defects. Tests written from the same spec share
the implementation's blind spots, so 232 green checks proved spec conformance, not
implementation safety. The defect classes that survived to review were all
implementation-emergent: proxy checks (`existsSync(bee-hive)` as "installed"), first-substring
parsing (decoy `BEE_VERSION` comments), pass ordering (deletion driven by a snapshot older
than the last write), and physical-identity blindness (case aliasing; repo↔target overlap).
Only reviewers reading the actual diff could see them.

## Recommendations

- Pre-code panels are spec-defect filters; green tests are spec-conformance evidence. For
  destructive/mirror/guard logic, NEVER count pre-code iterations or test counts as
  implementation assurance — the post-implementation isolated review of the real diff is the
  stage that catches implementation-emergent defects. (Promoted to critical-patterns.)
- Mirror/sync code: remove stale and opposite-type entries deepest-first BEFORE materializing
  new content (or stage-and-swap atomically); never drive a deletion pass from a snapshot
  older than the last write.
- A parsed value that authorizes mutation is a trust boundary: single line-anchored
  declaration on an lstat-verified regular file; ambiguity/duplicates/symlinks = unknown =
  refuse, never forceable, never a silent fallback.
- Name-keyed mirror/delete logic must key on canonical physical identity: case-alias probe,
  repoRoot↔targetRoot overlap refusal, fail-closed on collision — and carry a REAL
  case-insensitive mount in the test matrix (`/mnt/c` on WSL) as a first-class platform
  dimension.
- Process patterns that held: isolation cell before destructive implementation (F7); red-first
  reproduction for every fix (including on the alien filesystem); structural fences
  (iteration domain) over guard clauses; "reviewer word is never the evidence" — all 9 P1s
  were code-verified before acceptance, and 2 reviewer P1s were honestly downgraded with
  recorded reasons.
