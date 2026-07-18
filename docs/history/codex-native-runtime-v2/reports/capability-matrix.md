# Codex capability matrix — summary (cnr2-4 / S2 / D2)

**Probed CLI:** `codex-cli 0.144.4` · **Date:** 2026-07-18 · **Mode:** READ-ONLY spike, no repo/user
config mutated. Full evidence + verbatim envelopes: `.bee/spikes/codex-native-runtime-v2/capability-matrix.md`
(raw probe outputs under `.bee/spikes/codex-native-runtime-v2/evidence/`).

D2 rule applied: file-presence is never capability; docs-page claims cap at `unknown`; every `observed`
verdict has verbatim command/log evidence; each `unknown`/`not-observed` states its live-probe follow-up.

## Trust dimension (the one that governs everything)

Same wired `.codex/hooks.json`, same prompt, two runs:
- **normal-trust** (`codex exec --ephemeral --json`, hooks never `/hooks`-trusted) → **no hook fired** (skipped).
- **trust-bypassed** (`… --dangerously-bypass-hook-trust`) → **hooks fired**, envelopes captured.

So `hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed` is mechanical on 0.144.4.
Automation needs `--dangerously-bypass-hook-trust` for hooks to run without interactive trust.

## Rows

| Row | Capability | Verdict | Evidence / reason (0.144.4) |
|---|---|---|---|
| **A1** | `.codex/agents/*.toml` discovery (developer_instructions/model/sandbox_mode) | **not-observed** | TOMLs never surface in `debug prompt-input`; malformed agent TOML raised no parse error; only built-in agent_types spawnable. |
| **A2** | Named custom agent selectable + spawned (+ effective dev_instructions/model/sandbox, follow-up transport, start/stop identity) | **not-observed** (custom); built-ins observed | `spawn_agent agent_type="bee_worker"` → `unknown agent_type 'bee_worker'` (both config modes). Only `default`/`explorer`/`worker` accepted; they carry no bee developer_instructions. Identity: `use_agent_identity` = under-development/false. Follow-up: re-probe on a build with `multi_agent_v2`/`use_agent_identity` stable, or find the registration mechanism. |
| **B1** | Plugin manifest `hooks` key support | **not-observed** | `codex features list` → `plugin_hooks = removed/false`; no plugin bundles hooks. Follow-up: install a plugin with a `hooks` key on a capable build; confirm via a fired hook. |
| **B2** | Default `hooks/hooks.json` pickup vs explicit manifest key | **unknown** | `bee@bee` not installed as a Codex plugin + `plugin_hooks` removed → neither plugin path exercisable. Repo-source `.codex/hooks.json` pickup IS observed. Follow-up: install `bee@bee` bundling `hooks/hooks.json`, observe which path loads. |
| **B3** | Repo vs plugin precedence / duplicate-firing / XOR / per-hook source provenance | **unknown** | No plugin hooks installed → two sources not comparable. bee self-tags `--source=repo`; no Codex-native provenance field observed. Follow-up: install plugin + repo hooks together, observe duplicate firing. |
| **C1** | `update_plan` reaching PostToolUse | **observed** | `post_updateplan.jsonl`: PostToolUse envelope `tool_name:"update_plan"` matched matcher `update_plan`. Current repo matcher `TaskCreate\|TaskUpdate\|TodoWrite` would miss it → confirms D4 gap + fix. |
| **C2** | Hook ABI (envelope, tool-name matching, cwd, source, ordering, stdout/exit) | **observed** | Verbatim JSON-on-stdin envelope: `session_id/turn_id/cwd/hook_event_name/model/permission_mode/tool_name/tool_input/tool_response/tool_use_id`. Tool names normalized (`Bash`, `update_plan`, `spawn_agent`); `cwd` = session dir; emits `{}`, exit 0. Exit-1 + JSON-on-Stop semantics per 0.144.1 diagnosis. |
| **D1** | PreToolUse for agent spawns (`Agent`/`spawn_agent` matcher viability) | **observed** | Spawning built-in `worker` fired PreToolUse `tool_name:"spawn_agent"`, `tool_input.agent_type:"worker"`, matched `spawn_agent\|Agent`. Guard must match **`spawn_agent`**, not `Agent`; can gate on `agent_type`. |
| **E1** | SubagentStart-equivalent event | **unknown** | Spawn run had no SubagentStart/Stop matcher wired; parent JSONL exposed only `thread.started`/`turn.*`/`item.*`; no subagent-start flag in `features list`. Follow-up: wire SubagentStart+SubagentStop, spawn a child, observe firing + envelope. |
| **F1** | `/hooks` trust surface + machine-readable sources (present/discovered/trusted/observed/permission-mode/agent+skill discovery/duplicate sources) | **observed** (with hard limit) | Trust gate observed live; `permission_mode` in every envelope; `debug prompt-input` surfaces skills. BUT `doctor --json` (18 checks) has NO hook/trust/agent/skill rows; trust state lives only in the interactive `/hooks` TUI → not machine-readable. |

Built-in multi-agent tools observed present (`spawn_agent`, `followup_task`, `send_message`,
`wait_agent`, `interrupt_agent`, `list_agents`); `multi_agent = stable/true`, but
`multi_agent_v2`/`use_agent_identity`/`enable_fanout` are under-development/false.

## Gating consequences

### S3 — Distribution (D6 plugin hooks + XOR; D7 approval_policy)
- **D6: DEGRADE / DEFER** — B1 not-observed (`plugin_hooks` removed). Repo-local `.codex/hooks.json`
  stays authoritative; XOR rule moot; log the plugin-hooks manifest gap as an asymmetry (AO11).
- **D7: PROCEED** — capability-independent. Drop `approval_policy = "never"` from the distributed
  default; ship `bee-safe`→on-request / `bee-autopilot`→never profiles; keep Codex approval policy and
  bee `gate_bypass` documented as distinct. Local working copy may keep `never`.

### S4 — Native orchestration (D8 custom agents + developer_instructions; D10 advisor transport)
- **D8: DEGRADE / DEFER** — A1/A2 not-observed. `.codex/agents/*.toml` not discovered; only built-in
  `default`/`explorer`/`worker` spawnable, without bee developer_instructions. Worker invariants stay in
  skill prose + AGENTS.md; log the asymmetry. Use the observed PreToolUse **`spawn_agent`** guard (D1) to
  gate `agent_type` at spawn time instead of defining custom roles.
- **D10: PROCEED (adapter-level)** — native collaboration tools are present, so a Codex-native advisor/
  worker transport is feasible without a `claude -p` fallback; not gated on custom agents. This repo's
  advisor is already cli-shaped (`codex exec`).

### S6 — `bee doctor --runtime codex` (D11)
- **PROCEED, fail-closed by construction** — F1: `codex doctor --json` gives no hook/trust/agent surface,
  so bee derives its own rows: present = `.codex/hooks.json` on disk; discovered = matcher entry present;
  observed-this-session = `.bee/logs/hooks.jsonl`; **trusted = not machine-observable → report
  "unverifiable, run /hooks", never "ready"**; permission-mode = from a hook envelope; custom-agents =
  fail-closed (A1 not-observed); duplicate sources = compare repo hooks vs installed plugin hooks. The
  present/discovered/observed three-state model is fully supported; "trusted" and "custom agents" are
  structurally unknown and must fail-closed.
