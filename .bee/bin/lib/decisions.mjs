// decisions.mjs — event-sourced decisions in .bee/decisions.jsonl.
// Write-time secret & injection rejection; datamarked reads.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { appendJsonl, readJsonl } from './fsutil.mjs';

/** Content patterns that must never enter the decision log. */
export const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /\b(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"]?[^\s'"]{6,}/i,
];

/** Instruction-injection heuristics rejected at write time. */
export const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|messages|context|prompts?)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above|earlier)/i,
  /<\/?\s*(?:system|assistant|user|developer|tool)\b[^>]*>/i,
  /\[\s*(?:system|assistant|user|developer)\s*\]/i,
];

function decisionsPath(root) {
  return path.join(root, '.bee', 'decisions.jsonl');
}

// decision-propagation dp-1 (CONTEXT D4a): optional tags[] on a decide
// event, for structured recall alongside the existing free-string `scope`
// (which stays the spec-area dimension — no separate `area` field, fresh-
// eyes P2). Lowercase-slug shape mirrors the repo's existing feature-slug
// convention (worktree-store.mjs's FEATURE_SLUG_RE): one leading alnum,
// then alnum/hyphen.
export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// undefined/null tags -> null (event gains NO tags key at all — additive,
// zero-migration parity with the 400+ pre-dp-1 events that never had one).
// Anything else must be a non-empty array of TAG_PATTERN-valid strings.
function normalizeTags(tags) {
  if (tags === undefined || tags === null) return null;
  if (!Array.isArray(tags)) {
    throw new Error('logDecision: tags must be an array of lowercase slugs (e.g. ["billing", "nightly-job"]).');
  }
  const cleaned = tags.map((tag) => String(tag).trim());
  for (const tag of cleaned) {
    if (!TAG_PATTERN.test(tag)) {
      throw new Error(
        `logDecision: tag ${JSON.stringify(tag)} is not a valid lowercase slug (must match ${TAG_PATTERN}).`,
      );
    }
  }
  return cleaned.length ? cleaned : null;
}

function assertSafeContent(field, value) {
  if (typeof value !== 'string' || !value) return;
  for (const pattern of SECRET_CONTENT_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `Decision rejected: field "${field}" matches a secret pattern (${pattern}). Never log credentials — describe the decision without the secret.`,
      );
    }
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `Decision rejected: field "${field}" contains instruction-like content (${pattern}). Decision text must be data, not instructions.`,
      );
    }
  }
}

function assertSafe(fields) {
  for (const [field, value] of Object.entries(fields)) {
    assertSafeContent(field, value);
  }
}

export function logDecision(
  root,
  { decision, rationale, alternatives = null, scope = 'repo', source = 'user', confidence = null, tags = undefined },
) {
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('logDecision: decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('logDecision: rationale is required.');
  }
  assertSafe({ decision, rationale, alternatives, scope, source });
  const normalizedTags = normalizeTags(tags);

  const event = {
    id: crypto.randomUUID(),
    type: 'decide',
    date: new Date().toISOString(),
    decision: decision.trim(),
    rationale: rationale.trim(),
    alternatives,
    scope,
    source,
    confidence,
  };
  if (normalizedTags) event.tags = normalizedTags;
  appendJsonl(decisionsPath(root), event);
  return event;
}

// decision-propagation dp-2 (CONTEXT D2/D3): the propagation sweep. Scans
// docs/** ONLY (D2 pinned root — .bee/spikes/ sits outside docs/ and is
// excluded by construction, no special-case needed) for text files (md,
// json, yaml/yml, txt) citing the superseded decision by its full id or its
// short8 form (the id's first 8 hex chars, e.g. "1178cfce" from a uuid like
// "1178cfce-...") — a \b...\b word-boundary match so a short8 embedded
// inside a longer alnum run (e.g. "abc1178cfcedef") never false-positives.
const SWEEP_TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt']);
const SWEEP_EXCERPT_MAX = 160;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSweepFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSweepFiles(full, out);
    } else if (entry.isFile() && SWEEP_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

/**
 * Scan docs/** for citations of a superseded decision id (full id and
 * short8, word-boundary matched). Returns {scanned_at, hit_count, files[]}
 * with one entry per citing LINE: {file (repo-relative), line (1-based),
 * excerpt (trimmed, <=160 chars)}. Never edits the citing files — read-only.
 */
export function sweepDecisionCitations(root, { id, short8 }) {
  const docsRoot = path.join(root, 'docs');
  const candidateFiles = [];
  collectSweepFiles(docsRoot, candidateFiles);

  const idPattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i');
  const shortPattern = new RegExp(`\\b${escapeRegExp(short8)}\\b`, 'i');
  const files = [];
  for (const file of candidateFiles) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (idPattern.test(line) || shortPattern.test(line)) {
        const trimmed = line.trim();
        const excerpt = trimmed.length > SWEEP_EXCERPT_MAX ? `${trimmed.slice(0, SWEEP_EXCERPT_MAX - 3)}...` : trimmed;
        files.push({ file: path.relative(root, file), line: index + 1, excerpt });
      }
    });
  }
  return { scanned_at: new Date().toISOString(), hit_count: files.length, files };
}

export function supersedeDecision(root, { supersedes, decision, rationale, tags = undefined, scope = undefined }) {
  if (typeof supersedes !== 'string' || !supersedes.trim()) {
    throw new Error('supersedeDecision: supersedes (decision id) is required.');
  }
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('supersedeDecision: replacement decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('supersedeDecision: rationale is required.');
  }
  const targetId = supersedes.trim();
  assertSafe({ decision, rationale });

  // decision-propagation dp-2 (CONTEXT D6): resolve scope/tags — an explicit
  // flag wins; otherwise inherit from the superseded target; a metadata-less
  // target (or a target id not found in the store at all) falls back to
  // scope "repo" and no tags key at all, mirroring logDecision's zero-
  // migration additive shape.
  const events = readJsonl(decisionsPath(root));
  const target = events.find((event) => event && event.id === targetId);

  let resolvedScope;
  if (scope !== undefined && scope !== null && String(scope).trim()) {
    resolvedScope = String(scope).trim();
  } else if (target && typeof target.scope === 'string' && target.scope.trim()) {
    resolvedScope = target.scope.trim();
  } else {
    resolvedScope = 'repo';
  }
  assertSafeContent('scope', resolvedScope);

  let resolvedTags;
  if (tags !== undefined) {
    resolvedTags = normalizeTags(tags);
  } else if (target && Array.isArray(target.tags) && target.tags.length) {
    resolvedTags = normalizeTags(target.tags);
  } else {
    resolvedTags = null;
  }

  // decision-propagation dp-2 (CONTEXT D2, lock doctrine): compute the
  // propagation sweep BEFORE the append below — the event is written to the
  // store exactly once, already carrying the sweep result inline. Never a
  // post-append rewrite of an already-written jsonl line.
  const short8 = targetId.slice(0, 8);
  const sweep = sweepDecisionCitations(root, { id: targetId, short8 });

  const event = {
    id: crypto.randomUUID(),
    type: 'supersede',
    date: new Date().toISOString(),
    supersedes: targetId,
    decision: decision.trim(),
    rationale: rationale.trim(),
    scope: resolvedScope,
    sweep,
  };
  if (resolvedTags) event.tags = resolvedTags;
  appendJsonl(decisionsPath(root), event);
  return event;
}

export function redactDecision(root, { redacts, reason }) {
  if (typeof redacts !== 'string' || !redacts.trim()) {
    throw new Error('redactDecision: redacts (decision id) is required.');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('redactDecision: reason is required.');
  }
  const event = {
    id: crypto.randomUUID(),
    type: 'redact',
    date: new Date().toISOString(),
    redacts: redacts.trim(),
    reason: reason.trim(),
  };
  appendJsonl(decisionsPath(root), event);
  return event;
}

/** Decide/supersede events not themselves superseded or redacted, newest first. */
export function activeDecisions(root, { recent = null } = {}) {
  const events = readJsonl(decisionsPath(root));
  const superseded = new Set();
  const redacted = new Set();
  for (const event of events) {
    if (event.type === 'supersede' && event.supersedes) superseded.add(event.supersedes);
    if (event.type === 'redact' && event.redacts) redacted.add(event.redacts);
  }
  const active = events
    .filter(
      (event) =>
        (event.type === 'decide' || event.type === 'supersede') &&
        !superseded.has(event.id) &&
        !redacted.has(event.id),
    )
    .reverse();
  return recent != null ? active.slice(0, recent) : active;
}

/** Neutralize resurfaced text so it can never act as instructions. */
export function datamark(text) {
  const cleaned = String(text ?? '')
    .replace(/```+/g, '')
    .replace(/<\/?\s*(?:system|assistant|user|developer|tool)\b[^>]*>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return `«${cleaned}»`;
}
