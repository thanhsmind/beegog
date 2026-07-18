# gh22-completion — CONTEXT (locked decisions)

Completes the remainder of GH #22 + the user's 1.6.1-review P2 list, on top of
v1.6.2. Source directions: GH #22 items 3/6/7, the review's "Sau đó" list
(items 5-10). Gather anchors from the v1.6.2 tree are cited inline.

## In scope (6 work items)

1. **`bee dispatch prepare`** (GH #22 P0-3) — one source of truth for every
   bee-owned dispatch payload; the model stops hand-assembling spawn payloads
   from prose.
2. **Dispatch economics split** (GH #22 P1-6) — logical tier vs requested vs
   effective model, honest on codex-native transport.
3. **Doctor three-state + attestation** — ready / degraded / blocked instead
   of the current binary that can never say ready on codex.
4. **Doctor deep skill inventory** — render sidecar becomes a verifiable
   inventory; doctor audits against it.
5. **CI matrix** — GitHub Actions from zero (`.github/workflows` absent
   today): Ubuntu Node 18/20/22 full verify + Windows lane.
6. **Codex canary harness + A/B tiny protocol** (GH #22 P1-7 + review item
   10) — a real-codex smoke suite (codex-cli 0.144.4 IS on this machine) and
   the measurement protocol for inline-vs-worker tiny; live measurement data
   accrues later, the harness and protocol ship now.

## Locked decisions

- **D1 — dispatch prepare is a new registry group** (`dispatch.prepare`; no
  group exists today — greenfield surface). Kinds: `cell | gather | reviewer |
  advisor`; runtimes: `codex | claude`. Output = `{tool, payload, dispatch_id,
  economics}` — for codex: `{tool:'spawn_agent', payload:{agent_type:'worker',
  message:'[bee-tier: <t>]\n<prompt>'}}` with the marker anchored exactly
  where the guard checks (start of `message`, guard regex bee-model-guard
  :58/:116-143); for claude: Agent-tool params (subagent_type pinned per
  AO5/AO10 map, model param from resolveTier, marker-anchored prompt or
  description). Prompt body renders from the Worker Prompt Template
  (swarming-reference.md:236-269) for `cell`, and template-consistent shapes
  for gather/reviewer/advisor.
- **D2 — prepare NEVER widens tier semantics.** It calls
  `resolveTier(root, slot, runtime, purpose)` as-is: cli-shaped tiers stay
  gather-only (`{for:'gather'}`), a cell-kind against a cli tier returns the
  typed `cli_tier_gather_only` refusal verbatim — prepare surfaces
  refusals, it does not route around them (gather constraint #2).
- **D3 — economics fields ride the dispatch record, not resolveTier's return
  type** (no breaking change to claude callers). New optional fields in the
  dispatch.jsonl record and in prepare's `economics` output:
  `{logical_tier, requested_model, effective_model, effective_model_status:
  'pinned'|'inherited-or-unknown'|'unverified', transport:
  'claude-agent'|'codex-native'|'cli-exec', enforcement:
  'model-param'|'prompt-budget'|'cli-command'}`. Codex-native spawns always
  record `effective_model_status:'inherited-or-unknown'` +
  `enforcement:'prompt-budget'` until a capability probe proves per-agent
  model selection (none exists on 0.144.4).
- **D4 — doctor becomes three-state.** `blocked` = any mechanical blocking
  row not-ok (hooks file missing, baseline drift, handlers unresolvable,
  skills missing). `degraded` = mechanical rows all ok but trust rows
  structurally unknown (the current 4 unknown+blocking rows re-class as
  `degraded_reason` rows — runtime exposes no machine surface; tell the user
  to run /hooks). `ready` = mechanical green + a VALID attestation.
- **D5 — attestation verb**: `bee doctor attest --runtime codex` records
  `{hooks_file_sha256, codex_version, session_id, at, repo_identity}` into a
  runtime-tier `.bee` file (gitignored). Validity at read time: current
  `.codex/hooks.json` hash matches + current `codex --version` matches +
  at least one bee hook event observed AFTER the attestation timestamp
  (source: `.bee/logs/tools.jsonl` / hooks.jsonl entries) + repo identity
  unchanged. Any mismatch → attestation inert (stale reason named), doctor
  falls back to `degraded`.
- **D6 — version-scoped verdicts.** The hard-coded "0.144.4" reasoning
  strings become version-aware: when the live `codex --version` ≠ the probed
  version recorded in the capability matrix, unknown rows say
  `unprobed_version` (re-probe suggested), never assert `unsupported` as a
  general truth.
- **D7 — render sidecar becomes an inventory** (`bee-render/2`):
  `{schema, target_runtime, skills:[{name, sha256}]}` written by the
  renderer/onboarding sync; readers accept `bee-render/1` (legacy → shallow
  check only, warn). Doctor's deep check: every expected skill present, no
  unexpected `bee-*` strays, per-skill sha256 match; mismatch names the
  drifted skill(s).
- **D8 — CI matrix, honest about coverage.** `ci.yml`: Ubuntu, Node 18/20/22,
  full configured verify (bash installer E2E included). `windows.yml`: Node
  20/22 on windows-latest running the OS-relevant suites (portable paths,
  worktree store/cli, config validate, lib tests) + a PowerShell PARSE check
  of install.ps1 (5.1-compatible syntax via PSParser) — a real install.ps1
  E2E harness remains the named backlog item, the lane does not fake it.
  Workflows run on push/PR to main.
- **D9 — canary is a script + optional workflow, skip-guarded.**
  `scripts/canary_codex.mjs`: temp repo, repo-copy install, drive
  `codex exec --ephemeral` with `--dangerously-bypass-hook-trust` INSIDE the
  fixture only (same mechanism the capability spike used), assert:
  SessionStart fired, unmarked spawn_agent denied, marked spawn allowed,
  update_plan state-sync fired, write-guard blocks a pre-Gate-3 source write.
  Exits `skipped` cleanly when no codex binary. `canary.yml`: manual/nightly
  dispatch, never a push gate. A/B tiny protocol: a decision doc defining the
  two arms (inline vs one-worker), the metrics (wall time, time-to-first-edit,
  tool calls, tokens — from perf log + dispatch log), and the read-out rule;
  data accrues from real usage, no synthetic benchmark pretending.

## Out of scope

Windows install.ps1 E2E harness (backlog, named in D8); codex per-agent model
capability probing beyond recording status (D3 leaves the door open); any
change to gate/lane semantics; host rollouts.

## Acceptance

Each item lands with its own tests green plus the full configured verify;
dispatch-prepare payloads pass the live model-guard shapes (proven in test by
feeding prepare's output through the guard's own check functions); doctor
three-state proven on fixtures for all three states incl. attestation
staleness; sidecar v2 round-trips through renderer + doctor; workflows lint
(actionlint-equivalent or YAML parse) and the Ubuntu lane mirrors the local
verify; canary runs green on this machine (codex 0.144.4 present) or reports
skipped elsewhere.
