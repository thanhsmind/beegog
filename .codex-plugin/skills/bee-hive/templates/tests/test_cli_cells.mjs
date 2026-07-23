#!/usr/bin/env node
// test_cli_cells.mjs — claim-next selection + bee.mjs `backlog add` CLI verb
// contract tests, split out of test_lib.mjs (cs-2b) to shrink the monolith.
// Same PASS/FAIL/exit-1 contract as every other suite here — see
// scripts/lib/test-fixture.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';
import {
  makeTempRepo,
  makeCell,
  check,
  assert,
  assertThrows,
  assertRejects,
  printSummaryAndExit,
} from '../../../../scripts/lib/test-fixture.mjs';
import { readCell, claimCell, claimNextCell, claimCellCrossSession } from '../lib/cells.mjs';
import { reserve } from '../lib/reservations.mjs';
import { mirrorHold } from '../lib/worktree-holds.mjs';
import {
  createSession,
  heartbeatSession,
  claimCellFile,
  readClaim,
  sweepExpiredClaims,
  claimPath,
  DEFAULT_HEARTBEAT_STALE_SECONDS,
} from '../lib/claims.mjs';
// fsh-3 (lane store): namespace import so a not-yet-implemented export fails
// its own row ("… is not a function") instead of crashing the whole module
// graph at import time — the RED-first evidence stays per-row.
import * as laneStore from '../lib/state.mjs';
import * as laneBinding from '../lib/claims.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';
import { KIND_ALIASES, NORMALIZED_KINDS, buildDigest } from '../lib/feedback.mjs';
import { readBacklogCounts } from '../lib/backlog.mjs';

const root = makeTempRepo();

// Self-containment fix (cs-2b split): makeStateRepo/makeCellFile are defined
// in test_lib.mjs's "bee.mjs state CLI"/"bee.mjs state start-feature" sections
// (now test_cli_state.mjs, a different file); writeLaneFixture is defined in
// the "lanes" section (now test_state.mjs, also a different file). All three
// were only reachable here via function-declaration hoisting across the whole
// monolith. The claim-next selection rows below need them. Verbatim copies,
// same shape, same behavior, zero check weakened.
function makeStateRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  return dir;
}

function makeCellFile(dir, id, extra = {}) {
  fs.mkdirSync(path.join(dir, '.bee', 'cells'), { recursive: true });
  const cell = {
    id,
    feature: 'old-feature',
    title: `Cell ${id}`,
    lane: 'tiny',
    status: 'open',
    deps: [],
    action: 'do it',
    verify: 'node -e "process.exit(0)"',
    trace: {},
    ...extra,
  };
  writeJsonAtomic(path.join(dir, '.bee', 'cells', `${id}.json`), cell);
  return cell;
}

function writeLaneFixture(dir, feature, extra = {}) {
  laneStore.writeLane(dir, {
    schema_version: '1.0',
    feature,
    mode: null,
    phase: 'idle',
    approved_gates: { context: false, shape: false, execution: false, review: false },
    summary: '',
    next_action: '',
    created_at: new Date().toISOString(),
    ...extra,
  });
}

// ─── fsh-11: claim-next selection + throw-safe two-store claim (D2/D4) ──────
// Own bound lane (or the default pipeline when unbound) first, only when its
// OWN execution gate is approved; falls through to every OTHER pipeline whose
// gate is approved (never an unapproved one, even as the only ready cell);
// cells held by another session's active reservation are skipped (own holds
// never exclude); a dead session's stale claim is swept in the SAME pass
// (sweepExpiredClaims's production trigger, panel B1); the two-store claim
// releases its claims-store file on any claimCell throw (panel W4).

await check(
  "claimNextCell: a dead session's stale claim (TTL expired + heartbeat stale) is swept in-pass and the cell is selected in the SAME call — NO_APPROVED_WORK is never returned while it exists (C10, sweepExpiredClaims's production trigger)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-sweep-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        mode: 'standard',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      makeCellFile(dir, 'stale-1', { feature: 'demo-feat', status: 'open', deps: [] });

      // Simulate the two-store crash window: claims.mjs's claim file exists
      // (a dead session claimed it) but cells.mjs's OWN status is still
      // 'open' — exactly the gap a crash between claimCellFile and cells.mjs
      // claimCell leaves behind. No session record for 'sess-dead' at all:
      // heartbeatStale treats a missing session as stale (claims.mjs's own
      // documented rule), so TTL-expired + no-session together qualify.
      const dead = claimCellFile(dir, 'sess-dead', 'stale-1', 60);
      assert(dead.ok === true, 'precondition: the dead session claimed the file first');
      const stale = readClaim(dir, 'stale-1');
      writeJsonAtomic(claimPath(dir, 'stale-1'), {
        ...stale,
        claimed_at: new Date(Date.now() - 7200 * 1000).toISOString(),
      });
      assert(readCell(dir, 'stale-1').status === 'open', 'precondition: cells.mjs status was never flipped (the crash-window gap)');

      const result = await claimNextCell(dir, { sessionId: 'sess-fresh', worker: 'worker-fresh' });
      assert(result.ok === true, `expected the swept cell to be reclaimed and selected, got ${JSON.stringify(result)}`);
      assert(result.cell.id === 'stale-1' && result.cell.status === 'claimed', 'the previously-stale cell is now claimed');
      assert(readClaim(dir, 'stale-1').session === 'sess-fresh', 'the claims-store claim now belongs to the fresh session');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: the acting session's own bound lane's ready cell wins even when a backlog-favored OTHER approved lane also has one ready (own lane first, D2)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-own-first-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-own', { approved_gates: approved });
      writeLaneFixture(dir, 'lane-other', { approved_gates: approved });
      makeCellFile(dir, 'own-1', { feature: 'lane-own', status: 'open', deps: [] });
      makeCellFile(dir, 'other-1', { feature: 'lane-other', status: 'open', deps: [] });
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'docs', 'backlog.md'),
        [
          '| ID | Story | CoS | Status | Feature |',
          '|----|-------|-----|--------|---------|',
          '| B1 | other ranks first | x | in-flight | lane-other |',
          '| B2 | own ranks last | x | done | lane-own |',
        ].join('\n'),
        'utf8',
      );
      laneBinding.createSession(dir, { id: 'sess-own' });
      laneBinding.bindSessionLane(dir, 'sess-own', 'lane-own');

      const result = await claimNextCell(dir, { sessionId: 'sess-own', worker: 'w' });
      assert(result.ok === true && result.cell.id === 'own-1', `own lane must win regardless of backlog rank, got ${JSON.stringify(result)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: an unapproved own lane is NEVER selected, even when its cell is the only ready one anywhere — typed NO_APPROVED_WORK (D2 authority boundary)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-unapproved-own-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      writeLaneFixture(dir, 'lane-locked'); // default fixture gates: every gate false
      makeCellFile(dir, 'locked-1', { feature: 'lane-locked', status: 'open', deps: [] });
      laneBinding.createSession(dir, { id: 'sess-locked' });
      laneBinding.bindSessionLane(dir, 'sess-locked', 'lane-locked');

      const result = await claimNextCell(dir, { sessionId: 'sess-locked', worker: 'w' });
      assert(result.ok === false && result.code === 'NO_APPROVED_WORK', `an unapproved lane must never be auto-selected, got ${JSON.stringify(result)}`);
      assert(readCell(dir, 'locked-1').status === 'open', 'the locked cell is untouched');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check("claimNextCell: own lane with no ready cells falls through to another execution-approved lane", async () => {
  const dir = makeStateRepo('bee-claimnext-fallthrough-');
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
    const approved = { context: true, shape: true, execution: true, review: false };
    writeLaneFixture(dir, 'lane-empty', { approved_gates: approved });
    writeLaneFixture(dir, 'lane-full', { approved_gates: approved });
    makeCellFile(dir, 'full-1', { feature: 'lane-full', status: 'open', deps: [] });
    laneBinding.createSession(dir, { id: 'sess-empty' });
    laneBinding.bindSessionLane(dir, 'sess-empty', 'lane-empty');

    const result = await claimNextCell(dir, { sessionId: 'sess-empty', worker: 'w' });
    assert(result.ok === true && result.cell.id === 'full-1', `own lane empty must fall through to the other approved lane, got ${JSON.stringify(result)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check(
  "claimNextCell: cross-lane ordering — when own pipeline is empty/unbound, the pool of other approved lanes is ordered by backlog rank first, then lane created_at (D2)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-crosslane-order-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-old', { approved_gates: approved, created_at: '2020-01-01T00:00:00.000Z' });
      writeLaneFixture(dir, 'lane-new', { approved_gates: approved, created_at: '2024-01-01T00:00:00.000Z' });
      writeLaneFixture(dir, 'lane-ranked', { approved_gates: approved, created_at: '2026-01-01T00:00:00.000Z' });
      makeCellFile(dir, 'old-1', { feature: 'lane-old', status: 'open', deps: [] });
      makeCellFile(dir, 'new-1', { feature: 'lane-new', status: 'open', deps: [] });
      makeCellFile(dir, 'ranked-1', { feature: 'lane-ranked', status: 'open', deps: [] });
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'docs', 'backlog.md'),
        [
          '| ID | Story | CoS | Status | Feature |',
          '|----|-------|-----|--------|---------|',
          '| C1 | ranked lane wins by rank | x | in-flight | lane-ranked |',
        ].join('\n'),
        'utf8',
      );

      // lane-ranked has an explicit (best) backlog rank, so it wins even
      // though it is the YOUNGEST lane by created_at.
      const first = await claimNextCell(dir, { sessionId: 'sess-unbound-1', worker: 'w' });
      assert(first.ok === true && first.cell.id === 'ranked-1', `backlog rank must win the tie-break first, got ${JSON.stringify(first)}`);

      // With lane-ranked's cell now claimed (no longer ready), the two
      // remaining UNRANKED lanes tie-break by created_at, oldest first.
      const second = await claimNextCell(dir, { sessionId: 'sess-unbound-2', worker: 'w' });
      assert(second.ok === true && second.cell.id === 'old-1', `unranked lanes must tie-break by created_at, oldest first, got ${JSON.stringify(second)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

// GH#20: a lane actively owned by another live session (some OTHER session
// record is bound to it with a fresh heartbeat) must never be pooled by the
// cross-lane fallback — otherwise claim-next steals a cell out from under a
// session that just had its lane planned/claimed on it. bindLiveSession /
// bindStaleSessionOnLane reuse claims.mjs's own createSession/bindSessionLane/
// heartbeatSession primitives (already imported above) rather than hand-
// writing session JSON, so the fixtures stay honest about the real shape.

function bindLiveSession(dir, sessionId, feature) {
  laneBinding.createSession(dir, { id: sessionId });
  laneBinding.bindSessionLane(dir, sessionId, feature); // last_heartbeat is "now" — fresh
}

function bindStaleSessionOnLane(dir, sessionId, feature) {
  laneBinding.createSession(dir, { id: sessionId });
  laneBinding.bindSessionLane(dir, sessionId, feature);
  heartbeatSession(dir, sessionId, { now: Date.now() - (DEFAULT_HEARTBEAT_STALE_SECONDS + 60) * 1000 });
}

await check(
  "claimNextCell: a lane owned by another LIVE session (fresh heartbeat) is excluded from the fallback pool even when it is backlog-ranked first — the unowned approved lane is picked instead (GH#20)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-live-owner-excluded-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-owned', { approved_gates: approved });
      writeLaneFixture(dir, 'lane-free', { approved_gates: approved });
      makeCellFile(dir, 'owned-1', { feature: 'lane-owned', status: 'open', deps: [] });
      makeCellFile(dir, 'free-1', { feature: 'lane-free', status: 'open', deps: [] });
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'docs', 'backlog.md'),
        [
          '| ID | Story | CoS | Status | Feature |',
          '|----|-------|-----|--------|---------|',
          '| B1 | owned lane ranks first | x | in-flight | lane-owned |',
          '| B2 | free lane ranks last | x | in-flight | lane-free |',
        ].join('\n'),
        'utf8',
      );
      bindLiveSession(dir, 'sess-other-live', 'lane-owned');

      const result = await claimNextCell(dir, { sessionId: 'sess-acting', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'free-1',
        `the live-owned lane must be skipped despite its better backlog rank, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: a lane whose only binder's heartbeat has gone STALE is poolable again — steal-after-death is preserved (GH#20)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-stale-owner-poolable-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-owned', { approved_gates: approved });
      writeLaneFixture(dir, 'lane-free', { approved_gates: approved });
      makeCellFile(dir, 'owned-1', { feature: 'lane-owned', status: 'open', deps: [] });
      makeCellFile(dir, 'free-1', { feature: 'lane-free', status: 'open', deps: [] });
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'docs', 'backlog.md'),
        [
          '| ID | Story | CoS | Status | Feature |',
          '|----|-------|-----|--------|---------|',
          '| B1 | owned lane ranks first | x | in-flight | lane-owned |',
          '| B2 | free lane ranks last | x | in-flight | lane-free |',
        ].join('\n'),
        'utf8',
      );
      bindStaleSessionOnLane(dir, 'sess-other-dead', 'lane-owned');

      const result = await claimNextCell(dir, { sessionId: 'sess-acting', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'owned-1',
        `a stale-heartbeat binder must not protect the lane — it is poolable and wins its backlog rank, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: the acting session's OWN binding never blocks anything — bound to lane X (empty), lane Y owned by a live OTHER session, lane Z unowned -> picks Z, never Y (GH#20)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-own-binding-never-blocks-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-x', { approved_gates: approved }); // acting session's own lane, no ready cells
      writeLaneFixture(dir, 'lane-y', { approved_gates: approved }); // owned by a live OTHER session
      writeLaneFixture(dir, 'lane-z', { approved_gates: approved }); // unowned
      makeCellFile(dir, 'y-1', { feature: 'lane-y', status: 'open', deps: [] });
      makeCellFile(dir, 'z-1', { feature: 'lane-z', status: 'open', deps: [] });
      laneBinding.createSession(dir, { id: 'sess-acting-x' });
      laneBinding.bindSessionLane(dir, 'sess-acting-x', 'lane-x'); // acting session bound to its OWN lane
      bindLiveSession(dir, 'sess-other-y', 'lane-y');

      const result = await claimNextCell(dir, { sessionId: 'sess-acting-x', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'z-1',
        `own binding to lane-x must not block anything and lane-y must stay excluded, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  'claimNextCell: when the ONLY candidate anywhere lives in a live-owned lane, protection beats starvation — typed NO_APPROVED_WORK, not a steal (GH#20)',
  async () => {
    const dir = makeStateRepo('bee-claimnext-live-owner-only-candidate-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
      const approved = { context: true, shape: true, execution: true, review: false };
      writeLaneFixture(dir, 'lane-owned', { approved_gates: approved });
      makeCellFile(dir, 'owned-only-1', { feature: 'lane-owned', status: 'open', deps: [] });
      bindLiveSession(dir, 'sess-other-live', 'lane-owned');

      const result = await claimNextCell(dir, { sessionId: 'sess-acting-lonely', worker: 'w' });
      assert(
        result.ok === false && result.code === 'NO_APPROVED_WORK',
        `a live-owned lane must never be raided even as the only candidate anywhere, got ${JSON.stringify(result)}`,
      );
      assert(readCell(dir, 'owned-only-1').status === 'open', 'the live-owned cell is untouched');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: a cell whose files intersect ANOTHER session's active hold is skipped; the acting session's own hold on the same files never excludes it (D3)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-holds-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      makeCellFile(dir, 'held-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/held.ts'] });
      makeCellFile(dir, 'free-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/free.ts'] });
      await reserve(dir, { agent: 'other-worker', cell: 'other-cell', path: 'src/held.ts', session: 'sess-other' });

      const result = await claimNextCell(dir, { sessionId: 'sess-me', worker: 'w' });
      assert(result.ok === true && result.cell.id === 'free-1', `held-1 must be skipped for another session's hold, got ${JSON.stringify(result)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check("claimNextCell: the acting session's OWN active hold on a cell's files never excludes it", async () => {
  const dir = makeStateRepo('bee-claimnext-own-hold-');
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'swarming',
      feature: 'demo-feat',
      approved_gates: { context: true, shape: true, execution: true, review: false },
      workers: [],
    });
    makeCellFile(dir, 'own-hold-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/mine.ts'] });
    await reserve(dir, { agent: 'me-worker', cell: 'own-hold-1', path: 'src/mine.ts', session: 'sess-me' });

    const result = await claimNextCell(dir, { sessionId: 'sess-me', worker: 'w' });
    assert(result.ok === true && result.cell.id === 'own-hold-1', `own hold must never exclude the cell, got ${JSON.stringify(result)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check(
  "claimNextCell: a cell whose files overlap a FOREIGN cross-worktree hold (xwh-3) is skipped while a clean cell claims",
  async () => {
    const dir = makeStateRepo('bee-claimnext-foreign-hold-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      // readyCells sorts candidates by id (localeCompare) — 'held-foreign-1'
      // deliberately sorts BEFORE 'zzz-foreign-free-1' so selection would
      // pick the held cell FIRST without the xwh-3 foreign-hold check (a
      // real RED: this row must fail against pre-fix cells.mjs, not pass by
      // accident of id ordering).
      makeCellFile(dir, 'held-foreign-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/foreign.ts'] });
      makeCellFile(dir, 'zzz-foreign-free-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/free.ts'] });
      // `dir` is an ordinary checkout (no .git file) -> resolveHoldTopology
      // resolves holder='main', mainRoot=dir; a hold mirrored under any OTHER
      // holder id is therefore foreign to the acting claim-next call.
      await mirrorHold(dir, { path: 'src/foreign.ts', holder: 'worktree-other', feature: 'demo-feat', cell: 'other-cell' });

      const result = await claimNextCell(dir, { sessionId: 'sess-me', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'zzz-foreign-free-1',
        `held-foreign-1 must be skipped for another checkout's cross-worktree hold, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: the acting checkout's OWN cross-worktree ledger entries (holder 'main') never exclude a cell (xwh-3)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-own-foreign-hold-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      makeCellFile(dir, 'own-ledger-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/mine-ledger.ts'] });
      // `dir` resolves holder='main' for itself; an entry ALSO mirrored under
      // 'main' is the acting checkout's own hold, not a foreign one.
      await mirrorHold(dir, { path: 'src/mine-ledger.ts', holder: 'main', feature: 'demo-feat', cell: 'own-ledger-1' });

      const result = await claimNextCell(dir, { sessionId: 'sess-me', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'own-ledger-1',
        `the acting checkout's own ledger entry must never exclude the cell, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: a repo with no cross-worktree ledger file at all selects exactly like today (xwh-3 missing = empty)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-no-ledger-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      makeCellFile(dir, 'no-ledger-1', { feature: 'demo-feat', status: 'open', deps: [], files: ['src/plain.ts'] });
      assert(
        !fs.existsSync(path.join(dir, '.bee', 'runtime', 'cross-worktree-holds.json')),
        'no cross-worktree ledger file must exist before claim-next runs',
      );

      const result = await claimNextCell(dir, { sessionId: 'sess-me', worker: 'w' });
      assert(
        result.ok === true && result.cell.id === 'no-ledger-1',
        `a missing ledger must behave byte-identically to today, got ${JSON.stringify(result)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimCellCrossSession: a claimCell THROW after the claim file was created releases the claim file — no orphan (W4 unwind pin)",
  async () => {
    const dir = makeStateRepo('bee-claimnext-unwind-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      // deps: ['missing-dep'] guarantees a REAL claimCell throw (uncapped
      // deps) — no simulated race required, and claimCellFile itself never
      // checks deps/status, so step 1 succeeds before step 2 throws.
      makeCellFile(dir, 'blocked-1', { feature: 'demo-feat', status: 'open', deps: ['missing-dep'] });

      const result = await claimCellCrossSession(dir, { sessionId: 'sess-x', worker: 'w', cellId: 'blocked-1' });
      assert(result.ok === false && result.code === 'CLAIM_CELL_FAILED', `claimCell's throw must surface as a typed failure, got ${JSON.stringify(result)}`);
      assert(readClaim(dir, 'blocked-1') === null, 'the claims-store file must be released, not orphaned, after the throw');
      assert(readCell(dir, 'blocked-1').status === 'open', 'the cell itself is untouched by the failed claim');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  "claimNextCell: a repo with no lanes and no session record at all (pure default pipeline) still claims cleanly — D4 zero-lane shape",
  async () => {
    const dir = makeStateRepo('bee-claimnext-zero-lane-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'plain-feat',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      makeCellFile(dir, 'plain-1', { feature: 'plain-feat', status: 'open', deps: [] });

      const result = await claimNextCell(dir, { sessionId: 'sess-brand-new', worker: 'w' });
      assert(result.ok === true && result.cell.id === 'plain-1', `a fresh session id with no lane binding must resolve to the default pipeline, got ${JSON.stringify(result)}`);
      assert(!fs.existsSync(path.join(dir, '.bee', 'lanes')), 'no lanes directory was ever created by claim-next itself');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check('claimNextCell: NO_APPROVED_WORK when there is genuinely nothing claimable anywhere', async () => {
  const dir = makeStateRepo('bee-claimnext-none-');
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { schema_version: '1.0', phase: 'idle', feature: null, workers: [] });
    const result = await claimNextCell(dir, { sessionId: 'sess-lonely', worker: 'w' });
    assert(result.ok === false && result.code === 'NO_APPROVED_WORK', `expected NO_APPROVED_WORK, got ${JSON.stringify(result)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── bee.mjs backlog add verb (cli-mutations-2, decision from cli-mutations
// plan.md: agents never hand-edit .bee/*.json(l)) ─────────────────────────────
// counts/rank/badges already have direct lib/backlog.mjs coverage above (the
// harness10-6 suite); this block covers the new `add` mutation surface only,
// reusing the generic makeStateRepo scaffold. --type validation imports
// KIND_ALIASES/NORMALIZED_KINDS from lib/feedback.mjs rather than a
// duplicated literal list, so these tests reuse that same import.

function beeBacklogModulePath() {
  return fileURLToPath(new URL('../bee.mjs', import.meta.url));
}

function runBeeBacklog(cwd, args) {
  return runModuleWorker(beeBacklogModulePath(), { args: ['backlog', ...args], cwd });
}

// Self-containment fix (cs-2a split): PIN was a single top-level const shared
// with the feedback-collector section that has since moved to
// test_feedback.mjs (cs-2a). This block's two buildDigest(..., { now: PIN })
// calls need their own pinned timestamp — same literal value, zero check
// weakened.
const PIN = '2020-01-01T00:00:00.000Z';

// A REAL git repo (git init, not the synthetic `.git`-less makeStateRepo
// scaffold) — commitBacklogRow's --queue-submit path runs `git rev-parse
// --is-inside-work-tree` / `--git-dir` and a scoped `git add`/`git commit`,
// none of which succeed against a bare mkdir. Same shape as
// test_herding_cli.mjs's makeHerdingRepo.
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert(r.status === 0, `git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
  return r.stdout;
}

function makeGitBacklogRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 's@e']);
  git(root, ['config', 'user.name', 's']);
  fs.writeFileSync(path.join(root, 'f'), 'x');
  git(root, ['add', '.']);
  git(root, ['commit', '-q', '-m', 'init']);
  fs.mkdirSync(path.join(root, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(root, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  return fs.realpathSync(root);
}

function readBacklogJsonlLines(repoRoot) {
  const file = path.join(repoRoot, '.bee', 'backlog.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

await check('bee.mjs backlog add appends a validated row and buildDigest picks it up (never dropped as unknown_type)', async () => {
  const dir = makeStateRepo('bee-backlog-add-');
  try {
    const result = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'agents hand-edit .bee state',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--detail',
      'CLI-ify all mutations',
      '--feature',
      'cli-mutations',
    ]);
    assert(result.status === 0, `add should succeed, got ${result.status}: ${result.stderr}`);
    const lines = readBacklogJsonlLines(dir);
    assert(lines.length === 1, `one row appended, got ${lines.length}`);
    const row = lines[0];
    assert(row.type === 'friction', `type recorded, got ${row.type}`);
    assert(row.title === 'agents hand-edit .bee state', 'title recorded');
    assert(row.severity === 'P2', 'severity recorded');
    assert(row.layer === 'state', 'layer recorded');
    assert(row.detail === 'CLI-ify all mutations', 'detail recorded');
    assert(row.feature === 'cli-mutations', 'feature recorded');
    assert(typeof row.ts === 'string' && !Number.isNaN(Date.parse(row.ts)), `ts is a real ISO date, got ${row.ts}`);
    assert(
      !('source' in row),
      'no source field — the collector overrides source with SRC_BACKLOG and never reads a row-supplied value',
    );

    const digest = buildDigest(dir, { now: PIN });
    assert(digest.counts.dropped === 0, `nothing dropped, got ${JSON.stringify(digest.dropped)}`);
    assert(
      digest.entries.length === 1 && digest.entries[0].kind === 'friction',
      `entry present with kind friction, got ${JSON.stringify(digest.entries)}`,
    );
    assert(digest.entries[0].title === 'agents hand-edit .bee state', 'entry title matches the appended row');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add accepts an already-normalized NORMALIZED_KINDS value for --type, not only a KIND_ALIASES key', async () => {
  const dir = makeStateRepo('bee-backlog-add-normalized-');
  try {
    assert(
      !Object.prototype.hasOwnProperty.call(KIND_ALIASES, 'approval'),
      'test premise: "approval" is a NORMALIZED_KINDS value (from kill-approval), not itself a KIND_ALIASES key',
    );
    const result = await runBeeBacklog(dir, [
      'add',
      '--type',
      'approval',
      '--title',
      'kill-approval normalized',
      '--severity',
      'P3',
      '--layer',
      'review',
    ]);
    assert(result.status === 0, `add should accept an already-normalized kind, got ${result.status}: ${result.stderr}`);
    const digest = buildDigest(dir, { now: PIN });
    assert(
      digest.entries.length === 1 && digest.entries[0].kind === 'approval',
      `kind carried through unchanged, got ${JSON.stringify(digest.entries)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add rejects --type "kind" (the literal word) and any other unrecognized type before any write', async () => {
  const dir = makeStateRepo('bee-backlog-add-badtype-');
  try {
    const result = await runBeeBacklog(dir, ['add', '--type', 'kind', '--title', 'x', '--severity', 'P1', '--layer', 'state']);
    assert(result.status !== 0, 'the literal word "kind" is not a valid type — exits non-zero');
    assert(/--type/.test(result.stderr), `error names --type, got ${result.stderr}`);
    assert(!fs.existsSync(path.join(dir, '.bee', 'backlog.jsonl')), 'file untouched (never created) after a rejected add');

    const alsoBad = await runBeeBacklog(dir, [
      'add',
      '--type',
      'not-a-real-kind',
      '--title',
      'x',
      '--severity',
      'P1',
      '--layer',
      'state',
    ]);
    assert(alsoBad.status !== 0, 'a wholly unrecognized type is rejected too');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add rejects an oversize title, a bad severity, and an oversize/empty layer, leaving the file untouched', async () => {
  const dir = makeStateRepo('bee-backlog-add-badfields-');
  try {
    const good = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', 'baseline row', '--severity', 'P2', '--layer', 'state']);
    assert(good.status === 0, `baseline add should succeed, got ${good.status}: ${good.stderr}`);
    const before = fs.readFileSync(path.join(dir, '.bee', 'backlog.jsonl'), 'utf8');

    const longTitle = 'x'.repeat(201);
    const badTitle = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', longTitle, '--severity', 'P2', '--layer', 'state']);
    assert(badTitle.status !== 0, 'a title over 200 chars is rejected');
    assert(/--title/.test(badTitle.stderr), `error names --title, got ${badTitle.stderr}`);

    const badSeverity = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', 'x', '--severity', 'P4', '--layer', 'state']);
    assert(badSeverity.status !== 0, 'an out-of-range severity is rejected');
    assert(/--severity/.test(badSeverity.stderr), `error names --severity, got ${badSeverity.stderr}`);

    const longLayer = 'y'.repeat(41);
    const badLayer = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', 'x', '--severity', 'P2', '--layer', longLayer]);
    assert(badLayer.status !== 0, 'a layer over 40 chars is rejected');
    assert(/--layer/.test(badLayer.stderr), `error names --layer, got ${badLayer.stderr}`);

    const emptyLayer = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', 'x', '--severity', 'P2', '--layer', '']);
    assert(emptyLayer.status !== 0, 'an empty layer is rejected (non-empty required — still no fixed allowlist)');

    const missingType = await runBeeBacklog(dir, ['add', '--title', 'x', '--severity', 'P2', '--layer', 'state']);
    assert(missingType.status !== 0, 'a missing --type is rejected');

    const after = fs.readFileSync(path.join(dir, '.bee', 'backlog.jsonl'), 'utf8');
    assert(before === after, 'every rejected add left the file byte-for-byte untouched');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add accepts an arbitrary free-string --layer with no allowlist (e.g. "security", already live in backlog data)', async () => {
  const dir = makeStateRepo('bee-backlog-add-freelayer-');
  try {
    const result = await runBeeBacklog(dir, ['add', '--type', 'friction', '--title', 'x', '--severity', 'P2', '--layer', 'security']);
    assert(result.status === 0, `a free-string layer with no fixed enum is accepted, got ${result.status}: ${result.stderr}`);
    const lines = readBacklogJsonlLines(dir);
    assert(lines[0].layer === 'security', 'layer stored as given, no allowlist rewriting');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── backlog-auto-commit-2 (D1/D2): --queue-submit scopes commitBacklogRow's
// auto-commit to explicit human queue-submits, and a merge-in-progress skip
// is surfaced instead of silent. Real git-repo fixtures (makeGitBacklogRepo)
// — commitBacklogRow's git calls are no-ops against the synthetic
// makeStateRepo scaffold used by every test above this block. ──────────────

await check('bee.mjs backlog add with --queue-submit omitted never invokes git and returns committed:false with no commit created', async () => {
  const dir = makeGitBacklogRepo('bee-backlog-add-noqueue-');
  try {
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'agent self-observation row',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--json',
    ]);
    assert(result.status === 0, `add should succeed, got ${result.status}: ${result.stderr}`);
    const row = JSON.parse(result.stdout);
    assert(row.committed === false, `expected committed:false with --queue-submit omitted, got ${JSON.stringify(row)}`);
    assert(!('commit_sha' in row), `no commit_sha when uncommitted, got ${JSON.stringify(row)}`);
    assert(!('commit_skipped_reason' in row), `no commit_skipped_reason for the default-false path, got ${JSON.stringify(row)}`);
    const after = git(dir, ['rev-parse', 'HEAD']).trim();
    assert(before === after, 'HEAD unchanged — no commit was created');
    const lines = readBacklogJsonlLines(dir);
    assert(lines.length === 1, `row still appended to the jsonl despite no commit, got ${lines.length}`);

    const explicitFalse = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'second self-observation row',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--queue-submit=false',
      '--json',
    ]);
    assert(explicitFalse.status === 0, `add should succeed, got ${explicitFalse.status}: ${explicitFalse.stderr}`);
    const explicitRow = JSON.parse(explicitFalse.stdout);
    assert(explicitRow.committed === false, `explicit --queue-submit=false also skips the commit, got ${JSON.stringify(explicitRow)}`);
    const afterExplicit = git(dir, ['rev-parse', 'HEAD']).trim();
    assert(before === afterExplicit, 'HEAD still unchanged after an explicit --queue-submit=false add');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add --queue-submit performs the scoped commit, returns committed:true + commit_sha, touching only .bee/backlog.jsonl', async () => {
  const dir = makeGitBacklogRepo('bee-backlog-add-queue-');
  try {
    const result = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'human queue-submitted row',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--queue-submit',
      '--json',
    ]);
    assert(result.status === 0, `add should succeed, got ${result.status}: ${result.stderr}`);
    const row = JSON.parse(result.stdout);
    assert(row.committed === true, `expected committed:true with --queue-submit, got ${JSON.stringify(row)}`);
    assert(typeof row.commit_sha === 'string' && row.commit_sha.length > 0, `expected a commit_sha, got ${JSON.stringify(row)}`);

    const headSha = git(dir, ['rev-parse', 'HEAD']).trim();
    assert(headSha === row.commit_sha, `HEAD advanced to the returned commit_sha, got HEAD=${headSha} vs ${row.commit_sha}`);
    const changedFiles = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD'])
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    assert(
      changedFiles.length === 1 && changedFiles[0] === path.join('.bee', 'backlog.jsonl'),
      `commit touches only .bee/backlog.jsonl, got ${JSON.stringify(changedFiles)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog add --queue-submit with a merge in progress returns commit_skipped_reason:"merge_in_progress" and the text output carries the warning suffix, without committing', async () => {
  const dir = makeGitBacklogRepo('bee-backlog-add-mergeskip-');
  try {
    const gitDir = git(dir, ['rev-parse', '--git-dir']).trim();
    const mergeHeadPath = path.resolve(dir, gitDir, 'MERGE_HEAD');
    const headSha = git(dir, ['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(mergeHeadPath, `${headSha}\n`, 'utf8');

    const jsonResult = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'row during an in-progress merge',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--queue-submit',
      '--json',
    ]);
    assert(jsonResult.status === 0, `add should succeed (the row still appends), got ${jsonResult.status}: ${jsonResult.stderr}`);
    const row = JSON.parse(jsonResult.stdout);
    assert(row.committed === false, `expected committed:false during a merge, got ${JSON.stringify(row)}`);
    assert(
      row.commit_skipped_reason === 'merge_in_progress',
      `expected commit_skipped_reason:"merge_in_progress", got ${JSON.stringify(row)}`,
    );
    assert(!('commit_sha' in row), `no commit_sha when the commit was skipped, got ${JSON.stringify(row)}`);

    const textResult = await runBeeBacklog(dir, [
      'add',
      '--type',
      'friction',
      '--title',
      'a second row during the same merge',
      '--severity',
      'P2',
      '--layer',
      'state',
      '--queue-submit',
    ]);
    assert(textResult.status === 0, `add should succeed, got ${textResult.status}: ${textResult.stderr}`);
    assert(
      /auto-commit skipped: merge in progress/.test(textResult.stdout),
      `text output names the merge-in-progress skip, got stdout="${textResult.stdout}"`,
    );

    const headAfter = git(dir, ['rev-parse', 'HEAD']).trim();
    assert(headAfter === headSha, 'HEAD unchanged — no commit was attempted while MERGE_HEAD was present');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── bee.mjs backlog propose verb (backlog-submit-command D1/D2/D3/D5) ─────
// Direct docs/backlog.md PBI-row registration, distinct from `add` above
// (which targets .bee/backlog.jsonl). Reuses the makeStateRepo/runBeeBacklog
// scaffold; docs/backlog.md's own row shape (`| ID | Story | CoS | Status |
// Feature |`) is the table format lib/backlog.mjs's readBacklogCounts and
// proposePbiRow both read.

function makeBacklogTableRepo(prefix, table) {
  const dir = makeStateRepo(prefix);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'backlog.md'), table, 'utf8');
  return dir;
}

const BACKLOG_TABLE_HEADER = '# Backlog\n\n| ID | Story | CoS | Status | Feature |\n|----|-------|-----|--------|---------|\n';

await check('bee.mjs backlog propose on a fresh table (zero P<n> rows) assigns P1, defaults --feature to "—", and is immediately counted by readBacklogCounts as proposed', async () => {
  const dir = makeBacklogTableRepo('bee-backlog-propose-fresh-', BACKLOG_TABLE_HEADER);
  try {
    const result = await runBeeBacklog(dir, ['propose', '--story', 'A human can submit an item', '--cos', 'a row appears', '--json']);
    assert(result.status === 0, `propose should succeed, got ${result.status}: ${result.stderr}`);
    const row = JSON.parse(result.stdout);
    assert(row.id === 'P1', `expected P1 on a fresh (zero P<n> rows) table, got ${row.id}`);
    assert(row.feature === '—', `feature defaults to "—" when --feature is omitted, got ${row.feature}`);

    const counts = readBacklogCounts(dir);
    assert(counts.proposed === 1 && counts.total === 1, `readBacklogCounts immediately sees the new row as proposed, got ${JSON.stringify(counts)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog propose assigns (highest existing P<n> in the fixture) + 1 across a gap, never backfilling it', async () => {
  // A gap fixture (P3, then P10 — nothing in between) mirrors the live
  // table's own P58-style gap; the expected id is derived from THIS
  // fixture's own text below, never a hardcoded literal, since the live
  // table's actual max keeps advancing independently of this test.
  const table = `${BACKLOG_TABLE_HEADER}| P3 | Old row | old cos | done | — |\n| P10 | Newer row | newer cos | proposed | — |\n`;
  const fixtureMax = Math.max(...[...table.matchAll(/\|\s*P(\d+)\s*\|/g)].map((m) => Number(m[1])));
  const dir = makeBacklogTableRepo('bee-backlog-propose-gap-', table);
  try {
    const before = readBacklogCounts(dir);
    const result = await runBeeBacklog(dir, ['propose', '--story', 'Fill the gap? No.', '--cos', 'assigned max+1, not the gap', '--json']);
    assert(result.status === 0, `propose should succeed, got ${result.status}: ${result.stderr}`);
    const row = JSON.parse(result.stdout);
    assert(row.id === `P${fixtureMax + 1}`, `expected P${fixtureMax + 1} (fixture max+1, gap never backfilled), got ${row.id}`);

    const after = readBacklogCounts(dir);
    assert(after.total === before.total + 1, 'exactly one row appended');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog propose rejects an oversize/missing/whitespace-only --story or --cos, leaving docs/backlog.md byte-untouched', async () => {
  const dir = makeBacklogTableRepo('bee-backlog-propose-badfields-', BACKLOG_TABLE_HEADER);
  try {
    const before = fs.readFileSync(path.join(dir, 'docs', 'backlog.md'), 'utf8');

    const longStory = 's'.repeat(201);
    const badStory = await runBeeBacklog(dir, ['propose', '--story', longStory, '--cos', 'ok']);
    assert(badStory.status !== 0, 'a story over 200 chars is rejected');

    const longCos = 'c'.repeat(2001);
    const badCos = await runBeeBacklog(dir, ['propose', '--story', 'ok', '--cos', longCos]);
    assert(badCos.status !== 0, 'a cos over 2000 chars is rejected');

    const missingStory = await runBeeBacklog(dir, ['propose', '--cos', 'ok']);
    assert(missingStory.status !== 0, 'a missing --story is rejected');

    const missingCos = await runBeeBacklog(dir, ['propose', '--story', 'ok']);
    assert(missingCos.status !== 0, 'a missing --cos is rejected');

    const blankStory = await runBeeBacklog(dir, ['propose', '--story', '   ', '--cos', 'ok']);
    assert(blankStory.status !== 0, 'a whitespace-only --story is rejected');

    const blankCos = await runBeeBacklog(dir, ['propose', '--story', 'ok', '--cos', '   ']);
    assert(blankCos.status !== 0, 'a whitespace-only --cos is rejected');

    const after = fs.readFileSync(path.join(dir, 'docs', 'backlog.md'), 'utf8');
    assert(before === after, 'every rejected propose left docs/backlog.md byte-for-byte untouched');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog propose called twice in succession never collides — each call assigns max+1 off a freshly re-read file', async () => {
  const dir = makeBacklogTableRepo('bee-backlog-propose-twice-', BACKLOG_TABLE_HEADER);
  try {
    const first = await runBeeBacklog(dir, ['propose', '--story', 'first', '--cos', 'first cos', '--json']);
    assert(first.status === 0, `first propose should succeed, got ${first.status}: ${first.stderr}`);
    const firstRow = JSON.parse(first.stdout);

    const second = await runBeeBacklog(dir, ['propose', '--story', 'second', '--cos', 'second cos', '--json']);
    assert(second.status === 0, `second propose should succeed, got ${second.status}: ${second.stderr}`);
    const secondRow = JSON.parse(second.stdout);

    assert(firstRow.id !== secondRow.id, `two successive proposals must never collide, got ${firstRow.id} and ${secondRow.id}`);
    const expectedSecondN = Number(firstRow.id.slice(1)) + 1;
    assert(secondRow.id === `P${expectedSecondN}`, `second call assigns max+1 off the freshly-written file, got ${secondRow.id}`);

    const counts = readBacklogCounts(dir);
    assert(counts.proposed === 2 && counts.total === 2, `both rows counted, got ${JSON.stringify(counts)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog propose sanitizes a literal "|" and an embedded newline in --story/--cos so the appended row stays one parseable table row', async () => {
  const dir = makeBacklogTableRepo('bee-backlog-propose-sanitize-', BACKLOG_TABLE_HEADER);
  try {
    const result = await runBeeBacklog(dir, ['propose', '--story', 'A|B\nC', '--cos', 'has a | pipe too', '--json']);
    assert(result.status === 0, `propose should succeed, got ${result.status}: ${result.stderr}`);
    const row = JSON.parse(result.stdout);
    assert(!row.story.includes('|') && !row.story.includes('\n'), `story sanitized for the single-line table cell, got ${JSON.stringify(row.story)}`);
    assert(!row.cos.includes('|'), `cos sanitized for the single-line table cell, got ${JSON.stringify(row.cos)}`);

    const counts = readBacklogCounts(dir);
    assert(counts.proposed === 1 && counts.total === 1, `row stays parseable by readBacklogCounts after sanitizing, got ${JSON.stringify(counts)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog propose records a given --feature, appends Status=proposed at the raw file level, and confirms with a one-line text summary naming the id', async () => {
  const dir = makeBacklogTableRepo('bee-backlog-propose-rawrow-', BACKLOG_TABLE_HEADER);
  try {
    const withFeature = await runBeeBacklog(dir, ['propose', '--story', 'x', '--cos', 'y', '--feature', 'my-feature', '--json']);
    assert(withFeature.status === 0, `propose should succeed, got ${withFeature.status}: ${withFeature.stderr}`);
    assert(JSON.parse(withFeature.stdout).feature === 'my-feature', 'a given --feature is carried through, not overridden by the "—" default');

    const textResult = await runBeeBacklog(dir, ['propose', '--story', 'raw check', '--cos', 'raw cos']);
    assert(textResult.status === 0, `propose should succeed, got ${textResult.status}: ${textResult.stderr}`);
    assert(/^Proposed P\d+: /.test(textResult.stdout), `text confirmation names the assigned id, got stdout="${textResult.stdout}"`);

    const fileText = fs.readFileSync(path.join(dir, 'docs', 'backlog.md'), 'utf8');
    const match = /\|\s*P\d+\s*\|\s*raw check\s*\|\s*raw cos\s*\|\s*proposed\s*\|\s*—\s*\|/.exec(fileText);
    assert(match, `appended row matches the 5-column | ID | Story | CoS | Status | Feature | shape with Status=proposed, got:\n${fileText}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog counts/rank/badges verbs are unchanged by the add verb addition', async () => {
  const dir = makeStateRepo('bee-backlog-counts-');
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'docs', 'backlog.md'),
      '# Backlog\n\n| ID | Story | Status |\n|----|-------|--------|\n| 1 | A | done |\n| 2 | B | proposed |\n',
      'utf8',
    );
    const result = await runBeeBacklog(dir, ['counts', '--json']);
    assert(result.status === 0, `counts should succeed, got ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.done === 1 && parsed.proposed === 1 && parsed.total === 2, `counts unchanged, got ${JSON.stringify(parsed)}`);

    const badFlag = await runBeeBacklog(dir, ['counts', '--bogus']);
    assert(badFlag.status !== 0, 'an unknown flag on counts is still rejected (strict parsing preserved for non-add verbs)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('bee.mjs backlog with no command prints a Use: line listing all five verbs and exits non-zero', async () => {
  const dir = makeStateRepo('bee-backlog-noverb-');
  try {
    const result = await runBeeBacklog(dir, []);
    assert(result.status !== 0, 'no-command invocation exits non-zero');
    assert(/Use:/.test(result.stderr), `expected a "Use:" line, got stderr="${result.stderr}"`);
    assert(
      /counts/.test(result.stderr) &&
        /rank/.test(result.stderr) &&
        /badges/.test(result.stderr) &&
        /add/.test(result.stderr) &&
        /propose/.test(result.stderr),
      `Use: line should list all five verbs, got ${result.stderr}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

printSummaryAndExit();
