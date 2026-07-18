# Learnings — codex-native-runtime-v2 (2026-07-18)

## [20260718] Capability-gate everything: observe on the installed runtime before building on a claimed capability

**Category:** process · **Tags:** [capability-gating, spike-first, external-docs, codex]

The external review (docs/REFs/be-codex.md) was verified claim-by-claim before any work: 7/8 structural claims held, but its single most important RECOMMENDATION — build on Codex custom agents (.codex/agents/*.toml) — turned out to be **not real on the installed CLI** (codex-cli 0.144.4: not discovered, spawn_agent accepts built-in roles only), and "plugin hooks" was removed/false. A read-only spike (cnr2-4) with a verbatim-evidence rule and "unknown is a valid verdict" saved two full slices from being built on documentation fiction, while its bonus observations (update_plan reaches PostToolUse; spawn_agent fires PreToolUse with tool_input.agent_type) unlocked two wins nobody had planned: the matcher superset was confirmed necessary and a Codex-side dispatch guard became buildable. Every capability verdict is version-scoped (unsupported_on_0.144.4), never absolute.

## [20260718] The advisor consult iterated to PROCEED catches real architecture blockers pre-dispatch

**Category:** process · **Tags:** [advisor, validation, return-to-planning]

Slice 3 (adapter split) took THREE advisor rounds (RETURN-TO-PLANNING ×2 → PROCEED) plus a panel ITERATE. The blockers were real, not ceremony: rendered projections would have become lossy onboarding sources accepted by source-identity; deferring plugin pre-render would have shipped the exact cross-runtime bleed the slice existed to remove; the "split-brain" premise of an entire cell was disproved by reading the catalog header (intentional per-runtime projections, drift-pinned). Iterating cell text until the advisor finds "residuals: none" is cheap compared to re-doing a distribution-machinery slice.

## [20260718] A dead worker's cap is not evidence — reopen, re-verify, re-cap

**Category:** process · **Tags:** [verification, worker-death, honest-evidence]

A worker hit its session limit after capping cnr2-15 with placeholder evidence ("test outcome", junk JSON). The work itself was green — proven by the orchestrator's independent re-run — but the record was not honest. The fix is mechanical: `cells reopen` → run the real verify → `cells verify --output` with the real tail → `cells cap` with real evidence + outcome. Never let a placeholder cap stand just because the underlying work happens to be good; the record is the product.

## [20260718] Multi-session interleaving is survivable with surgical commits

**Category:** process · **Tags:** [multi-session, git, isolation]

Three foreign events interleaved this feature: an external release bump (1.5.1) mid-slice, silent edit reverts from a concurrent sync, and uncommitted foreign config edits (advisor swap, hook toggle). None corrupted the feature because: (a) the transient full-chain red was traced to the bump's stale provenance sidecar before anyone "fixed" a non-bug; (b) workers verified their edits persisted before final verify; (c) commits isolated exactly the cell's delta — including a `git hash-object + update-index` surgical blob for a shared config file carrying foreign edits. Never bundle another session's uncommitted work into a cell commit.
