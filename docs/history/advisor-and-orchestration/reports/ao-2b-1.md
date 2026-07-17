# ao-2b-1 — W2/AO5: advisor check narrowed to the literal same-model no-op

**Status:** [DONE]

**Outcome:** Removed the AO5-banned strength ladder (`haiku < sonnet < opus`) and the
ceiling-always-skip rule from the orchestrator's dispatch-time advisor check in
`skills/bee-swarming/SKILL.md`, its `references/swarming-reference.md` template and
prose, and the trigger citation in `skills/bee-executing/SKILL.md`. The only remaining
skip condition is the literal same-model no-op (advisor resolves to the exact same
model name as the worker). Ceiling-tier workers now always receive an `Advisor` line
when a distinct advisor is configured — config is the authority, per AO5. Worker-side
consult loop and trigger (AO4) untouched.

**Files modified:**
- `skills/bee-swarming/SKILL.md`
- `skills/bee-swarming/references/swarming-reference.md`
- `skills/bee-executing/SKILL.md`
- `.claude/skills/bee-swarming/SKILL.md` (mirror)
- `.claude/skills/bee-swarming/references/swarming-reference.md` (mirror)
- `.claude/skills/bee-executing/SKILL.md` (mirror)
- `.agents/skills/bee-swarming/SKILL.md` (mirror)
- `.agents/skills/bee-swarming/references/swarming-reference.md` (mirror)
- `.agents/skills/bee-executing/SKILL.md` (mirror)
- `docs/history/codex-harness-hardening/release-manifest.json` (regenerated via `release_manifest.mjs --write`)

**Grep evidence (required by the cell — the verify chain is structural only):**
`grep -n -i "degenerate\|haiku < sonnet\|ceiling tier" skills/bee-swarming/SKILL.md skills/bee-swarming/references/swarming-reference.md skills/bee-executing/SKILL.md` returned 0 matches post-change (5 matches pre-change). A wider repo sweep confirms remaining `haiku < sonnet` hits are historical only (`CONTEXT.md`, `plan.md`, `docs/history/advisor/*` — the earlier, superseded advisor feature).

**Full trace/evidence:** `.bee/cells/ao-2b-1.json`

**Commit:** `0837aec`
