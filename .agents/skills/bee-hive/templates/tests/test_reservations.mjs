#!/usr/bin/env node
// test_reservations.mjs — lib/reservations.mjs contract tests (reserve/release/
// sweepExpired/findConflicts + fsh-7 session-owned holds), split out of
// test_lib.mjs (cs-2a) to shrink the monolith. Same PASS/FAIL/exit-1 contract
// as every other suite here — see scripts/lib/test-fixture.mjs.

import {
  makeTempRepo,
  check,
  assert,
  printSummaryAndExit,
} from '../../../../scripts/lib/test-fixture.mjs';
import {
  reserve,
  release,
  listReservations,
  sweepExpired,
  findConflicts,
  findSessionConflicts,
  reservationsPath,
} from '../lib/reservations.mjs';
import { createSession } from '../lib/claims.mjs';
import { readJson, writeJsonAtomic } from '../lib/fsutil.mjs';

const root = makeTempRepo();

// ─── reservations ───────────────────────────────────────────────────────────

await check('reserve succeeds, then conflicts for another agent on the same path', async () => {
  const first = await reserve(root, { agent: 'worker-a', cell: 'demo-2', path: 'src/api/router.ts' });
  assert(first.ok === true, 'first reservation ok');
  const second = await reserve(root, { agent: 'worker-b', cell: 'blk-1', path: 'src/api/router.ts' });
  assert(second.ok === false, 'second reservation should conflict');
  assert(second.conflicts.length === 1 && second.conflicts[0].agent === 'worker-a', 'conflict names holder');
});

await check('same agent does not conflict with itself; directory prefix overlaps', async () => {
  const conflicts = findConflicts(root, 'worker-a', ['src/api/router.ts']);
  assert(conflicts.length === 0, 'own reservation is not a conflict');
  const dirConflicts = findConflicts(root, 'worker-b', ['src/api']);
  assert(dirConflicts.length === 1, 'directory prefix should overlap the reserved file');
});

await check('release frees the path for other agents', async () => {
  await release(root, { agent: 'worker-a', cell: 'demo-2' });
  const retry = await reserve(root, { agent: 'worker-b', cell: 'blk-1', path: 'src/api/router.ts' });
  assert(retry.ok === true, 'released path can be reserved by another agent');
});

await check('sweepExpired releases TTL-expired reservations', async () => {
  const store = readJson(reservationsPath(root), { reservations: [] });
  const active = store.reservations.find((r) => r.agent === 'worker-b' && r.released_at === null);
  assert(active, 'precondition: worker-b holds an active reservation');
  active.reserved_at = new Date(Date.now() - 7200 * 1000).toISOString();
  active.ttl_seconds = 60;
  writeJsonAtomic(reservationsPath(root), store);
  const swept = await sweepExpired(root);
  assert(swept >= 1, `expected at least one swept reservation, got ${swept}`);
  assert(listReservations(root, { activeOnly: true }).length === 0, 'no active reservations remain');
});

// ─── fsh-7: session-owned holds (D3) ────────────────────────────────────────
// reservations gain an OPTIONAL `session` field; findSessionConflicts is the
// session-keyed sibling of findConflicts, exported for the write guard.

await check('reserve without --session omits the field entirely (byte-identical shape to every pre-existing row); reserve WITH session stamps it', async () => {
  // D3: reserve() self-derives session from CLAUDE_CODE_SESSION_ID when no
  // explicit flag is passed — "no session passed" only stays session-less
  // when the env is ALSO absent, so this assertion clears env for the
  // duration (same save/clear/restore pattern as the resolveSessionId check
  // below), matching the running-as-a-live-session reality of a bee worker.
  const savedEnv = process.env.CLAUDE_CODE_SESSION_ID;
  try {
    delete process.env.CLAUDE_CODE_SESSION_ID;
    const plain = await reserve(root, { agent: 'worker-a', cell: 'sess-1', path: 'src/hold/plain.ts' });
    assert(plain.ok === true, 'plain reserve still succeeds');
    assert(!('session' in plain.reservation), 'no session passed and no env -> no session key on the record at all');
  } finally {
    if (savedEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = savedEnv;
  }

  const owned = await reserve(root, { agent: 'worker-a', cell: 'sess-1', path: 'src/hold/owned.ts', session: 'sess-A' });
  assert(owned.ok === true, 'session-owned reserve succeeds');
  assert(owned.reservation.session === 'sess-A', 'session id is stamped on the record');
});

await check('findSessionConflicts: a different session conflicts on an overlapping path; the owning session itself never conflicts; a legacy session-less row never conflicts for anybody', async () => {
  await reserve(root, { agent: 'worker-a', cell: 'sess-2', path: 'src/hold/shared.ts', session: 'sess-A' });
  const other = findSessionConflicts(root, 'sess-B', ['src/hold/shared.ts']);
  assert(other.length === 1 && other[0].session === 'sess-A', 'a different session sees the hold as a conflict');

  const own = findSessionConflicts(root, 'sess-A', ['src/hold/shared.ts']);
  assert(own.length === 0, "the owning session's own hold is never a conflict against itself");

  // src/hold/plain.ts was reserved with no session field above.
  const legacy = findSessionConflicts(root, 'sess-B', ['src/hold/plain.ts']);
  assert(legacy.length === 0, 'a session-less (legacy) reservation row never conflicts for any session');
});

await check('findSessionConflicts: an expired session-owned hold never conflicts', async () => {
  await reserve(root, { agent: 'worker-c', cell: 'sess-3', path: 'src/hold/expiring.ts', session: 'sess-C', ttl: 60 });
  const store = readJson(reservationsPath(root), { reservations: [] });
  const row = store.reservations.find((r) => r.path === 'src/hold/expiring.ts' && r.session === 'sess-C');
  assert(row, 'precondition: the just-made hold exists');
  row.reserved_at = new Date(Date.now() - 7200 * 1000).toISOString();
  writeJsonAtomic(reservationsPath(root), store);
  const conflicts = findSessionConflicts(root, 'sess-D', ['src/hold/expiring.ts']);
  assert(conflicts.length === 0, 'a TTL-expired hold is never a conflict, even for a different session');
});

// ─── hardening-4a: sessionless reserve refuses in concurrent mode ──────────

await check('reserve: sessionless reserve still works solo (nobody else live) — byte-unchanged; refuses typed SESSION_REQUIRED once another session goes live, naming --session-id and BEE_SESSION_ID; a real session id still reserves fine in concurrent mode', async () => {
  const savedLegacyEnv = process.env.CLAUDE_CODE_SESSION_ID;
  const savedBeeEnv = process.env.BEE_SESSION_ID;
  try {
    delete process.env.CLAUDE_CODE_SESSION_ID;
    delete process.env.BEE_SESSION_ID;

    const solo = await reserve(root, { agent: 'worker-solo', cell: 'concurrent-1', path: 'src/hold/solo.ts' });
    assert(solo.ok === true, 'sessionless reserve still succeeds with nobody else live');
    assert(!('session' in solo.reservation), 'solo sessionless reserve still omits the session key entirely');
    await release(root, { agent: 'worker-solo', cell: 'concurrent-1' });

    createSession(root, { id: 'other-live-sess' }); // fresh heartbeat -> concurrent mode
    const refused = await reserve(root, { agent: 'worker-solo', cell: 'concurrent-2', path: 'src/hold/refused.ts' });
    assert(refused.ok === false, 'sessionless reserve refused while another session is live');
    assert(refused.code === 'SESSION_REQUIRED', `expected typed SESSION_REQUIRED, got ${refused.code}`);
    assert(typeof refused.reason === 'string' && refused.reason.includes('--session-id'), `reason should name --session-id, got ${JSON.stringify(refused.reason)}`);
    assert(refused.reason.includes('BEE_SESSION_ID'), `reason should name BEE_SESSION_ID, got ${JSON.stringify(refused.reason)}`);
    assert(Array.isArray(refused.conflicts) && refused.conflicts.length === 0, 'refusal carries an empty conflicts array so an existing !ok caller reading .conflicts never crashes');
    assert(listReservations(root, { activeOnly: true }).filter((r) => r.cell === 'concurrent-2').length === 0, 'the refusal never leaves a reservation row behind');

    const withSession = await reserve(root, { agent: 'worker-solo', cell: 'concurrent-2', path: 'src/hold/refused.ts', session: 'other-live-sess' });
    assert(withSession.ok === true, 'a real session id reserves fine even in concurrent mode');
    await release(root, { agent: 'worker-solo', cell: 'concurrent-2' });
  } finally {
    if (savedLegacyEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = savedLegacyEnv;
    if (savedBeeEnv === undefined) delete process.env.BEE_SESSION_ID;
    else process.env.BEE_SESSION_ID = savedBeeEnv;
  }
});

printSummaryAndExit();
