---
artifact_contract: bee-implement-plan/v1
feature: fresh-session-handoff
lane: high-risk
status: Approved
updated: 2026-07-13
sources: [CONTEXT.md, approach.md, plan.md]
decisions: [D1, D2, D3, D4]
---

# Implementation Plan: Fresh Session Handoff

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## 1. Goal

The owner opens several terminals on one project and they work like a team
instead of stepping on each other; when a terminal finishes a task, it hands
the next one to a brand-new session — the owner types `/clear` and the fresh
session already knows its work.

**Success looks like**
- Two sessions in the same checkout never write into each other's held files — the write is refused, naming who holds it and until when (D3).
- A finished task hands off so that `/clear` is the owner's only keystroke; the fresh session starts the chosen next task by itself (D1).
- A session that runs out of approved work in its own feature picks up approved work from another, and stops honestly when none is left — it never starts an unapproved feature (D2).
- All of this works with plain multiple-terminals-on-one-folder, no extra setup (D4).

## 2. Current State

- One global pipeline: `.bee/state.json` holds a single phase/feature/mode/gates for the whole repo; two sessions overwrite each other's pipeline by design.
- File writes are atomic (tmp+rename) but **unlocked**: reserve/claim does read-check-write in three steps, so two concurrent sessions can both pass the check (scout-confirmed race).
- Reservations have TTL semantics but are voluntary — nothing enforces them at write time.
- `HANDOFF.json` has no CLI writer, no schema, no kind; "present it and WAIT — never auto-resume" exists only as prose.
- ~20 test sites pin the single-state shape (inventory with anchors in CONTEXT.md § Existing Code Context).

## 3. Scope

**In scope**
- Session identity + atomic O_EXCL claim primitive with TTL/heartbeat (foundation for D1–D3).
- Per-feature lane state with `state.json` as the back-compat default lane (D4 topology).
- Hook-enforced cross-session hold blocking (D3).
- Schema'd two-kind handoff, cap→claim-next→handoff flow, `/clear` rehydrate, cross-lane pull (D1, D2).
- Doctrine/prose/spec updates and host rollout path.

**Out of scope**
- Headless outer loop (backlog P29); shared coordination store across git worktrees (D4); `merge=union` gitattributes (P30); any change to gate semantics, bypass rules, or review-on-demand.

## 4. Proposed Approach

Build bottom-up from the probe-proven primitive: exclusive-create claim files
plus a session identity that reaches hooks and CLI verbs. The lane model is
**additive** — `state.json` stays authoritative as the *default lane*, extra
lanes live beside it, and a repo with zero extra lanes behaves byte-identically
to today, so the pinned suite stays green while each consumer migrates
deliberately. D3 extends the existing write guard (the enforcement point that
already exists) rather than inventing a new mechanism. D1/D2 close the
`/clear` race by having the handoff itself carry the claim, which the fresh
session adopts.

**Why this approach** — it is the only path in the approach analysis where the guarantee is real (probe PASS), the migration never goes red, and no new dependency enters the vendored harness.
**Alternatives considered** — one big lockfile (coarse, worse stale-lock recovery); pure per-lane split deleting state.json (breaks ~20 test sites at once); SQLite (native dependency, against "vừa đủ"); advisory holds (rejected outright by D3).

## 5. Technical Design

```text
finish task -> cap (green verify) -> claim next cell (O_EXCL, TTL)
  -> write planned-next handoff (carries the claim)
  -> owner types /clear
  -> SessionStart hook reads handoff.kind
       planned-next -> preamble says "start cell X now"; new session adopts the claim
       pause        -> preamble says "present and WAIT" (unchanged)
```

- **Session identity** — each session is a first-class record on disk; claims and holds name their owning session. Exact pass-through from hook payload to agent-run CLI verbs is a validating question (Open Questions).
- **Claims** — one exclusive-create file per claimed cell: owner session, TTL, heartbeat. Reclaim requires TTL expiry **and** stale heartbeat/no disk progress (critical pattern 20260710: the stall signal alone never justifies stealing).
- **Data model** — new: lane records (per-feature phase/mode/gates), session records, claim records, handoff gains `kind` + carried claim. Changed: `state.json` becomes "default lane + index" — backward compatible: absent lanes ⇒ today's exact semantics. Migration: none destructive; new files appear beside existing ones.
- **API / contract** — new CLI verbs (lane lifecycle, claim-next, handoff write/adopt, session); every new mutation gets a verb before ship (hive law 12). Hook contract: write guard gains the cross-session deny; SessionStart gains the rehydrate branch.
- **Security / Permissions** *(mandatory)* — no auth surface and no secrets touched. The permission-relevant edges: (1) the hard block must **fail closed for writes** on unreadable/corrupt coordination files — a broken claims store must never silently grant cross-session writes; (2) gate authority is preserved: claim-next only ever selects from lanes whose execution gate a human (or recorded bypass) approved — the puller never widens authority (D2); (3) auto-resume authority is bounded by handoff kind: only planned-next (capped + green verify, written by the CLI verb that enforces those preconditions) may act without confirmation (D1); pause handoffs keep the wait rule, so an interrupted session can never be silently continued.

## 6. Affected Files

Pre-prep projection from approach.md (cells become authoritative after Gate 2 prep).

| Action | File / Component | Purpose |
|--------|------------------|---------|
| Create | `skills/bee-hive/templates/lib/` claim/session module | O_EXCL claims, session records, TTL/heartbeat |
| Modify | `skills/bee-hive/templates/lib/state.mjs` | lane records, default-lane resolution, handoff schema/verbs |
| Modify | `skills/bee-hive/templates/lib/reservations.mjs` | holds carry session identity |
| Modify | `skills/bee-hive/templates/lib/command-registry.mjs` + `templates/bee.mjs` | new verbs (lane, claim-next, handoff, session) |
| Modify | `skills/bee-hive/templates/lib/guards.mjs` + `hooks/bee-write-guard.mjs` | D3 cross-session hard block |
| Modify | `skills/bee-hive/templates/lib/inject.mjs` + `hooks/bee-session-init.mjs` | rehydrate branch by handoff kind |
| Modify | `skills/bee-hive/templates/tests/test_lib.mjs`, `templates/tests/test_bee_cli.mjs`, `hooks/test_hook_contracts.mjs` | RED-first coverage + deliberate migration of pinned sites |
| Modify | `skills/bee-hive/SKILL.md`, `references/routing-and-contracts.md`, `templates/AGENTS.block.md` | two handoff kinds, claim-next flow; standing rules carry their transport (B3a) |
| Modify | `.claude-plugin/plugin.json` + vendor sync via onboarding | version bump, host rollout |

## 7. Implementation Steps

Slice queue from plan.md (cells exist only per slice, after gates):

- [x] **S1** — session identity + atomic claim primitive — SHIPPED 2026-07-13 (fsh-1, fsh-2 capped + goal-checked; win32 probe PASS; scribed into the workflow-state spec)
- [x] **S2** — lane state model — SHIPPED 2026-07-13 (fsh-3/4/5/6 capped + goal-checked; zero-lane byte-parity held: 258/0 lib, 125-row hook contracts ALL PASS, 113/0 CLI; scribed as B12/B13)
- [x] **S3** — cross-session hold enforcement — SHIPPED 2026-07-13 (fsh-7/8 capped + goal-checked; the hard block is live through the real hook: holder+expiry deny, fail-closed corrupt store, phase-independent; scribed as B14)
- [ ] **S4** — two-kind handoff, claim-next, /clear rehydrate (D1, D2) — validated READY WITH CONSTRAINTS (C10 in-pass sweep, C11 clear/startup-only auto-start, C12 pure builder): [`reports/validation-s4.md`](reports/validation-s4.md)
  - [ ] Handoff kinds + guarded writer/adopter verbs (`fsh-9`)
  - [ ] SessionStart wiring: source-gated adoption + pure preamble branch + two-session fixture (`fsh-10`, deps fsh-9)
  - [ ] claim-next with in-pass stale-claim sweep (`fsh-11`, deps fsh-9, fsh-10)
- [ ] **S3** — cross-session hold hard block in the write guard (D3)
- [ ] **S4** — planned-next handoff, claim adoption across `/clear`, cross-lane pull + honest stop (D1, D2)
- [ ] **S5** — doctrine/prose/specs, version bump, host rollout

## 8. Validation Plan

**Automated** — `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` (the recorded verify command) → expected: green at every slice boundary; S2's explicit target: green **with zero lanes created** before any consumer migrates.
**Feasibility (already run)** — `node .bee/spikes/fresh-session-handoff/probe_atomic_claim.mjs` → `PASS 20 rounds x 8 racers: exactly one O_EXCL winner every round (platform: linux)`. Windows half: Windows Node v22.14.0 verified present; the probe run itself is fsh-1's gating STEP 0 (pre-Gate-3 write guard blocks it earlier — validation report C1).
**Manual** — [ ] two real terminals on this checkout: cross-write refused with holder+expiry; [ ] real `/clear` rehydrate starts the next task unprompted (D1); [ ] pause handoff still waits.
**Evidence** — S1 validated **READY WITH CONSTRAINTS** (C1 win32-probe-first — SATISFIED at execution with a win32 runtime PASS; C2 no network-FS project dirs; C3 S1 proven only when both cells cap): [`reports/validation-s1.md`](reports/validation-s1.md). S1 shipped: fsh-1/fsh-2 capped, goal-checked (238/0 re-run by the orchestrator), judge-intact, scribed into the workflow-state spec (B11/R17/R18).
**S3 validated READY WITH CONSTRAINTS** (C7 corrupt-store deny is a returned verdict — never a throw the fail-open hook would swallow — with a mandatory corrupt-store row through the real hook; C8 hold-deny tests run in a swarming/execution-approved lane so phase-independence is proven; C9 vendored parity enforced by cmp in every verify): [`reports/validation-s3.md`](reports/validation-s3.md) — reality gate 5/5 PASS; panel 1 BLOCKER/2 WARNINGS all resolved into design pins; both cells PICK UP COLD after read_first/channel repairs.
**S2 validated READY WITH CONSTRAINTS** (C4 suite-green baseline before every cell's first edit, pinned rows extended never modified; C5 honest close — after S2 the production write guard and SessionStart preamble still resolve the default pipeline, their hook threading belongs to S3/S4 by design; C6 serialized waves fsh-3→4→5→6): [`reports/validation-s2.md`](reports/validation-s2.md) — reality gate 5/5 PASS; persona panel 1 BLOCKER/4 WARNINGS all resolved by rescoping fsh-5/fsh-6 to lib capability and serializing deps; cold-pickup CRITICALs (undefined lane attribution, stale anchors) repaired in the cells.

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Win32 exclusive-create unproven locally | Med | validating: run the probe on a Windows Git Bash host, or ship a runtime self-check with documented-upstream evidence |
| Session identity fails to reach CLI verbs | High | gating validating question — no cell writes to identity until the pass-through is proven |
| Migration of ~20 pinned test sites | High | additive default-lane design; migrate assertions in the same cell as each consumer change; suite green at every boundary |
| D3 false positives (own writes blocked) | Med | hook-contract tests: own-session allowed / cross-session denied / expired allowed |
| Claim stolen in the /clear window | Med | handoff-carried claim + adoption; fixture race test with a third session |
| Reclaim steals live work | Med | TTL expiry AND stale-heartbeat required (pattern 20260710) |

## 10. Rollback Plan

Each slice is independently revertible in git — revert the slice's commits and
re-run the recorded verify command (the suite pins pre-lane behavior, so a
revert that breaks nothing is provable, not assumed). The design makes rollback
cheap by construction: coordination lives in **new files** (lanes, sessions,
claims) beside untouched ones, and `state.json` semantics without lanes are
unchanged — so reverting code while stale lane/claim files remain on disk is
safe (they become inert data nothing reads; a cleanup note ships in the release
notes). Hosts roll back by pinning the previous plugin version and re-running
onboarding's vendor sync, the same path every prior release uses. No data
migration to reverse.

## 11. Open Questions

Carried from approach.md — all assigned to validating, none blocks Gate 2 (the shape does not change with their answers; cells do not exist until they resolve):

1. Session-identity pass-through: does the hook payload carry `session_id` everywhere needed, and what is the honest bridge to agent-run CLI verbs?
2. Windows probe: run on a real Windows Git Bash host vs accept documented-upstream + runtime self-check?
3. D2 selection ordering: confirm backlog-rank → lane-age works with what `bee_backlog.mjs rank` exposes.
4. `startFeature` preconditions: which stay global vs lane-scoped without weakening the buried-work guarantee?
