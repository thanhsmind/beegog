#!/usr/bin/env node
// test_claims.mjs — lib/claims.mjs contract tests (cross-session sessions +
// O_EXCL cell claims, resolveSessionId, sessionless claims, concurrent Worker
// races), split out of test_lib.mjs (cs-2a) to shrink the monolith. Same
// PASS/FAIL/exit-1 contract as every other suite here — see
// scripts/lib/test-fixture.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';
import { check, assert, printSummaryAndExit } from '../../../../scripts/lib/test-fixture.mjs';
import {
  createSession,
  readSession,
  heartbeatSession,
  claimCellFile,
  readClaim,
  releaseClaim,
  clearClaim,
  adoptClaim,
  sweepExpiredClaims,
  isClaimActive,
  sessionPath,
  claimPath,
  claimGatePath,
  resolveSessionId,
  DEFAULT_CLAIM_TTL_SECONDS,
  DEFAULT_HEARTBEAT_STALE_SECONDS,
} from '../lib/claims.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';

// ─── claims (cross-session sessions + O_EXCL cell claims) ───────────────────
// fsh-1 (fresh-session-handoff): single-process rows prove post-states and the
// typed {ok:false, code, reason} contract. The concurrency windows themselves
// are proven by the multi-process race fixtures (fsh-2); S1 caps as a unit.

const claimsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-claims-'));

await check('createSession writes .bee/sessions/<id>.json (id, started_at, last_heartbeat); duplicate id is a typed failure', async () => {
  const made = createSession(claimsRoot, { id: 'sess-a' });
  assert(made.ok === true, 'first createSession ok');
  assert(fs.existsSync(sessionPath(claimsRoot, 'sess-a')), 'session record exists on disk');
  const record = readSession(claimsRoot, 'sess-a');
  assert(record && record.id === 'sess-a', 'session record carries its id');
  assert(typeof record.started_at === 'string' && !Number.isNaN(Date.parse(record.started_at)), 'started_at is a timestamp');
  assert(typeof record.last_heartbeat === 'string' && !Number.isNaN(Date.parse(record.last_heartbeat)), 'last_heartbeat is a timestamp');
  const dup = createSession(claimsRoot, { id: 'sess-a' });
  assert(dup.ok === false && dup.code === 'SESSION_EXISTS' && typeof dup.reason === 'string', 'duplicate session id returns typed {ok:false, code, reason} — no throw');
  const generated = createSession(claimsRoot);
  assert(generated.ok === true && typeof generated.session.id === 'string' && generated.session.id.length > 0, 'id generated when omitted');
});

await check('heartbeatSession advances last_heartbeat; missing session is a typed SESSION_MISSING failure', async () => {
  const stale = new Date(Date.now() - 7200 * 1000).toISOString();
  const record = readSession(claimsRoot, 'sess-a');
  writeJsonAtomic(sessionPath(claimsRoot, 'sess-a'), { ...record, last_heartbeat: stale });
  const beat = heartbeatSession(claimsRoot, 'sess-a');
  assert(beat.ok === true, 'heartbeat ok');
  const after = readSession(claimsRoot, 'sess-a');
  assert(Date.parse(after.last_heartbeat) > Date.parse(stale), 'last_heartbeat advanced');
  const missing = heartbeatSession(claimsRoot, 'sess-ghost');
  assert(missing.ok === false && missing.code === 'SESSION_MISSING' && typeof missing.reason === 'string', 'missing session returns typed failure — no throw');
});

await check('claimCellFile: first claimant wins, second gets typed CLAIMED naming holder and expiry — no throw', async () => {
  createSession(claimsRoot, { id: 'sess-b' });
  const first = claimCellFile(claimsRoot, 'sess-a', 'cell-1', 60);
  assert(first.ok === true, 'first claim wins');
  assert(first.claim.cell === 'cell-1' && first.claim.session === 'sess-a', 'claim record carries cell + owner');
  assert(first.claim.ttl_seconds === 60, 'claim record carries ttl');
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-1')), 'claim file exists under .bee/claims/');
  const second = claimCellFile(claimsRoot, 'sess-b', 'cell-1', 60);
  assert(second.ok === false, 'second claim loses');
  assert(second.code === 'CLAIMED', `contention code is CLAIMED, got ${second.code}`);
  assert(typeof second.reason === 'string' && second.reason.includes('sess-a'), 'reason names the holder');
  assert(/expir/i.test(second.reason), 'reason names the expiry');
  assert(second.holder && second.holder.session === 'sess-a', 'holder record returned');
});

await check('claim and session records are repo-relative — no absolute or system-temp path inside', async () => {
  const claimText = fs.readFileSync(claimPath(claimsRoot, 'cell-1'), 'utf8');
  const sessionText = fs.readFileSync(sessionPath(claimsRoot, 'sess-a'), 'utf8');
  assert(!claimText.includes(claimsRoot), 'claim record must not embed the repo root path');
  assert(!sessionText.includes(claimsRoot), 'session record must not embed the repo root path');
  assert(!claimText.includes(os.tmpdir()), 'claim record must not embed a system temp path');
});

await check('isClaimActive reuses reservations TTL semantics: fresh claim active, TTL-expired claim inactive', async () => {
  const claim = readClaim(claimsRoot, 'cell-1');
  assert(isClaimActive(claim) === true, 'fresh claim is active');
  const expired = { ...claim, claimed_at: new Date(Date.now() - 7200 * 1000).toISOString(), ttl_seconds: 60 };
  assert(isClaimActive(expired) === false, 'TTL-expired claim is inactive');
  assert(isClaimActive(null) === false, 'missing claim is not active');
});

await check('sweep: TTL expired but heartbeat FRESH is never reclaimed (20260710 — no steal on a stall signal)', async () => {
  // Backdate the claim past its TTL; owner sess-a heartbeat was just renewed above.
  heartbeatSession(claimsRoot, 'sess-a');
  const claim = readClaim(claimsRoot, 'cell-1');
  writeJsonAtomic(claimPath(claimsRoot, 'cell-1'), {
    ...claim,
    claimed_at: new Date(Date.now() - 7200 * 1000).toISOString(),
    ttl_seconds: 60,
  });
  const result = sweepExpiredClaims(claimsRoot);
  assert(result.ok === true, 'sweep returns ok');
  assert(!result.swept.includes('cell-1'), 'fresh-heartbeat claim not swept');
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-1')), 'claim file untouched');
});

await check('sweep: TTL expired AND heartbeat stale IS reclaimed; no gate file leaks', async () => {
  const session = readSession(claimsRoot, 'sess-a');
  writeJsonAtomic(sessionPath(claimsRoot, 'sess-a'), {
    ...session,
    last_heartbeat: new Date(Date.now() - (DEFAULT_HEARTBEAT_STALE_SECONDS + 3600) * 1000).toISOString(),
  });
  const result = sweepExpiredClaims(claimsRoot);
  assert(result.swept.includes('cell-1'), `expired+stale claim swept, got ${JSON.stringify(result)}`);
  assert(!fs.existsSync(claimPath(claimsRoot, 'cell-1')), 'claim file reclaimed');
  assert(!fs.existsSync(claimGatePath(claimsRoot, 'cell-1')), 'gate file removed after sweep');
  heartbeatSession(claimsRoot, 'sess-a'); // restore a fresh heartbeat for later rows
});

await check('sweep and adopt skip/refuse while the per-claim gate is held — typed GATE_HELD, never wait', async () => {
  const claimed = claimCellFile(claimsRoot, 'sess-a', 'cell-2', 60);
  assert(claimed.ok === true, 'precondition: cell-2 claimed');
  writeJsonAtomic(claimPath(claimsRoot, 'cell-2'), {
    ...readClaim(claimsRoot, 'cell-2'),
    claimed_at: new Date(Date.now() - 7200 * 1000).toISOString(),
  });
  writeJsonAtomic(sessionPath(claimsRoot, 'sess-a'), {
    ...readSession(claimsRoot, 'sess-a'),
    last_heartbeat: new Date(Date.now() - (DEFAULT_HEARTBEAT_STALE_SECONDS + 3600) * 1000).toISOString(),
  });
  fs.writeFileSync(claimGatePath(claimsRoot, 'cell-2'), '{}', 'utf8'); // another process mid-adopt
  const swept = sweepExpiredClaims(claimsRoot);
  assert(!swept.swept.includes('cell-2'), 'gated claim skipped by sweep');
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-2')), 'gated claim untouched');
  const adopt = adoptClaim(claimsRoot, 'cell-2', 'sess-b');
  assert(adopt.ok === false && adopt.code === 'GATE_HELD' && typeof adopt.reason === 'string', 'adopt under a held gate is a typed GATE_HELD failure — no throw');
  fs.rmSync(claimGatePath(claimsRoot, 'cell-2'));
  heartbeatSession(claimsRoot, 'sess-a');
});

await check('adoptClaim rewrites the owner in place: old owner loses, new owner holds, claim file present throughout post-state', async () => {
  const before = readClaim(claimsRoot, 'cell-2');
  assert(before.session === 'sess-a', 'precondition: sess-a owns cell-2');
  const adopted = adoptClaim(claimsRoot, 'cell-2', 'sess-b');
  assert(adopted.ok === true, `adopt ok, got ${JSON.stringify(adopted)}`);
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-2')), 'claim file exists after adopt (never deleted)');
  const after = readClaim(claimsRoot, 'cell-2');
  assert(after.session === 'sess-b', 'new session owns the claim');
  assert(after.adopted_from === 'sess-a', 'adoption records the previous owner');
  assert(typeof after.adopted_at === 'string' && !Number.isNaN(Date.parse(after.adopted_at)), 'adoption timestamped');
  assert(after.cell === 'cell-2', 'cell id preserved in place');
  assert(!fs.existsSync(claimGatePath(claimsRoot, 'cell-2')), 'gate file removed after adopt');
  const missing = adoptClaim(claimsRoot, 'cell-ghost', 'sess-b');
  assert(missing.ok === false && missing.code === 'NOT_FOUND' && typeof missing.reason === 'string', 'adopting a missing claim is a typed NOT_FOUND failure');
});

await check('releaseClaim: NOT_OWNER for the old session after adoption, owner release removes the file, NOT_FOUND after', async () => {
  const denied = releaseClaim(claimsRoot, 'sess-a', 'cell-2');
  assert(denied.ok === false && denied.code === 'NOT_OWNER' && typeof denied.reason === 'string', 'old owner can no longer release — typed NOT_OWNER');
  assert(denied.reason.includes('sess-b'), 'NOT_OWNER reason names the actual owner');
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-2')), 'claim untouched by a denied release');
  const released = releaseClaim(claimsRoot, 'sess-b', 'cell-2');
  assert(released.ok === true, 'owner release ok');
  assert(!fs.existsSync(claimPath(claimsRoot, 'cell-2')), 'claim file removed on release');
  assert(!fs.existsSync(claimGatePath(claimsRoot, 'cell-2')), 'no gate file leaked by release');
  const gone = releaseClaim(claimsRoot, 'sess-b', 'cell-2');
  assert(gone.ok === false && gone.code === 'NOT_FOUND', 'releasing a missing claim is a typed NOT_FOUND failure');
});

await check('claimCellFile default TTL matches the exported constant; released cell is claimable again', async () => {
  const again = claimCellFile(claimsRoot, 'sess-b', 'cell-2');
  assert(again.ok === true, 'released cell claimable again');
  assert(again.claim.ttl_seconds === DEFAULT_CLAIM_TTL_SECONDS, 'default ttl applied');
  releaseClaim(claimsRoot, 'sess-b', 'cell-2');
});

// ─── D3: resolveSessionId — explicit flag -> CLAUDE_CODE_SESSION_ID env -> null ──

await check('resolveSessionId: explicit flag wins over env; a blank flag falls through to env; neither present resolves null', async () => {
  const savedEnv = process.env.CLAUDE_CODE_SESSION_ID;
  try {
    process.env.CLAUDE_CODE_SESSION_ID = 'sess-from-env';
    assert(resolveSessionId({ flag: 'sess-from-flag' }) === 'sess-from-flag', 'explicit flag takes precedence over env');
    assert(resolveSessionId({ flag: '' }) === 'sess-from-env', 'a blank flag falls through to env, not treated as an explicit empty session');
    assert(resolveSessionId({ flag: '   ' }) === 'sess-from-env', 'a whitespace-only flag falls through to env too');
    assert(resolveSessionId({}) === 'sess-from-env', 'no flag at all resolves from env');
    delete process.env.CLAUDE_CODE_SESSION_ID;
    assert(resolveSessionId({}) === null, 'neither flag nor env present resolves null');
    assert(resolveSessionId() === null, 'called with no argument at all still resolves null, never throws');
  } finally {
    if (savedEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = savedEnv;
  }
});

// ─── D1 Δ2: sessionless claims — claimCellFile/releaseClaim/clearClaim ─────

await check('claimCellFile(root, null, ...): a sessionless claim omits the "session" key entirely (never null) and still race-serializes via O_EXCL', async () => {
  const first = claimCellFile(claimsRoot, null, 'cell-sessionless', 60);
  assert(first.ok === true, 'sessionless claim succeeds');
  assert(!('session' in first.claim), 'the claim record omits "session" entirely rather than writing session:null');
  const onDisk = readClaim(claimsRoot, 'cell-sessionless');
  assert(!('session' in onDisk), 'the on-disk claim record also omits "session"');
  const second = claimCellFile(claimsRoot, 'sess-intruder', 'cell-sessionless', 60);
  assert(second.ok === false && second.code === 'CLAIMED', 'a second (session-bearing) claimant still loses to the sessionless winner');
  assert(second.reason.includes('no session (sessionless claim)'), `CLAIMED reason should name the sessionless holder, got ${JSON.stringify(second.reason)}`);
});

await check('releaseClaim(root, null, ...) releases a sessionless claim; a real session cannot release someone else\'s sessionless claim', async () => {
  const deniedByRealSession = releaseClaim(claimsRoot, 'sess-intruder', 'cell-sessionless');
  assert(deniedByRealSession.ok === false && deniedByRealSession.code === 'NOT_OWNER', 'a real session id can never release a sessionless claim it does not own');
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-sessionless')), 'claim untouched by the denied release');
  const released = releaseClaim(claimsRoot, null, 'cell-sessionless');
  assert(released.ok === true, 'the sessionless owner (null) can release its own claim');
  assert(!fs.existsSync(claimPath(claimsRoot, 'cell-sessionless')), 'claim file removed');
});

await check('clearClaim: unconditional removal regardless of owner; no-ops (ok:true, released:null) when there is no claim file; never leaks a gate file', async () => {
  const noClaim = clearClaim(claimsRoot, 'cell-never-claimed');
  assert(noClaim.ok === true && noClaim.released === null, `clearing a cell with no claim file must no-op, got ${JSON.stringify(noClaim)}`);

  claimCellFile(claimsRoot, 'sess-owner', 'cell-to-clear', 60);
  assert(fs.existsSync(claimPath(claimsRoot, 'cell-to-clear')), 'precondition: claim file exists');
  // clearClaim needs no owner argument at all — a DIFFERENT actor (or none)
  // still removes it; this is what cap/unclaim/block/drop/reopen rely on.
  const cleared = clearClaim(claimsRoot, 'cell-to-clear');
  assert(cleared.ok === true && cleared.released && cleared.released.session === 'sess-owner', `clearClaim must remove regardless of caller, got ${JSON.stringify(cleared)}`);
  assert(!fs.existsSync(claimPath(claimsRoot, 'cell-to-clear')), 'claim file removed');
  assert(!fs.existsSync(claimGatePath(claimsRoot, 'cell-to-clear')), 'no gate file leaked by clearClaim');
});

fs.rmSync(claimsRoot, { recursive: true, force: true });

// ─── claims: concurrent Worker races (fsh-2) ───────────────────────────────
// The entire race lives inside race_claims_child.mjs as a self-contained
// orchestrator (starts its own barrier-synchronized Worker racers, asserts
// internally, exits 0/1 with a one-line summary). The outer module entrypoint
// uses the shared serialized runner; only the racers themselves are concurrent.

const raceChildScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'race_claims_child.mjs',
);

function runRaceScenario(scenario) {
  return runModuleWorker(raceChildScript, { args: [scenario], timeout: 60000 });
}

await check('race: claim-contention — concurrent workers racing one cell, exactly one O_EXCL winner every round', async () => {
  const result = await runRaceScenario('claim-contention');
  assert(result.status === 0, `claim-contention race failed (status ${result.status}): ${result.stdout}${result.stderr}`);
  assert(/^PASS +claim-contention/m.test(result.stdout), `expected a PASS summary line, got: ${result.stdout}`);
});

await check('race: adoption-steal — a third session cannot steal a cell mid-adoption; every attempt loses with typed CLAIMED', async () => {
  const result = await runRaceScenario('adoption-steal');
  assert(result.status === 0, `adoption-steal race failed (status ${result.status}): ${result.stdout}${result.stderr}`);
  assert(/^PASS +adoption-steal/m.test(result.stdout), `expected a PASS summary line, got: ${result.stdout}`);
});

await check('race: sweep-heartbeat — concurrent sweepExpiredClaims + heartbeat renewal never reclaims a live claim (20260710)', async () => {
  const result = await runRaceScenario('sweep-heartbeat');
  assert(result.status === 0, `sweep-heartbeat race failed (status ${result.status}): ${result.stdout}${result.stderr}`);
  assert(/^PASS +sweep-heartbeat/m.test(result.stdout), `expected a PASS summary line, got: ${result.stdout}`);
});

printSummaryAndExit();
