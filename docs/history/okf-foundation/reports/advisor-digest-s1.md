# Advisor consult digest — okf-foundation S1 (pre-Gate-3, AO2b)

Advisor: fable (models.claude.advisor). Read-only. Advice, never approval.

1. **Most likely post-green latent defect:** silent misparse behind an empty-bundle green — at S1
   `check` validates zero real concepts, so the parser is only exercised by its own fixtures; a
   colon in an unquoted title, `#` mid-value, or CRLF frontmatter parses *wrong without erroring*
   and surfaces at S4, three cells later.
2. **Emitter-first under future hand-edits:** sound only if "fail loudly" means reject anything not
   positively recognized. Cheapest guard: a **canonical round-trip check inside `check`** — parse,
   re-emit, byte-compare; mismatch = profile warning naming the file. Converts the silent-misparse
   class into a detectable finding.
3. **Ledger ordering:** hashes are content-sha256 of the working tree — commit timing is moot. Real
   hazards: `.bee/onboarding.json` absent from okf-1's files list (would re-ship the v1.9.0
   stale-ledger incident if the commit follows the list); refresh→verify must be the **last**
   mutation before the cell commit; `--apply` also touches `updated_at`/`bee_version` — sweep it all.
4. **Likeliest F2 regret in D17-D38:** D21's per-level committed byte-identical indexes — a
   merge-conflict amplifier across worktrees and a cross-OS determinism flake surface at F2 scale.
   Runner-up: D35's exactly-one ownership breeding artificial cross-references where a rule
   genuinely governs two concepts.

ADVISOR DIGEST: S1's real risk is silent misparse behind an empty-bundle green — add a
parse→re-emit byte-compare warning to `check`. Ledger: content-based hashes make commit timing
moot, but onboarding.json must ride the cell commit and refresh+verify must be last. D21 is the
likeliest F2 regret; advice only — approval stays with the orchestrator.

## Orchestrator disposition

- Items 1+2: **accepted** — folded into okf-1 (round-trip warning in check; CRLF/colon/# fixture
  rows in the RED-first suite). No locked decision touched.
- Item 3: **accepted** — `.bee/onboarding.json` added to okf-1 `files`; "refresh+verify is the last
  mutation" added to must_haves.
- Item 4: **recorded, not acted on** — D21/D35 stay locked (advice never overrides a locked
  decision); flagged into the F2 backlog row so F2 planning weighs index granularity and shared-rule
  ownership with this digest cited.
