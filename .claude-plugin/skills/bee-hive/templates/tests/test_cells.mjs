#!/usr/bin/env node
// test_cells.mjs — cells.mjs contract tests (add/update/claim/cap/budgets/judge/
// claim-next + cells-archive/hardening-1 satellites), split out of test_lib.mjs
// (cs-2a) to shrink the monolith. Same PASS/FAIL/exit-1 contract as every other
// suite here — see scripts/lib/test-fixture.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
import {
  readState,
  writeState,
  isKnownPhase,
  bypassLevel,
} from '../lib/state.mjs';
import {
  addCell,
  addCells,
  updateCell,
  readCell,
  listCells,
  cellsArchiveDir,
  resolveCellFile,
  archiveFeature,
  archivedSummary,
  readyCells,
  claimCell,
  recordVerify,
  capCell,
  blockCell,
  dropCell,
  unclaimCell,
  reopenCell,
  claimNextCell,
  claimCellCrossSession,
  normalizeFailureSignature,
  resetCellBudget,
  resolveCellBudgets,
  checkCellBudgets,
  deriveChangeClass,
  CHANGE_CLASSES,
} from '../lib/cells.mjs';
import { claimCellFile, readClaim, claimPath } from '../lib/claims.mjs';
import { activeDecisions } from '../lib/decisions.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';

const root = makeTempRepo();

// Self-containment fix (cs-2a split): makeStateRepo is defined in test_lib.mjs's
// "bee.mjs state CLI" section (a section that stays behind for cs-2b) and was
// only reachable here via function-declaration hoisting across the whole
// monolith. The budget-audit-order / gate-bypass / claim-next-budget rows
// below need a throwaway repo distinct from the shared `root`, so this is a
// verbatim copy of that helper — same shape, same behavior, zero check
// weakened.
function makeStateRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  return dir;
}

// Self-containment fix (cs-2a split): makeCellFile is defined in test_lib.mjs's
// "bee.mjs state start-feature" section (also staying behind for cs-2b) and,
// like makeStateRepo above, was only reachable here via hoisting. It fabricates
// a raw cell file (bypassing addCell's validation) so the budget/claim-next
// rows below can seed a specific trace.attempts shape directly — verbatim
// copy, same shape, zero check weakened.
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

// ─── cells: add validation ──────────────────────────────────────────────────

await check('addCell rejects an invalid lane', async () => {
  assertThrows(() => addCell(root, makeCell('bad-lane', { lane: 'huge' })), 'lane', 'invalid lane');
});

await check('addCell rejects standard lane without must_haves.truths', async () => {
  assertThrows(
    () => addCell(root, makeCell('std-1', { lane: 'standard' })),
    'must_haves',
    'standard lane needs truths',
  );
});

await check('addCell accepts a valid small cell and a standard cell with truths', async () => {
  addCell(root, makeCell('demo-1'));
  addCell(
    root,
    makeCell('demo-2', {
      lane: 'standard',
      deps: ['demo-1'],
      must_haves: { truths: ['Users see X'], artifacts: [], key_links: [], prohibitions: [] },
    }),
  );
  assert(readCell(root, 'demo-1') !== null, 'demo-1 should exist');
  assert(readCell(root, 'demo-2') !== null, 'demo-2 should exist');
});

// ─── cells: batch add (cells-batch-add) ─────────────────────────────────────

await check('addCells creates every cell of a valid batch in one call', async () => {
  const added = addCells(root, [makeCell('batch-1'), makeCell('batch-2'), makeCell('batch-3')]);
  assert(added.length === 3, 'three cells returned');
  for (const id of ['batch-1', 'batch-2', 'batch-3']) {
    assert(readCell(root, id) !== null, `${id} should exist`);
  }
});

await check('addCells is all-or-nothing: one invalid cell in the batch writes zero files', async () => {
  assertThrows(
    () => addCells(root, [makeCell('batch-x1'), makeCell('batch-x2', { lane: 'huge' }), makeCell('batch-x3')]),
    'lane',
    'invalid lane in the middle of the batch refuses',
  );
  for (const id of ['batch-x1', 'batch-x2', 'batch-x3']) {
    assert(readCell(root, id) === null, `${id} must not exist after a failed batch`);
  }
});

await check('addCells refuses a duplicate id within the batch, nothing written', async () => {
  assertThrows(
    () => addCells(root, [makeCell('batch-dup'), makeCell('batch-dup')]),
    'duplicate',
    'in-batch duplicate id refuses',
  );
  assert(readCell(root, 'batch-dup') === null, 'batch-dup must not exist');
});

await check('addCells refuses a non-array and an empty array', async () => {
  assertThrows(() => addCells(root, makeCell('batch-notarray')), 'array', 'plain object refused');
  assertThrows(() => addCells(root, []), 'array', 'empty array refused');
});

// ─── cells: dependency-cycle refusal at every dep-mutating write (D2, ────────
// parallel-scheduler-2) — addCell, addCells, updateCell-when-deps-change all
// refuse fail-fast, all-or-nothing, before any writeCell. File overlap is
// NEVER checked here (D2: overlap stays legal, only cycles are illegal) —
// isolated temp roots so this section's ids never interact with the shared
// `root` used above/below.

function cycMakeCell(id, extra = {}) {
  return makeCell(id, { feature: 'cyc-demo', ...extra });
}

await check('addCells refuses an in-batch cycle (a<->b), nothing written, message names both ids', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-batch-'));
  try {
    assertThrows(
      () =>
        addCells(cRoot, [
          cycMakeCell('cyc-a', { deps: ['cyc-b'] }),
          cycMakeCell('cyc-b', { deps: ['cyc-a'] }),
        ]),
      'cycle',
      'in-batch two-cycle refused',
    );
    assertThrows(
      () =>
        addCells(cRoot, [
          cycMakeCell('cyc-a2', { deps: ['cyc-b2'] }),
          cycMakeCell('cyc-b2', { deps: ['cyc-a2'] }),
        ]),
      'cyc-a2',
      'refusal message names the cycle ids',
    );
    assert(readCell(cRoot, 'cyc-a') === null, 'cyc-a must not exist — batch refused before any write');
    assert(readCell(cRoot, 'cyc-b') === null, 'cyc-b must not exist — batch refused before any write');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('addCell refuses a cycle formed against an existing on-disk cell (batch-vs-disk)', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-disk-'));
  try {
    addCell(cRoot, cycMakeCell('cyc-disk-a', { deps: ['cyc-disk-b'] }));
    // cyc-disk-b does not exist yet — cyc-disk-a's dep is merely unsatisfiable
    // so far (no cycle: an unknown id can never close one). Adding cyc-disk-b
    // with a dep back on cyc-disk-a closes it against the ON-DISK cell.
    assertThrows(
      () => addCell(cRoot, cycMakeCell('cyc-disk-b', { deps: ['cyc-disk-a'] })),
      'cycle',
      'new cell forming a cycle with an on-disk cell is refused',
    );
    assert(readCell(cRoot, 'cyc-disk-b') === null, 'cyc-disk-b must not exist — refused before write');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('addCell refuses a self-dependency (a lists itself in deps)', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-self-'));
  try {
    assertThrows(
      () => addCell(cRoot, cycMakeCell('cyc-self', { deps: ['cyc-self'] })),
      'cycle',
      'self-dep refused',
    );
    assert(readCell(cRoot, 'cyc-self') === null, 'cyc-self must not exist');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('updateCell refuses a patch that reintroduces a cycle via deps; the cell is untouched', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-update-'));
  try {
    addCell(cRoot, cycMakeCell('cyc-upd-a', { deps: [] }));
    addCell(cRoot, cycMakeCell('cyc-upd-b', { deps: ['cyc-upd-a'] }));
    const before = readCell(cRoot, 'cyc-upd-a');
    await assertRejects(
      () => updateCell(cRoot, 'cyc-upd-a', { deps: ['cyc-upd-b'] }),
      'cycle',
      'update that closes a<->b via deps is refused',
    );
    const after = readCell(cRoot, 'cyc-upd-a');
    assert(JSON.stringify(after) === JSON.stringify(before), 'cyc-upd-a must be byte-unchanged after the refused update');
    // A field edit that does NOT touch deps is untouched by the cycle check —
    // proves the check is deps-gated, not a blanket re-validation.
    const ok = await updateCell(cRoot, 'cyc-upd-a', { title: 'renamed, no deps change' });
    assert(ok.title === 'renamed, no deps change', 'non-deps patch still applies normally');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('addCell over a store with pre-existing unsatisfiable deps (missing/blocked/dropped) still succeeds — never mistaken for a cycle', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-unsat-'));
  try {
    addCell(cRoot, cycMakeCell('cyc-unsat-blocked', { deps: [] }));
    await updateCell(cRoot, 'cyc-unsat-blocked', { title: 'still open' }); // no-op sanity
    // Simulate a blocked cell directly (blockCell requires the cell to exist first).
    await blockCell(cRoot, 'cyc-unsat-blocked', 'unrelated reason');
    addCell(cRoot, cycMakeCell('cyc-unsat-dropped', { deps: [] }));
    await dropCell(cRoot, 'cyc-unsat-dropped', 'unrelated reason');
    // A brand-new cell depending on a missing id, plus the blocked/dropped
    // cells above, plus a dep on a capped cell (satisfied) — none of this is
    // structurally a cycle; it must add cleanly.
    addCell(cRoot, cycMakeCell('cyc-unsat-new', { deps: ['cyc-unsat-blocked', 'cyc-unsat-dropped', 'cyc-unsat-missing'] }));
    assert(readCell(cRoot, 'cyc-unsat-new') !== null, 'cyc-unsat-new must be added — unsatisfiable deps are not cycles');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('a pre-existing on-disk cycle (legacy store) never blocks unrelated writes; a write participating in it is still refused (parallel-scheduler-5)', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-legacy-'));
  try {
    // Simulate a legacy (pre-guard, ≤0.1.42) store: hand-write a cyclic pair
    // directly on disk, bypassing addCell — the shape an upgraded host can
    // legitimately carry. D2 scopes the WRITE refusal to cycles the write
    // introduces or participates in; pre-existing cycles are `cells schedule`
    // diagnostics, never a store-wide write freeze.
    const dir = path.join(cRoot, '.bee', 'cells');
    fs.mkdirSync(dir, { recursive: true });
    for (const [id, dep] of [['cyc-legacy-a', 'cyc-legacy-b'], ['cyc-legacy-b', 'cyc-legacy-a']]) {
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(cycMakeCell(id, { deps: [dep] })));
    }
    // Unrelated acyclic add in another feature succeeds despite the legacy cycle.
    addCell(cRoot, makeCell('cyc-legacy-new', { feature: 'other-feature' }));
    assert(readCell(cRoot, 'cyc-legacy-new') !== null, 'unrelated add must succeed despite a legacy cycle elsewhere');
    // Unrelated deps patch succeeds too.
    const upd = await updateCell(cRoot, 'cyc-legacy-new', { deps: ['cyc-legacy-missing'] });
    assert(upd.deps.length === 1, 'unrelated deps patch must apply despite a legacy cycle elsewhere');
    // A patch on a cycle MEMBER that keeps the cycle closed is still refused…
    await assertRejects(
      () => updateCell(cRoot, 'cyc-legacy-a', { deps: ['cyc-legacy-b', 'cyc-legacy-missing'] }),
      'cycle',
      'a deps patch that keeps the cell inside the cycle is refused',
    );
    // …while a patch that BREAKS the cycle applies cleanly (the fix path).
    const healed = await updateCell(cRoot, 'cyc-legacy-a', { deps: [] });
    assert(healed.deps.length === 0, 'a deps patch that breaks the legacy cycle must be allowed');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('addCells: file overlap between two batch cells is NOT refused (D2 — only cycles are illegal)', async () => {
  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cycle-overlap-'));
  try {
    const added = addCells(cRoot, [
      cycMakeCell('cyc-ov-a', { files: ['shared.mjs'] }),
      cycMakeCell('cyc-ov-b', { files: ['shared.mjs'] }),
    ]);
    assert(added.length === 2, 'both overlapping cells are added — overlap is legal per D2');
  } finally {
    fs.rmSync(cRoot, { recursive: true, force: true });
  }
});

await check('bee.mjs cells add CLI: a JSON array on --stdin creates the whole slice in one call', async () => {
  const cliPath = fileURLToPath(new URL('../bee.mjs', import.meta.url));
  const batch = [makeCell('batch-cli-1'), makeCell('batch-cli-2')];
  const ok = await runModuleWorker(cliPath, {
    args: ['cells', 'add', '--stdin'],
    cwd: root,
    input: JSON.stringify(batch),
  });
  assert(ok.status === 0, `batch add CLI exits 0, got ${ok.status}: ${ok.stderr}`);
  assert(ok.stdout.includes('Added batch-cli-1') && ok.stdout.includes('Added batch-cli-2'), 'every added id reported');
  assert(readCell(root, 'batch-cli-1') !== null && readCell(root, 'batch-cli-2') !== null, 'both cells exist');
  const single = await runModuleWorker(cliPath, {
    args: ['cells', 'add', '--stdin'],
    cwd: root,
    input: JSON.stringify(makeCell('batch-cli-single')),
  });
  assert(single.status === 0, `single-object add still exits 0, got ${single.status}: ${single.stderr}`);
  assert(readCell(root, 'batch-cli-single') !== null, 'single-object path unchanged');
});

// ─── cells: update verb (cells-update-verb) ─────────────────────────────────

await check('updateCell lands patched fields on an open cell; unpatched fields, status, trace byte-stable', async () => {
  addCell(root, makeCell('upd-1', { action: 'Old action per D1.' }));
  const before = readCell(root, 'upd-1');
  const updated = await updateCell(root, 'upd-1', { action: 'New action per D2.', files: ['a.txt'] });
  assert(updated.action === 'New action per D2.', 'action updated');
  assert(updated.files.length === 1 && updated.files[0] === 'a.txt', 'files updated');
  assert(updated.title === before.title, 'unpatched field unchanged');
  assert(updated.status === before.status, 'status unchanged');
  assert(JSON.stringify(updated.trace) === JSON.stringify(before.trace), 'trace unchanged');
});

await check('updateCell works on a blocked cell (rescue path), refuses an empty patch', async () => {
  addCell(root, makeCell('upd-2', { status: 'blocked' }));
  const updated = await updateCell(root, 'upd-2', { verify: 'node -e "process.exit(0)" # v2' });
  assert(updated.verify.includes('v2'), 'verify updated on blocked cell');
  await assertRejects(() => updateCell(root, 'upd-2', {}), 'empty', 'empty patch refused');
});

await check('updateCell refuses claimed, capped, and dropped cells with the file byte-unchanged', async () => {
  for (const status of ['claimed', 'capped', 'dropped']) {
    const id = `upd-door-${status}`;
    addCell(root, makeCell(id, { status }));
    const file = path.join(root, '.bee', 'cells', `${id}.json`);
    const before = fs.readFileSync(file, 'utf8');
    await assertRejects(() => updateCell(root, id, { title: 'nope' }), status, `${status} cell refused`);
    assert(fs.readFileSync(file, 'utf8') === before, `${id} file byte-unchanged after refusal`);
  }
});

await check('updateCell refuses every frozen key and unknown keys — whole patch, file untouched', async () => {
  addCell(root, makeCell('upd-3'));
  const file = path.join(root, '.bee', 'cells', 'upd-3.json');
  const before = fs.readFileSync(file, 'utf8');
  for (const key of ['id', 'feature', 'status', 'trace', 'tier']) {
    await assertRejects(
      () => updateCell(root, 'upd-3', { title: 'ok', [key]: 'x' }),
      'frozen',
      `frozen key ${key} refuses the whole patch`,
    );
  }
  await assertRejects(() => updateCell(root, 'upd-3', { totally_new: 1 }), 'unknown field', 'unknown key refused');
  await assertRejects(() => updateCell(root, 'upd-3', { title: '' }), 'non-empty string', 'invalid value refused');
  assert(fs.readFileSync(file, 'utf8') === before, 'upd-3 file untouched after all refusals');
});

await check('updateCell fails closed on a present-but-corrupt cell file and on a missing cell', async () => {
  const file = path.join(root, '.bee', 'cells', 'upd-corrupt.json');
  fs.writeFileSync(file, '{ not json');
  await assertRejects(() => updateCell(root, 'upd-corrupt', { title: 'x' }), 'not valid JSON', 'corrupt cell refused');
  assert(fs.readFileSync(file, 'utf8') === '{ not json', 'corrupt file untouched');
  fs.rmSync(file);
  await assertRejects(() => updateCell(root, 'upd-nope', { title: 'x' }), 'not found', 'missing cell refused');
});

await check('updateCell re-checks the standard/high-risk truths invariant on the merged result', async () => {
  addCell(root, makeCell('upd-4', { lane: 'standard', must_haves: { truths: ['t1'] } }));
  await assertRejects(
    () => updateCell(root, 'upd-4', { must_haves: { truths: [] } }),
    'truths',
    'emptied truths refused',
  );
  const ok = await updateCell(root, 'upd-4', { must_haves: { truths: ['t1', 't2'] } });
  assert(ok.must_haves.truths.length === 2, 'valid must_haves patch lands');
  await assertRejects(
    () => updateCell(root, 'upd-1', { lane: 'standard' }),
    'truths',
    'lane upgrade without truths refused',
  );
});

await check('bee.mjs cells update CLI: --file works one-line; unknown flag and missing --id refuse', async () => {
  const cliPath = fileURLToPath(new URL('../bee.mjs', import.meta.url));
  addCell(root, makeCell('upd-cli-1'));
  const patchFile = path.join(root, 'upd-cli-patch.json');
  fs.writeFileSync(patchFile, JSON.stringify({ title: 'CLI updated title' }));
  const ok = await runModuleWorker(cliPath, {
    args: ['cells', 'update', '--id', 'upd-cli-1', '--file', patchFile],
    cwd: root,
  });
  assert(ok.status === 0, `update CLI exits 0, got ${ok.status}: ${ok.stderr}`);
  assert(ok.stdout.includes('Updated upd-cli-1'), 'one-line confirmation printed');
  assert(readCell(root, 'upd-cli-1').title === 'CLI updated title', 'patch landed via CLI');
  const badFlag = await runModuleWorker(cliPath, {
    args: ['cells', 'update', '--id', 'upd-cli-1', '--file', patchFile, '--dry-run', 'x'],
    cwd: root,
  });
  assert(badFlag.status !== 0, 'unknown flag refuses');
  const noId = await runModuleWorker(cliPath, {
    args: ['cells', 'update', '--file', patchFile],
    cwd: root,
  });
  assert(noId.status !== 0, 'missing --id refuses');
});

// ─── cells: gate-locked claiming + deps ─────────────────────────────────────

await check('claimCell refuses while gate execution is false', async () => {
  await assertRejects(() => claimCell(root, 'demo-1', 'worker-a'), 'execution', 'gate lock');
});

await check('readyCells excludes cells with uncapped deps', async () => {
  const ready = readyCells(root, 'demo');
  const ids = ready.map((cell) => cell.id);
  assert(ids.includes('demo-1'), 'demo-1 should be ready');
  assert(!ids.includes('demo-2'), 'demo-2 depends on uncapped demo-1');
});

// ─── cells-archive-1: regression net pinning CURRENT listCells/readCell/ ───
// readyCells/depsAllCapped behavior over an isolated fixture, GREEN BEFORE any
// archive-fallback changes land (crit-pattern 20260714: net first). depsAllCapped
// itself is unexported — exercised indirectly through readyCells, its only caller
// besides claimCell. Every case below must stay byte-identical once the archive
// lookup lands (no archive dir exists in these fixtures).

await check('listCells (pre-archive baseline): sorted by id, feature/status filters, tolerant of an unparseable sibling file', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-list-'));
  try {
    addCell(aRoot, makeCell('arc-b', { feature: 'arc-feat' }));
    addCell(aRoot, makeCell('arc-a', { feature: 'arc-feat' }));
    addCell(aRoot, makeCell('arc-c', { feature: 'other-feat' }));
    // A non-JSON sibling and an unparseable .json sibling must both be skipped
    // tolerantly, never thrown.
    fs.writeFileSync(path.join(aRoot, '.bee', 'cells', 'garbage.json'), '{ not json');
    fs.writeFileSync(path.join(aRoot, '.bee', 'cells', 'notes.txt'), 'not a cell');
    const all = listCells(aRoot);
    assert(
      all.map((c) => c.id).join(',') === 'arc-a,arc-b,arc-c',
      `sorted by id, unparseable siblings skipped, got ${all.map((c) => c.id).join(',')}`,
    );
    const byFeature = listCells(aRoot, { feature: 'arc-feat' });
    assert(byFeature.map((c) => c.id).join(',') === 'arc-a,arc-b', 'feature filter narrows and stays sorted');
    const byStatus = listCells(aRoot, { status: 'open' });
    assert(byStatus.length === 3, 'status filter matches the all-open fixture');
    assert(listCells(aRoot, { status: 'capped' }).length === 0, 'status filter excludes non-matching cells');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('readCell (pre-archive baseline): returns the cell object for an existing id, null for a missing id', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-readcell-'));
  try {
    addCell(aRoot, makeCell('arc-rd-1'));
    const got = readCell(aRoot, 'arc-rd-1');
    assert(got && got.id === 'arc-rd-1', 'existing cell returned');
    assert(readCell(aRoot, 'arc-rd-missing') === null, 'missing cell returns null, not a throw');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('readyCells/depsAllCapped (pre-archive baseline): excludes an open cell whose dep is not capped or is missing; includes it once the dep is capped', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-ready-'));
  try {
    addCell(aRoot, makeCell('arc-dep-base', { feature: 'arc-ready' }));
    addCell(aRoot, makeCell('arc-dep-child', { feature: 'arc-ready', deps: ['arc-dep-base'] }));
    addCell(
      aRoot,
      makeCell('arc-dep-missing-child', { feature: 'arc-ready', deps: ['arc-dep-nope'] }),
    );
    let ready = readyCells(aRoot, 'arc-ready').map((c) => c.id);
    assert(ready.includes('arc-dep-base'), 'base cell (no deps) is ready');
    assert(!ready.includes('arc-dep-child'), 'child excluded — its dep is not capped');
    assert(!ready.includes('arc-dep-missing-child'), 'child with a missing dep excluded too');

    const state = readState(aRoot);
    state.approved_gates.execution = true;
    writeState(aRoot, state);
    await claimCell(aRoot, 'arc-dep-base', 'worker-arc');
    await recordVerify(aRoot, 'arc-dep-base', { command: 'true', output: 'ok', passed: true });
    await capCell(aRoot, 'arc-dep-base', { files_changed: ['x.txt'], outcome: 'done' });

    ready = readyCells(aRoot, 'arc-ready').map((c) => c.id);
    assert(ready.includes('arc-dep-child'), 'child now ready — its dep is capped');
    assert(!ready.includes('arc-dep-missing-child'), 'still excluded — its dep is still missing');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

// ─── cells-archive-1: archive-aware lookup (cellsArchiveDir, readCell/────────
// resolveCellFile fallback, listCells includeArchived) — the actual new
// behavior, layered on top of the pinned baseline above.

await check('cellsArchiveDir composes .bee/cells/archive/<feature>/, and readCell/resolveCellFile fall back there when the active file is absent', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-fallback-'));
  try {
    assert(
      cellsArchiveDir(aRoot, 'shipped-feat') === path.join(aRoot, '.bee', 'cells', 'archive', 'shipped-feat'),
      'cellsArchiveDir composes the expected path',
    );
    // A cell that exists ONLY under the archive tree (simulating a later
    // archive-move cell), never written to the active .bee/cells/ dir.
    const archived = makeCell('arc-fb-1', { feature: 'shipped-feat', status: 'capped' });
    const archiveDir = cellsArchiveDir(aRoot, 'shipped-feat');
    // recursive:true also creates the .bee/cells/ parent — no active file for
    // arc-fb-1 exists anywhere under it, only this archived one.
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, 'arc-fb-1.json'), JSON.stringify(archived));

    const found = readCell(aRoot, 'arc-fb-1');
    assert(found && found.id === 'arc-fb-1' && found.status === 'capped', 'readCell falls back to the archive tree once .bee/cells/ exists');
    assert(readCell(aRoot, 'arc-fb-missing') === null, 'a truly nonexistent id (active nor archived) still returns null');

    const resolved = resolveCellFile(aRoot, 'arc-fb-1');
    assert(resolved === path.join(archiveDir, 'arc-fb-1.json'), 'resolveCellFile names the REAL archive path for an archived-only cell');
    assert(resolveCellFile(aRoot, 'arc-fb-missing') === null, 'resolveCellFile returns null for a cell in neither tree');

    // cellFile's own meaning (the active path) is unchanged — adding the
    // active-side cell now must make readCell/resolveCellFile prefer it.
    addCell(aRoot, makeCell('arc-fb-2', { feature: 'shipped-feat' }));
    assert(resolveCellFile(aRoot, 'arc-fb-2') === path.join(aRoot, '.bee', 'cells', 'arc-fb-2.json'), 'resolveCellFile prefers the active file when present');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('readCell fallback is byte-identical to today when no archive dir exists at all (no throw, missing stays null)', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-none-'));
  try {
    addCell(aRoot, makeCell('arc-noarc-1'));
    assert(readCell(aRoot, 'arc-noarc-1') !== null, 'active cell still resolves with no archive dir present');
    assert(readCell(aRoot, 'arc-noarc-missing') === null, 'missing cell returns null, not a throw, with no archive dir present');
    assert(resolveCellFile(aRoot, 'arc-noarc-missing') === null, 'resolveCellFile also returns null, never throws, with no archive dir present');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('listCells default scans ONLY the active .bee/cells/ dir (skips archive/), includeArchived:true folds in archived cells too, same sorted shape', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-net-listarchived-'));
  try {
    addCell(aRoot, makeCell('arc-lst-b', { feature: 'arc-lst-feat' }));
    addCell(aRoot, makeCell('arc-lst-d', { feature: 'arc-lst-feat' }));
    const archiveDir = cellsArchiveDir(aRoot, 'arc-lst-feat');
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(
      path.join(archiveDir, 'arc-lst-a.json'),
      JSON.stringify(makeCell('arc-lst-a', { feature: 'arc-lst-feat', status: 'capped' })),
    );
    fs.writeFileSync(
      path.join(archiveDir, 'arc-lst-c.json'),
      JSON.stringify(makeCell('arc-lst-c', { feature: 'arc-lst-feat', status: 'capped' })),
    );

    const activeOnly = listCells(aRoot, { feature: 'arc-lst-feat' });
    assert(
      activeOnly.map((c) => c.id).join(',') === 'arc-lst-b,arc-lst-d',
      `default listCells must skip archive/ entirely, got ${activeOnly.map((c) => c.id).join(',')}`,
    );

    const withArchived = listCells(aRoot, { feature: 'arc-lst-feat', includeArchived: true });
    assert(
      withArchived.map((c) => c.id).join(',') === 'arc-lst-a,arc-lst-b,arc-lst-c,arc-lst-d',
      `includeArchived:true folds in archived cells, same sorted-by-id shape, got ${withArchived.map((c) => c.id).join(',')}`,
    );

    const archivedCappedOnly = listCells(aRoot, { feature: 'arc-lst-feat', includeArchived: true, status: 'capped' });
    assert(
      archivedCappedOnly.map((c) => c.id).join(',') === 'arc-lst-a,arc-lst-c',
      'status filter applies to archived cells too',
    );
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

// ─── hardening-1: P0 data-loss hardening for archiveFeature/unarchiveFeature
// (slug/containment validation, capped|dropped allowlist, atomic rollback,
// and the mutate-an-archived-cell fork guard). Each case below was RED
// against the pre-hardening code (see cell hardening-1 report) — the point of
// this net is that it stays green as the fix lands, not merely that it
// exists.

await check('archiveFeature refuses a path-traversal feature slug and moves nothing (P0 containment)', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-hard-traversal-'));
  try {
    const evilFeature = '../escape';
    const cellsDirPath = path.join(aRoot, '.bee', 'cells');
    fs.mkdirSync(cellsDirPath, { recursive: true });
    fs.writeFileSync(
      path.join(cellsDirPath, 'trav-1.json'),
      JSON.stringify(makeCell('trav-1', { feature: evilFeature, status: 'capped' })),
    );

    await assertRejects(
      () => archiveFeature(aRoot, evilFeature),
      'invalid feature',
      'a feature slug containing ".." / "/" must be refused before any move',
    );
    assert(fs.existsSync(path.join(cellsDirPath, 'trav-1.json')), 'cell file untouched after refusal');
    assert(
      !fs.existsSync(path.join(cellsDirPath, 'escape')),
      'no directory created outside the archive tree for the escaped path',
    );
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('archiveFeature refuses a feature containing a blocked cell — only ALL-capped/dropped features archive', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-hard-blocked-'));
  try {
    const cellsDirPath = path.join(aRoot, '.bee', 'cells');
    fs.mkdirSync(cellsDirPath, { recursive: true });
    fs.writeFileSync(
      path.join(cellsDirPath, 'blk-1.json'),
      JSON.stringify(makeCell('blk-1', { feature: 'blk-feat', status: 'capped' })),
    );
    fs.writeFileSync(
      path.join(cellsDirPath, 'blk-2.json'),
      JSON.stringify(makeCell('blk-2', { feature: 'blk-feat', status: 'blocked' })),
    );

    await assertRejects(
      () => archiveFeature(aRoot, 'blk-feat'),
      'blk-2 (blocked)',
      'a blocked sibling must refuse the whole archive, named in the error',
    );
    assert(fs.existsSync(path.join(cellsDirPath, 'blk-1.json')), 'capped sibling untouched — all-or-nothing refusal');
    assert(fs.existsSync(path.join(cellsDirPath, 'blk-2.json')), 'the blocked cell itself untouched');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('mutating an archived cell id (updateCell/claimCell/capCell) refuses "archived" and never forks a duplicate active file', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-hard-mutate-'));
  try {
    const cellsDirPath = path.join(aRoot, '.bee', 'cells');
    fs.mkdirSync(cellsDirPath, { recursive: true });
    fs.writeFileSync(
      path.join(cellsDirPath, 'mut-1.json'),
      JSON.stringify(makeCell('mut-1', { feature: 'mut-feat', status: 'capped' })),
    );
    fs.writeFileSync(
      path.join(cellsDirPath, 'mut-2.json'),
      JSON.stringify(makeCell('mut-2', { feature: 'mut-feat', status: 'capped' })),
    );

    const state = readState(aRoot);
    state.approved_gates.execution = true;
    writeState(aRoot, state);

    const archived = await archiveFeature(aRoot, 'mut-feat');
    assert(
      archived.moved.includes('mut-1') && archived.moved.includes('mut-2'),
      `both cells should be archived, got ${JSON.stringify(archived)}`,
    );
    const activePath = path.join(cellsDirPath, 'mut-1.json');
    assert(!fs.existsSync(activePath), 'sanity: the active copy is gone after archiving');
    assert(readCell(aRoot, 'mut-1') !== null, 'sanity: readCell still resolves the id via the archive fallback');

    await assertRejects(() => updateCell(aRoot, 'mut-1', { title: 'hack' }), 'archived', 'updateCell on an archived id refuses');
    assert(!fs.existsSync(activePath), 'updateCell must not fork a duplicate active file');

    await assertRejects(() => claimCell(aRoot, 'mut-1', 'worker-x'), 'archived', 'claimCell on an archived id refuses');
    assert(!fs.existsSync(activePath), 'claimCell must not fork a duplicate active file');

    await assertRejects(
      () => capCell(aRoot, 'mut-1', { files_changed: ['x'], outcome: 'done' }),
      'archived',
      'capCell on an archived id refuses',
    );
    assert(!fs.existsSync(activePath), 'capCell must not fork a duplicate active file');
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('archiveFeature is atomic: a mid-loop rename failure rolls back every already-moved file and leaves summary.json untouched', async () => {
  const aRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-archive-hard-rollback-'));
  try {
    const cellsDirPath = path.join(aRoot, '.bee', 'cells');
    fs.mkdirSync(cellsDirPath, { recursive: true });
    for (const id of ['roll-1', 'roll-2', 'roll-3']) {
      fs.writeFileSync(
        path.join(cellsDirPath, `${id}.json`),
        JSON.stringify(makeCell(id, { feature: 'roll-feat', status: 'capped' })),
      );
    }
    // listCells sorts by id, so the loop visits roll-1, roll-2, roll-3 in
    // that order. Pre-creating a DIRECTORY at roll-2's destination path makes
    // fs.renameSync throw EISDIR when the loop reaches the second cell —
    // 'file onto an existing directory' is refused by the OS rename(2) call
    // itself, a clean, deterministic, permission-free way to inject a
    // mid-loop failure without mocking fs.
    const archiveDir = cellsArchiveDir(aRoot, 'roll-feat');
    fs.mkdirSync(path.join(archiveDir, 'roll-2.json'), { recursive: true });

    await assertRejects(
      () => archiveFeature(aRoot, 'roll-feat'),
      'eisdir',
      'the injected mid-loop rename failure must propagate, not be swallowed',
    );

    assert(fs.existsSync(path.join(cellsDirPath, 'roll-1.json')), 'roll-1 (already moved) must be rolled back to active');
    assert(!fs.existsSync(path.join(archiveDir, 'roll-1.json')), 'roll-1 must not be left behind in the archive tree');
    assert(fs.existsSync(path.join(cellsDirPath, 'roll-2.json')), 'roll-2 (never moved — its slot was blocked) stays active');
    assert(fs.existsSync(path.join(cellsDirPath, 'roll-3.json')), 'roll-3 (never reached) stays active');
    assert(
      !('roll-feat' in archivedSummary(aRoot)),
      'summary.json must be untouched — it is written only after every move succeeds',
    );
  } finally {
    fs.rmSync(aRoot, { recursive: true, force: true });
  }
});

await check('claimCell refuses a cell with uncapped deps even after gate approval', async () => {
  const state = readState(root);
  state.phase = 'swarming';
  state.approved_gates.execution = true;
  writeState(root, state);
  await assertRejects(() => claimCell(root, 'demo-2', 'worker-a'), 'uncapped deps', 'dep lock');
});

await check('claimCell claims an open, dep-free cell', async () => {
  const cell = await claimCell(root, 'demo-1', 'worker-a');
  assert(cell.status === 'claimed', 'status should be claimed');
  assert(cell.trace.worker === 'worker-a', 'worker recorded');
});

// ─── D1: claimCellCrossSession is the path `cells claim --id` now runs ────
// through (bee.mjs handleCellsClaim) — the claim file is acquired BEFORE the
// cell JSON flips, so a losing concurrent claimant gets a typed CLAIMED
// refusal instead of silently double-claiming. D3: a null/absent sessionId is
// a legal sessionless claim (single-session use is unaffected).

await check('claimCellCrossSession backs "cells claim --id": winner claims both the cell JSON and the claims-store file; a second claimant on the SAME cell gets typed CLAIMED naming the winner + expiry, and the cell is untouched', async () => {
  addCell(root, makeCell('claimx-1'));
  const first = await claimCellCrossSession(root, { sessionId: 'sess-x1', worker: 'worker-x1', cellId: 'claimx-1' });
  assert(first.ok === true, `first claimant should win, got ${JSON.stringify(first)}`);
  assert(first.cell.status === 'claimed' && first.cell.trace.worker === 'worker-x1', 'cell JSON reflects the winner');
  assert(first.claim.session === 'sess-x1', 'claims-store file belongs to the winner');
  assert(readCell(root, 'claimx-1').status === 'claimed', 'on-disk cell is claimed');

  const second = await claimCellCrossSession(root, { sessionId: 'sess-x2', worker: 'worker-x2', cellId: 'claimx-1' });
  assert(second.ok === false && second.code === 'CLAIMED', `second claimant must lose with typed CLAIMED, got ${JSON.stringify(second)}`);
  assert(second.reason.includes('sess-x1'), 'refusal names the actual owner');
  assert(/expir/i.test(second.reason), 'refusal names the expiry');
  assert(readCell(root, 'claimx-1').trace.worker === 'worker-x1', 'the losing attempt never touched the cell JSON');
});

await check('claimCellCrossSession with sessionId null/undefined is a legal sessionless claim — the claim file omits "session" entirely; single-session flow (no env id) still claims successfully', async () => {
  addCell(root, makeCell('claimx-2'));
  const result = await claimCellCrossSession(root, { sessionId: null, worker: 'worker-sessionless', cellId: 'claimx-2' });
  assert(result.ok === true, `a null sessionId must still succeed, got ${JSON.stringify(result)}`);
  assert(!('session' in result.claim), 'the sessionless claim record omits "session" entirely');
  assert(result.cell.status === 'claimed', 'the cell is claimed regardless of session');
});

// ─── cells: verify-gated capping ────────────────────────────────────────────

await check('capCell refuses without a passing verify result', async () => {
  await assertRejects(() => capCell(root, 'demo-1', { outcome: 'done' }), 'verify', 'cap needs verify');
});

await check('capCell refuses when verify was recorded as failed', async () => {
  await recordVerify(root, 'demo-1', { command: 'npm test', output: '1 failing', passed: false });
  await assertRejects(() => capCell(root, 'demo-1', { outcome: 'done' }), 'verify', 'failed verify blocks cap');
});

await check('capCell refuses behavior_change without verification_evidence', async () => {
  await recordVerify(root, 'demo-1', { command: 'npm test', output: 'ok', passed: true });
  await assertRejects(
    () => capCell(root, 'demo-1', { behavior_change: true, outcome: 'done' }),
    'verification_evidence',
    'evidence contract',
  );
});

await check('capCell caps with passing verify + evidence, and unlocks dependents', async () => {
  const cell = await capCell(root, 'demo-1', {
    behavior_change: true,
    verification_evidence: {
      tests_added: ['x.test.js'],
      red_failure_evidence: 'demo-1: prior behavior seen failing before this change — git-show of the old state, captured at cap time for the D3 anti-boilerplate floor.',
      verification_run: 'npm test',
    },
    files_changed: ['src/x.js'],
    outcome: 'done',
  });
  assert(cell.status === 'capped', 'demo-1 capped');
  const ready = readyCells(root, 'demo').map((c) => c.id);
  assert(ready.includes('demo-2'), 'demo-2 becomes ready once its dep is capped');
});

await check('capCell on a high-risk cell requires files_changed and outcome', async () => {
  addCell(
    root,
    makeCell('hr-1', {
      lane: 'high-risk',
      must_haves: { truths: ['Auth still works'], artifacts: [], key_links: [], prohibitions: [] },
    }),
  );
  await claimCell(root, 'hr-1', 'worker-b');
  await recordVerify(root, 'hr-1', { command: 'npm test', output: '12 passing', passed: true });
  await assertRejects(() => capCell(root, 'hr-1', {}), 'high-risk', 'high-risk trace tier');
  await capCell(root, 'hr-1', { files_changed: ['src/auth.js'], outcome: 'auth guard added' });
  assert(readCell(root, 'hr-1').status === 'capped', 'hr-1 capped with full trace');
});

await check('capCell refuses a small cell whose verify has no output and no evidence (decision 0004)', async () => {
  addCell(root, makeCell('ev-1'));
  await claimCell(root, 'ev-1', 'worker-c');
  await recordVerify(root, 'ev-1', { command: 'npm test', passed: true }); // assertion, no output
  await assertRejects(
    () => capCell(root, 'ev-1', { files_changed: ['src/y.js'], outcome: 'done' }),
    'proof',
    'assertion-capping must be refused',
  );
});

await check('capCell refuses a small cell with proof but empty files_changed (decision 0004)', async () => {
  await recordVerify(root, 'ev-1', { command: 'npm test', output: '3 passing', passed: true });
  await assertRejects(
    () => capCell(root, 'ev-1', { outcome: 'done' }),
    'files_changed',
    'empty files_changed must be refused for small+',
  );
  await capCell(root, 'ev-1', { files_changed: ['src/y.js'], outcome: 'done' });
  assert(readCell(root, 'ev-1').status === 'capped', 'ev-1 caps once output + files recorded');
});

await check('tiny lane still caps on a passing verify alone (lanes scale strictness)', async () => {
  addCell(root, makeCell('tiny-1', { lane: 'tiny' }));
  await claimCell(root, 'tiny-1', 'worker-c');
  await recordVerify(root, 'tiny-1', { command: 'node -e "process.exit(0)"', passed: true });
  await capCell(root, 'tiny-1', { outcome: 'typo fixed' });
  assert(readCell(root, 'tiny-1').status === 'capped', 'tiny cell capped without output/files');
});

await check('capCell honors the cell-declared behavior_change when the flag is omitted (grooming fix)', async () => {
  addCell(root, makeCell('bc-decl', { behavior_change: true }));
  await claimCell(root, 'bc-decl', 'worker-c');
  await recordVerify(root, 'bc-decl', { command: 'npm test', output: 'ok', passed: true });
  // omitting the flag must NOT drop the declared behavior_change — cap still demands evidence
  await assertRejects(
    () => capCell(root, 'bc-decl', { files_changed: ['a.js'], outcome: 'done' }),
    'verification_evidence',
    'declared behavior_change is still enforced at cap when the flag is omitted',
  );
  const capped = await capCell(root, 'bc-decl', {
    files_changed: ['a.js'],
    outcome: 'done',
    verification_evidence: {
      red_failure_evidence: 'bc-decl: prior behavior characterized here before this change, distinct from the demo-1 fixture text, meeting the D3 anti-boilerplate floor.',
      verification_run: 'npm test',
    },
  });
  assert(capped.trace.behavior_change === true, 'trace.behavior_change carried from the cell declaration');
});

await check('isKnownPhase accepts the enum + terminal alias and rejects drift', async () => {
  assert(isKnownPhase('swarming') === true, 'enum phase accepted');
  assert(isKnownPhase('compounding-complete') === true, 'terminal alias accepted');
  assert(isKnownPhase('merged') === false, 'invented phase rejected');
});

await check('blockCell records the reason', async () => {
  addCell(root, makeCell('blk-1'));
  await blockCell(root, 'blk-1', 'reservation conflict');
  assert(readCell(root, 'blk-1').status === 'blocked', 'blk-1 blocked');
});

// ─── D1: revision ledger (trace.attempts) + failure-signature normalizer ──

await check('normalizeFailureSignature is deterministic for the same logical failure under timestamp/path/hex noise, and differs for a different failure', async () => {
  const a = 'FAIL 2026-07-19T10:22:03.451Z /home/alice/repo/src/foo.js assertion abc123def456 failed';
  const b = 'FAIL 2026-07-20T02:11:59Z /Users/bob/work/src/foo.js assertion 9f8e7d6c5b4a failed';
  const sigA = normalizeFailureSignature(a);
  const sigB = normalizeFailureSignature(b);
  assert(sigA === sigB, `same logical failure under timestamp/path/hex noise should normalize identically, got ${sigA} vs ${sigB}`);
  assert(/^[0-9a-f]{12}$/.test(sigA), `signature should be 12 lowercase hex chars, got "${sigA}"`);
  const different = normalizeFailureSignature('FAIL totally unrelated assertion blew up');
  assert(different !== sigA, 'a genuinely different failure must normalize to a different signature');
  const empty = normalizeFailureSignature(null);
  assert(/^[0-9a-f]{12}$/.test(empty), `null output still normalizes to a stable 12-hex signature, got "${empty}"`);
  assert(empty === normalizeFailureSignature(''), 'null and empty-string output normalize identically');
});

await check('normalizeFailureSignature prefers the first FAIL/Error/refus/denied line over surrounding noise', async () => {
  const output = 'running suite...\n3/45 passed\nFAIL assertion mismatch on line 12\nmore trailing noise';
  const sig = normalizeFailureSignature(output);
  assert(sig === normalizeFailureSignature('other run\nFAIL assertion mismatch on line 12\ndone'), 'the picked diagnostic line ignores unrelated surrounding noise');
});

await check('recordVerify appends a ledger entry on every outcome — fail then fail then pass — with claim_session/claimed_at from the live claim file (D1+Δ1)', async () => {
  addCell(root, makeCell('ledger-1'));
  const claimed = await claimCellCrossSession(root, { sessionId: 'sess-ledger-1', worker: 'worker-ledger', cellId: 'ledger-1' });
  assert(claimed.ok === true, `precondition: claim should succeed, got ${JSON.stringify(claimed)}`);
  const liveClaim = readClaim(root, 'ledger-1');

  await recordVerify(root, 'ledger-1', { command: 'npm test', output: 'FAIL first attempt', passed: false, sessionId: 'sess-ledger-1' });
  const afterFail1 = readCell(root, 'ledger-1');
  assert(Array.isArray(afterFail1.trace.attempts) && afterFail1.trace.attempts.length === 1, `expected 1 attempt, got ${JSON.stringify(afterFail1.trace.attempts)}`);
  const entry1 = afterFail1.trace.attempts[0];
  assert(entry1.n === 1, `first entry n should be 1, got ${entry1.n}`);
  assert(entry1.verdict === 'fail', `first entry verdict should be fail, got ${entry1.verdict}`);
  assert(entry1.claim_session === 'sess-ledger-1', `claim_session should come from the live claim, got ${entry1.claim_session}`);
  assert(entry1.claimed_at === liveClaim.claimed_at, `claimed_at should be copied from the live claim file, got ${entry1.claimed_at} vs ${liveClaim.claimed_at}`);
  assert(entry1.worker === 'worker-ledger', `worker should carry the claiming worker, got ${entry1.worker}`);
  assert(typeof entry1.failure_signature === 'string' && entry1.failure_signature.length > 0, 'a failed attempt must carry a failure_signature');
  assert('at' in entry1 && typeof entry1.at === 'string', 'entry carries its own timestamp');

  await recordVerify(root, 'ledger-1', { command: 'npm test', output: 'FAIL second attempt', passed: false, sessionId: 'sess-ledger-1' });
  const afterFail2 = readCell(root, 'ledger-1');
  assert(afterFail2.trace.attempts.length === 2, `expected 2 attempts, got ${afterFail2.trace.attempts.length}`);
  assert(afterFail2.trace.attempts[0].failure_signature === entry1.failure_signature, 'the first entry is never rewritten by a later append');
  assert(afterFail2.trace.attempts[1].n === 2, `second entry n should be 2, got ${afterFail2.trace.attempts[1].n}`);

  await recordVerify(root, 'ledger-1', { command: 'npm test', output: 'ok', passed: true, sessionId: 'sess-ledger-1' });
  const afterPass = readCell(root, 'ledger-1');
  assert(afterPass.trace.attempts.length === 3, `expected 3 attempts after the passing verify, got ${afterPass.trace.attempts.length}`);
  const passEntry = afterPass.trace.attempts[2];
  assert(passEntry.verdict === 'pass', `third entry verdict should be pass, got ${passEntry.verdict}`);
  assert(passEntry.failure_signature === null, `a passing attempt must never carry a failure_signature, got ${passEntry.failure_signature}`);
});

await check('recordVerify --signature (worker-supplied) overrides the mechanical normalizer for a failed attempt', async () => {
  addCell(root, makeCell('ledger-sig-1'));
  await claimCell(root, 'ledger-sig-1', 'worker-sig');
  await recordVerify(root, 'ledger-sig-1', { command: 'npm test', output: 'FAIL something', passed: false, signature: 'custom-sig-001' });
  const entry = readCell(root, 'ledger-sig-1').trace.attempts[0];
  assert(entry.failure_signature === 'custom-sig-001', `explicit --signature should win over the normalizer, got ${entry.failure_signature}`);
});

await check('blockCell appends a "blocked" ledger entry whose note is the block reason and whose failure_signature derives from it', async () => {
  addCell(root, makeCell('ledger-block-1'));
  await claimCell(root, 'ledger-block-1', 'worker-block');
  await blockCell(root, 'ledger-block-1', 'reservation conflict on src/x.js');
  const entry = readCell(root, 'ledger-block-1').trace.attempts[0];
  assert(entry.verdict === 'blocked', `expected blocked verdict, got ${entry.verdict}`);
  assert(entry.note === 'reservation conflict on src/x.js', `note should carry the block reason verbatim, got ${entry.note}`);
  assert(entry.failure_signature === normalizeFailureSignature('reservation conflict on src/x.js'), 'blockCell signature derives from the reason via the same normalizer');
});

await check('a sessionless claim records claim_session null but still carries the live claim file\'s claimed_at (D1+Δ1 undercount-safe, F2)', async () => {
  addCell(root, makeCell('ledger-sessionless-1'));
  const claimed = await claimCellCrossSession(root, { sessionId: null, worker: 'worker-sl', cellId: 'ledger-sessionless-1' });
  assert(claimed.ok === true, `precondition: sessionless claim should succeed, got ${JSON.stringify(claimed)}`);
  await recordVerify(root, 'ledger-sessionless-1', { command: 'npm test', output: 'FAIL x', passed: false });
  const entry = readCell(root, 'ledger-sessionless-1').trace.attempts[0];
  assert(entry.claim_session === null, `sessionless claim must record claim_session null, got ${entry.claim_session}`);
  assert(typeof entry.claimed_at === 'string' && entry.claimed_at.length > 0, 'claimed_at is still copied from the live (sessionless) claim file');
});

await check('trace.attempts entries survive capCell — appended to, never dropped by the trace spread', async () => {
  addCell(root, makeCell('ledger-cap-1'));
  await claimCell(root, 'ledger-cap-1', 'worker-cap');
  await recordVerify(root, 'ledger-cap-1', { command: 'npm test', output: 'FAIL once', passed: false });
  await recordVerify(root, 'ledger-cap-1', { command: 'npm test', output: 'ok', passed: true });
  const capped = await capCell(root, 'ledger-cap-1', { files_changed: ['a.js'], outcome: 'done' });
  assert(Array.isArray(capped.trace.attempts) && capped.trace.attempts.length === 2, `capCell must preserve every prior ledger entry, got ${JSON.stringify(capped.trace.attempts)}`);
  assert(capped.trace.attempts[0].verdict === 'fail' && capped.trace.attempts[1].verdict === 'pass', 'entry order and verdicts survive cap byte-unchanged');
});

await check('updateCell refuses a {trace:{...}} patch on an open cell — the ledger cannot be edited around (D1+F1: trace is already frozen wholesale)', async () => {
  addCell(root, makeCell('ledger-update-1'));
  await claimCell(root, 'ledger-update-1', 'worker-upd');
  await recordVerify(root, 'ledger-update-1', { command: 'npm test', output: 'FAIL', passed: false });
  await blockCell(root, 'ledger-update-1', 'stuck', { sessionId: undefined });
  const file = path.join(root, '.bee', 'cells', 'ledger-update-1.json');
  const before = fs.readFileSync(file, 'utf8');
  await assertRejects(
    () => updateCell(root, 'ledger-update-1', { title: 'ok', trace: { attempts: [] } }),
    'frozen',
    'a patch attempting to touch trace.attempts must be refused wholesale, cell untouched',
  );
  assert(fs.readFileSync(file, 'utf8') === before, 'ledger-update-1 file byte-unchanged after the refused trace patch');
});

// ─── D2 (self-correcting-loop): cell-lifetime budgets at the claim door ────
// max_claims/max_failed_attempts/max_same_signature enforced INSIDE the
// O_EXCL critical section of claimCellCrossSession, typed CELL_BUDGET_
// EXHAUSTED/REPEATED_FAILURE refusals, an audited reset-budget door, and
// claim-next SELECTION skipping bricked candidates (Δ3/F3) so the pool
// never bricks.

await check('claimCellCrossSession: a fresh cell with no attempts ledger claims exactly as today — D2 defaults never bite on a first claim (D6 compatibility floor)', async () => {
  addCell(root, makeCell('budget-fresh-1'));
  const result = await claimCellCrossSession(root, { sessionId: 'sess-budget-fresh', worker: 'w', cellId: 'budget-fresh-1' });
  assert(result.ok === true, `first claim on a fresh cell must succeed under default budgets, got ${JSON.stringify(result)}`);
});

await check('claimCellCrossSession: 3 claims exhaust the default max_claims budget — a 4th claim is refused typed CELL_BUDGET_EXHAUSTED naming the budget, and the just-acquired claim file is unwound (D2+Δ2)', async () => {
  addCell(root, makeCell('budget-claims-1'));
  for (let i = 0; i < 3; i += 1) {
    const claimed = await claimCellCrossSession(root, { sessionId: `sess-budget-claims-${i}`, worker: 'w', cellId: 'budget-claims-1' });
    assert(claimed.ok === true, `claim #${i + 1} should succeed under the default budget of 3, got ${JSON.stringify(claimed)}`);
    await recordVerify(root, 'budget-claims-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: `sess-budget-claims-${i}` });
    await unclaimCell(root, 'budget-claims-1', { sessionId: `sess-budget-claims-${i}` });
  }
  const fourth = await claimCellCrossSession(root, { sessionId: 'sess-budget-claims-3', worker: 'w', cellId: 'budget-claims-1' });
  assert(fourth.ok === false, `the 4th claim must be refused, got ${JSON.stringify(fourth)}`);
  assert(fourth.code === 'CELL_BUDGET_EXHAUSTED', `expected CELL_BUDGET_EXHAUSTED, got ${fourth.code}`);
  assert(fourth.budget && fourth.budget.name === 'max_claims', `refusal must name the exhausted budget, got ${JSON.stringify(fourth.budget)}`);
  assert(typeof fourth.fix === 'string' && fourth.fix.includes('reset-budget'), `refusal must name the reset door, got ${fourth.fix}`);
  assert(readClaim(root, 'budget-claims-1') === null, 'a refused claim must not leave an orphaned claim file behind (Δ2 unwind precedent cells.mjs:951)');
  assert(readCell(root, 'budget-claims-1').status === 'open', 'the cell itself stays untouched on a refused claim — only the transient claim-file acquisition was unwound');
});

await check('claimCellCrossSession: two failed attempts sharing an identical failure_signature refuse the NEXT claim typed REPEATED_FAILURE, independent of the max_claims/max_failed_attempts budgets (D2 same-signature)', async () => {
  addCell(root, makeCell('budget-sig-1'));
  for (let i = 0; i < 2; i += 1) {
    await claimCellCrossSession(root, { sessionId: `sess-budget-sig-${i}`, worker: 'w', cellId: 'budget-sig-1' });
    await recordVerify(root, 'budget-sig-1', { command: 'npm test', output: 'FAIL identical assertion', passed: false, sessionId: `sess-budget-sig-${i}` });
    await unclaimCell(root, 'budget-sig-1', { sessionId: `sess-budget-sig-${i}` });
  }
  const third = await claimCellCrossSession(root, { sessionId: 'sess-budget-sig-2', worker: 'w', cellId: 'budget-sig-1' });
  assert(third.ok === false, `a claim after 2 identical-signature fails must refuse, got ${JSON.stringify(third)}`);
  assert(third.code === 'REPEATED_FAILURE', `expected REPEATED_FAILURE, got ${third.code}`);
  assert(third.signature === normalizeFailureSignature('FAIL identical assertion'), `refusal must name the repeated signature, got ${third.signature}`);
  assert(typeof third.fix === 'string' && third.fix.includes('reset-budget'), `refusal must name the reset door, got ${third.fix}`);
});

await check('claimCellCrossSession: an explicit per-cell budgets override is honored over the defaults (D2)', async () => {
  addCell(root, makeCell('budget-custom-1', { budgets: { max_claims: 1, max_failed_attempts: 4, max_same_signature: 2 } }));
  const first = await claimCellCrossSession(root, { sessionId: 'sess-budget-custom-0', worker: 'w', cellId: 'budget-custom-1' });
  assert(first.ok === true, `first claim under a custom max_claims:1 should succeed, got ${JSON.stringify(first)}`);
  await recordVerify(root, 'budget-custom-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: 'sess-budget-custom-0' });
  await unclaimCell(root, 'budget-custom-1', { sessionId: 'sess-budget-custom-0' });
  const second = await claimCellCrossSession(root, { sessionId: 'sess-budget-custom-1', worker: 'w', cellId: 'budget-custom-1' });
  assert(second.ok === false && second.code === 'CELL_BUDGET_EXHAUSTED', `a 2nd claim under a custom max_claims:1 must refuse, got ${JSON.stringify(second)}`);
  assert(second.budget.limit === 1, `refusal must reflect the cell's own override, not the default, got ${JSON.stringify(second.budget)}`);
});

await check('resetCellBudget: audited reset appends a budget_resets marker, logs a decision, never touches attempts, and reopens the claim door (D2)', async () => {
  addCell(root, makeCell('budget-reset-1'));
  for (let i = 0; i < 3; i += 1) {
    await claimCellCrossSession(root, { sessionId: `sess-budget-reset-${i}`, worker: 'w', cellId: 'budget-reset-1' });
    await recordVerify(root, 'budget-reset-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: `sess-budget-reset-${i}` });
    await unclaimCell(root, 'budget-reset-1', { sessionId: `sess-budget-reset-${i}` });
  }
  const blocked = await claimCellCrossSession(root, { sessionId: 'sess-budget-reset-3', worker: 'w', cellId: 'budget-reset-1' });
  assert(blocked.ok === false && blocked.code === 'CELL_BUDGET_EXHAUSTED', `precondition: the door should be exhausted, got ${JSON.stringify(blocked)}`);
  const attemptsBefore = readCell(root, 'budget-reset-1').trace.attempts.length;

  const reset = await resetCellBudget(root, 'budget-reset-1', 'manager approved a genuine retry', { operator: 'manager-1' });
  assert(Array.isArray(reset.trace.budget_resets) && reset.trace.budget_resets.length === 1, `reset must append exactly one budget_resets entry, got ${JSON.stringify(reset.trace.budget_resets)}`);
  assert(reset.trace.budget_resets[0].reason === 'manager approved a genuine retry', 'the reset reason is recorded verbatim');
  assert(reset.trace.budget_resets[0].by_actor === 'manager-1', `reset must record the acting operator as by_actor, got ${JSON.stringify(reset.trace.budget_resets[0])}`);
  assert(reset.trace.attempts.length === attemptsBefore, 'reset never rewrites or drops any attempts ledger entry');

  const decisions = activeDecisions(root, { recent: 1 });
  assert(decisions.length > 0 && decisions[0].decision.includes('budget-reset-1'), `resetCellBudget must log a decision naming the cell, got ${JSON.stringify(decisions)}`);

  const reopened = await claimCellCrossSession(root, { sessionId: 'sess-budget-reset-4', worker: 'w', cellId: 'budget-reset-1' });
  assert(reopened.ok === true, `after reset the door must reopen for a fresh claim, got ${JSON.stringify(reopened)}`);
});

await check('resetCellBudget requires a non-empty reason, and refuses an unknown cell id', async () => {
  addCell(root, makeCell('budget-reset-noreason-1'));
  await assertRejects(() => resetCellBudget(root, 'budget-reset-noreason-1', ''), 'reason', 'resetCellBudget must refuse an empty reason');
  await assertRejects(() => resetCellBudget(root, 'budget-reset-noreason-1', '   '), 'reason', 'resetCellBudget must refuse a whitespace-only reason');
  await assertRejects(() => resetCellBudget(root, 'no-such-cell-budget', 'a reason'), 'not found', 'resetCellBudget must refuse an unknown cell id');
});

// ─── D-GHF-C (GH #27.3+4): budget hard clamps + guarded, audit-first reset ──

await check('resolveCellBudgets (D-GHF-C): clamps a declared value above the hard max down to it, and falls back to DEFAULT_BUDGETS for a non-integer or below-floor declared value — no path ever raises a budget above the hard max', () => {
  assert(resolveCellBudgets({}).max_claims === 3, `no declared budgets -> DEFAULT max_claims 3, got ${resolveCellBudgets({}).max_claims}`);

  const clampedHigh = resolveCellBudgets({
    budgets: { max_claims: 999999, max_failed_attempts: 999999, max_same_signature: 999999 },
  });
  assert(clampedHigh.max_claims === 9, `max_claims must clamp to hard max 9, got ${clampedHigh.max_claims}`);
  assert(clampedHigh.max_failed_attempts === 12, `max_failed_attempts must clamp to hard max 12, got ${clampedHigh.max_failed_attempts}`);
  assert(clampedHigh.max_same_signature === 6, `max_same_signature must clamp to hard max 6, got ${clampedHigh.max_same_signature}`);

  // boundary: exactly at the hard max is honored verbatim; one above clamps down.
  assert(resolveCellBudgets({ budgets: { max_claims: 9 } }).max_claims === 9, 'a declared value exactly at the hard max is honored verbatim');
  assert(resolveCellBudgets({ budgets: { max_claims: 10 } }).max_claims === 9, 'one above the hard max clamps down to it');

  // non-integer / below-floor declared values fall back to DEFAULT, not the hard max.
  assert(resolveCellBudgets({ budgets: { max_claims: 2.5 } }).max_claims === 3, 'a non-integer declared value falls back to DEFAULT (3), never clamps');
  assert(resolveCellBudgets({ budgets: { max_claims: 0 } }).max_claims === 3, 'a zero declared value falls back to DEFAULT');
  assert(resolveCellBudgets({ budgets: { max_claims: -5 } }).max_claims === 3, 'a negative declared value falls back to DEFAULT');
  assert(resolveCellBudgets({ budgets: { max_claims: 'nine' } }).max_claims === 3, 'a non-numeric declared value falls back to DEFAULT');
});

await check('addCell (validateNewCell, D-GHF-C): refuses a malformed budgets object at authoring time — non-plain-object, unknown key, non-integer, and over-hard-max values are all rejected before write; a valid at-hard-max object is accepted verbatim', () => {
  assertThrows(() => addCell(root, makeCell('budget-authoring-array-1', { budgets: [1, 2, 3] })), 'budgets', 'an array budgets value must be refused');
  assertThrows(() => addCell(root, makeCell('budget-authoring-unknown-1', { budgets: { max_claims: 3, bogus_key: 1 } })), 'budgets', 'an unknown budgets key must be refused');
  assertThrows(() => addCell(root, makeCell('budget-authoring-noninteger-1', { budgets: { max_claims: 2.5 } })), 'budgets', 'a non-integer budgets value must be refused');
  assertThrows(() => addCell(root, makeCell('budget-authoring-toohigh-1', { budgets: { max_claims: 10 } })), 'budgets', 'a budgets value above the hard max must be refused');
  assertThrows(() => addCell(root, makeCell('budget-authoring-zero-1', { budgets: { max_claims: 0 } })), 'budgets', 'a zero budgets value must be refused');
  assert(readCell(root, 'budget-authoring-array-1') === null, 'a refused authoring call must not leave a partial cell file behind');

  const ok = addCell(root, makeCell('budget-authoring-ok-1', { budgets: { max_claims: 9, max_failed_attempts: 12, max_same_signature: 6 } }));
  assert(ok.budgets.max_claims === 9 && ok.budgets.max_failed_attempts === 12 && ok.budgets.max_same_signature === 6, `a valid at-hard-max budgets object must be accepted verbatim, got ${JSON.stringify(ok.budgets)}`);
});

await check('resetCellBudget (D-GHF-C): refused, typed RESET_NOT_NEEDED, on a cell that is not actually budget-blocked — checkCellBudgets(cell).ok stays the door, not a bare reason string', async () => {
  addCell(root, makeCell('budget-reset-healthy-1'));
  assert(checkCellBudgets(readCell(root, 'budget-reset-healthy-1')).ok === true, 'precondition: a fresh cell is not budget-blocked');
  let caught = null;
  try {
    await resetCellBudget(root, 'budget-reset-healthy-1', 'trying to reset anyway', { operator: 'manager-1' });
  } catch (error) {
    caught = error;
  }
  assert(caught !== null, 'resetCellBudget must refuse a reset on a healthy (non-budget-blocked) cell');
  assert(caught.code === 'RESET_NOT_NEEDED', `refusal must be typed RESET_NOT_NEEDED, got ${JSON.stringify(caught.code)}`);
  const after = readCell(root, 'budget-reset-healthy-1');
  assert(!Array.isArray(after.trace.budget_resets) || after.trace.budget_resets.length === 0, 'a refused reset must not append a budget_resets entry');
});

await check('resetCellBudget (D-GHF-C): refused without an actor — neither --operator nor BEE_AGENT_NAME supplied, message names both options', async () => {
  addCell(root, makeCell('budget-reset-noactor-1'));
  const savedEnv = process.env.BEE_AGENT_NAME;
  delete process.env.BEE_AGENT_NAME;
  try {
    await assertRejects(
      () => resetCellBudget(root, 'budget-reset-noactor-1', 'a reason'),
      'operator',
      'resetCellBudget must refuse without an actor, naming --operator',
    );
    await assertRejects(
      () => resetCellBudget(root, 'budget-reset-noactor-1', 'a reason'),
      'BEE_AGENT_NAME',
      'resetCellBudget must refuse without an actor, naming BEE_AGENT_NAME',
    );
  } finally {
    if (savedEnv === undefined) delete process.env.BEE_AGENT_NAME;
    else process.env.BEE_AGENT_NAME = savedEnv;
  }
  const after = readCell(root, 'budget-reset-noactor-1');
  assert(!Array.isArray(after.trace.budget_resets) || after.trace.budget_resets.length === 0, 'a refused actor-less reset must not append a budget_resets entry');
});

await check('resetCellBudget (D-GHF-C): the BEE_AGENT_NAME env fallback supplies the actor when --operator is omitted', async () => {
  addCell(root, makeCell('budget-reset-envactor-1'));
  for (let i = 0; i < 3; i += 1) {
    await claimCellCrossSession(root, { sessionId: `sess-envactor-${i}`, worker: 'w', cellId: 'budget-reset-envactor-1' });
    await recordVerify(root, 'budget-reset-envactor-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: `sess-envactor-${i}` });
    await unclaimCell(root, 'budget-reset-envactor-1', { sessionId: `sess-envactor-${i}` });
  }
  const blocked = await claimCellCrossSession(root, { sessionId: 'sess-envactor-3', worker: 'w', cellId: 'budget-reset-envactor-1' });
  assert(blocked.ok === false, 'precondition: the door should be exhausted');
  const savedEnv = process.env.BEE_AGENT_NAME;
  process.env.BEE_AGENT_NAME = 'env-actor-1';
  try {
    const reset = await resetCellBudget(root, 'budget-reset-envactor-1', 'env fallback actor test');
    assert(reset.trace.budget_resets[0].by_actor === 'env-actor-1', `expected the BEE_AGENT_NAME env value as the actor, got ${JSON.stringify(reset.trace.budget_resets[0])}`);
  } finally {
    if (savedEnv === undefined) delete process.env.BEE_AGENT_NAME;
    else process.env.BEE_AGENT_NAME = savedEnv;
  }
});

await check('resetCellBudget (D-GHF-C): writes the audit decision BEFORE the cell write — a forced writeCell failure still leaves the decision recorded, and the cell file itself is untouched', async () => {
  const dir = makeStateRepo('bee-budget-audit-order-');
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'swarming',
      feature: 'demo-feat',
      mode: 'standard',
      approved_gates: { context: true, shape: true, execution: true, review: false },
      workers: [],
    });
    addCell(dir, makeCell('budget-audit-order-1'));
    for (let i = 0; i < 3; i += 1) {
      await claimCellCrossSession(dir, { sessionId: `sess-audit-order-${i}`, worker: 'w', cellId: 'budget-audit-order-1' });
      await recordVerify(dir, 'budget-audit-order-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: `sess-audit-order-${i}` });
      await unclaimCell(dir, 'budget-audit-order-1', { sessionId: `sess-audit-order-${i}` });
    }
    const blocked = await claimCellCrossSession(dir, { sessionId: 'sess-audit-order-3', worker: 'w', cellId: 'budget-audit-order-1' });
    assert(blocked.ok === false, 'precondition: the door should be exhausted');
    const before = fs.readFileSync(path.join(dir, '.bee', 'cells', 'budget-audit-order-1.json'), 'utf8');

    const cellsDir = path.join(dir, '.bee', 'cells');
    fs.chmodSync(cellsDir, 0o555);
    let threw = false;
    try {
      await resetCellBudget(dir, 'budget-audit-order-1', 'forced write failure test', { operator: 'test-op' });
    } catch {
      threw = true;
    } finally {
      fs.chmodSync(cellsDir, 0o755);
    }
    assert(threw, 'a forced writeCell failure must propagate as a rejection, not be silently swallowed');

    const after = fs.readFileSync(path.join(dir, '.bee', 'cells', 'budget-audit-order-1.json'), 'utf8');
    assert(after === before, 'the cell file itself must be byte-unchanged — the write never actually landed');

    const decisions = activeDecisions(dir, { recent: 1 });
    assert(
      decisions.length > 0 && decisions[0].decision.includes('budget-audit-order-1'),
      `the audit decision must exist even though the cell write failed, got ${JSON.stringify(decisions)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check(
  'gate_bypass="total" does NOT bypass CELL_BUDGET_EXHAUSTED or REPEATED_FAILURE — the budget check never reads bypass config at all; these are structural loop-safety stops, not approval gates (D2 explicit test row)',
  async () => {
    const dir = makeStateRepo('bee-budget-bypass-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        mode: 'standard',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      writeJsonAtomic(path.join(dir, '.bee', 'config.json'), { gate_bypass: 'total' });
      assert(bypassLevel(dir) === 'total', 'precondition: bypass level resolves to total');

      const oldAttempts = [0, 1, 2].map((i) => ({
        n: i + 1,
        at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        claim_session: `sess-old-${i}`,
        claimed_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        worker: 'w',
        verdict: 'pass',
        failure_signature: null,
        note: null,
      }));
      makeCellFile(dir, 'bypass-1', { feature: 'demo-feat', status: 'open', deps: [], trace: { attempts: oldAttempts } });

      const result = await claimCellCrossSession(dir, { sessionId: 'sess-bypass-total', worker: 'w', cellId: 'bypass-1' });
      assert(result.ok === false && result.code === 'CELL_BUDGET_EXHAUSTED', `gate_bypass=total must NOT bypass the budget refusal, got ${JSON.stringify(result)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  'claimNextCell: SELECTION skips a budget-exhausted candidate — the pool still finds another ready cell instead of surfacing the refusal (D2 Δ3/F3)',
  async () => {
    const dir = makeStateRepo('bee-claimnext-budget-skip-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        mode: 'standard',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      const oldAttempts = [0, 1, 2].map((i) => ({
        n: i + 1,
        at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        claim_session: `sess-old-${i}`,
        claimed_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        worker: 'w',
        verdict: 'pass',
        failure_signature: null,
        note: null,
      }));
      makeCellFile(dir, 'exhausted-1', { feature: 'demo-feat', status: 'open', deps: [], trace: { attempts: oldAttempts } });
      makeCellFile(dir, 'healthy-1', { feature: 'demo-feat', status: 'open', deps: [] });

      const result = await claimNextCell(dir, { sessionId: 'sess-selector', worker: 'w' });
      assert(result.ok === true, `expected a healthy cell to be selected, got ${JSON.stringify(result)}`);
      assert(result.cell.id === 'healthy-1', `the budget-exhausted candidate must be skipped by selection, got ${result.cell.id}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

await check(
  'claimNextCell: when the ONLY ready candidate is budget-exhausted, selection returns typed NO_APPROVED_WORK rather than surfacing CELL_BUDGET_EXHAUSTED — only a direct `cells claim --id` surfaces that refusal (D2 Δ3/F3)',
  async () => {
    const dir = makeStateRepo('bee-claimnext-budget-only-');
    try {
      writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
        schema_version: '1.0',
        phase: 'swarming',
        feature: 'demo-feat',
        mode: 'standard',
        approved_gates: { context: true, shape: true, execution: true, review: false },
        workers: [],
      });
      const oldAttempts = [0, 1, 2].map((i) => ({
        n: i + 1,
        at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        claim_session: `sess-old-${i}`,
        claimed_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
        worker: 'w',
        verdict: 'pass',
        failure_signature: null,
        note: null,
      }));
      makeCellFile(dir, 'exhausted-only-1', { feature: 'demo-feat', status: 'open', deps: [], trace: { attempts: oldAttempts } });

      const result = await claimNextCell(dir, { sessionId: 'sess-selector-2', worker: 'w' });
      assert(result.ok === false && result.code === 'NO_APPROVED_WORK', `expected NO_APPROVED_WORK when the only candidate is bricked, got ${JSON.stringify(result)}`);

      const direct = await claimCellCrossSession(dir, { sessionId: 'sess-selector-2', worker: 'w', cellId: 'exhausted-only-1' });
      assert(direct.ok === false && direct.code === 'CELL_BUDGET_EXHAUSTED', `direct claim --id must still surface the typed refusal, got ${JSON.stringify(direct)}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);

// ─── D3 (self-correcting-loop): judge-standard matrix — authoring advisory
// (bee.mjs handler layer, tested in test_bee_cli.mjs alongside
// manifestLintWarning) + mechanical behavior-class cap teeth (this lib,
// tested here). change_class:'behavior' is used explicitly (rather than
// behavior_change:true) in the cap-teeth rows below so the teeth are proven
// gated on the DERIVED CLASS, not on the `bc` flag — CONTEXT: "additive to
// today's rules", not a replacement for the pre-existing Decision 0009 check.

await check('deriveChangeClass resolves explicit change_class, the sole behavior_change=>behavior derivation, and null otherwise — no other auto-derivation (D3)', async () => {
  assert(deriveChangeClass({ change_class: 'api' }) === 'api', 'explicit change_class wins');
  assert(deriveChangeClass({ change_class: 'api', behavior_change: true }) === 'api', 'explicit change_class wins even over behavior_change:true');
  assert(deriveChangeClass({ behavior_change: true }) === 'behavior', 'absent change_class + behavior_change:true derives behavior');
  assert(deriveChangeClass({ behavior_change: false }) === null, 'absent change_class + behavior_change:false is unclassified');
  assert(deriveChangeClass({}) === null, 'absent change_class + absent behavior_change is unclassified');
  assert(deriveChangeClass(null) === null, 'null cell tolerated, never throws');
  assert(deriveChangeClass(undefined) === null, 'undefined cell tolerated, never throws');
  assert(CHANGE_CLASSES.includes('behavior') && CHANGE_CLASSES.length === 6, `expected the 6-member enum, got ${JSON.stringify(CHANGE_CLASSES)}`);
});

await check('addCell validates optional change_class against the enum, naming CHANGE_CLASSES on refusal (D3)', async () => {
  assertThrows(
    () => addCell(root, makeCell('jsm-bad-class', { change_class: 'not-a-class' })),
    'change_class',
    'an invalid change_class must be refused',
  );
  const added = addCell(root, makeCell('jsm-good-class', { change_class: 'api' }));
  assert(added.change_class === 'api', 'a valid change_class is persisted');
});

await check('updateCell validates change_class the same way, and accepts null to un-set it back to derivation (D3)', async () => {
  await assertRejects(
    () => updateCell(root, 'jsm-good-class', { change_class: 'nonsense' }),
    'change_class',
    'update must refuse an invalid change_class',
  );
  const cleared = await updateCell(root, 'jsm-good-class', { change_class: null });
  assert(cleared.change_class === null, 'null un-sets change_class back to derivation');
  const revalidated = await updateCell(root, 'jsm-good-class', { change_class: 'security' });
  assert(revalidated.change_class === 'security', 'a subsequent valid change_class still applies');
});

await check('capCell refuses a behavior-class cap with no red_failure_evidence at all, naming the missing minimum — gated on change_class, independent of the behavior_change flag (D3)', async () => {
  addCell(root, makeCell('jsm-missing-1', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-missing-1', 'worker-jsm');
  await recordVerify(root, 'jsm-missing-1', { command: 'x', output: 'ok', passed: true });
  await assertRejects(
    () => capCell(root, 'jsm-missing-1', { files_changed: ['a.js'], outcome: 'done' }),
    'red_failure_evidence',
    'a behavior-class cap with no evidence at all must be refused by the D3 teeth even when behavior_change is never set',
  );
});

await check('capCell refuses a behavior-class cap whose red_failure_evidence is under 80 chars, naming the length floor (D3)', async () => {
  addCell(root, makeCell('jsm-short-1', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-short-1', 'worker-jsm');
  await recordVerify(root, 'jsm-short-1', { command: 'x', output: 'ok', passed: true });
  await assertRejects(
    () =>
      capCell(root, 'jsm-short-1', {
        files_changed: ['a.js'],
        outcome: 'done',
        verification_evidence: { red_failure_evidence: 'too short' },
      }),
    '80',
    'short red_failure_evidence must be refused, naming the 80-char floor',
  );
});

await check('capCell refuses a behavior-class cap whose red_failure_evidence is byte-identical to another cell\'s recorded evidence, naming the colliding cell id (D3+Δ5 anti-boilerplate)', async () => {
  const sharedText =
    'this exact red_failure_evidence text is reused verbatim across two different cells to trigger the D3 anti-boilerplate duplicate refusal.';
  assert(sharedText.length >= 80, 'fixture text must clear the length floor on its own, so only the duplicate check fires');

  addCell(root, makeCell('jsm-dup-a', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-dup-a', 'worker-jsm');
  await recordVerify(root, 'jsm-dup-a', { command: 'x', output: 'ok', passed: true });
  await capCell(root, 'jsm-dup-a', {
    files_changed: ['a.js'],
    outcome: 'done',
    verification_evidence: { red_failure_evidence: sharedText },
  });

  addCell(root, makeCell('jsm-dup-b', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-dup-b', 'worker-jsm');
  await recordVerify(root, 'jsm-dup-b', { command: 'x', output: 'ok', passed: true });
  await assertRejects(
    () =>
      capCell(root, 'jsm-dup-b', {
        files_changed: ['a.js'],
        outcome: 'done',
        verification_evidence: { red_failure_evidence: sharedText },
      }),
    'jsm-dup-a',
    'a byte-identical red_failure_evidence must be refused, naming the colliding cell id',
  );
});

await check('capCell caps a behavior-class cell whose red_failure_evidence clears the D3 floor and is unique (green row)', async () => {
  addCell(root, makeCell('jsm-green-1', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-green-1', 'worker-jsm');
  await recordVerify(root, 'jsm-green-1', { command: 'x', output: 'ok', passed: true });
  const capped = await capCell(root, 'jsm-green-1', {
    files_changed: ['a.js'],
    outcome: 'done',
    verification_evidence: {
      red_failure_evidence:
        'jsm-green-1: a genuinely unique characterization of the prior failing behavior before this change, clearing the D3 floor.',
    },
  });
  assert(capped.status === 'capped', 'a sufficiently long, unique red_failure_evidence caps cleanly');
});

await check('capCell caps a behavior-class cell riding deliberate_exceptions without the D3 length/duplicate floor — today\'s contract unchanged (F5 passthrough)', async () => {
  addCell(root, makeCell('jsm-exception-1', { change_class: 'behavior' }));
  await claimCell(root, 'jsm-exception-1', 'worker-jsm');
  await recordVerify(root, 'jsm-exception-1', { command: 'x', output: 'ok', passed: true });
  const capped = await capCell(root, 'jsm-exception-1', {
    files_changed: ['a.js'],
    outcome: 'done',
    verification_evidence: { deliberate_exceptions: ['brand-new surface, no prior behavior to characterize'] },
  });
  assert(capped.status === 'capped', 'the exception door still caps without any red_failure_evidence — the D3 floor never applies to it');
});

await check('capCell tolerates a corrupt sibling cell file during the D3 duplicate scan — never throws, just skips it (Δ5)', async () => {
  const corruptPath = path.join(root, '.bee', 'cells', 'jsm-corrupt-sibling.json');
  fs.writeFileSync(corruptPath, '{ not valid json', 'utf8');
  try {
    addCell(root, makeCell('jsm-corrupt-check', { change_class: 'behavior' }));
    await claimCell(root, 'jsm-corrupt-check', 'worker-jsm');
    await recordVerify(root, 'jsm-corrupt-check', { command: 'x', output: 'ok', passed: true });
    const capped = await capCell(root, 'jsm-corrupt-check', {
      files_changed: ['a.js'],
      outcome: 'done',
      verification_evidence: {
        red_failure_evidence:
          'jsm-corrupt-check: unique red evidence text, long enough to clear the D3 anti-boilerplate floor despite a corrupt sibling cell file present on disk.',
      },
    });
    assert(capped.status === 'capped', 'a corrupt sibling cell file must never crash or block the duplicate scan');
  } finally {
    fs.rmSync(corruptPath, { force: true });
  }
});

await check('capCell applies NO teeth to non-behavior classes — an api-class cell caps normally without any verification_evidence (D3: only behavior gets hard teeth in v1)', async () => {
  addCell(root, makeCell('jsm-api-1', { change_class: 'api' }));
  await claimCell(root, 'jsm-api-1', 'worker-jsm');
  await recordVerify(root, 'jsm-api-1', { command: 'x', output: 'ok', passed: true });
  const capped = await capCell(root, 'jsm-api-1', { files_changed: ['a.js'], outcome: 'done' });
  assert(capped.status === 'capped', 'a non-behavior change_class never gets D3 cap teeth');
});

// ─── D1 Δ2-amendment: EVERY claim-clearing transition releases the claim
// file — cap, unclaim, block, drop, reopen — not only the claim-next unwind.
// Without this a same-session round trip through one of these verbs would
// self-refuse CLAIMED for the claim's full TTL (block/reopen's round trip is
// covered end-to-end by scripts/test_claim_race.mjs scenario (c); this covers
// cap/unclaim/drop directly at the lib level).

await check('capCell releases the claim file on cap (D1 Δ2)', async () => {
  addCell(root, makeCell('rel-cap-1'));
  await claimCellCrossSession(root, { sessionId: 'sess-rel-cap', worker: 'w', cellId: 'rel-cap-1' });
  assert(readClaim(root, 'rel-cap-1') !== null, 'precondition: claim file exists after claim');
  // D4 (msh-4): the owning session must now authenticate its own mutations —
  // recordVerify/capCell run AS 'sess-rel-cap', the session that claimed it.
  await recordVerify(root, 'rel-cap-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true, sessionId: 'sess-rel-cap' });
  await capCell(root, 'rel-cap-1', { files_changed: ['a.js'], outcome: 'done', sessionId: 'sess-rel-cap' });
  assert(readClaim(root, 'rel-cap-1') === null, 'cap must release the claim file');
});

await check('unclaimCell releases the claim file, and the cell is re-claimable by the SAME session with no self-refusal (D1 Δ2)', async () => {
  addCell(root, makeCell('rel-unclaim-1'));
  await claimCellCrossSession(root, { sessionId: 'sess-rel-unclaim', worker: 'w', cellId: 'rel-unclaim-1' });
  assert(readClaim(root, 'rel-unclaim-1') !== null, 'precondition: claim file exists after claim');
  // D4 (msh-4): unclaim as the owning session — single-session use never refuses.
  await unclaimCell(root, 'rel-unclaim-1', { sessionId: 'sess-rel-unclaim' });
  assert(readClaim(root, 'rel-unclaim-1') === null, 'unclaim must release the claim file');
  const reclaimed = await claimCellCrossSession(root, { sessionId: 'sess-rel-unclaim', worker: 'w', cellId: 'rel-unclaim-1' });
  assert(reclaimed.ok === true, `same-session re-claim after unclaim must not self-refuse, got ${JSON.stringify(reclaimed)}`);
});

await check('dropCell releases the claim file (D1 Δ2)', async () => {
  addCell(root, makeCell('rel-drop-1'));
  await claimCellCrossSession(root, { sessionId: 'sess-rel-drop', worker: 'w', cellId: 'rel-drop-1' });
  assert(readClaim(root, 'rel-drop-1') !== null, 'precondition: claim file exists after claim');
  await dropCell(root, 'rel-drop-1', 'no longer needed');
  assert(readClaim(root, 'rel-drop-1') === null, 'drop must release the claim file');
});

await check('capCell/unclaimCell/blockCell/dropCell/reopenCell never fail when there is no claim file to release (cells claimed before msh-2, or never claimed)', async () => {
  addCell(root, makeCell('rel-none-1'));
  assert(readClaim(root, 'rel-none-1') === null, 'precondition: no claim file (never claimed via claimCellCrossSession)');
  await claimCell(root, 'rel-none-1', 'worker-plain'); // the bare, file-less claim path
  await recordVerify(root, 'rel-none-1', { command: 'node -e "process.exit(0)"', output: 'ok', passed: true });
  const capped = await capCell(root, 'rel-none-1', { files_changed: ['a.js'], outcome: 'done' });
  assert(capped.status === 'capped', 'cap succeeds cleanly with no claim file to release');
});

// ─── D4 (msh-4): claim-ownership check on cell mutators + audited force
// door. recordVerify/capCell/blockCell/unclaimCell/reopenCell now read the
// live claim file: a LIVE claim carrying a session that differs from the
// caller's resolved session refuses (typed, names owner + expiry); an
// expired claim, an absent claim, a sessionless claim, or a matching session
// proceeds unchanged (dropCell stays untouched — CONTEXT D4 names only
// verify/cap/block/unclaim/reopen).

await check('a live claim mismatch refuses recordVerify/capCell/blockCell/unclaimCell, naming owner and expiry', async () => {
  addCell(root, makeCell('own-mismatch-1'));
  await claimCellCrossSession(root, { sessionId: 'sess-owner', worker: 'w', cellId: 'own-mismatch-1' });
  await assertRejects(
    () =>
      recordVerify(root, 'own-mismatch-1', {
        command: 'node -e "process.exit(0)"',
        output: 'ok',
        passed: true,
        sessionId: 'sess-intruder',
      }),
    'sess-owner',
    'recordVerify refuses a mismatched session',
  );
  await assertRejects(
    () =>
      recordVerify(root, 'own-mismatch-1', {
        command: 'node -e "process.exit(0)"',
        output: 'ok',
        passed: true,
        sessionId: 'sess-intruder',
      }),
    'expires',
    'the refusal names the expiry too',
  );
  await assertRejects(
    () => capCell(root, 'own-mismatch-1', { files_changed: ['a.js'], outcome: 'done', sessionId: 'sess-intruder' }),
    'sess-owner',
    'capCell refuses a mismatched session',
  );
  await assertRejects(
    () => blockCell(root, 'own-mismatch-1', 'stuck', { sessionId: 'sess-intruder' }),
    'sess-owner',
    'blockCell refuses a mismatched session',
  );
  await assertRejects(
    () => unclaimCell(root, 'own-mismatch-1', { sessionId: 'sess-intruder' }),
    'sess-owner',
    'unclaimCell refuses a mismatched session',
  );
  const cell = readCell(root, 'own-mismatch-1');
  assert(cell.status === 'claimed', 'every refusal above left the cell untouched — still claimed');
  assert(cell.trace.verify_passed !== true, 'the refused recordVerify never landed a partial write');
});

await check('reopenCell also refuses a live-claim mismatch, naming owner and expiry', async () => {
  addCell(root, makeCell('own-mismatch-reopen', { status: 'blocked' }));
  claimCellFile(root, 'sess-owner', 'own-mismatch-reopen', 3600); // a lingering live claim on an already-blocked cell
  await assertRejects(
    () => reopenCell(root, 'own-mismatch-reopen', 'retry', { sessionId: 'sess-intruder' }),
    'sess-owner',
    'reopenCell refuses a mismatched session',
  );
  assert(readCell(root, 'own-mismatch-reopen').status === 'blocked', 'reopenCell refusal leaves status untouched');
});

await check('an expired claim proceeds unchanged for verify/cap (rescue stays possible)', async () => {
  addCell(root, makeCell('own-expired-1'));
  await claimCell(root, 'own-expired-1', 'worker-x'); // bare claim (status only)
  writeJsonAtomic(claimPath(root, 'own-expired-1'), {
    cell: 'own-expired-1',
    session: 'sess-gone',
    claimed_at: new Date(Date.now() - 7200 * 1000).toISOString(),
    ttl_seconds: 60,
  });
  await recordVerify(root, 'own-expired-1', {
    command: 'node -e "process.exit(0)"',
    output: 'ok',
    passed: true,
    sessionId: 'sess-rescuer',
  });
  const capped = await capCell(root, 'own-expired-1', { files_changed: ['a.js'], outcome: 'done', sessionId: 'sess-rescuer' });
  assert(capped.status === 'capped', 'cap proceeds through an expired claim without refusal');
});

await check('a sessionless claim proceeds unchanged — single-session use never hits a refusal', async () => {
  addCell(root, makeCell('own-sessionless-1'));
  await claimCellCrossSession(root, { sessionId: null, worker: 'w', cellId: 'own-sessionless-1' });
  assert(readClaim(root, 'own-sessionless-1').session === undefined, 'precondition: sessionless claim omits the session key');
  await recordVerify(root, 'own-sessionless-1', {
    command: 'node -e "process.exit(0)"',
    output: 'ok',
    passed: true,
    sessionId: 'sess-anyone',
  });
  const capped = await capCell(root, 'own-sessionless-1', {
    files_changed: ['a.js'],
    outcome: 'done',
    sessionId: 'sess-anyone',
  });
  assert(capped.status === 'capped', 'cap proceeds through a sessionless claim regardless of caller session');
});

await check(
  '--force-ownership bypasses a live-claim mismatch and appends an audited trace.ownership_overrides row (never trace.deviations) that survives the subsequent cap',
  async () => {
    addCell(root, makeCell('own-force-1'));
    await claimCellCrossSession(root, { sessionId: 'sess-owner', worker: 'w', cellId: 'own-force-1' });
    await recordVerify(root, 'own-force-1', {
      command: 'node -e "process.exit(0)"',
      output: 'ok',
      passed: true,
      sessionId: 'sess-forcer',
      forceOwnership: true,
    });
    const afterVerify = readCell(root, 'own-force-1');
    assert(
      Array.isArray(afterVerify.trace.ownership_overrides) && afterVerify.trace.ownership_overrides.length === 1,
      `recordVerify force appends one override row, got ${JSON.stringify(afterVerify.trace.ownership_overrides)}`,
    );
    const row = afterVerify.trace.ownership_overrides[0];
    assert(
      row.verb === 'recordVerify' && row.forced_by === 'sess-forcer' && row.owner_bypassed === 'sess-owner',
      `override row names forcer and bypassed owner, got ${JSON.stringify(row)}`,
    );
    assert(
      !Array.isArray(afterVerify.trace.deviations) || afterVerify.trace.deviations.length === 0,
      'the force audit never lands in trace.deviations (Δ5) — cap has not run yet to even populate it',
    );

    const capped = await capCell(root, 'own-force-1', {
      files_changed: ['a.js'],
      outcome: 'forced cap',
      deviations: ['unrelated planning deviation'], // capCell REPLACES deviations wholesale — proves ownership_overrides survives that wipe
      sessionId: 'sess-forcer',
      forceOwnership: true,
    });
    assert(
      capped.trace.ownership_overrides.length === 2,
      `cap force appends a SECOND row (append-only), got ${JSON.stringify(capped.trace.ownership_overrides)}`,
    );
    assert(capped.trace.ownership_overrides[1].verb === 'capCell', 'the second row is capCell\'s own audit line');
    assert(
      capped.trace.deviations.length === 1 && capped.trace.deviations[0] === 'unrelated planning deviation',
      'trace.deviations still holds only the cap-time deviations — the ownership audit key is untouched by capCell wholesale-replacing deviations',
    );
  },
);

await check(
  "a forced unclaim past another session's live claim still clears the claim file, so the forced-open cell is claimable by a new session (D4 Δ5)",
  async () => {
    addCell(root, makeCell('own-force-unclaim-1'));
    await claimCellCrossSession(root, { sessionId: 'sess-owner', worker: 'w', cellId: 'own-force-unclaim-1' });
    await unclaimCell(root, 'own-force-unclaim-1', { sessionId: 'sess-rescuer', forceOwnership: true });
    assert(
      readClaim(root, 'own-force-unclaim-1') === null,
      'forced unclaim releases the claim file — the cell must not stay self-refusing',
    );
    const reclaimed = await claimCellCrossSession(root, { sessionId: 'sess-rescuer', worker: 'w2', cellId: 'own-force-unclaim-1' });
    assert(reclaimed.ok === true, `the forced-open cell is claimable by the rescuing session, got ${JSON.stringify(reclaimed)}`);
    const afterReclaim = readCell(root, 'own-force-unclaim-1');
    assert(
      afterReclaim.trace.ownership_overrides.length === 1 && afterReclaim.trace.ownership_overrides[0].verb === 'unclaimCell',
      `the unclaim force audit row survives the reclaim, got ${JSON.stringify(afterReclaim.trace.ownership_overrides)}`,
    );
  },
);

printSummaryAndExit();
