# CONTEXT — codex-harness-hardening Slice 1c (honest status drift)

**Boundary:** make `bee status` report the truth about the host's vendored runtime — stop reading
`drift:false` over a `.bee/bin` whose content no longer matches what onboarding recorded (E-02,
DIST-04, PROJ-08). Honest-drift ONLY. The SRC-01..06 source-tree classifier is explicitly OUT (slice
1d). No change to onboarding's mutation logic (1b closed the downgrade hole; 1c is a read-only status
change).

## Domain types
- **CALL** — the `bee status` command's `onboarding.drift` output field (a public contract).
- **ORGANIZE** — the host's `.bee/onboarding.json` managed-hash ledger as the reference of record.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Scope = honest status drift ONLY; the SRC-01..06 source-tree classifier splits to slice 1d. | User-chosen (recommended). Drift is small and well-grounded; the classifier is a bigger piece needing its own design. |
| D2 | The authoritative reference is the host's own `.bee/onboarding.json` managed-hash map (`managed.lib` + `managed.helpers`, per-file sha256), already written at onboard. No new shipped artifact; the release manifest stays repo-only. | Scout: onboarding.json already records per-file sha256 of every vendored lib module + helper; `computePlan` already builds the source's desired hashes (`buildManagedVersions`). Post-1b onboard refuses downgrades, so this ledger cannot be rewritten downward — closing the false-green loop; manual/external edits show as live≠recorded. |
| D3 | Drift = TRUE when any live managed file's actual sha256 ≠ its recorded hash, OR the live file set differs (missing/extra) from the recorded set, OR the recorded `bee_version` ≠ the running lib's version. Same-version content drift is still drift (PROJ-08). | Content-hash mismatch is the strong signal; the version and file-set checks catch the edge cases. |
| D4 | `bee status` drift is REPORT-ONLY and stays a boolean; an optional detail field names which managed files drifted. status never auto-heals (onboard's job). Absent/legacy `onboarding.managed` → degrade fail-open (status still renders), never a hard error. | `bee status` is read-only by contract; healing belongs to `onboard --apply`. A detail field shows WHAT drifted without reshaping the boolean consumers parse. |
| D5 | The managed file set to check is DERIVED from the recorded `onboarding.managed` map (and/or `readdirSync` of the runtime), never a hand-kept list. | Crit-pattern 20260714: hand-listed fixture/file sets rot silently under fail-open. |

## Pinned terms
- **managed-hash ledger** — the `managed` block in `.bee/onboarding.json`: per-file sha256 of every
  vendored helper and lib module, plus the agents/gitignore block hashes, recorded at the last onboard.
- **content drift** — the live vendored runtime differs from what the managed-hash ledger recorded,
  even when the version string is unchanged.

## Scout paths
- `.bee/onboarding.json` — records `managed.lib` / `managed.helpers` sha256 map (the reference).
- `skills/bee-hive/scripts/onboard_bee.mjs` — `buildManagedVersions` (:~1779), `computePlan` step 6
  onboarding drift compare (:1808-1816). Source of the recorded shape; NOT edited in 1c.
- `skills/bee-hive/templates/bee.mjs` (mirror `.bee/bin/bee.mjs`) `:297` — the current false-green
  `drift = ledger.bee_version !== BEE_VERSION`; the site 1c rewrites. Read-only status path.
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` — where a status-drift test would live.

## Canonical references
- SPEC §6.2 (E-02), §6.3 (DIST-04, PROJ-08); `docs/specs/onboarding.md` R15 (the 1b guard drift builds on).
- 1b learning: `docs/history/learnings/20260715-codex-harness-hardening-1b.md`.

## Open questions for planning
- Does `bee.mjs` recompute live hashes on every `status` call (cost) or only in a dedicated check? Cost
  is tiny (~16 small files) — likely inline, but planning confirms.
- The optional detail field name/shape on the status output (e.g. `drift_detail: [file, ...]`) — a
  public-contract addition; keep `drift` boolean unchanged.
- A dedicated regression test proving: content-downgraded/edited `.bee/bin/lib` reads `drift:true`;
  intact tree reads `drift:false`; absent managed ledger degrades fail-open (sentinel-deny per TEST-01).

## Deferred ideas
- **Slice 1d — SRC-01..06 source-tree classifier** (source_checkout/project_projection/plugin_package/
  legacy_global/unknown) as a shared lib module imported by onboarding + status (DIST-04 identity half).
  Stays as backlog P37's remaining half.
