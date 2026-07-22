#!/usr/bin/env node
// test_knowledge.mjs — self-contained contract tests (no framework) for the
// OKF v0.1 bundle core: lib/knowledge.mjs (emitter-first frontmatter parser,
// concept model, checkBundle) plus the `bee knowledge check` CLI wiring
// (okf-foundation S1, cell okf-1; D4/D12/D13/D18/D19/D23/D32).
//
// RED-FIRST (cell okf-1): this file is written and run red (lib/knowledge.mjs
// does not exist yet) BEFORE any implementation, per docs/history/
// okf-foundation/plan.md §File order S1 and AGENTS.md critical rule 2.
//
// Advisor digest s1 items 1+2 are pinned here on purpose: the silent-misparse
// class (colon in an unquoted title, '#' mid-value, CRLF frontmatter) must
// surface as a not_canonical profile warning — parsed data preserved, never
// silently mangled, never a silent green.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';
import {
  CONCEPT_TYPES,
  LIFECYCLES,
  parseFrontmatter,
  emitFrontmatter,
  checkBundle,
  bundleDir,
} from '../lib/knowledge.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.dirname(TESTS_DIR);
const BEE_MJS = path.join(TEMPLATES_DIR, 'bee.mjs');

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
    console.log(`      ${error instanceof Error ? (error.stack || error.message) : error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── fixture builders (mkdtempSync fixture roots only — never the real repo) ─

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-knowledge-test-'));
  fs.mkdirSync(path.join(root, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(root, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  return root;
}

function writeBundleFile(root, rel, text) {
  const abs = path.join(root, 'docs', 'knowledge', rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
  return abs;
}

/** Canonical concept file text built through the real emitter (D12: the
 *  emitter is the subset's source of truth, so fixtures author through it). */
function conceptText({
  type = 'bee.pattern',
  title = 'A demo pattern',
  description = 'A canonical fixture concept',
  id = 'demo-pattern',
  lifecycle = 'active',
  omitRoot = [],
  extraBee = {},
} = {}) {
  const data = {
    type,
    title,
    description,
    tags: ['demo'],
    timestamp: '2026-07-22',
    bee: {
      id,
      lifecycle,
      areas: ['demo-area'],
      required_context: [],
      decisions: [],
      sources: [],
      ...extraBee,
    },
  };
  for (const key of omitRoot) delete data[key];
  return `${emitFrontmatter(data)}\n# ${title}\n\nBody.\n`;
}

function findingCodes(list) {
  return list.map((f) => f.code);
}

async function runBee(args, cwd) {
  return runModuleWorker(BEE_MJS, { args, cwd });
}

// ─── exports: the closed vocabulary and lifecycle enums (D18/D19) ───────────

await check('CONCEPT_TYPES is the closed nine-type D18 vocabulary, slug-cased; LIFECYCLES the four D19 states', async () => {
  const expected = [
    'bee.area',
    'bee.feature',
    'bee.work-item',
    'bee.plan',
    'bee.delivery',
    'bee.decision',
    'bee.pattern',
    'bee.runbook',
    'bee.evidence',
  ];
  assert(JSON.stringify([...CONCEPT_TYPES].sort()) === JSON.stringify([...expected].sort()), `expected the nine D18 types, got ${JSON.stringify(CONCEPT_TYPES)}`);
  assert(CONCEPT_TYPES.length === 9, `vocabulary must be closed at nine, got ${CONCEPT_TYPES.length}`);
  assert(JSON.stringify([...LIFECYCLES].sort()) === JSON.stringify(['active', 'archived', 'draft', 'superseded'].sort()), `expected the four D19 lifecycles, got ${JSON.stringify(LIFECYCLES)}`);
});

// ─── emitter-first parser: round-trip on the emitted subset (D12) ──────────

await check('emit → parse → re-emit is byte-identical, including Vietnamese titles and every D19 field', async () => {
  const data = {
    type: 'bee.pattern',
    title: 'Định tuyến phiên làm việc — quy tắc vàng',
    description: 'Mô tả có dấu tiếng Việt: được trích dẫn vì chứa dấu hai chấm',
    tags: ['mẫu', 'quy-tắc'],
    timestamp: '2026-07-22T03:00:00Z',
    resource: 'https://example.com/x',
    bee: {
      id: 'vn-pattern',
      lifecycle: 'active',
      areas: ['workflow'],
      required_context: ['areas/workflow/overview.md'],
      decisions: ['D19', 'D32'],
      sources: ['docs/specs/advisor-protocol.md'],
      lane: 'high-risk',
      polarity: 'practice',
      critical: true,
      authoritative_for: 'session-routing',
      review_status: 'Draft',
      supersedes: 'old-pattern',
    },
  };
  const emitted = emitFrontmatter(data);
  const parsed = parseFrontmatter(`${emitted}\nBody.\n`);
  assert(parsed.ok === true && parsed.present === true, `canonical emit must parse: ${JSON.stringify(parsed)}`);
  assert(JSON.stringify(parsed.data) === JSON.stringify(data), `parsed data must equal the emitted data.\nemitted: ${JSON.stringify(data)}\nparsed: ${JSON.stringify(parsed.data)}`);
  assert(emitFrontmatter(parsed.data) === emitted, 're-emit of parsed data must be byte-identical to the first emit');
  assert(parsed.block === emitted, 'parsed.block must be the exact frontmatter bytes from the file');
});

await check('parser fails loudly (typed, never a guess) outside the emitted subset (D12)', async () => {
  const cases = [
    ['---\ntype: bee.pattern\n', 'unclosed ---'],
    ['---\ntype: bee.pattern\n\ttitle: tabbed\n---\n', 'tab in frontmatter'],
    ['---\ntype: bee.pattern\ntype: bee.area\n---\n', 'duplicate key'],
    ["---\ntitle: 'single quoted'\n---\n", 'single-quoted scalar'],
    ['---\ntitle: "unterminated\n---\n', 'bad quoted string'],
    ['---\ntitle:no-space\n---\n', 'key:value without space'],
    ['---\ntype: bee.pattern\n\ntitle: x\n---\n', 'blank line inside frontmatter'],
    ['---\nnested:\n  deep: x\n---\n', 'nested map other than bee:'],
    ['---\ntitle: [unclosed, list\n---\n', 'unclosed flow list'],
  ];
  for (const [text, label] of cases) {
    const parsed = parseFrontmatter(text);
    assert(parsed.ok === false, `${label}: must fail, got ${JSON.stringify(parsed)}`);
    assert(parsed.error && typeof parsed.error.code === 'string' && parsed.error.code, `${label}: failure must carry a typed code`);
    assert(typeof parsed.error.message === 'string' && parsed.error.message, `${label}: failure must carry a message`);
  }
});

await check('a file with no leading --- reports present:false (no frontmatter), never a throw', async () => {
  const parsed = parseFrontmatter('# Just a heading\n\nProse.\n');
  assert(parsed.ok === true && parsed.present === false, `expected present:false, got ${JSON.stringify(parsed)}`);
});

// ─── empty bundle is OK (D23: a bundle with nothing in it is conformant) ────

await check('empty bundle: missing docs/knowledge/ and an empty docs/knowledge/ both check OK with zeroed counts', async () => {
  const missing = makeRepo();
  const reportMissing = checkBundle(missing);
  assert(reportMissing.okf.errors.length === 0 && reportMissing.profile.warnings.length === 0, `missing bundle dir must yield zero findings: ${JSON.stringify(reportMissing)}`);
  assert(reportMissing.counts.files === 0 && reportMissing.counts.concepts === 0, `missing bundle dir must count zero files: ${JSON.stringify(reportMissing.counts)}`);
  assert(reportMissing.ok === true, 'empty bundle must be ok');

  const empty = makeRepo();
  fs.mkdirSync(bundleDir(empty), { recursive: true });
  const reportEmpty = checkBundle(empty);
  assert(reportEmpty.ok === true && reportEmpty.counts.files === 0, `empty bundle dir must be ok: ${JSON.stringify(reportEmpty)}`);
});

// ─── OKF error classes (D4, one per class) ──────────────────────────────────

await check('OKF error: a non-reserved .md with no frontmatter', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/naked.md', '# No frontmatter here\n');
  const report = checkBundle(root);
  assert(findingCodes(report.okf.errors).includes('missing_frontmatter'), `expected missing_frontmatter, got ${JSON.stringify(report.okf.errors)}`);
  assert(report.okf.errors.some((e) => e.file === 'patterns/naked.md'), 'error must name the file');
  assert(report.ok === false, 'an OKF error must fail the check');
});

await check('OKF error: unparseable frontmatter (unclosed ---) names the file with the typed parser failure', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/broken.md', '---\ntype: bee.pattern\nno closing delimiter\n');
  const report = checkBundle(root);
  const err = report.okf.errors.find((e) => e.code === 'unparseable_frontmatter');
  assert(err, `expected unparseable_frontmatter, got ${JSON.stringify(report.okf.errors)}`);
  assert(err.file === 'patterns/broken.md', `error must name the file, got ${JSON.stringify(err)}`);
});

await check('OKF error: empty type and absent type both flagged (OKF §4.1: type is REQUIRED)', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/empty-type.md', conceptText({ type: '', id: 'empty-type' }));
  writeBundleFile(root, 'patterns/no-type.md', conceptText({ id: 'no-type', omitRoot: ['type'] }));
  const report = checkBundle(root);
  const emptyTypeErrors = report.okf.errors.filter((e) => e.code === 'empty_type');
  assert(emptyTypeErrors.length === 2, `expected two empty_type errors, got ${JSON.stringify(report.okf.errors)}`);
  assert(new Set(emptyTypeErrors.map((e) => e.file)).size === 2, 'each error must name its own file');
});

await check('OKF error: frontmatter in a non-root index.md; a root index.md with only okf_version is clean', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'index.md', '---\nokf_version: "0.1"\n---\n\n# Bundle index\n');
  writeBundleFile(root, 'areas/demo/index.md', '---\nokf_version: "0.1"\n---\n\n# Area index\n');
  const report = checkBundle(root);
  const err = report.okf.errors.find((e) => e.code === 'index_frontmatter');
  assert(err, `expected index_frontmatter, got ${JSON.stringify(report.okf.errors)}`);
  assert(err.file === 'areas/demo/index.md', `error must name the non-root index, got ${JSON.stringify(err)}`);
  assert(!report.okf.errors.some((e) => e.file === 'index.md'), `root index.md with only okf_version must be clean, got ${JSON.stringify(report.okf.errors)}`);
});

await check('OKF error: root index.md carrying any key but okf_version', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'index.md', '---\nokf_version: "0.1"\ntitle: sneaky\n---\n\n# Bundle index\n');
  const report = checkBundle(root);
  const err = report.okf.errors.find((e) => e.code === 'root_index_extra_keys');
  assert(err, `expected root_index_extra_keys, got ${JSON.stringify(report.okf.errors)}`);
  assert(/title/.test(err.message), `the offending key must be named, got ${JSON.stringify(err)}`);
});

await check('OKF error: log.md date heading not ISO 8601 (OKF §7); ISO headings pass', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'log.md', '# Log\n\n## 2026-07-22\n\nFine.\n\n## July 22, 2026\n\nNot fine.\n');
  const report = checkBundle(root);
  const errs = report.okf.errors.filter((e) => e.code === 'log_heading_not_iso');
  assert(errs.length === 1, `exactly the non-ISO heading must be flagged, got ${JSON.stringify(report.okf.errors)}`);
  assert(/July 22, 2026/.test(errs[0].message), `the offending heading must be quoted, got ${JSON.stringify(errs[0])}`);
});

// ─── profile warning classes (D4, one per class; never OKF errors) ─────────

await check('profile warning: type outside the D18 nine warns, does not error, exits ok un-strict', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/guide.md', conceptText({ type: 'bee.guide', id: 'guide-1' }));
  const report = checkBundle(root);
  assert(report.okf.errors.length === 0, `unknown type is a SHOULD, never an error: ${JSON.stringify(report.okf.errors)}`);
  const warn = report.profile.warnings.find((w) => w.code === 'unknown_type');
  assert(warn && warn.file === 'patterns/guide.md' && /bee\.guide/.test(warn.message), `expected unknown_type naming bee.guide, got ${JSON.stringify(report.profile.warnings)}`);
  assert(report.ok === true, 'warnings alone must not fail un-strict');
});

await check('profile warning: missing profile-required field (D10: never invented, warned by name)', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/undescribed.md', conceptText({ id: 'undescribed', omitRoot: ['description'] }));
  const report = checkBundle(root);
  const warn = report.profile.warnings.find((w) => w.code === 'missing_profile_field' && /description/.test(w.message));
  assert(warn && warn.file === 'patterns/undescribed.md', `expected missing_profile_field naming description, got ${JSON.stringify(report.profile.warnings)}`);
  assert(report.okf.errors.length === 0, 'a missing profile field is never an OKF error');
});

await check('profile warning: dangling required_context path; a resolving path stays silent', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'areas/demo/overview.md', conceptText({ type: 'bee.area', id: 'demo-overview', extraBee: { authoritative_for: 'demo-overview-subject' } }));
  writeBundleFile(root, 'patterns/linked.md', conceptText({ id: 'linked', extraBee: { required_context: ['areas/demo/overview.md', 'areas/ghost/nothing.md'] } }));
  const report = checkBundle(root);
  const dangling = report.profile.warnings.filter((w) => w.code === 'dangling_required_context');
  assert(dangling.length === 1, `only the ghost path may warn, got ${JSON.stringify(report.profile.warnings)}`);
  assert(/areas\/ghost\/nothing\.md/.test(dangling[0].message) && dangling[0].file === 'patterns/linked.md', `warning must name file and target, got ${JSON.stringify(dangling[0])}`);
});

await check('profile warning: dangling supersedes id; a resolving id stays silent', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/old.md', conceptText({ id: 'old-pattern', lifecycle: 'superseded' }));
  writeBundleFile(root, 'patterns/new.md', conceptText({ id: 'new-pattern', extraBee: { supersedes: 'old-pattern' } }));
  writeBundleFile(root, 'patterns/orphan.md', conceptText({ id: 'orphan', extraBee: { supersedes: 'never-existed' } }));
  const report = checkBundle(root);
  const dangling = report.profile.warnings.filter((w) => w.code === 'dangling_supersedes');
  assert(dangling.length === 1 && dangling[0].file === 'patterns/orphan.md' && /never-existed/.test(dangling[0].message), `expected one dangling_supersedes for orphan, got ${JSON.stringify(report.profile.warnings)}`);
});

await check('profile warning: duplicate bee.id (D31: id is globally unique)', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/a.md', conceptText({ id: 'same-id' }));
  writeBundleFile(root, 'patterns/b.md', conceptText({ id: 'same-id' }));
  const report = checkBundle(root);
  const dup = report.profile.warnings.find((w) => w.code === 'duplicate_id');
  assert(dup && /same-id/.test(dup.message), `expected duplicate_id naming same-id, got ${JSON.stringify(report.profile.warnings)}`);
  assert(/patterns\/a\.md/.test(dup.message) || dup.file === 'patterns/a.md', 'both claimants must be traceable from the warning');
});

await check('profile warning: duplicate bee.authoritative_for (D31: one subject, one authority)', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'areas/x/one.md', conceptText({ type: 'bee.area', id: 'x-one', extraBee: { authoritative_for: 'gates' } }));
  writeBundleFile(root, 'areas/x/two.md', conceptText({ type: 'bee.area', id: 'x-two', extraBee: { authoritative_for: 'gates' } }));
  const report = checkBundle(root);
  const dup = report.profile.warnings.find((w) => w.code === 'duplicate_authoritative_for');
  assert(dup && /gates/.test(dup.message), `expected duplicate_authoritative_for naming the subject, got ${JSON.stringify(report.profile.warnings)}`);
});

// ─── advisor round-trip guard: misparse candidates warn, never silently ────

await check('round-trip guard: colon in an unquoted title parses (data intact) and warns not_canonical', async () => {
  const root = makeRepo();
  const canonical = conceptText({ id: 'colon-title' });
  const bent = canonical.replace('title: A demo pattern', 'title: Routing: the golden rule');
  writeBundleFile(root, 'patterns/colon.md', bent);
  const report = checkBundle(root);
  assert(report.okf.errors.length === 0, `a colon title is not an OKF error: ${JSON.stringify(report.okf.errors)}`);
  const warn = report.profile.warnings.find((w) => w.code === 'not_canonical' && w.file === 'patterns/colon.md');
  assert(warn, `expected not_canonical naming the file, got ${JSON.stringify(report.profile.warnings)}`);
  const parsed = parseFrontmatter(fs.readFileSync(path.join(bundleDir(root), 'patterns/colon.md'), 'utf8'));
  assert(parsed.ok && parsed.data.title === 'Routing: the golden rule', `the colon value must survive parsing intact, got ${JSON.stringify(parsed.data)}`);
});

await check('round-trip guard: "#" mid-value is kept as data (never comment-stripped) and warns not_canonical', async () => {
  const root = makeRepo();
  const canonical = conceptText({ id: 'hash-title' });
  const bent = canonical.replace('title: A demo pattern', 'title: value # not a comment');
  writeBundleFile(root, 'patterns/hash.md', bent);
  const report = checkBundle(root);
  assert(report.okf.errors.length === 0, `a hash mid-value is not an OKF error: ${JSON.stringify(report.okf.errors)}`);
  assert(report.profile.warnings.some((w) => w.code === 'not_canonical' && w.file === 'patterns/hash.md'), `expected not_canonical, got ${JSON.stringify(report.profile.warnings)}`);
  const parsed = parseFrontmatter(fs.readFileSync(path.join(bundleDir(root), 'patterns/hash.md'), 'utf8'));
  assert(parsed.ok && parsed.data.title === 'value # not a comment', `the "#" must remain part of the value, got ${JSON.stringify(parsed.data && parsed.data.title)}`);
});

await check('round-trip guard: CRLF frontmatter parses (data intact) and warns not_canonical', async () => {
  const root = makeRepo();
  const canonical = conceptText({ id: 'crlf-concept' });
  writeBundleFile(root, 'patterns/crlf.md', canonical.replace(/\n/g, '\r\n'));
  const report = checkBundle(root);
  assert(report.okf.errors.length === 0, `CRLF is not an OKF error: ${JSON.stringify(report.okf.errors)}`);
  assert(report.profile.warnings.some((w) => w.code === 'not_canonical' && w.file === 'patterns/crlf.md'), `expected not_canonical for CRLF, got ${JSON.stringify(report.profile.warnings)}`);
  const parsed = parseFrontmatter(fs.readFileSync(path.join(bundleDir(root), 'patterns/crlf.md'), 'utf8'));
  assert(parsed.ok && parsed.data.bee && parsed.data.bee.id === 'crlf-concept', `CRLF content must parse to the same data, got ${JSON.stringify(parsed.data)}`);
});

await check('a fully canonical bundle yields zero not_canonical warnings', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/clean.md', conceptText({ id: 'clean', title: 'Tiêu đề tiếng Việt không dấu ngoặc' }));
  const report = checkBundle(root);
  assert(!report.profile.warnings.some((w) => w.code === 'not_canonical'), `canonical files must not warn, got ${JSON.stringify(report.profile.warnings)}`);
});

// ─── D23: the walk never leaves docs/knowledge/ ─────────────────────────────

await check('check ignores broken .md outside docs/knowledge/ (D23: files outside the bundle are not concepts)', async () => {
  const root = makeRepo();
  fs.mkdirSync(path.join(root, 'docs', 'specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'specs', 'broken.md'), '---\ntotally: broken: yaml\nno close\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'legacy.md'), '# no frontmatter\n', 'utf8');
  writeBundleFile(root, 'patterns/clean.md', conceptText({ id: 'clean' }));
  const report = checkBundle(root);
  assert(report.okf.errors.length === 0 && report.counts.files === 1, `only the one bundle file may be seen, got ${JSON.stringify(report)}`);
});

// ─── --strict promotes warnings (D4/D13) ────────────────────────────────────

await check('strict flip: a warnings-only bundle is ok un-strict and not ok under strict', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/guide.md', conceptText({ type: 'bee.guide', id: 'guide-1' }));
  const loose = checkBundle(root);
  assert(loose.okf.errors.length === 0 && loose.profile.warnings.length > 0 && loose.ok === true, `un-strict must pass on warnings only, got ${JSON.stringify({ ok: loose.ok, counts: loose.counts })}`);
  const strict = checkBundle(root, { strict: true });
  assert(strict.ok === false, 'strict must fail on any finding');
});

// ─── CLI wiring: bee knowledge check (D13 --json shape + exit codes) ────────

await check('CLI: knowledge check --json on an empty repo exits 0 with the D13 {okf,profile,counts} shape', async () => {
  const root = makeRepo();
  const result = await runBee(['knowledge', 'check', '--json'], root);
  assert(result.status === 0, `expected exit 0, got ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert(report.okf && Array.isArray(report.okf.errors) && report.okf.errors.length === 0, `expected okf.errors [], got ${result.stdout}`);
  assert(report.profile && Array.isArray(report.profile.warnings) && report.profile.warnings.length === 0, `expected profile.warnings [], got ${result.stdout}`);
  assert(report.counts && report.counts.concepts === 0, `expected zero concepts, got ${result.stdout}`);
});

await check('CLI: an OKF error exits non-zero; warnings-only exits 0; --strict flips warnings-only to non-zero (D13)', async () => {
  const errRoot = makeRepo();
  writeBundleFile(errRoot, 'patterns/naked.md', '# No frontmatter\n');
  const errResult = await runBee(['knowledge', 'check', '--json'], errRoot);
  assert(errResult.status !== 0, `an OKF error must exit non-zero, got ${errResult.status}: ${errResult.stdout}`);
  const errReport = JSON.parse(errResult.stdout);
  assert(errReport.okf.errors.length === 1, `expected the one error in --json output, got ${errResult.stdout}`);

  const warnRoot = makeRepo();
  writeBundleFile(warnRoot, 'patterns/guide.md', conceptText({ type: 'bee.guide', id: 'guide-1' }));
  const loose = await runBee(['knowledge', 'check', '--json'], warnRoot);
  assert(loose.status === 0, `warnings-only must exit 0, got ${loose.status}: ${loose.stdout} ${loose.stderr}`);
  assert(JSON.parse(loose.stdout).profile.warnings.length > 0, `the warning must still be reported, got ${loose.stdout}`);
  const strict = await runBee(['knowledge', 'check', '--strict', '--json'], warnRoot);
  assert(strict.status !== 0, `--strict must exit non-zero on warnings, got ${strict.status}: ${strict.stdout}`);
});

await check('CLI: human (no --json) output names each finding and ends with a summary line', async () => {
  const root = makeRepo();
  writeBundleFile(root, 'patterns/naked.md', '# No frontmatter\n');
  const result = await runBee(['knowledge', 'check'], root);
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/patterns\/naked\.md/.test(result.stdout), `finding must name the file, got ${result.stdout}`);
  assert(/knowledge check:/.test(result.stdout), `expected the summary line, got ${result.stdout}`);
});

await check('CLI: knowledge.check appears in the bee --help --json manifest (test_bee_cli conformance)', async () => {
  const result = await runBee(['--help', '--json'], makeRepo());
  assert(result.status === 0, `--help --json must exit 0, got ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  const entry = manifest.commands.find((c) => c.name === 'knowledge.check');
  assert(entry, 'manifest must carry knowledge.check');
  assert(entry.invoke === 'bee knowledge check', `invoke must be "bee knowledge check", got ${entry.invoke}`);
  assert(Array.isArray(entry.examples) && entry.examples.length > 0, 'entry must carry runnable examples');
  assert(entry.parameters && entry.parameters.type === 'object' && entry.parameters.properties.strict, 'parameters must be JSON-Schema with a strict flag');
});

// ═══ okf-4 (S3): bee knowledge index + bee knowledge list ═══════════════════
// RED-FIRST (cell okf-4): these checks are written and run red (the index and
// list verbs do not exist yet) BEFORE any implementation.

/** Collect every index.md under the fixture bundle: Map rel -> content. */
function collectIndexFiles(root) {
  const dir = bundleDir(root);
  const out = new Map();
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
      else if (entry.isFile() && entry.name === 'index.md') out.set(childRel, fs.readFileSync(path.join(abs, entry.name), 'utf8'));
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out;
}

/** Fixture bundle exercising nested dirs, criticality, and every list filter. */
function makeIndexFixture() {
  const root = makeRepo();
  writeBundleFile(root, 'areas/demo/overview.md', conceptText({
    type: 'bee.area', id: 'demo-overview', title: 'Demo overview', description: 'Overview of the demo area',
    extraBee: { areas: ['routing'], authoritative_for: 'demo-overview' },
  }));
  writeBundleFile(root, 'areas/demo/rules.md', conceptText({
    type: 'bee.area', id: 'demo-rules', title: 'Demo rules', description: 'Rules of the demo area', lifecycle: 'draft',
    extraBee: { areas: ['routing'], authoritative_for: 'demo-rules' },
  }));
  writeBundleFile(root, 'patterns/critical-one.md', conceptText({
    id: 'critical-one', title: 'A critical pattern', description: 'Always in context',
    extraBee: { critical: true },
  }));
  writeBundleFile(root, 'patterns/plain.md', conceptText({
    id: 'plain-one', title: 'A plain pattern', description: 'Not critical',
  }));
  writeBundleFile(root, 'log.md', '# Log\n\n## 2026-07-22\n\n- Fixture bundle created.\n');
  return root;
}

await check('CLI: knowledge index generates an index at every level with concepts (root included); two consecutive runs are byte-identical, LF-only (D21)', async () => {
  const root = makeIndexFixture();
  const first = await runBee(['knowledge', 'index', '--json'], root);
  assert(first.status === 0, `first index run must exit 0, got ${first.status}: stdout=${first.stdout} stderr=${first.stderr}`);
  const snapshot1 = collectIndexFiles(root);
  const expected = ['areas/demo/index.md', 'areas/index.md', 'index.md', 'patterns/index.md'];
  assert(JSON.stringify([...snapshot1.keys()].sort()) === JSON.stringify(expected), `expected exactly ${JSON.stringify(expected)}, got ${JSON.stringify([...snapshot1.keys()].sort())}`);
  for (const [rel, content] of snapshot1) {
    assert(!content.includes('\r'), `${rel}: generated index must be LF-only`);
    assert(!/\d{2}:\d{2}:\d{2}/.test(content), `${rel}: generated index must carry no wall-clock value`);
  }
  const second = await runBee(['knowledge', 'index', '--json'], root);
  assert(second.status === 0, `second index run must exit 0, got ${second.status}: ${second.stderr}`);
  const snapshot2 = collectIndexFiles(root);
  assert(snapshot2.size === snapshot1.size, `run 2 must generate the same file set, got ${JSON.stringify([...snapshot2.keys()])}`);
  for (const [rel, content] of snapshot1) {
    assert(snapshot2.get(rel) === content, `${rel}: two consecutive runs must be byte-identical`);
  }
});

await check('CLI: index --check exits non-zero naming a doctored stale index; regeneration heals it (decisions render --check idiom)', async () => {
  const root = makeIndexFixture();
  const render = await runBee(['knowledge', 'index'], root);
  assert(render.status === 0, `render must exit 0, got ${render.status}: ${render.stderr}`);
  const fresh = await runBee(['knowledge', 'index', '--check', '--json'], root);
  assert(fresh.status === 0, `--check on a fresh render must exit 0, got ${fresh.status}: ${fresh.stdout}`);
  const doctored = path.join(bundleDir(root), 'areas', 'demo', 'index.md');
  fs.appendFileSync(doctored, '\nHand-edited drift.\n', 'utf8');
  const stale = await runBee(['knowledge', 'index', '--check'], root);
  assert(stale.status !== 0, `--check over a doctored index must exit non-zero, got ${stale.status}: ${stale.stdout}`);
  assert(/areas\/demo\/index\.md/.test(stale.stdout), `--check must NAME the stale file, got ${stale.stdout}`);
  const heal = await runBee(['knowledge', 'index'], root);
  assert(heal.status === 0, `regeneration must exit 0, got ${heal.status}: ${heal.stderr}`);
  const healed = await runBee(['knowledge', 'index', '--check', '--json'], root);
  assert(healed.status === 0, `--check after regeneration must exit 0 (healed), got ${healed.status}: ${healed.stdout}`);
});

await check('generated non-root indexes carry NO frontmatter — only the HTML provenance comment (D4/D21)', async () => {
  const root = makeIndexFixture();
  await runBee(['knowledge', 'index'], root);
  for (const rel of ['areas/index.md', 'areas/demo/index.md', 'patterns/index.md']) {
    const content = fs.readFileSync(path.join(bundleDir(root), rel), 'utf8');
    const parsed = parseFrontmatter(content);
    assert(parsed.ok === true && parsed.present === false, `${rel}: a non-root index must carry no frontmatter, got ${JSON.stringify(parsed)}`);
    assert(content.startsWith('<!--'), `${rel}: must open with the HTML provenance comment, got ${JSON.stringify(content.slice(0, 40))}`);
    assert(/GENERATED FILE — do not hand-edit/.test(content), `${rel}: provenance header must say GENERATED FILE — do not hand-edit`);
    assert(/bee knowledge index/.test(content), `${rel}: provenance header must name the regenerate command`);
  }
});

await check('generated root index keeps okf_version-only frontmatter + provenance comment, and the generated bundle passes knowledge check', async () => {
  const root = makeIndexFixture();
  await runBee(['knowledge', 'index'], root);
  const content = fs.readFileSync(path.join(bundleDir(root), 'index.md'), 'utf8');
  const parsed = parseFrontmatter(content);
  assert(parsed.ok === true && parsed.present === true, `root index must carry frontmatter, got ${JSON.stringify(parsed)}`);
  assert(JSON.stringify(Object.keys(parsed.data)) === JSON.stringify(['okf_version']), `root index frontmatter must carry ONLY okf_version, got ${JSON.stringify(parsed.data)}`);
  assert(parsed.data.okf_version === '0.1', `okf_version must be "0.1", got ${JSON.stringify(parsed.data.okf_version)}`);
  assert(/GENERATED FILE — do not hand-edit/.test(content), 'root index must carry the provenance comment');
  const checkResult = await runBee(['knowledge', 'check', '--json'], root);
  assert(checkResult.status === 0, `generated bundle must pass knowledge check, got ${checkResult.status}: ${checkResult.stdout}`);
  const report = JSON.parse(checkResult.stdout);
  assert(report.okf.errors.length === 0, `generated indexes must produce zero OKF errors, got ${JSON.stringify(report.okf.errors)}`);
});

await check('root index carries a "## Critical patterns" section listing exactly the bee.critical concepts (D21)', async () => {
  const root = makeIndexFixture();
  await runBee(['knowledge', 'index'], root);
  const content = fs.readFileSync(path.join(bundleDir(root), 'index.md'), 'utf8');
  const start = content.indexOf('## Critical patterns');
  assert(start !== -1, `root index must carry a "## Critical patterns" section, got ${content}`);
  const rest = content.slice(start + '## Critical patterns'.length);
  const nextHeading = rest.indexOf('\n## ');
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  assert(/\(patterns\/critical-one\.md\)/.test(section), `critical section must link the critical concept, got ${section}`);
  assert(/A critical pattern/.test(section), `critical section must carry the concept's title, got ${section}`);
  assert(!/patterns\/plain\.md/.test(section), `a non-critical concept must NOT appear in the critical section, got ${section}`);
});

await check('empty bundle: knowledge index generates the root index only', async () => {
  const root = makeRepo();
  const result = await runBee(['knowledge', 'index', '--json'], root);
  assert(result.status === 0, `index over an empty bundle must exit 0, got ${result.status}: ${result.stderr}`);
  const files = collectIndexFiles(root);
  assert(JSON.stringify([...files.keys()]) === JSON.stringify(['index.md']), `an empty bundle must generate the root index only, got ${JSON.stringify([...files.keys()])}`);
  const checkResult = await runBee(['knowledge', 'check', '--json'], root);
  assert(checkResult.status === 0, `the generated empty-bundle root index must pass check, got ${checkResult.status}: ${checkResult.stdout}`);
});

// ─── bee knowledge list (D15): rows, filters, never content ────────────────

await check('CLI: knowledge list --json rows carry exactly path,id,type,lifecycle,title — never file content (D15)', async () => {
  const root = makeIndexFixture();
  const result = await runBee(['knowledge', 'list', '--json'], root);
  assert(result.status === 0, `list must exit 0, got ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert(Array.isArray(report.concepts) && report.count === 4, `expected 4 concept rows, got ${result.stdout}`);
  for (const row of report.concepts) {
    assert(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(['id', 'lifecycle', 'path', 'title', 'type']), `row keys must be exactly path,id,type,lifecycle,title — got ${JSON.stringify(row)}`);
  }
  const overview = report.concepts.find((r) => r.path === 'areas/demo/overview.md');
  assert(overview && overview.id === 'demo-overview' && overview.type === 'bee.area' && overview.lifecycle === 'active' && overview.title === 'Demo overview', `overview row wrong: ${JSON.stringify(overview)}`);
  assert(!result.stdout.includes('Body.'), `list output must never carry file content, got ${result.stdout}`);
});

await check('CLI: knowledge list filters --type/--lifecycle/--area narrow the rows (D15)', async () => {
  const root = makeIndexFixture();
  const byType = JSON.parse((await runBee(['knowledge', 'list', '--type', 'bee.area', '--json'], root)).stdout);
  assert(byType.count === 2 && byType.concepts.every((r) => r.type === 'bee.area'), `--type bee.area must yield the 2 area rows, got ${JSON.stringify(byType)}`);
  const byLifecycle = JSON.parse((await runBee(['knowledge', 'list', '--lifecycle', 'draft', '--json'], root)).stdout);
  assert(byLifecycle.count === 1 && byLifecycle.concepts[0].id === 'demo-rules', `--lifecycle draft must yield only demo-rules, got ${JSON.stringify(byLifecycle)}`);
  const byArea = JSON.parse((await runBee(['knowledge', 'list', '--area', 'routing', '--json'], root)).stdout);
  assert(byArea.count === 2 && byArea.concepts.every((r) => r.path.startsWith('areas/demo/')), `--area routing must yield the 2 routing rows, got ${JSON.stringify(byArea)}`);
  const combined = JSON.parse((await runBee(['knowledge', 'list', '--type', 'bee.area', '--lifecycle', 'active', '--json'], root)).stdout);
  assert(combined.count === 1 && combined.concepts[0].id === 'demo-overview', `combined filters must intersect, got ${JSON.stringify(combined)}`);
});

await check('CLI: knowledge.index and knowledge.list appear in the bee --help --json manifest (test_bee_cli conformance)', async () => {
  const result = await runBee(['--help', '--json'], makeRepo());
  assert(result.status === 0, `--help --json must exit 0, got ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  for (const [name, invoke] of [['knowledge.index', 'bee knowledge index'], ['knowledge.list', 'bee knowledge list']]) {
    const entry = manifest.commands.find((c) => c.name === name);
    assert(entry, `manifest must carry ${name}`);
    assert(entry.invoke === invoke, `${name}: invoke must be "${invoke}", got ${entry.invoke}`);
    assert(Array.isArray(entry.examples) && entry.examples.length > 0, `${name}: entry must carry runnable examples`);
    assert(entry.examples.every((e) => !e.includes('--strict')), `${name}: no --strict anywhere in examples`);
  }
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
