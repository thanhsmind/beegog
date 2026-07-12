# review-od-4 — bee-reviewing becomes a user-invoked review session

**Status:** [DONE]

**Outcome:** Rewrote `skills/bee-reviewing/SKILL.md` and `skills/bee-reviewing/references/reviewing-reference.md` per SPEC `565e68d0`: reviewing now dispatches only on explicit user intent (R1), scope is resolved/frozen/previewed through `bee_reviews.mjs` before any reviewer runs (R4/R5/A10), Gate 4 lives only inside a session with gate bypass never creating/approving one (R8), delta re-review replaces full-panel re-runs for localized P1 fixes (R9/A12), and Lane Scaling now scales to the session scope's risk instead of any lane auto-running a reviewer at feature close. The specialist wave, severity/synthesis, verification-evidence gate, frozen-judge check, artifact verification, and UAT contracts are unchanged (goal 5).

**Files touched:**
- `skills/bee-reviewing/SKILL.md`
- `skills/bee-reviewing/references/reviewing-reference.md`

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && ! grep -F "Use when the final swarm slice completes" skills/bee-reviewing/SKILL.md && grep -qF "bee_reviews.mjs" skills/bee-reviewing/SKILL.md` — passed (206/0 tests; retired trigger wording confirmed gone; `bee_reviews.mjs` confirmed present).

**Commit:** `f0b76cd`

Full trace/evidence: `.bee/cells/review-od-4.json`.
