# Review — Code Quality / Correctness (codex-runtime-parity, 088fcd8..HEAD)

Reviewer scope: git diff 088fcd8..HEAD, CONTEXT.md, plan.md. Read-only.
Verification: all four vendored test suites run GREEN in this working tree —
`hooks/test_hook_contracts.mjs` (71 rows, 0 failing), `hooks/test_write_guard.mjs`
(ALL PASS), `skills/bee-hive/templates/tests/test_lib.mjs` (169 passed, 0 failed),
`skills/bee-hive/scripts/test_onboard_bee.mjs` (0 failures, 1 skip). Both projections
re-render byte-identical to disk; both twin pairs are `cmp`-identical.

## Focus-area verdicts (all PASS)

1. **adapter.mjs stdin normalization + per-host output encoding — CORRECT.**
   Every one of the seven wrappers (`bee-session-init`, `bee-prompt-context`,
   `bee-write-guard`, `bee-model-guard`, `bee-state-sync`, `bee-chain-nudge`,
   `bee-session-close`) calls `readHookContext()` FIRST and only ever touches
   `ctx.payload.*` on the already-normalized plain object. No wrapper reads
   stdin directly or accesses a field before normalization. `readHookContext`
   normalizes top-level null/array/junk to `{}` (adapter.mjs:173-187), coerces
   non-string/absent `cwd` to `process.cwd()` (189-197), and wraps
   `findRepoRoot` in its own try/catch (207-214) so no discovery throw escapes.
   Advisory-event encoding is correct: `emitHookOutput` (244-253) emits JSON
   `{systemMessage}` only for PreCompact/SubagentStop/Stop and never
   `decision:"block"`; `bee-state-sync` is silent on SubagentStop/Stop (satisfies
   the Codex JSON-only rule by emitting nothing); `bee-session-close` collects
   all parts into ONE `systemMessage` write (single parseable object). Each
   wrapper wired to an advisory event passes the correct `defaultEvent` for
   payloads that omit `hook_event_name`.

2. **catalog.mjs rendering determinism — CORRECT.** `renderProjection` emits
   events in CATALOG declaration order; each group emits `matcher` then `hooks`;
   each hook spreads `cmd()` output ({type, command, statusMessage}) in fixed
   key order (catalog.mjs:35-41, 138-153). `renderProjectionText` uses
   `JSON.stringify(...,null,2)+"\n"`. I re-rendered both projections in-process
   and confirmed `renderProjectionText('codex') === hooks/hooks.json` and
   `renderProjectionText('claude') === hooks/claude-hooks.json` byte-for-byte. A
   rerender cannot drift against the checked-in files. Manifest routing is
   consistent: `.claude-plugin/plugin.json` "hooks" now points to
   `claude-hooks.json`; `.codex-plugin/plugin.json` carries no hooks field
   (Codex loads the default `hooks/hooks.json`).

3. **startFeature preconditions — CORRECT (fails closed, atomic on success).**
   Walked every branch (state.mjs:451-491, +local helpers 424-449): non-empty
   feature check, `isKnownPhase` check, then reads via `readStateStrict` and
   checks phase(idle/compounding-complete) → HANDOFF → workers → active
   reservations → any-claimed-cell → prior-feature-nonterminal-cell. Every
   refusal path throws BEFORE the single terminal `writeState` — zero mutation
   on refusal (confirmed by the eight test_lib refusal tests, each asserting
   byte-identical state.json before/after). Success path is ONE `writeState`
   (writeJsonAtomic) setting feature/mode/phase + resetting all four gates —
   atomic, no partial write. `readStateStrict` correctly distinguishes absent
   (defaults) from corrupt (throws), so it cannot silently clobber. Phase
   vocabulary is consistent: validation uses `isKnownPhase`/`KNOWN_PHASES`; the
   startable/terminal pair `idle`|`compounding-complete` matches the identical
   pair in `bee-session-close.mjs:174`.

4. **test_onboard_bee two-projection parity — CORRECT and bidirectional.** 9b
   compares the applied repo settings against `hooks/claude-hooks.json` (the
   Claude projection, matching the manifest switch). 9b2 imports
   `ALLOWED_DIFFERENCES` from `hooks/catalog.mjs` (never re-hardcoded), computes
   `onlyInClaudeProjection` AND `onlyInCodexProjection` (both directions),
   asserts every diff is allowed, and separately asserts every
   `ALLOWED_DIFFERENCES` entry maps to a real diff. Correct file compared per
   runtime.

5. **Twins — BYTE-IDENTICAL.** `cmp templates/bee_state.mjs .bee/bin/bee_state.mjs`
   and `cmp templates/lib/state.mjs .bee/bin/lib/state.mjs` both report identical.
   test_lib also enforces this for every templates/**.mjs ↔ .bee/bin sibling.

No P1 or P2 correctness defects found. Four low-severity advisories follow.

---

## Findings

### F1 — Same-runtime double-activation is host-behavior-dependent and unproven by the diff
- severity: **P3**
- autofix_class: **advisory**
- summary: `hooks/hooks.json` (Codex default projection) physically remains at
  the plugin root while `.claude-plugin/plugin.json` explicitly wires
  `hooks/claude-hooks.json`. D1 forbids two active hook sources in one install.
  The diff relies on Claude Code treating an explicit manifest `hooks` path as a
  REPLACEMENT for the default `hooks/hooks.json`, not an addition.
- today-behavior: If a host loads BOTH the manifest path and the default
  `hooks/hooks.json`, every shared hook on Claude runs twice per event (double
  state-sync writes, doubled advisories). Claude Code's documented behavior is
  that an explicit hooks path replaces the default, so this is almost certainly
  fine — but nothing in the diff proves it, and the plan lists "hook activation"
  proof as still pending.
- failure scenario: A Claude host that auto-discovers `hooks/hooks.json` at
  plugin root would emit each SubagentStop/Stop advisory twice and write
  `state.json` twice per PostToolUse; harmless-but-noisy, not corrupting (hooks
  are idempotent/deduped).
- file:line: `.claude-plugin/plugin.json:8`, `hooks/hooks.json` (whole file)
- smallest credible fix: none in code — add a live-fire activation-count check
  on the Claude runtime to the Distribution-slice UAT (already flagged pending
  in plan.md), confirming exactly one activation per shared hook.

### F2 — Terminal/startable phase pair is hardcoded in two places, not a shared predicate
- severity: **P3**
- autofix_class: **advisory**
- summary: The `idle`|`compounding-complete` startable/terminal pair is written
  literally in `startFeature` and again in `bee-session-close`. Values currently
  match, but there is no single source (unlike `isKnownPhase`/`KNOWN_PHASES`), so
  a future change to one can silently drift from the other.
- today-behavior: Consistent; both use the same two literals.
- failure scenario: A later edit adds a second terminal alias to session-close's
  branch but not to startFeature's guard (or vice versa), causing startFeature to
  refuse on a phase the rest of the system treats as terminal.
- file:line: `skills/bee-hive/templates/lib/state.mjs:466`,
  `hooks/bee-session-close.mjs:174`
- smallest credible fix: export an `isTerminalPhase(phase)` (or
  `STARTABLE_PHASES`) constant from state.mjs and use it in both sites.

### F3 — Reservation "active" logic is duplicated in startFeature's local helper
- severity: **P3**
- autofix_class: **advisory**
- summary: `listActiveReservationsForStart` (state.mjs:437-449) reimplements the
  released/expired predicate that `reservations.mjs` already exposes as
  `isActive`. I diffed both: semantics match exactly today (released_at nullish
  AND ttl-based expiry with the same finiteness guards). It is a deliberate
  choice (comment cites avoiding a state.mjs↔reservations.mjs import cycle), but
  it is drift-prone.
- today-behavior: Equivalent to `reservations.isActive`; no behavioral gap.
- failure scenario: If reservation expiry rules change in `reservations.mjs`
  (e.g. a grace window), startFeature keeps the old rule and refuses/permits out
  of step with `bee-session-close`'s active-reservation warning.
- file:line: `skills/bee-hive/templates/lib/state.mjs:437-449` vs
  `skills/bee-hive/templates/lib/reservations.mjs:29-39`
- smallest credible fix: none required now; if the cycle can be broken, factor
  the predicate into `fsutil`/a shared leaf module both import.

### F4 — Projection ALLOWED_DIFFERENCES parity check ignores the hook filename
- severity: **P3**
- autofix_class: **advisory**
- summary: In test_onboard_bee 9b2, `isAllowedDifference` matches a diff by
  (event, matcher) only; the third triple component (the `.mjs` filename) is not
  compared against the allowed entry. The single real difference (Agent|Task →
  bee-model-guard.mjs) has a unique matcher, so this is not exploitable today.
- today-behavior: Passes correctly for the one allowed difference.
- failure scenario: A future rule sharing event+matcher with an allowed entry
  but pointing at a different script would be accepted as "allowed" without the
  filename being verified.
- file:line: `skills/bee-hive/scripts/test_onboard_bee.mjs` (isAllowedDifference,
  ~line 512)
- smallest credible fix: extend `ALLOWED_DIFFERENCES` entries with the expected
  filename and compare the full triple.
