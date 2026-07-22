#!/usr/bin/env node
// test_bundle_mode.mjs — the permanent suite for the ONE bundle-mode
// predicate and the scribing decision tree it routes (okf-switchover-f3, cell
// f3-2; G1/G3/G8/G9).
//
// WHY THIS SUITE EXISTS AT ALL (advisor-digest-f3 finding 1, measured): bee's
// own checkout HAS a bundle, and G2 forbids new prose under docs/specs/ here,
// so the home repo structurally CANNOT exercise the compatibility fallback end
// to end. The fallback is the promise that a host repo which never migrated
// keeps working byte-for-byte — a promise that, if left as prose, "ships
// working, rots in one release, no error". It is therefore proven in a
// bundle-LESS fixture repo, permanently, on every chain run.
//
// The three fixtures below are the whole point:
//   - bundle-LESS  -> the docs/specs/ path is selected, NO bundle path is
//                     touched, and NOTHING new is emitted (no deprecation
//                     notice, no nag, not one extra field) — G1.
//   - bundle-ful   -> the concept path is selected — G3.
//   - .gitkeep     -> a docs/knowledge/ directory holding only a .gitkeep is
//                     NOT a bundle. A directory is not a bundle; at least one
//                     concept must actually parse. This exact case is how the
//                     guarantee would rot silently in a host repo: scribing
//                     would write concepts nobody reads while docs/specs/
//                     quietly stopped updating.
//
// RED-FIRST (cell f3-2): written and run red — `bundleMode` and
// `scribingTarget` do not exist in lib/knowledge.mjs yet — BEFORE any
// implementation, per AGENTS.md critical rule 2.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitFrontmatter, bundleMode, scribingTarget } from '../lib/knowledge.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(TESTS_DIR, '..', '..', '..', '..');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error instanceof Error ? error.stack || error.message : error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── fixture builders (mkdtempSync roots only — never the real repo) ────────

function makeRepo(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bee-bundle-mode-${label}-`));
}

function writeFile(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
  return abs;
}

/** Canonical concept text through the real emitter (D12). */
function conceptText({
  type = 'bee.area',
  title = 'Demo area — purpose',
  description = 'A canonical fixture concept.',
  id = 'demo-area-overview',
  areas = ['demo-area'],
  authoritativeFor = null,
  body = 'Body.',
} = {}) {
  const bee = { id, lifecycle: 'active', areas };
  if (authoritativeFor) bee.authoritative_for = authoritativeFor;
  const data = { type, title, description, tags: ['demo'], timestamp: '2026-07-22', bee };
  return `${emitFrontmatter(data)}\n# ${title}\n\n${body}\n`;
}

/** A host repo that never migrated: docs/specs/ only, no docs/knowledge/. */
function makeBundlelessRepo() {
  const root = makeRepo('bundleless');
  writeFile(root, 'docs/specs/reading-map.md', '# Reading map\n\n- billing: docs/specs/billing.md\n');
  writeFile(root, 'docs/specs/billing.md', '# Billing\n\n## Purpose\n\nCharges customers.\n');
  return root;
}

/** A migrated repo: a bundle with concepts that actually parse. */
function makeBundlefulRepo() {
  const root = makeRepo('bundleful');
  writeFile(root, 'docs/specs/reading-map.md', '# Reading map\n');
  writeFile(
    root,
    'docs/knowledge/areas/billing/overview.md',
    conceptText({
      id: 'billing-overview',
      title: 'Billing — purpose, vocabulary, and actors',
      areas: ['billing'],
      authoritativeFor: 'billing: purpose, vocabulary, and actors',
    }),
  );
  writeFile(
    root,
    'docs/knowledge/areas/billing/refunds.md',
    conceptText({
      id: 'billing-refunds',
      title: 'Billing — refunds',
      areas: ['billing'],
      authoritativeFor: 'billing: refunds and reversals',
    }),
  );
  return root;
}

/** The rot case: docs/knowledge/ exists but holds no concept at all. */
function makeGitkeepRepo() {
  const root = makeRepo('gitkeep');
  writeFile(root, 'docs/specs/billing.md', '# Billing\n');
  writeFile(root, 'docs/knowledge/.gitkeep', '');
  return root;
}

function listBundleFiles(root) {
  const dir = path.join(root, 'docs', 'knowledge');
  const out = [];
  const walk = (abs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
      else out.push(childRel);
    }
  };
  walk(dir, '');
  return out.sort();
}

// Anything that would tell an un-migrated host repo that this release
// happened. G1: the fallback is not a deprecation warning and never nags.
const NAG_RE = /deprecat|obsolete|legacy tree|no longer supported|please migrate|will be removed|superseded by docs\/knowledge|consider migrating/i;

const TARGET_KEYS = ['bundle_mode', 'action', 'area', 'subject', 'path', 'owner', 'regenerate_index'];

// ─── G8: the ONE predicate ─────────────────────────────────────────────────

await check('bundleMode is FALSE when docs/knowledge/ does not exist at all', async () => {
  const root = makeBundlelessRepo();
  assert(bundleMode(root) === false, 'a repo with no docs/knowledge/ is not in bundle mode');
});

await check('bundleMode is FALSE for a docs/knowledge/ containing only a .gitkeep (a directory is not a bundle)', async () => {
  const root = makeGitkeepRepo();
  assert(fs.existsSync(path.join(root, 'docs', 'knowledge')), 'fixture really does have the directory');
  assert(bundleMode(root) === false, 'an empty docs/knowledge/ must NOT flip a host repo into bundle mode');
});

await check('bundleMode is FALSE for a bundle holding only reserved files (index.md / log.md are not concepts)', async () => {
  const root = makeRepo('reserved');
  writeFile(root, 'docs/knowledge/index.md', '---\nokf_version: "0.1"\n---\n\n# Index\n');
  writeFile(root, 'docs/knowledge/log.md', '# Log\n\n## 2026-07-22\n');
  assert(bundleMode(root) === false, 'reserved basenames are never concepts (OKF §3.1)');
});

await check('bundleMode is FALSE when no concept actually parses (frontmatter absent or unparseable)', async () => {
  const root = makeRepo('unparseable');
  writeFile(root, 'docs/knowledge/areas/billing/overview.md', '# No frontmatter here\n');
  writeFile(root, 'docs/knowledge/areas/billing/broken.md', '---\ntype: bee.area\n# never closed\n');
  assert(bundleMode(root) === false, 'files that do not parse as concepts do not make a bundle');
});

await check('bundleMode is TRUE as soon as ONE concept parses', async () => {
  const root = makeBundlefulRepo();
  assert(bundleMode(root) === true, 'a bundle with parsing concepts is bundle mode');
});

await check("bundleMode is TRUE for bee's own checkout (the live bundle)", async () => {
  assert(bundleMode(REPO_ROOT) === true, 'the home repo has a real bundle');
});

await check('bundleMode never throws on a nonexistent root or on a file where the bundle dir should be', async () => {
  assert(bundleMode(path.join(os.tmpdir(), 'bee-does-not-exist-xyz')) === false, 'missing root is false, not a throw');
  const root = makeRepo('filedir');
  writeFile(root, 'docs/knowledge', 'not a directory\n');
  assert(bundleMode(root) === false, 'a FILE at docs/knowledge is not a bundle');
});

// ─── G1: the bundle-LESS fixture — today's behaviour, byte-for-byte ─────────

await check('bundle-less fixture: an existing area routes to docs/specs/<area>.md, in place', async () => {
  const root = makeBundlelessRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: refunds and reversals' });
  assert(target.bundle_mode === false, 'fallback mode');
  assert(target.action === 'update-spec', `in-place spec update, got ${target.action}`);
  assert(target.path === 'docs/specs/billing.md', `today's path, got ${target.path}`);
  assert(target.regenerate_index === false, 'no index to regenerate without a bundle');
  assert(target.owner === null, 'no concept owners exist');
});

await check('bundle-less fixture: a brand-new area routes to docs/specs/<area>.md — one area, one file, forever', async () => {
  const root = makeBundlelessRepo();
  const target = scribingTarget(root, { area: 'payouts', subject: 'payouts: schedule' });
  assert(target.bundle_mode === false, 'fallback mode');
  assert(target.action === 'create-spec', `first write creates the one spec, got ${target.action}`);
  assert(target.path === 'docs/specs/payouts.md', `today's path, got ${target.path}`);
});

await check('bundle-less fixture: NO bundle path is named, and none is created on disk', async () => {
  const root = makeBundlelessRepo();
  for (const area of ['billing', 'payouts']) {
    const target = scribingTarget(root, { area, subject: `${area}: something` });
    const serialized = JSON.stringify(target);
    assert(!serialized.includes('docs/knowledge'), `no bundle path in the result: ${serialized}`);
    assert(!serialized.includes('areas/'), `no bundle-relative path in the result: ${serialized}`);
  }
  assert(!fs.existsSync(path.join(root, 'docs', 'knowledge')), 'resolving a target creates no bundle directory');
  assert(listBundleFiles(root).length === 0, 'not one bundle file touched');
});

await check('bundle-less fixture: nothing new is emitted — no deprecation notice, no nag, no extra field', async () => {
  const root = makeBundlelessRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: refunds and reversals' });
  const serialized = JSON.stringify(target);
  assert(!NAG_RE.test(serialized), `the fallback must say nothing new: ${serialized}`);
  const keys = Object.keys(target).sort();
  assert(
    JSON.stringify(keys) === JSON.stringify([...TARGET_KEYS].sort()),
    `the fallback result carries exactly the pinned keys, got ${JSON.stringify(keys)}`,
  );
});

await check('.gitkeep fixture: the empty docs/knowledge/ still routes to docs/specs/ (the silent-rot case)', async () => {
  const root = makeGitkeepRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: refunds' });
  assert(target.bundle_mode === false, 'a .gitkeep is not a bundle');
  assert(target.path === 'docs/specs/billing.md', `still the spec path, got ${target.path}`);
  assert(listBundleFiles(root).join(',') === '.gitkeep', 'the bundle directory is left exactly as found');
});

// ─── G3: the bundle-ful fixture — the concept path ─────────────────────────

await check('bundle-ful fixture (a): a subject already owned updates THAT concept', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: refunds and reversals' });
  assert(target.bundle_mode === true, 'bundle mode');
  assert(target.action === 'update-concept', `owned subject updates in place, got ${target.action}`);
  assert(target.path === 'docs/knowledge/areas/billing/refunds.md', `the owning concept, got ${target.path}`);
  assert(target.owner && target.owner.id === 'billing-refunds', 'the owner is named');
  assert(target.regenerate_index === false, 'an in-place update adds no index row');
});

await check('bundle-ful fixture (a): ownership matching ignores case and surrounding whitespace', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'billing', subject: '  Billing:  Refunds and Reversals  ' });
  assert(target.action === 'update-concept', `normalized match, got ${target.action}`);
  assert(target.path === 'docs/knowledge/areas/billing/refunds.md', `the owning concept, got ${target.path}`);
});

await check('bundle-ful fixture (b): a new subject in an existing area authors a new concept there and regenerates the index', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: dunning and retries' });
  assert(target.bundle_mode === true, 'bundle mode');
  assert(target.action === 'new-concept', `new subject, existing area, got ${target.action}`);
  assert(
    target.path === 'docs/knowledge/areas/billing/dunning-and-retries.md',
    `slug derived from the subject, got ${target.path}`,
  );
  assert(target.owner === null, 'nobody owns it yet');
  assert(target.regenerate_index === true, 'a new file means the index must be regenerated');
});

await check('bundle-ful fixture (c): a brand-new area creates areas/<slug>/ with an overview concept', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'payouts', subject: 'payouts: purpose and actors' });
  assert(target.action === 'new-area', `brand-new area, got ${target.action}`);
  assert(target.path === 'docs/knowledge/areas/payouts/overview.md', `overview concept, got ${target.path}`);
  assert(target.regenerate_index === true, 'a new area means the index must be regenerated');
});

// ─── G9: the anti-fork gate ────────────────────────────────────────────────

await check('anti-fork: authoring a NEW concept for an already-owned subject is REFUSED, naming the owner', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, {
    area: 'billing',
    subject: 'billing: refunds and reversals',
    intent: 'new-concept',
  });
  assert(target.action === 'fork_denied', `a second concept on one subject is refused, got ${target.action}`);
  assert(target.path === null, 'a refusal hands back NO path to write to');
  assert(target.owner && target.owner.path === 'docs/knowledge/areas/billing/refunds.md', 'the refusal names the owner');
  assert(target.regenerate_index === false, 'nothing to regenerate');
});

await check('anti-fork: an owned subject is never routed to a second file even when its slug differs from the owner filename', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: refunds and reversals' });
  assert(target.path !== 'docs/knowledge/areas/billing/refunds-and-reversals.md', 'no -v2 by slug drift');
  assert(target.path === 'docs/knowledge/areas/billing/refunds.md', 'the one owning file, always');
});

await check('anti-fork: a derived filename that already exists is an in-place update, never a second file', async () => {
  const root = makeBundlefulRepo();
  // A concept file whose name matches the subject slug but claims no subject.
  writeFile(
    root,
    'docs/knowledge/areas/billing/invoices.md',
    conceptText({ id: 'billing-invoices', title: 'Billing — invoices', areas: ['billing'] }),
  );
  const target = scribingTarget(root, { area: 'billing', subject: 'billing: invoices' });
  assert(target.action === 'update-concept', `an existing path is updated, never duplicated, got ${target.action}`);
  assert(target.path === 'docs/knowledge/areas/billing/invoices.md', `got ${target.path}`);
});

await check('anti-fork: ownership is bundle-wide — a subject owned in ANOTHER area still blocks a new concept here', async () => {
  const root = makeBundlefulRepo();
  const target = scribingTarget(root, { area: 'payouts', subject: 'billing: refunds and reversals' });
  assert(target.action === 'update-concept', `the owner wins over the requested area, got ${target.action}`);
  assert(target.path === 'docs/knowledge/areas/billing/refunds.md', 'routed to the one authority');
});

// ─── the prose that must not rot back (advisor finding 1: prose alone rots) ─

await check('bee-scribing routes on the ONE predicate and names the bundle area path', async () => {
  const skill = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'bee-scribing', 'SKILL.md'), 'utf8');
  assert(/bundleMode/.test(skill), 'the skill cites the one predicate by name');
  assert(/docs\/knowledge\/areas\//.test(skill), 'the skill names where concepts live');
  assert(/authoritative_for/.test(skill), 'the anti-fork gate is specified');
  assert(/emitFrontmatter/.test(skill), 'frontmatter always through the canonical emitter');
});

await check('bee-scribing no longer routes new area truth into docs/specs/ when a bundle exists', async () => {
  const skill = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'bee-scribing', 'SKILL.md'), 'utf8');
  const start = skill.indexOf('### 2a.');
  const end = skill.indexOf('### 2b.');
  assert(start !== -1 && end > start, 'the routing section has a bundle branch and a fallback branch');
  const bundleBranch = skill.slice(start, end);
  assert(!bundleBranch.includes('docs/specs/<area>.md'), 'the bundle branch never sends area truth to a spec file');
  assert(bundleBranch.includes('docs/knowledge/areas/'), 'the bundle branch names the concept home');
  // The fallback branch keeps today's rule, verbatim and un-annotated.
  const fallback = skill.slice(end);
  assert(
    fallback.includes('**One area = one file, forever.**'),
    "today's rule survives untouched in the no-bundle branch",
  );
});

await check('bee-scribing carries NO deprecation notice and no nag anywhere', async () => {
  const skill = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'bee-scribing', 'SKILL.md'), 'utf8');
  assert(!NAG_RE.test(skill), 'an un-migrated host repo must not be told this release happened');
});

await check('the okf-profile area-concept template carries the nine-section skeleton and the rebuild bar', async () => {
  const profile = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'specs', 'okf-profile.md'), 'utf8');
  const marker = '### `bee.area`';
  const start = profile.indexOf(marker);
  assert(start !== -1, 'the Templates section carries a bee.area template');
  const nextTemplate = profile.indexOf('\n### ', start + marker.length);
  const section = profile.slice(start, nextTemplate === -1 ? profile.length : nextTemplate);
  const NINE = [
    'Purpose',
    'Entry Points & Triggers',
    'Data Dictionary',
    'Behaviors & Operations',
    'Actors & Access',
    'Business Rules',
    'Edge Cases Settled',
    'Open Gaps',
    'Pointers (implementation)',
  ];
  for (const heading of NINE) {
    assert(section.includes(`## ${heading}`), `the template carries "## ${heading}"`);
  }
  assert(/rebuild bar/i.test(section), 'the rebuild bar is stated as the acceptance test, not left to discretion');
  assert(/authoritative_for/.test(section), 'the template shows the subject-ownership field');
});

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} test_bundle_mode: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
