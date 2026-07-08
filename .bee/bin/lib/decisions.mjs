// decisions.mjs — event-sourced decisions in .bee/decisions.jsonl.
// Write-time secret & injection rejection; datamarked reads.

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
  { decision, rationale, alternatives = null, scope = 'repo', source = 'user', confidence = null },
) {
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('logDecision: decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('logDecision: rationale is required.');
  }
  assertSafe({ decision, rationale, alternatives, scope, source });

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
  appendJsonl(decisionsPath(root), event);
  return event;
}

export function supersedeDecision(root, { supersedes, decision, rationale }) {
  if (typeof supersedes !== 'string' || !supersedes.trim()) {
    throw new Error('supersedeDecision: supersedes (decision id) is required.');
  }
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('supersedeDecision: replacement decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('supersedeDecision: rationale is required.');
  }
  assertSafe({ decision, rationale });

  const event = {
    id: crypto.randomUUID(),
    type: 'supersede',
    date: new Date().toISOString(),
    supersedes: supersedes.trim(),
    decision: decision.trim(),
    rationale: rationale.trim(),
  };
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
