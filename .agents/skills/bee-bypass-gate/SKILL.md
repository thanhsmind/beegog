---
name: bee-bypass-gate
description: >-
  Toggle opt-in gate-bypass autopilot. When on, the agent auto-approves Gates 1-3 for tiny/small/standard work (taking the recommended choice) instead of stopping for the human; high-risk/hard-gate work, secret reads, and Gate 4 UAT always still stop. Use when the user wants to run the pipeline without approving every gate, or to check or turn off bypass. Invocable as the command bee-bypass-gate with on / off / status.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads and reports state/config via the vendored .bee/bin helpers.
---

# bee-bypass-gate (autopilot toggle)

This skill flips one persistent per-repo switch: `.bee/config.json` `gate_bypass`. It does not run any pipeline work itself. The **behavior** of bypass lives in the Gate Presentation Contract (`bee-hive/references/routing-and-contracts.md`) — this skill only turns it on/off and states exactly what that means, so the user opts in with eyes open.

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

## What bypass does (say this when turning it on)

When `gate_bypass: true`, the agent stops asking the human at **Gates 1, 2, and 3** and instead takes the RECOMMENDATION option, records the approval with `node .bee/bin/bee.mjs state gate --name context|shape|execution --approved true`, logs a one-line audit decision, and continues — posting a short `⚡ auto-approved Gate N` line, not a question.

What bypass **never** touches (the safety floor, all absolute):

- **High-risk / hard-gate work** — `high-risk` lane, or any of: auth · authorization · data loss · audit/security · external provider · validation removal · database migration/schema change. These stop for the human exactly as if bypass were off.
- **Gate 4** — UAT items always go to the human; any P1 finding always blocks. Merge auto-approves only when P1 = 0 and every UAT item passed.
- **Privacy** — reading secret-shaped files always needs explicit human approval.

Bypass is **not** headless: headless defers within-stage questions but still stops at every gate. Bypass is the one mode that self-approves gates.

## Operation

Parse the argument: `on` | `off` | `status` (no argument → `status`, then ask which the user wants).

1. Read current state: `node .bee/bin/bee.mjs status --json` (the `gate_bypass` field) and `.bee/config.json`.
2. Apply:
   - **status** — report whether bypass is on or off, in plain language, plus the safety floor. No write.
   - **on** — set `gate_bypass: true` in `.bee/config.json` (preserve every other field; create the field if absent). Then state, in the user's language, the full "what it does / what it never touches" summary above and confirm it is on. Log it: `node .bee/bin/bee.mjs decisions log --decision "gate-bypass turned ON" --rationale "<user's stated reason, or 'user request'>"`.
   - **off** — set `gate_bypass: false`. Confirm the human gates are back. Log it: `node .bee/bin/bee.mjs decisions log --decision "gate-bypass turned OFF" --rationale "..."`.
3. Config writes are `.bee/`-layer — allowed in any phase, no gate, no permission needed. Never touch `state.json` gates from this skill; it only flips the config switch.

The change takes effect immediately for the current session and persists across sessions until turned off. The session preamble and `bee_status` both print a loud `GATE BYPASS ON` line while it is active, so it is never silently in effect.

## Hard Gates

- This skill only writes `.bee/config.json` `gate_bypass`. It never approves a pipeline gate, never edits `state.json`, never runs feature work.
- Turning bypass **on** must be accompanied by stating the safety floor to the user in the same turn — never flip it silently.
- The safety floor (high-risk/hard-gate, Gate 4 UAT, privacy) is not configurable here or anywhere. Do not add options to widen bypass past it.

## Red Flags

- flipping bypass on without telling the user what stays human-gated
- treating bypass as headless, or headless as bypass
- any suggestion to bypass high-risk/hard-gate work, secret reads, or Gate 4 UAT
- approving an actual gate from this skill instead of just setting the config switch

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Bypass set to `<on|off>`. Return to whatever the user was doing (or `bee-hive` if idle).
