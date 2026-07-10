# Approach — evolving loop (P18)

Source of truth: decision `20784de8` (2026-07-10) + the P18 backlog row. No CONTEXT.md;
hive routed via surface-scope-earlier with the locked decision as the scoping synthesis.

## Locked decisions (cited, never reinterpreted)

- **D1** — Dogfood repos stay zero-effort: the digest is a *side effect* of `bee-compounding`
  at feature close, never a chore the host project runs.
- **D2** — The digest carries **meta + short text only, never project code**.
- **D3** — `bee-evolving` runs **only in the bee repo, on demand**. Never auto, never in a host repo.
- **D4** — Every improvement goes through the `bee-writing-skills` **Iron Law**: a failing
  pressure test exists before any skill content is written or edited.
- **D5** — **Two human gates**: (a) what to fix, (b) approve the diff/push. **Push is never auto.**

## Chosen path

Three layers, each reusing an existing bee pattern rather than inventing one:

1. **`lib/feedback.mjs`** — the collector. Reads only bee-owned meta inside a repo root:
   `.bee/backlog.jsonl` (friction/finding), `.bee/decisions.jsonl` (process decisions),
   `.bee/cells/*.json` traces (`friction`, `deviations`, `blocked_reason`), and the frontmatter +
   Recommendation lines of `docs/history/learnings/*.md`. Residual findings are recorded as a
   *path reference*, not inlined. Emits `feedback-digest.json` (schema v1) at the repo's
   `.bee/feedback-digest.json`.

   Safety (D2) is enforced in code, not prose: every text field passes
   `SECRET_CONTENT_PATTERNS` + `INJECTION_PATTERNS` (already exported by `lib/decisions.mjs`,
   already used by `lib/capture.mjs`), is truncated to a hard character cap, and the collector
   **never opens a path outside `.bee/` and `docs/history/`**. An entry that cannot be made safe
   is dropped and counted in `digest.dropped`, never silently swallowed.

2. **`bee_feedback.mjs`** — the CLI, a thin wrapper in the exact shape of `bee_capture.mjs`:
   `digest [--out <path>] [--json]` writes the local digest; `collect [--json]` reads
   `dogfood_repos` from `.bee/config.json` and merges each repo's digest (label + counts +
   entries) into one in-memory view for `bee-evolving`. Landing it in
   `skills/bee-hive/templates/` is enough — `onboard_bee.mjs` copies helpers by directory scan.

3. **`bee-evolving`** — a bee-repo-only skill (D3). Reads the merged digests → clusters friction →
   ranks by `frequency × pain × corroborating-learning` → **HUMAN GATE 1: what to fix** → each
   approved item is handed to `bee-writing-skills` (Iron Law, RED first — D4) → version bump +
   both suites green → **HUMAN GATE 2: approve the diff** → push + WSL deploy. The skill refuses
   to run when the repo root is not the bee repo.

`bee-compounding` gains one step (D1): after the learnings file is written, refresh
`.bee/feedback-digest.json`. Failure to refresh is a warning, never a blocker — a host project's
close must not fail because bee wanted telemetry.

## Rejected alternatives

- **Push digests to a central service / GitHub issues.** Rejected: leaves the machine, turns D2
  from a code invariant into a trust exercise, and needs credentials bee does not want.
- **`bee-evolving` reads host repos' raw `.bee/` directly at run time.** Rejected: the digest is
  the redaction boundary. If evolving can read raw traces, D2 is enforced nowhere.
- **Auto-apply the top-ranked fix.** Rejected outright by D5. A system that edits and pushes
  itself without a human at both ends is exactly what bee's gates exist to prevent.
- **Digest as JSONL append log.** Rejected: the digest is a *snapshot* of current standing
  friction, regenerated each close. An append log would double-count every re-observed friction
  and corrupt the frequency term of the ranking.

## Risk map

| Component | Risk | Proof needed at validating |
|---|---|---|
| `lib/feedback.mjs` read scope (D2) | **HIGH** | A test that points the collector at a repo containing project source + a fake secret in a friction field, and asserts: no source path opened, secret-bearing entry dropped, `dropped` count = 1 |
| Cross-repo paths (WSL/Git Bash) | **MEDIUM** | Critical pattern `[20260708]`: node cannot resolve MSYS `/tmp`. `dogfood_repos` entries must be resolved with `path.resolve` and existence-checked; a missing repo warns and is skipped, never throws |
| `bee-evolving` self-modification | **HIGH** | Pressure test (RED) proving an agent without the skill pushes without the second gate; GREEN proving it stops |
| Digest schema as public contract | **MEDIUM** | `docs/07-contracts.md` + `config-reference.md` updated in the same slice; a drift test pins the schema version literal |
| `bee-compounding` chain change | **LOW** | Existing suite + one assertion that a digest-refresh failure does not fail the close |

## Open questions for validating

1. Does `readConfig` normalization of `dogfood_repos` need to accept `{path,label}` objects, or is a
   bare string array enough for the first cut? (Plan assumes: accept both, normalize to objects.)
2. Is `.bee/feedback-digest.json` gitignored in host repos, or committed as a visible artifact?
   (Plan assumes: written, and the host repo's own gitignore decides — bee does not touch it.)
3. Does `bee-evolving`'s "WSL deploy" step have a concrete command in this environment, or is it
   the existing manual copy into `~/.claude/skills/`? (Plan assumes: the latter, named not scripted.)
