# cz-2 — A doctrine gate that derives its own scan set, knows four counts apart, and bites

**Status:** [DONE]

**Outcome:** `scripts/test_doctrine_parity.mjs` guards the cz-1 doctrine corrections. It derives its
scan set (`git ls-files -z '*.md'` minus `docs/history/**`), its doctrine file set (every
`AGENTS.block.md` **plus** the merged root `AGENTS.md`, named explicitly because the glob does not
match it), and all four hook counts. Prose counts are checked only against the quantity they name;
bare `<n> hook(s)` is reported as unchecked rather than guessed, so the true six-toggle claim at
`docs/06-runtime-integration.md:121` passes. `--selftest` aims the checker at fixture roots and
asserts both failure modes bite. Joins the verify chain through `run_verify.mjs`'s `scripts/` glob —
no runner edit.

**Files touched:** `scripts/test_doctrine_parity.mjs` (new)

**Commit:** `6dc1d20`

**Full trace, verify command and recorded output:** `.bee/cells/cz-2.json`
