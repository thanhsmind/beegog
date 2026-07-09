# 0010 — Opt-in gate-bypass (autopilot within a safety floor)

- **Status:** active — owner-approved 2026-07-09 (in-session: request + scope answers)
- **Date:** 2026-07-09
- **Source:** owner request — add an option, invoked as `bee-bypass-gate`, that when on makes bee "luôn lựa chọn theo agent suggest và không cần phải human chọn". Scope confirmed via two questions: (Q1) bypass covers normal-lane work but **not** high-risk/hard-gate; (Q2) secret reads and Gate 4 UAT stay human.
- **Confidence:** 0.6 (directly reverses a v0.1 invariant; the safety floor is designed but not yet dogfooded on a real high-risk feature to confirm the floor actually catches).

## What this reverses

Every prior artifact asserted the invariant "the four human gates are never self-approved, in any mode, including headless" — `docs/00-vision.md`, `docs/02-architecture.md`, `docs/04-skills-spec.md`, `go-mode.md` ("`auto_approve_gates` does not exist in bee"), `AGENTS.block.md`, `bee-hive/SKILL.md`, and decision 0001's lineage. 0010 carves **one** deliberate, opt-in exception and leaves the invariant intact everywhere it is off (the default).

## Decision

Add a persistent per-repo switch `.bee/config.json` `gate_bypass` (default `false`), toggled by a new skill **`bee-bypass-gate`** (`on` / `off` / `status`). When `true`:

- **Gates 1-3** are auto-approved by the agent for `tiny`/`small`/`standard` work: it takes the RECOMMENDATION option, sets `approved_gates.<gate>` in `state.json` (the same write a human "yes" triggers), logs a one-line audit decision, writes the machine-layer report, and posts a short `⚡ auto-approved Gate N (bypass)` chat line (a notice, not a question).
- **Safety floor (absolute, not configurable):** `high-risk` lane or any hard-gate flag (auth · authorization · data loss · audit/security · external provider · validation removal · migration/schema) → the gate stops for the human exactly as if bypass were off.
- **Gate 4** is never fully bypassed: UAT items always go to the human and any P1 always blocks; only the merge question auto-approves, and only when P1 = 0 and every UAT item passed.
- **Privacy** is never bypassed: secret-file reads always require human approval.
- **Headless ≠ bypass:** headless still stops at every gate; bypass is the only gate-self-approving mode. They are independent switches.

The behavioral rule lives in **one** place — the Gate Presentation Contract in `bee-hive/references/routing-and-contracts.md` — which every gate point already references; the `bee-bypass-gate` skill only flips the switch and states the floor.

## Rationale

- **The mechanical guards stay honest.** `claimCell` and the write-guard hook still require `approved_gates.execution: true`; bypass changes *who records the approval* (agent vs human) for eligible work, not *whether it is required*. So there is no second enforcement path to keep in sync, and the audit trail (state gate + logged decision) still exists.
- **A floor, not a kill-switch.** The owner wanted autopilot but explicitly kept high-risk/hard-gate, UAT, and secrets human. That maps exactly to bee's existing risk vocabulary (the hard-gate flag list and the `high-risk` lane), so the floor reuses concepts the pipeline already computes — nothing new to classify.
- **Always visible.** The one real danger of a bypass is forgetting it is on. Both the session preamble (`inject.mjs`) and `bee_status` print a loud `GATE BYPASS ON` line whenever the switch is set, and every auto-approval is logged and announced in chat.
- **Opt-in, per-repo, reversible.** Off by default; a single skill call turns it on or off; it never leaks between repos.

## Alternatives considered

- **Full auto (bypass everything, all lanes).** Offered; owner rejected in favor of the safety floor. A data-loss migration or auth change auto-running unattended is the exact failure the four gates exist to prevent.
- **Bypass = headless.** Rejected: headless is "don't ask within-stage questions"; conflating it with gate self-approval would silently turn every headless/orchestrated run into autopilot. Kept strictly separate.
- **A helper CLI that flips gates.** Rejected for the approval path: the safety-floor decision needs the lane/flags the agent knows from planning, not something a helper re-derives; agent-sets-state is already the canonical gate-approval mechanism. The skill only writes the config switch.
- **Do nothing.** Rejected: the owner asked for it directly and it is a legitimate autopilot for low-risk, high-trust repos.

## Scope

- New skill: `skills/bee-bypass-gate/SKILL.md`.
- Config: `gate_bypass` in `onboard_bee.mjs` `DEFAULT_CONFIG` (fresh onboards; absent = off for existing repos, no migration needed).
- Visibility: `bee_status.mjs` (JSON `gate_bypass` + loud text line), `lib/inject.mjs` (preamble warning line).
- Central rule: Gate Presentation Contract + skill catalog + first-skill routing in `routing-and-contracts.md`.
- Invariant carves: `AGENTS.block.md`, `bee-hive/SKILL.md`, `go-mode.md`, `docs/00-vision.md`, `docs/02-architecture.md`, `docs/04-skills-spec.md`.
- Gate-point notes: `bee-validating/SKILL.md` (Gate 3), `bee-reviewing/SKILL.md` (Gate 4).
- Version 0.1.5 → 0.1.6.
- Not changed: `claimCell`/write-guard enforcement (unchanged by design); the per-skill headless sections (headless still never self-approves — correct as written).

## Consequences

- Skill count 13 → 14; the 0002 decision gate is honored (this record names the workflow gap: a trust/speed mode for low-risk repos that the four-gate invariant did not allow).
- The "never self-approve in any mode" statements are now "never — except opt-in bypass, within the floor." Anyone reading an old copy of a skill without this carve would refuse to bypass; that is a safe failure (falls back to asking the human).
- Weaker-runtime debt: the floor is prose-enforced (the agent must check lane/flags before self-approving). Pressure-testing the floor on high-risk features across tiers is recorded debt before 1.0 — a bypass that leaks past its floor on a hard-gate change is the failure mode to test for.
