// knowledge.mjs — OKF v0.1 knowledge-bundle core (okf-foundation S1, cell
// okf-1): the emitter-first frontmatter codec, the Bee OKF Profile concept
// model, and the two-level bundle checker behind `bee knowledge check`.
//
// Ground rules, all locked in docs/history/okf-foundation/CONTEXT.md:
//   D12 — zero dependencies. This file ships its own frontmatter parser
//         covering EXACTLY the YAML subset emitFrontmatter() produces, and
//         fails loudly (typed {code,message,line}) on anything outside it.
//         The emitter is the subset's single source of truth: "what parses"
//         is defined as "what the emitter can produce", never as "what YAML
//         allows". Hand-edited files that still parse but would not re-emit
//         byte-identically are surfaced as a not_canonical profile warning
//         (advisor digest s1 items 1-2) — the silent-misparse class (colon in
//         an unquoted title, '#' mid-value, CRLF line endings) becomes a
//         detectable finding instead of a wrong-without-erroring parse.
//   D23 — a concept is any non-reserved .md INSIDE docs/knowledge/; this
//         module never reads a file outside the bundle directory.
//   D2  — the bundle is the knowledge layer, never a write path into
//         .bee/*.json(l) runtime stores; this module performs no writes at
//         all.
//   D4  — check reports two levels: OKF errors (the spec's own MUSTs) and
//         profile warnings (bee's SHOULD layer); --strict promotes warnings.
//   D13 — the CLI handler (bee.mjs) emits {okf:{errors},profile:{warnings},
//         counts} and exits non-zero only on OKF errors, or on any finding
//         under --strict.
//   D18 — the type vocabulary is closed at nine, slug-cased.
//   D19/D32 — concept frontmatter carries type + title/description/tags/
//         timestamp (+ resource for an external asset) + a nested bee: map;
//         bee.id is identity, paths are link targets.

import fs from 'node:fs';
import path from 'node:path';

export const OKF_VERSION = '0.1';

// D18: the closed nine-type vocabulary. "Pitfall" is bee.pattern with
// bee.polarity: pitfall — never a tenth type.
export const CONCEPT_TYPES = [
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

// D19: the four lifecycle states of bee.lifecycle.
export const LIFECYCLES = ['draft', 'active', 'superseded', 'archived'];

// Canonical emission order (D19/D32). Unknown keys are legal input (OKF §8:
// consumers MUST NOT reject unknown fields) and are emitted after the known
// keys in sorted order — root-level unknowns before the bee: map, bee-level
// unknowns at the end of the map — so a canonical file with unknown keys
// still round-trips byte-identically.
const ROOT_KEY_ORDER = ['type', 'title', 'description', 'tags', 'timestamp', 'resource'];
const BEE_KEY_ORDER = [
  'id',
  'lifecycle',
  'areas',
  'required_context',
  'decisions',
  'sources',
  'lane',
  'polarity',
  'critical',
  'authoritative_for',
  'review_status',
  'supersedes',
  'superseded_by',
];

// Profile-required fields (D4 "missing profile-required field"; D10: the
// migrator never invents title/description — check warns instead). bee.id and
// bee.lifecycle join them because identity (D31 uniqueness) and lifecycle
// (D19) are what every consumer keys on.
const PROFILE_REQUIRED = [
  ['title'],
  ['description'],
  ['bee', 'id'],
  ['bee', 'lifecycle'],
];

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

// OKF §3.1 reserved names — not concepts, no frontmatter obligation (D23).
const RESERVED_BASENAMES = new Set(['index.md', 'log.md']);

/** The single directory this module is allowed to read (D17/D23). */
export function bundleDir(root) {
  return path.join(root, 'docs', 'knowledge');
}

// ─── emitter (the subset's source of truth, D12) ────────────────────────────

function isPlainSafe(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value !== value.trim()) return false;
  // Anything YAML could re-interpret (colon, hash, quotes, flow/block
  // indicators, escapes, control whitespace) is emitted JSON-quoted instead.
  if (/[:#"'\\\[\]{},\t\r\n]/.test(value)) return false;
  if (/^[-?&*!|>%@`]/.test(value)) return false;
  if (value === 'true' || value === 'false' || value === 'null') return false;
  return true;
}

function emitScalar(value, keyPath) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value !== 'string') {
    throw new Error(
      `emitFrontmatter: "${keyPath}" must be a string or boolean (the profile emits no other scalar kinds), got ${typeof value}.`,
    );
  }
  return isPlainSafe(value) ? value : JSON.stringify(value);
}

function emitValue(value, keyPath) {
  if (Array.isArray(value)) {
    return `[${value.map((item, i) => emitScalar(item, `${keyPath}[${i}]`)).join(', ')}]`;
  }
  return emitScalar(value, keyPath);
}

function assertEmittableKey(key, keyPath) {
  if (!KEY_RE.test(key)) {
    throw new Error(`emitFrontmatter: key "${keyPath}" is not a legal frontmatter key.`);
  }
}

function emitEntries(lines, map, order, indent, prefix) {
  const known = order.filter((key) => key in map);
  const unknown = Object.keys(map)
    .filter((key) => !order.includes(key) && key !== 'bee')
    .sort();
  for (const key of [...known, ...unknown]) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    assertEmittableKey(key, keyPath);
    const value = map[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      throw new Error(
        `emitFrontmatter: "${keyPath}" is a nested map — the profile's only nested map is the root-level "bee:".`,
      );
    }
    lines.push(`${indent}${key}: ${emitValue(value, keyPath)}`);
  }
}

/**
 * Emit the canonical frontmatter block (including both --- delimiter lines,
 * LF-terminated) for a concept data object. This function DEFINES the D12
 * subset: parseFrontmatter accepts exactly what this can produce, and the
 * checker's round-trip guard compares a file's real bytes against a re-emit
 * of its parsed data.
 */
export function emitFrontmatter(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('emitFrontmatter: data must be a plain object.');
  }
  const lines = ['---'];
  emitEntries(lines, data, ROOT_KEY_ORDER, '', '');
  if ('bee' in data) {
    const bee = data.bee;
    if (!bee || typeof bee !== 'object' || Array.isArray(bee)) {
      throw new Error('emitFrontmatter: "bee" must be a plain object.');
    }
    lines.push('bee:');
    emitEntries(lines, bee, BEE_KEY_ORDER, '  ', 'bee');
  }
  lines.push('---');
  return `${lines.join('\n')}\n`;
}

// ─── parser (accepts exactly the emitted subset; loud typed failure) ────────

function parseFailure(code, message, line) {
  return { ok: false, present: true, error: { code, message, line } };
}

function parseScalarToken(raw, lineNo) {
  if (raw === 'true') return { ok: true, value: true };
  if (raw === 'false') return { ok: true, value: false };
  if (raw.startsWith('"')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return parseFailure(
        'bad_quoted_string',
        `quoted value ${JSON.stringify(raw)} is not one complete JSON string`,
        lineNo,
      );
    }
    if (typeof parsed !== 'string') {
      return parseFailure('bad_quoted_string', 'quoted value did not decode to a string', lineNo);
    }
    return { ok: true, value: parsed };
  }
  if (raw.startsWith("'")) {
    return parseFailure(
      'single_quoted_string',
      'single-quoted scalars are outside the emitted subset — use double quotes',
      lineNo,
    );
  }
  if (/^[&*!|>%@`{}]/.test(raw)) {
    return parseFailure(
      'unsupported_scalar',
      `value starting with "${raw[0]}" (anchor/alias/block/flow-map indicator) is outside the emitted subset`,
      lineNo,
    );
  }
  // Plain scalar: the ENTIRE rest of the line, colons and hashes included.
  // The emitter would have quoted such a value, so keeping it as data here is
  // what turns "colon in an unquoted title" / "# mid-value" into a
  // round-trip (not_canonical) warning instead of a silent misparse.
  return { ok: true, value: raw };
}

function parseFlowList(raw, lineNo) {
  if (!raw.endsWith(']')) {
    return parseFailure('bad_flow_list', `flow list ${JSON.stringify(raw)} does not close with "]"`, lineNo);
  }
  const inner = raw.slice(1, -1).trim();
  if (inner === '') return { ok: true, value: [] };
  const segments = [];
  let current = '';
  let inQuote = false;
  let escaped = false;
  for (const ch of inner) {
    if (inQuote) {
      current += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inQuote = false;
    } else if (ch === '"') {
      current += ch;
      inQuote = true;
    } else if (ch === ',') {
      segments.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (inQuote) {
    return parseFailure('bad_flow_list', 'unterminated quoted item inside flow list', lineNo);
  }
  segments.push(current);
  const value = [];
  for (const segment of segments) {
    const token = segment.trim();
    if (token === '') {
      return parseFailure('bad_flow_list', 'empty item inside flow list', lineNo);
    }
    const parsed = parseScalarToken(token, lineNo);
    if (!parsed.ok) return parsed;
    value.push(parsed.value);
  }
  return { ok: true, value };
}

function parseKeyValueLine(line, target, lineNo, prefix) {
  const sep = line.indexOf(': ');
  if (sep === -1) {
    return parseFailure(
      'unrecognized_line',
      `line ${JSON.stringify(line)} is not "key: value", a "bee:" map header, or a closing "---"`,
      lineNo,
    );
  }
  const key = line.slice(0, sep);
  if (!KEY_RE.test(key)) {
    return parseFailure('bad_key', `${JSON.stringify(key)} is not a legal frontmatter key`, lineNo);
  }
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    return parseFailure('duplicate_key', `duplicate key "${prefix}${key}"`, lineNo);
  }
  const raw = line.slice(sep + 2);
  if (raw === '') {
    return parseFailure('empty_value', `key "${prefix}${key}" has no value after ": "`, lineNo);
  }
  const parsed = raw.startsWith('[') ? parseFlowList(raw, lineNo) : parseScalarToken(raw, lineNo);
  if (!parsed.ok) return parsed;
  target[key] = parsed.value;
  return { ok: true };
}

/**
 * Parse a file's frontmatter. Returns one of:
 *   { ok: true,  present: false }                      — no leading "---"
 *   { ok: true,  present: true, data, block, body }    — parsed; block is the
 *     EXACT frontmatter bytes from the file (delimiters included), body the
 *     rest — so callers can byte-compare block against emitFrontmatter(data)
 *   { ok: false, present: true, error: {code,message,line} } — loud typed
 *     failure, anything outside the emitted subset (D12)
 *
 * CRLF input parses (each line's trailing \r is stripped) so the DATA is
 * never mangled; the raw block keeps its \r bytes, which the round-trip
 * guard then reports as not_canonical.
 */
export function parseFrontmatter(text) {
  if (typeof text !== 'string') {
    return parseFailure('not_text', 'input is not a string', 0);
  }
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { ok: true, present: false };
  }
  const openLen = text.startsWith('---\r\n') ? 5 : 4;

  // Locate the closing "---" line, tracking exact byte offsets so `block`
  // reproduces the file's own bytes.
  let cursor = openLen;
  let blockEnd = -1;
  let innerEnd = -1;
  let lineNo = 1;
  while (cursor <= text.length) {
    lineNo += 1;
    const nl = text.indexOf('\n', cursor);
    const hasNewline = nl !== -1;
    const lineEnd = hasNewline ? nl : text.length;
    let line = text.slice(cursor, lineEnd);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line === '---') {
      innerEnd = cursor;
      blockEnd = hasNewline ? nl + 1 : text.length;
      break;
    }
    if (!hasNewline) break;
    cursor = nl + 1;
  }
  if (blockEnd === -1) {
    return parseFailure('unclosed_frontmatter', 'frontmatter opened with "---" but never closed', 1);
  }

  const block = text.slice(0, blockEnd);
  const body = text.slice(blockEnd);
  const innerRaw = text.slice(openLen, innerEnd);
  const innerLines = innerRaw === '' ? [] : innerRaw.split('\n').slice(0, -1);

  const data = {};
  let inBeeMap = false;
  let currentLineNo = 1;
  for (let rawLine of innerLines) {
    currentLineNo += 1;
    if (rawLine.endsWith('\r')) rawLine = rawLine.slice(0, -1);
    if (rawLine === '') {
      return parseFailure('blank_line', 'blank line inside frontmatter is outside the emitted subset', currentLineNo);
    }
    if (rawLine.includes('\t')) {
      return parseFailure('tab_in_frontmatter', 'tab character inside frontmatter is outside the emitted subset', currentLineNo);
    }
    if (rawLine.startsWith('  ')) {
      if (!inBeeMap) {
        return parseFailure('unexpected_indent', 'indented line outside the "bee:" map', currentLineNo);
      }
      const inner = rawLine.slice(2);
      if (inner.startsWith(' ')) {
        return parseFailure('bad_indent', 'bee: map entries are indented exactly two spaces', currentLineNo);
      }
      const result = parseKeyValueLine(inner, data.bee, currentLineNo, 'bee.');
      if (!result.ok) return result;
      continue;
    }
    if (rawLine.startsWith(' ')) {
      return parseFailure('bad_indent', 'root-level lines must not be indented', currentLineNo);
    }
    inBeeMap = false;
    const header = /^([^:\s]+):$/.exec(rawLine);
    if (header) {
      const key = header[1];
      if (!KEY_RE.test(key)) {
        return parseFailure('bad_key', `${JSON.stringify(key)} is not a legal frontmatter key`, currentLineNo);
      }
      if (key !== 'bee') {
        return parseFailure(
          'unsupported_map',
          `nested map "${key}:" is outside the emitted subset (the only nested map is "bee:")`,
          currentLineNo,
        );
      }
      if (Object.prototype.hasOwnProperty.call(data, 'bee')) {
        return parseFailure('duplicate_key', 'duplicate key "bee"', currentLineNo);
      }
      data.bee = {};
      inBeeMap = true;
      continue;
    }
    const result = parseKeyValueLine(rawLine, data, currentLineNo, '');
    if (!result.ok) return result;
  }

  return { ok: true, present: true, data, block, body };
}

// ─── bundle walk (D23: never leaves docs/knowledge/) ────────────────────────

function listBundleMarkdown(dir) {
  const out = [];
  const walk = (abs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // a symlink could escape the bundle — never follow (D23)
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(childRel);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out.sort();
}

// ISO 8601 date, optionally with a time part — OKF §7 for log.md headings.
const ISO_HEADING_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isIsoDateHeading(text) {
  const match = ISO_HEADING_RE.exec(text);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d);
}

function checkIndexFile(rel, text, errors) {
  const parsed = parseFrontmatter(text);
  const isRoot = rel === 'index.md';
  if (!isRoot) {
    // D4: frontmatter in a non-root index.md is an OKF error — presence alone
    // decides; parseability does not rescue it (§6: index files carry none).
    if (parsed.present) {
      errors.push({
        file: rel,
        code: 'index_frontmatter',
        message: 'a non-root index.md must not carry frontmatter (OKF §6; D4)',
      });
    }
    return;
  }
  if (!parsed.present) return; // generator arrives in S3; an absent block carries no illegal keys
  if (!parsed.ok) {
    errors.push({
      file: rel,
      code: 'unparseable_frontmatter',
      message: `root index.md frontmatter is unparseable — ${parsed.error.code}: ${parsed.error.message} (line ${parsed.error.line})`,
    });
    return;
  }
  const extra = Object.keys(parsed.data).filter((key) => key !== 'okf_version');
  if (extra.length > 0) {
    errors.push({
      file: rel,
      code: 'root_index_extra_keys',
      message: `root index.md may carry only okf_version (OKF §9); found extra key(s): ${extra.join(', ')}`,
    });
  }
}

function checkLogFile(rel, text, errors) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^##\s+(.*?)\s*$/.exec(lines[i]);
    if (!match) continue;
    if (!isIsoDateHeading(match[1])) {
      errors.push({
        file: rel,
        code: 'log_heading_not_iso',
        message: `log.md date heading ${JSON.stringify(match[1])} (line ${i + 1}) is not ISO 8601 (OKF §7 MUST)`,
      });
    }
  }
}

function readPath(data, keyPath) {
  let value = data;
  for (const key of keyPath) {
    if (!value || typeof value !== 'object') return undefined;
    value = value[key];
  }
  return value;
}

/** Resolve a bundle-relative link target inside the bundle; null when it
 *  escapes (never touch the filesystem outside docs/knowledge/ — D23). */
function resolveInsideBundle(dir, target) {
  if (typeof target !== 'string' || target === '') return null;
  const resolved = path.resolve(dir, target);
  const prefix = `${path.resolve(dir)}${path.sep}`;
  if (!resolved.startsWith(prefix)) return null;
  return resolved;
}

/**
 * Two-level check over the whole bundle (D4/D13). Read-only; walks ONLY
 * docs/knowledge/ (D23); a missing or empty bundle is OK.
 *
 * Returns { okf: {errors}, profile: {warnings}, counts, ok, strict } where
 * each finding is {file, code, message}; ok is false on any OKF error, and —
 * under strict — on any finding at all.
 */
export function checkBundle(root, { strict = false } = {}) {
  const dir = bundleDir(root);
  const errors = [];
  const warnings = [];
  const files = listBundleMarkdown(dir);
  const parsedConcepts = [];
  let conceptCount = 0;

  for (const rel of files) {
    const base = rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel;
    let text;
    try {
      text = fs.readFileSync(path.join(dir, rel), 'utf8');
    } catch (error) {
      errors.push({ file: rel, code: 'unreadable', message: `could not read file: ${error.message}` });
      continue;
    }
    if (RESERVED_BASENAMES.has(base)) {
      if (base === 'index.md') checkIndexFile(rel, text, errors);
      else checkLogFile(rel, text, errors);
      continue;
    }

    conceptCount += 1;
    const parsed = parseFrontmatter(text);
    if (!parsed.present) {
      errors.push({
        file: rel,
        code: 'missing_frontmatter',
        message: 'a non-reserved .md inside the bundle is a concept and must carry frontmatter (D23; OKF §4)',
      });
      continue;
    }
    if (!parsed.ok) {
      errors.push({
        file: rel,
        code: 'unparseable_frontmatter',
        message: `frontmatter is unparseable — ${parsed.error.code}: ${parsed.error.message} (line ${parsed.error.line})`,
      });
      continue;
    }

    const data = parsed.data;
    if (typeof data.type !== 'string' || data.type.trim() === '') {
      errors.push({
        file: rel,
        code: 'empty_type',
        message: 'type is required and must be a non-empty string (OKF §4.1 MUST)',
      });
    } else if (!CONCEPT_TYPES.includes(data.type)) {
      warnings.push({
        file: rel,
        code: 'unknown_type',
        message: `type "${data.type}" is outside the profile's nine types (D18); OKF consumers tolerate it, bee flags it`,
      });
    }

    for (const keyPath of PROFILE_REQUIRED) {
      const value = readPath(data, keyPath);
      if (typeof value !== 'string' || value.trim() === '') {
        warnings.push({
          file: rel,
          code: 'missing_profile_field',
          message: `profile-required field "${keyPath.join('.')}" is missing or empty (D10: never invented — author it)`,
        });
      }
    }

    // Advisor round-trip guard (digest s1 items 1-2): parse -> re-emit ->
    // byte-compare. A mismatch means the file was authored outside the
    // canonical emitted form; the data above is still exact, but the file
    // should be normalized before it is trusted as curated truth.
    let reEmitted = null;
    try {
      reEmitted = emitFrontmatter(data);
    } catch {
      reEmitted = null;
    }
    if (reEmitted !== parsed.block) {
      warnings.push({
        file: rel,
        code: 'not_canonical',
        message:
          'frontmatter parse→re-emit differs byte-wise from the file (hand-edited colon/#/CRLF/key-order outside the canonical emitted form) — normalize by re-emitting',
      });
    }

    parsedConcepts.push({ file: rel, data });
  }

  // ─── bundle-level profile checks (D31 uniqueness, D4 dangling targets) ────
  const byId = new Map();
  const byAuthority = new Map();
  for (const concept of parsedConcepts) {
    const bee = concept.data.bee && typeof concept.data.bee === 'object' ? concept.data.bee : {};
    if (typeof bee.id === 'string' && bee.id) {
      if (!byId.has(bee.id)) byId.set(bee.id, []);
      byId.get(bee.id).push(concept.file);
    }
    if (typeof bee.authoritative_for === 'string' && bee.authoritative_for) {
      if (!byAuthority.has(bee.authoritative_for)) byAuthority.set(bee.authoritative_for, []);
      byAuthority.get(bee.authoritative_for).push(concept.file);
    }
  }
  for (const [id, holders] of byId) {
    if (holders.length > 1) {
      warnings.push({
        file: holders[0],
        code: 'duplicate_id',
        message: `bee.id "${id}" is claimed by ${holders.length} concepts (${holders.join(', ')}) — ids are globally unique (D31)`,
      });
    }
  }
  for (const [subject, holders] of byAuthority) {
    if (holders.length > 1) {
      warnings.push({
        file: holders[0],
        code: 'duplicate_authoritative_for',
        message: `bee.authoritative_for "${subject}" is claimed by ${holders.length} concepts (${holders.join(', ')}) — one subject, one authority (D31)`,
      });
    }
  }
  for (const concept of parsedConcepts) {
    const bee = concept.data.bee && typeof concept.data.bee === 'object' ? concept.data.bee : {};
    if (Array.isArray(bee.required_context)) {
      for (const target of bee.required_context) {
        const resolved = typeof target === 'string' ? resolveInsideBundle(dir, target) : null;
        if (!resolved || !fs.existsSync(resolved)) {
          warnings.push({
            file: concept.file,
            code: 'dangling_required_context',
            message: `required_context target "${String(target)}" does not resolve inside the bundle (D19: bundle-relative paths)`,
          });
        }
      }
    }
    if (typeof bee.supersedes === 'string' && bee.supersedes && !byId.has(bee.supersedes)) {
      warnings.push({
        file: concept.file,
        code: 'dangling_supersedes',
        message: `supersedes target id "${bee.supersedes}" matches no concept's bee.id in the bundle`,
      });
    }
  }

  const counts = {
    files: files.length,
    concepts: conceptCount,
    errors: errors.length,
    warnings: warnings.length,
  };
  const ok = errors.length === 0 && (!strict || warnings.length === 0);
  return { okf: { errors }, profile: { warnings }, counts, ok, strict };
}
