# Validation Report — fresh-session-handoff, slice S1

Date: 2026-07-13 · Lane: high-risk · Cells: fsh-1, fsh-2 · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 4 mechanical flags (data model, public contracts, cross-platform, existing covered behavior) = high-risk threshold; recorded in plan.md header |
| REPO FIT | PASS | reuses existing seams: reservations TTL helpers (`reservations.mjs:29-148`), `writeJsonAtomic` (`fsutil.mjs:37-42`), guarded `startFeature` (`state.mjs:483-563`) — all verified by two independent reviewers against source |
| ASSUMPTIONS | PASS | feasibility matrix below; every row carries accepted evidence or an execution-ordered gating step |
| SMALLER PATH | PASS | S1 is lib-only, 2 cells, zero consumer wiring; nothing smaller proves the primitive |
| PROOF SURFACE | PASS | verify = the recorded standard suite (baseline ran green this session: 224 passed + onboard PASS); fsh-2's truths[0] makes the race fixtures falsifiable (deliberate-break → red) |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| O_EXCL create is an atomic cross-process claim (linux/WSL2) | blocks all | runtime probe | `probe_atomic_claim.mjs` → PASS 20 rounds × 8 racers, exactly one winner (platform: linux) | PROVEN |
| Same primitive on Windows Git Bash / NTFS | blocks all | runtime probe on win32 | Windows Node v22.14.0 present at `/mnt/c/Program Files/nodejs/node.exe` (verified); probe run **blocked pre-Gate-3** by the write guard (Windows temp is outside the knowledge-write allowlist) | CONSTRAINT C1 → **SATISFIED at execution** (fsh-1 STEP 0, 2026-07-13): probe on `E:\Temp` under Windows Node → `PASS 20 rounds x 8 racers: exactly one O_EXCL winner every round (platform: win32)`, recorded in the fsh-1 trace before any source edit |
| `session_id` reaches hooks | blocks D3/S2+ | official doc proof | code.claude.com/docs/en/hooks: `session_id` is a common input field on ALL hook events (SessionStart/PreToolUse/Stop examples quoted); adapter preserves the full payload (`hooks/adapter.mjs:161-177`) | PROVEN (no env var exists → CLI bridge = explicit `--session` param printed in the preamble; hooks resolve from payload) |
| S1 API is bridge-agnostic | — | design inspection | `claims.mjs` takes `sessionId` as a parameter (panel: "good decoupling") | PROVEN |
| D2 ordering has a data source | S4 only | file inspection | `rankBacklog` exports status-grouped ranked ids (`lib/backlog.mjs:78-141`) | PROVEN for planning S4 |
| `startFeature` precondition scoping | S2 only | analysis | recommendation recorded: per-lane unfinished-work check + global path-overlap check; decided at S2 planning | DEFERRED (not S1) |
| NFS/network project dirs | edge | doc caveat (O_EXCL on network FS) | documented as unsupported topology in fsh-1's action | CONSTRAINT C2 |

## Persona panel (review slot, adversarial) — 0 BLOCKERS / 5 WARNINGS, all resolved

| # | Finding | Resolution |
|---|---|---|
| W1 | fsh-1's atomicity truth not falsifiable by its own single-process verify | truths rewritten to post-state claims; concurrency windows proven in fsh-2; S1 caps as a unit (noted in fsh-1 action) |
| W2 | adoptClaim's two obvious implementations reintroduce the race | design pinned in fsh-1: exclusive-create gate file over a continuously-present claim file; bare read-modify-write and release-then-reclaim prohibited |
| W3 | sweep-vs-heartbeat is cross-file TOCTOU | pinned: sweep re-verifies TTL+heartbeat **under the claim's gate**; barrier fixtures prove ordering, the gate proves race-freedom |
| W4 | gating probe half-run (win32) while CONTEXT says "run it first" | attempted now; blocked by the pre-execution write guard → converted to fsh-1 STEP 0 with hard [BLOCKED]-on-FAIL (constraint C1); Windows Node availability verified in advance |
| W5 | fsh-2's steal proof seems to belong to S4 | epic map reconciled: S1 proves the primitive's steal-safety, S4 the wired handoff-carried flow — intentional double coverage |

## Cold-pickup cell review — repairs applied

- fsh-1: PICKS UP COLD. Minors fixed: typed-failure contract pinned ({ok:false, code, reason}, never throw for contention); `.bee/bin/lib` copy removed from files (self-onboard owns vendoring); scope note added.
- fsh-2: was NEEDS REPAIR (CRITICAL: sync non-awaiting `check()` would silently pass an async race). Repaired: the whole race lives in `race_claims_child.mjs` as a self-contained orchestrator (fork racers, assert internally, exit 0/1); suite calls it via one blocking `spawnSync`; `check()` untouched; falsifiability truth added (deliberate break → red). CRITICAL closed.

## Approval block

- Verdict: **READY WITH CONSTRAINTS**
  - C1: fsh-1 STEP 0 = win32 probe first; FAIL → [BLOCKED], return to planning, no source edits.
  - C2: network-filesystem project dirs unsupported (documented).
  - C3: S1 is proven only when BOTH cells cap (fsh-1 post-states + fsh-2 races).
- Approval covers slice S1 only (fsh-1, fsh-2). S2-S5 return through planning + validating.
