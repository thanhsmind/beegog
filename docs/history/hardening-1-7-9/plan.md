# hardening-1-7-9 — plan for remaining slices 4-8 (frozen at Gate 2)

Slices 1-3 done (archive-safety, windows-lock-filename, judge-lifecycle).
Audit 2026-07-21 (session digest, anchors in cell actions) rescoped 4-8
against msh-1..8 and the 2026-07-20 work. Cells:

Wave 1 — five workers in parallel (disjoint files):
- **hardening-4a** — runtime-neutral session id: `BEE_SESSION_ID` in the
  resolveSessionId chain (flag > BEE_SESSION_ID > CLAUDE_CODE_SESSION_ID)
  + lock.mjs's direct env read unified; sessionless-mutation refusal when
  other live sessions exist (concurrent mode = live foreign heartbeat).
- **hardening-5** — recovery transcript-root becomes runtime-aware
  (configurable second-runtime root; graceful empty stays).
- **hardening-6** — install.ps1: read-only probe → confirm → mutate →
  rollback on failure (mirror install.sh D8 staging); conformance test
  asserts the ordering statically (no Windows runner available).
- **hardening-7** — dispatch-prepare refuses a cell that is unclaimed or
  claimed by another worker (audited override); small-lane doctrine text:
  one live worker processes its 1-3 cells serially; tiny-direct recorded
  as subsumed by the ab-tiny-protocol A/B (decision, no new mode).
- **hardening-8** — hermetic/hygiene: machine-local `dogfood_repos` moves
  to gitignored `.bee/config.local.json` overlay merged at readConfig;
  installers-E2E post-install checks get the same env sandbox as the rest;
  codex canary skip becomes loud (visible SKIP marker in output); Node-24
  timeout-worker claim closed as no-repro with evidence; Windows installer
  E2E recorded deferred (needs a Windows runner).

Wave 2 (after 4a; overlaps claims.mjs/cells.mjs):
- **hardening-4b** — lock the six unlocked cell mutators
  (claimCell/dropCell/unclaimCell/reopenCell/setTier/updateCell) under
  `cells:<id>`; sweepExpiredClaims also resets the cell record
  claimed→open under the same lock; worktree admin mutex: writeGrant/
  removeGrant/createFeatureWorktree/mergeFeatureWorktree serialized under
  a main-store `worktree-admin` lock.

Close: full verify green on THIS checkout, then the RC gate: clean-clone
verify reproduction before any tag (original decision 8650ff81).
