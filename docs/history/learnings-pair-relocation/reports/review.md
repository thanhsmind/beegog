# Review — learnings-pair-relocation (small lane: 1 correctness reviewer)

Reviewer: external codex CLI (review slot `{kind:cli}`), isolated context (diff 320c7eb + plan.md).
Raw report: `.bee/workers/review-learnings-pair-relocation.result.md`.
Synthesis: orchestrator, per the rule this very feature shipped. Self-checks (tiny list): verify green,
judge intact, no secrets, scope = declared files. All three findings orchestrator-verified against the
files before acceptance (grep + pre-commit git show).

FINDINGS: 3 — 2×P1, 1×P3. All `autofix_class: gated_auto` (concrete one-phrase fixes).

### [P1] The 7-reviewer wave cap silently refills the freed slots (finding 1)

**Plain language:** the pair's removal freed 2 wave slots, but the cap stayed at 7 — so up to 3
conditionals can now dispatch where 2 could before. Worst case saves 1 dispatch, not the promised 2,
and a conditional that used to fold into a core reviewer now gets its own dispatch.

**Evidence:** SKILL.md:30 ("cap 7"), SKILL.md:62 ("cap the wave at 7"), reviewing-reference.md:44
("Cap the wave at 7 reviewers total"). Old wave: 5 parallel (4 core + researcher) + 2 conditionals = 7.
New wave: 4 core + 3 conditionals = 7. Plan promised −2 dispatches per standard/high-risk feature.

**Failure scenario:** a high-risk diff matching 3 conditional triggers dispatches 7 where the
intent was 6 — the cost reduction erodes exactly on the expensive lane.

**Smallest fix:** cap 7 → 6 in the three locations. Orchestrator-verified: arithmetic correct. Accepted P1
(contradicts the approved plan's stated outcome).

### [P1] Conditional reviewers carry contradictory tier instructions (finding 2 — pre-existing)

**Plain language:** SKILL.md:60 says conditionals use the `review` slot; reviewing-reference.md:32
still says "same generation tier". Two agents reading different files dispatch on different models.

**Evidence:** reference line 32 is byte-identical before this commit (`git show 320c7eb^`) — the
contradiction was created when decision 0021 introduced the review slot in SKILL.md without updating
the reference's conditional section. Not introduced by this diff; surfaced by it.

**Failure scenario:** an orchestrator following the reference dispatches a reliability/migration
reviewer on the generation model instead of the configured independent-review model.

**Smallest fix:** "same generation tier" → "same review slot" at reference:32. Accepted (kept at the
reviewer's P1 per the conservative-route rule; provenance noted).

### [P3] "Strongest model in the wave" overclaims (finding 3)

**Plain language:** the new synthesis rationale in SKILL.md §2 claims the orchestrator is the
strongest model in the wave; with the review slot configurable (opus / external CLI) and advisor mode
running the session on the generation tier, that is not guaranteed.

**Smallest fix:** reword to the plan's precise claim — the old synthesis agent ran on the
orchestrator's own model, so dispatching it added a hop, not a mind. Accepted P3.

## Verification-evidence gate

Single `behavior_change` cell (learnings-pair-relocation-1): trace carries structured
`verification_evidence` with red before-state (11-hit grep census, exit 1) and the green chain
(negative grep 0, positive greps pass, test_lib 124/0, test_onboard PASS). ✔

## Artifact verification

plan.md promised 4 file edits: all EXIST, SUBSTANTIVE (real prose replacing the pair, not stubs),
WIRED (the lane tables and roster sentences are the operative text agents read). ✔

## Gate 4 disposition

P1 = 2 → merge blocked pending fixes or explicit owner acknowledgment.
