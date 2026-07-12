# review-od-5 — chain handoffs off auto-review

**[DONE]** — worker: dave

Re-wired the post-execution chain per SPEC R3/7.1 (decision `565e68d0`):

- `skills/bee-swarming/SKILL.md`: final-slice and small-lane completion signals now hand off to
  bee-scribing (all 4 `bee-reviewing` occurrences removed/reworded); frozen-judge escalation carries
  hits into any later review session instead of auto-flagging `bee-reviewing`.
- `skills/bee-scribing/SKILL.md`: sync trigger + frontmatter description now say "execution completes"
  (chain-position wording only; capture/spec-sync rules untouched).
- `skills/bee-compounding/SKILL.md`: feature close gained a "Review candidate at close" step —
  `bee_reviews.mjs candidate add --feature <feature> --head "$(git rev-parse HEAD)" --mode <lane>` +
  the SPEC §9 completion line, closing truthfully as `unreviewed`.

Verify passed: `node skills/bee-hive/templates/tests/test_lib.mjs && ! grep -F "bee-reviewing" skills/bee-swarming/SKILL.md && grep -qF "candidate add" skills/bee-compounding/SKILL.md` — 206/0, composite exit 0.

Files touched: `skills/bee-swarming/SKILL.md`, `skills/bee-scribing/SKILL.md`, `skills/bee-compounding/SKILL.md`.

Commit: `064f712`. Reservations released (3). Full trace/evidence: `.bee/cells/review-od-5.json`.
