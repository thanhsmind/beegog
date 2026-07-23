# Semantic goal-check judge — cz-3

**Verdict: ACCEPTED.**

Every `must_have` holds against the code, not merely against the test names.

## 1. A resume record never re-increments — structurally impossible

Two independent mechanisms: counting is a **row filter over the log**
(`compaction.mjs:103`, `if (record.event !== 'precompact') continue;`), never a read of
any stored index; and the written row carries `increment = event === 'precompact' ? 1 : 0`
(`:266`). Adversarial probe on temp fixtures: five resumes with no precompact yield
`0,0,0,0,0`; one precompact then four resumes yields `1,1,1,1,1`; and a **hand-forged
resume row with `compact_index: 99`** appended to the log still reads back
`{compact_index: 1, cell_compact_count: 1}` — nothing ever reads the stored index back,
so a poisoned row cannot inflate a later count. The worker's mutation probe proved the
suite bites; this proves the design is immune.

## 2. compactCheck is read-only — by call graph and on the real tree

Full call graph audited leaf by leaf (`readJson`/`readJsonl`/`readText`, `readState`,
`resolvePipeline`, `readLane`, `readSession`, `readClaim`, `listReservations`→`readStore`,
`listCells`/`readCell`, `readIntent`) — every one a pure read, none with a
normalize-and-writeback. The one write-on-read precedent in this repo is `inject.mjs`'s
legacy-cache migration (`markInjected` at `:527-535` does `writeJsonAtomic` +
`removeFileIfExists`); **`compaction.mjs` imports neither `inject.mjs` nor any sweep** —
its import list is `fsutil/state/intent/claims/reservations/cells` only (`:42-47`), and
`sweepExpiredClaims` (which does `rmSync` + `writeJsonAtomic`) is deliberately never
called. Empirically: the **real** repo `.bee/` tree — which has `cells/archive/`, `cache/`,
`logs/`, `tmp/`, `sessions/`, `lanes/`, `intent/`, none of which the test fixture has —
copied and hashed before, after run 1 and after run 2: all three equal, deep-equal across
runs, including no-session, bogus-session and two `anchorMissing` calls.

## 3. All three LANE_* codes reachable and surfaced

`compaction.mjs:434-435` passes `pipeline.code` through verbatim — no mapping, no default.
Producers at `state.mjs:1237/:1245/:1254` are each on a distinct reachable branch, and each
is asserted on both `checks[lane_binding].code` and `result.mismatches`. A fourth code,
`LANE_UNRESOLVABLE` (`:430-432`), covers a throw; the branch structure guarantees exactly
one `lane_binding` entry, never two.

## 4. The append try/catch is two lines wide

It wraps only `appendJsonl` (`:281-285`). The argument-error throw for an unknown event sits
**outside** it at `:256-260` — confirmed: `appendCompactionRecord({event:'sneeze'})` throws
rather than being swallowed. `appendJsonl` can only throw fs errors, and the record is built
entirely from strings/numbers/booleans/nulls so `JSON.stringify` cannot throw — the bare
`catch {}` has no wrong class available to swallow. EISDIR probe: `append failed but
returned: precompact 1 0`, return value fully intact.

## Judgement 1 — the unresolvable-lane design call: right and consistent

On `!ok`, the record carries `{lane: <name>, feature: null, phase: null}`. The repo has two
postures for a typed refusal: ephemeral render surfaces fall back to the default record
(`inject.mjs:305`, `:479`), durable/decision surfaces refuse typed (`guards.mjs:215-219`,
`cells.mjs:2344-2350`, "refuses loudly rather than silently falling back"). A jsonl row is
durable. Writing the default pipeline's `feature`/`phase` into a row whose `lane` names a
*different* lane produces an internally inconsistent record a later audit cannot detect as
wrong — precisely the fault the typed refusal exists to prevent. The cell's action cites
`inject.mjs:301-305` for *passing the session id*, not for its `!ok` fallback, so this is
not a deviation.

INFO, non-blocking: `pipelineFields` records lane+nulls on `!ok` while `anchorMissing`
returns `null` outright — a justified asymmetry (a log records facts; a nudge makes a
claim), documented at `:324-327`. And `:229-232`'s throw-fallback would log the default
feature/phase with `lane: null`, but `resolvePipeline` has no throwing path, so it is
unreachable.

## Judgement 2 — anchorMissing's interface vs what cz-7 consumes: correct, no rework

`.key` = `'anchor-missing-nudge'` and `.hash` = `` `${session}:${feature}:${cell}` `` match
cz-7's spec exactly, and `shouldInject`/`markInjected` (`inject.mjs:516`, `:527`) take three
positional args — drop-in. **Structurally important: `anchorMissing` performs no dedup
itself** — it never reads `shouldInject` and never calls `markInjected`, so dedup ownership
stays with the caller. Had it marked internally, the forced PreCompact path would have
poisoned the UserPromptSubmit cache and silently killed the deduped surface. This matches
`maybeCaptureQueueNudge` (`hooks/bee-session-close.mjs:210-215`), where `force` skips both.

The judge replicated `buildFixture` (`hooks/test_hook_contracts.mjs:240-259`) byte-for-byte
and ran the predicate two cells early: control (no anchor) fires `true`, with-anchor fires
`false` — exactly the asymmetry cz-7's action predicts, confirming the D23 additivity row
will go red by design and that the split cz-7 plans is the right fix.

**Two things cz-7 must carry, both wiring-side, neither a cz-3 defect:** on the forced
PreCompact path it must NOT call `markInjected`, or the next UserPromptSubmit nudge is
suppressed; and with no claimed cell the hash degenerates to `<sid>:<feature>:` — stable and
functional, since both hooks supply a session id.
