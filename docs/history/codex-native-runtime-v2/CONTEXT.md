# CONTEXT — codex-native-runtime-v2

**Goal:** bee on Codex delivers the same operating experience as on Claude Code — same invariants, runtime-native orchestration — per the external review `docs/REFs/be-codex.md`, verified against repo reality on 2026-07-18 (all 8 of its structural claims confirmed; see conversation review + gather digests).

**Mode:** high-risk (5 flags: external systems, public contracts, cross-platform, existing covered behavior, multi-domain). No hard-gate flag; gate_bypass=total is active.

## Verified problem statement

1. Three active docs still claim "Codex has no lifecycle hooks" (`INSTALL.md:120`, `docs/06-runtime-integration.md:52`, `README.md:434`) while `.codex/hooks.json` ships 7 events — bee's own P24 feature (`docs/history/codex-runtime-parity/CONTEXT.md:88-90`) already flagged this drift; the fix never landed.
2. No hook-trust verification exists for Codex (no `/hooks` step; file presence is treated as capability).
3. `.codex/hooks.json` state-sync matcher is Claude-named (`TaskCreate|TaskUpdate|TodoWrite`); no `update_plan`; no PreToolUse guard for `Agent` (no model-guard equivalent on Codex).
4. `.codex-plugin/plugin.json` bundles skills only — no `hooks` key.
5. `.codex/config.toml` ships `approval_policy = "never"` as the only content; no `[agents]`, no `.codex/agents/` roles (P25 deferred pending "reliable role selection").
6. Worker invariants live only in `bee-executing/SKILL.md` prose (user-tier on Codex); nothing at developer priority.
7. The 5 runtime-sensitive skills ship byte-identical to both runtimes (verified same SHA) with interleaved Claude/Codex branches; advisor transport for model-shaped advisors falls back to `claude -p` (`bee-executing/SKILL.md:90-93`) even on Codex.
8. ~~NEW: Claude-side split-brain~~ — DISPROVED at validation: the two manifests are intentional per-runtime catalog projections (see D5 correction below).

## Locked decisions

- **D1 — One Bee Core, no skill fork.** Shared workflow semantics stay single-source; only runtime-sensitive surfaces get adapters. (Review doc final table; aligns decision 565e68d0 lineage.)
- **D2 — Capability-gated build.** Every claimed new Codex capability (`.codex/agents/*.toml` discovery, `developer_instructions`, plugin `hooks` key, PreToolUse `Agent`-shaped matcher, `update_plan` tool name, SubagentStart-equivalent) must be **observed on the installed Codex CLI** by a read-only spike before any slice builds on it. A capability not observed ⇒ that slice degrades to the current mechanism and logs an explicit asymmetry decision (AO11 pattern). File-presence is never capability (`hooks_file_present ≠ hooks_discovered ≠ hooks_trusted_and_observed`).
- **D3 — Truth cleanup lands first.** Remove/replace every active-doc "Codex has no (lifecycle) hooks" claim (INSTALL.md, README.md, docs/06-runtime-integration.md; config-reference/decision docs keep historical wording with a dated correction note only where they are active guidance). INSTALL.md gains a Codex verify procedure: project trust, `/hooks` review state, three-state model, observed-hook check via `.bee/logs/hooks.jsonl`.
- **D4 — Matcher supersets, never swaps.** `.codex/hooks.json` state-sync matcher becomes `update_plan|TaskCreate|TaskUpdate|TodoWrite` (superset — safe on every Codex version). An `Agent`-guard entry for Codex is added only if D2 observes PreToolUse firing for agent spawns.
- **D5 — CORRECTED at validation (no action).** The "split-brain" premise was a misread: `hooks/hooks.json` is the **Codex plugin projection** and `hooks/claude-hooks.json` the **Claude projection**, both rendered from `hooks/catalog.mjs` (single source of truth) with every intentional difference pinned by the catalog drift-check + ALLOWED_DIFFERENCES (`hooks/test_hook_contracts.mjs:751+`, cell codex-parity-2). Audit is codex-only, model guard claude-only, by design. Likewise the review doc's "plugin doesn't bundle hooks" claim is moot: `.codex-plugin/plugin.json` omits the `hooks` key deliberately — Codex loads `hooks/hooks.json` from the default plugin-root location. Cell cnr2-3 dropped; decision logged.
- **D6 — Plugin bundles hooks (capability-gated).** If D2 confirms the plugin `hooks` key works, `.codex-plugin/plugin.json` declares it and onboarding/doctor enforce plugin-hooks XOR repo-hooks (never both silently). Otherwise repo-local `.codex/hooks.json` stays authoritative and the manifest gap is logged as asymmetry.
- **D7 — `approval_policy = "never"` leaves the distributed default.** The shipped/template `.codex/config.toml` carries no approval_policy; documented profiles (`bee-safe` → on-request, `bee-autopilot` → never) replace it. Codex permission policy and bee gate_bypass are documented as distinct concepts. This repo's own working copy may keep `never` (user runs total autopilot) — distribution ≠ local choice.
- **D8 — Codex custom agents unlock P25 (capability-gated).** Four roles rendered from `.bee/config.json` models at onboarding (config-rendered, same pattern as `.claude/agents/bee-*.md`): `bee-gather`/`bee-extract`-equivalent explorer (read-only), validator (read-only), worker (workspace-write), reviewer (read-only). Worker invariants (one assigned cell, reserve-before-write, no package installs, exact verify + real output, cap only on green, release reservations, single status token) go in `developer_instructions` — developer priority, not skill prose. Skills keep the detailed procedure.
- **D9 — Adapter split for the 5 runtime-sensitive skills** (`bee-hive`, `bee-swarming`, `bee-executing`, `bee-validating`, `bee-reviewing`): shared core + per-runtime adapter fragments, rendered at onboarding sync into runtime-specific SKILL.md per managed root (`.claude/skills/` gets core+claude, `.agents/skills/` gets core+codex). Root `skills/` remains the single human-edited source (core + `adapters/` subdirs); no parallel `dist/` tree. Sync/mirror/release tests learn the rendering; a semantic-hash check keeps shared cores identical across runtimes. The 10 workflow-semantic skills stay unsplit.
- **D10 — Advisor transport is runtime-native.** The Codex adapter of bee-executing consults model-shaped advisors via Codex-native dispatch; the `claude -p` fallback exists only in the Claude adapter or when the user explicitly configures an external Claude advisor. (This repo's own advisor is already cli-shaped `codex exec` — unaffected.)
- **D11 — `bee doctor --runtime codex`.** New bee.mjs command group reporting: Codex version, project trust, hooks file present / discovered / observed-this-session (from `.bee/logs/hooks.jsonl`), pending hook review, skills discovered, custom agents discovered, active permission mode, duplicate plugin+repo hooks. Fail-closed: never "ready" from file presence alone. A `--runtime claude` counterpart reports the Claude-side equivalents (cheap once the frame exists).
- **D12 — Conformance suite, automatable subset first.** Scenario harness for the review doc's 12 black-box scenarios; land the mechanically-checkable subset (write-before-Gate-3 blocked, verify-red never caps, reservation conflict blocks, doctor fail-closed, matcher coverage) as scripted tests; the interactive-judgment scenarios are documented as a manual checklist with measured metrics named, not faked.
- **D13 — AGENTS.md stays under a hard 20 KiB budget, kernel-first.** Trim toward kernel + pointers where content is duplicated in skills (current 17.9 KiB, Codex cap 32 KiB shared with host-repo AGENTS.md files). Conservative: no rule is deleted, only deduplicated; every removed sentence must exist verbatim-or-stronger in a skill or runtime contract. Full 60-line kernel rewrite is OUT of scope (own future feature).

## Slices (dependency order)

- **S1 — Truth + guards (no new capability needed):** D3 docs cleanup, D4 matcher superset, D5 split-brain fix + parity test.
- **S2 — Capability spike (read-only, disposable under `.bee/spikes/`):** observe each D2 capability on installed Codex; output: capability matrix report + gating decisions logged.
- **S3 — Distribution (gated on S2):** D6 plugin hooks + XOR rule, D7 approval_policy removal + profiles.
- **S4 — Native orchestration (gated on S2):** D8 custom agents + developer_instructions, D10 advisor transport.
- **S5 — Adapter split:** D9 (biggest slice; regression-net-first per critical-patterns 20260716).
- **S6 — Doctor:** D11.
- **S7 — Conformance + docs budget:** D12, D13.

## Out of scope

- Full AGENTS.md 60-line kernel rewrite (D13 is dedupe-only).
- Any change to gates/lanes/review doctrine semantics.
- MCP server wrapper (previously deferred, stays deferred).
- Claude-runtime behavior changes beyond D5 parity fix.

## Acceptance criterion (feature level)

A Codex session in a bee host repo gets: truthful docs, observed-or-declared-asymmetric hooks, native agent roles (if capability confirmed) with developer-priority worker invariants, runtime-clean skill prose with zero cross-runtime instruction bleed on the loaded path, a doctor that fail-closes, and scripted conformance checks green on both runtimes.
