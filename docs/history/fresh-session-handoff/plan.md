---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# Plan: Fresh Session Handoff

Mode: `high-risk` — 4 risk flags: data model (the coordination state model itself), public contracts (CLI verbs + hook behavior vendored into every host), cross-platform (WSL2 + Windows Git Bash), existing covered behavior (~20 pinned test sites on the single-state shape).
Why this is the least workflow that protects the work: 4 flags is the mechanical high-risk threshold; anything smaller would route a state-model rewrite consumed by every host repo through a lane with no independent feasibility check.

## Requirements (from CONTEXT.md)

- **D1** — two handoff kinds: *planned-next* (capped + green verify + next cell chosen) auto-resumes after `/clear`; *pause* keeps surface-and-wait. The record carries its `kind`.
- **D2** — lane empty → auto-claim an open cell from another **Gate-3-approved** lane (ordering: deferred question), skipping cells whose paths intersect another session's live holds; nothing approved left → report and stop; never auto-start an unapproved lane.
- **D3** — cross-session holds are **hook-enforced hard blocks**, naming holder + expiry. Advisory rejected.
- **D4** — primary topology: multiple sessions, one checkout. Worktrees = documented option only; no shared-store-across-worktrees work.

## Discovery

L1 verify, recorded here (no discovery.md): the gating claim-primitive probe ran and **passed** — `node .bee/spikes/fresh-session-handoff/probe_atomic_claim.mjs` → `PASS 20 rounds x 8 racers: exactly one O_EXCL winner every round (platform: linux)`. Win32 support of `wx`/CREATE_NEW is documented-upstream, unproven locally → validating question. Scout inventory of every state.json/HANDOFF/reservations consumer (with anchors) is in CONTEXT.md § Existing Code Context.

## Approach

See `approach.md` (high-risk fan-out): additive lane model over a default-lane `state.json`, O_EXCL claim files + session identity, hard-block extension of the existing write guard, handoff-carried claim adoption across `/clear`.

## Shape — epic map

**Feature outcome:** several same-checkout sessions coordinate purely through disk — per-feature lanes, TTL claims, hard-blocked holds — and a finished task hands the next one to a fresh session through `/clear`.

**Repo-reality basis:** scout inventory 2026-07-13 (CONTEXT § Existing Code Context); probe PASS above; guarded `startFeature` and reservations TTL helpers already exist as seams.

| Epic | Capability / Risk Area | Why It Exists | Slices | Proof Needed |
|---|---|---|---|---|
| E1 | Session identity + atomic claim primitive | everything else keys ownership off it; the current read-check-write race is the root defect | S1 | probe linux PASS; win32 probe = fsh-1 STEP 0 (gating, blocked pre-Gate-3 by the write guard — first execution act); session_id pass-through (proven: official hook docs, all events) |
| E2 | Lane state model with default-lane back-compat | D-multi-terminal needs per-feature pipelines; ~20 pinned tests need a migration that never goes red | S2 | suite green with zero lanes = byte-identical behavior |
| E3 | Cross-session hold enforcement (D3) | advisory holds are the proven failure; the write guard is the existing enforcement point | S3 | hook-contract tests: own-session allowed, cross-session denied w/ holder+expiry, expired allowed. **S3 also owns threading payload.session_id through bee-write-guard into checkWrite's optional sessionId param (S2 ships the lib capability only — validation-s2 BL-1)** |
| E4 | Planned-next handoff + claim adoption + cross-lane pull (D1, D2) | the user-visible flow; the /clear race window closes by handoff-carried claim adoption | S4 | two-session fixture over the WIRED flow: cap → handoff → adopt; "no approved work left" stop. (S1/fsh-2 proves the PRIMITIVE's steal-safety; S4 proves the wired handoff-carried flow — intentional double coverage, panel W5.) **S4 also owns threading payload.session_id through bee-session-init into buildSessionPreamble's optional sessionId param, alongside the rehydrate branch (validation-s2 W-4)** |
| E5 | Doctrine, prose, specs, host rollout | rules must ride the standing sheet with their transport (B3a); hosts consume by upgrade | S5 | census anchors; onboard --apply drift check |

**Slice queue:** S1 (feasible — probe green) → S2 (depends S1 session identity) → S3 (depends S1 identity in holds) → S4 (depends S1+S2+S3) → S5 (depends all).
**Current slice to prepare after gates:** S1 — session identity + claim primitive as a lib module with RED-first tests; no consumer migrates yet.

## Test matrix (high-risk: probes per dimension)

| Dimension | Probe |
|---|---|
| 1 User types | one session vs three concurrent sessions; agent-run CLI vs hook-run code paths |
| 2 Input extremes | lane/feature names with spaces & unicode; 0-cell lanes; 100+ open cells |
| 3 Timing | claim TTL expiry mid-work; heartbeat renewal; /clear→rehydrate gap (adoption race — S4 fixture); two claims within the same ms |
| 4 Scale | 5 lanes × 3 sessions; claims dir with hundreds of stale files (sweep cost) |
| 5 State transitions | open→claimed→capped under adoption; reclaim only when TTL expired AND heartbeat stale (critical pattern 20260710); pause-handoff never auto-resumes (D1 negative test) |
| 6 Environment | WSL2 (probe green) vs Windows Git Bash (validating answer); repo-relative paths only (no /tmp — pattern 20260708) |
| 7 Error cascades | corrupt lane file (readStateStrict precedent: refuse, never clobber); claim file exists but session record missing; guard failure fails closed for writes, open for reads |
| 8 Authorization | gates stay lane-scoped: claim requires that lane's execution gate (D2); hard block bypassed by nobody incl. the orchestrator (20260710 lesson) |
| 9 Data integrity | state.json default lane byte-survival (existing :3131 test extended); no lane data lost on concurrent lane-file writes |
| 10 Integration | preamble text contract (:746-887); bee status parity (:839-846); hook-contract whole-file hash tests (:1760-1774) migrated deliberately |
| 11 Compliance | hive law 12: every new mutation has a CLI verb before ship; write-guard DENY list extended for lanes/claims/sessions/handoff |
| 12 Business logic | D2 stop condition ("no approved work left"); planned-next requires capped+green-verify precondition enforced in the verb, not prose |

## Out of scope

- Headless outer loop (backlog P29), shared store across worktrees (D4), `merge=union` gitattributes (P30).
- Any weakening of gate semantics: bypass rules, Gate 4, and review-on-demand are untouched.

## Current slice

**S5 — doctrine, prose, and release prep** (S1-S4 shipped: fsh-1..11 capped, goal-checked, scribed; the whole flow is live at the record/hook layer).

Entry state: the runtime distinguishes handoff kinds and pulls work, but every standing instruction sheet and skill prose still states the blanket "never auto-resume" rule and knows nothing of lanes, holds, or claim-next — an agent following prose alone never uses the flow (safe, but the feature is invisible).
Exit state: the always-loaded doctrine (AGENTS.block.md template + root AGENTS.md) states the two-kind handoff rule WITH its transport (the verbs — doctrine-layer B3a / critical rule 13 precedent) and the multi-session etiquette (holds, lanes, claim-next); bee-hive SKILL/references' HANDOFF sections are kind-aware; bee-executing/bee-swarming prose describes the finish → claim-next → planned-next handoff → "type /clear" flow; census anchor rows pin the new doctrine on both surfaces (B4/R2); version bumped and beegog self-onboarded so the vendored runtime and rendered AGENTS.md match; backlog row/README refreshed. Tagging, pushing, and host onboarding stay the owner's release decision (A9: with unreviewed candidates, the release question is asked, never assumed).
Design pins: prose only restates what shipped (projection, never origination); every new standing rule carries its transport (B3a); the pause-handoff wait rule stays verbatim for its kind.
Verify: full chain (test_lib + test_bee_cli + hook contracts + onboard) green; census rows red-first for the new anchors.

## Previous slice — S4 (shipped)

**S4 — two-kind handoff, claim-next, and the /clear rehydrate (D1, D2)** (S3 shipped: fsh-7/8 capped, goal-checked, scribed — the hard block is live in production).

Entry state: handoff is an unschema'd, CLI-less, prose-guarded file; no claim-next exists; the SessionStart hook neither knows the acting session nor branches on handoff kind.
Exit state: the handoff record carries a `kind` (planned-next | pause) and is written/adopted only through CLI verbs — the planned-next writer refuses unless the previous cell is capped with green verify AND the next cell's claim is carried (D1's preconditions live in the verb, not prose); `claim-next` selects the next open cell — own lane first, then execution-approved other lanes only, skipping cells whose paths intersect another session's live holds, ordered by backlog rank then lane age, with a typed "no approved work left" stop (D2); the SessionStart hook registers/refreshes the session record, threads its identity into the preamble (the S2-deferred W-4 item), and branches on handoff kind — planned-next: adopt the carried claim under its gate and put the next task on the table; pause: surface and WAIT, byte-identical to today (D1). End-to-end two-session fixture: cap → planned-next handoff → simulated /clear → adoption wins, third-session steal loses; zero-handoff and no-session_id repos byte-identical.
Design pins: adoption uses fsh-1's gate-based adoptClaim — the claim file never vanishes across the boundary; the "never auto-resume" prose rule stays for pause handoffs and every legacy handoff without a kind (an unknown/missing kind = pause semantics, fail-safe); every new mutation ships as a CLI verb with an exercised example (hive law 12, R12/R13).
Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` + cmp parity, green at every cell boundary.

## Previous slice — S3 (shipped)

**S3 — cross-session hold enforcement (D3)** (S1 shipped: fsh-1/2; S2 shipped: fsh-3/4/5/6 — all capped, goal-checked, scribed; zero-lane byte-parity held through every wave).

Entry state: `checkWrite` accepts an acting-session identity (fsh-5) but no production caller passes it; reservations carry only worker nicknames; nothing denies a cross-session write.
Exit state: a write into a path held by another live session is **denied by the write guard in production**, with a message naming the holder and the expiry (D3); the acting session's own holds and expired holds never block; the write-guard hook threads `payload.session_id` into `checkWrite` (the S2-deferred BL-1 item); the bound-session hook-contract rows land; zero-hold and zero-lane repos stay byte-identical.
Design pins: holds ride the existing reservation store extended with an owning-session field (additive; nickname stays for intra-swarm conflicts); the deny is a typed refusal at write time reusing the TTL semantics claims proved; fail-closed for writes on an unreadable hold store (implement-plan §5 security edge), fail-open for reads.
Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` green at every cell boundary.

## Cells

- S1 (capped): `fsh-1` — session + claim lib (RED-first) · `fsh-2` — multi-process race fixtures
- S2 (capped): `fsh-3` — lane store · `fsh-4` — lane/session CLI · `fsh-5` — enforcement readers · `fsh-6` — presentation readers. (Reader migration split 2-ways at prep; scope unchanged. Commits 257d6b5, 6fa4f89, ba9b39f, 19b9891.)
- S3 (capped): `fsh-7` — session-owned holds + guard deny · `fsh-8` — write-guard hook threading + bound rows. (Commits 255757d, 4969e8c.)
- S4: `fsh-9` — handoff kinds + guarded writer/adopter verbs (lib + CLI, RED-first) · `fsh-10` — SessionStart wiring: session registration, source-gated adoption, pure-builder preamble branch, two-session fixture (deps: fsh-9) · `fsh-11` — claim-next selection with in-pass stale-claim sweep (deps: fsh-9, fsh-10). (fsh-9 split at validation; panel B1/W1-W5 pinned — validation-s4.md C10-C12.)
