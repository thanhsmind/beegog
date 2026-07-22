#!/usr/bin/env node
'use strict';

/**
 * classify-lane.mjs — decide whether a docs/backlog.md row is safe for an
 * unattended dispatcher to pick up (D6, agent-pane-orchestration).
 *
 * Usage: node classify-lane.mjs <PBI-ID> [--backlog PATH]
 *
 * Emits exactly one JSON object on stdout:
 *   {pbi, lane, hard_gate_flags[], lane_safe, reason}
 *
 * This answers only "is this row's lane safe for an unattended agent" — one
 * input to D1's four-condition dispatchable set, never the whole of it.
 *
 * Fail-closed contract: anything the rules cannot classify with confidence
 * (no matching row, unreadable backlog file, empty/unparseable row text, or
 * a signal the rules do not cover) returns lane_safe:false with lane
 * "high-risk" and a reason naming why confidence failed. An unclassifiable
 * row must never come back safe.
 */

import { readFileSync } from 'node:fs';

const STATUS_VALUES = new Set(['proposed', 'in-flight', 'done']);

// Mode-gate risk flags, from bee-planning SKILL.md's "Mode Gate" section:
//   auth · authorization · data model · audit/security · external systems ·
//   public contracts · cross-platform · changes behavior an existing test
//   asserts · the change requires weakening/deleting/replacing existing
//   proof · multi-domain
// The six hard-gate flags (decisive per D6 / SKILL.md "4+ flags or any
// hard-gate flag"): auth, authorization, data loss, audit/security,
// external provider, validation removal. "data loss" broadens "data model"
// and "validation removal" broadens "weakening/deleting/replacing existing
// proof" — same category, D6's wording for the decisive subset.
const FLAG_RULES = [
  {
    id: 'auth',
    label: 'auth',
    hardGate: true,
    pattern: /\bauthentication\b|\bauth\b(?!ori)|đăng nhập|xác thực/i,
  },
  {
    id: 'authorization',
    label: 'authorization',
    hardGate: true,
    pattern: /\bauthoriz(?:e|ation|ed|ing)\b|\bauthz\b|phân quyền|ủy quyền|uỷ quyền|quyền truy cập/i,
  },
  {
    id: 'data-loss',
    label: 'data model / data loss',
    hardGate: true,
    pattern: /\bdata loss\b|\bdata model\b|drop table|xóa dữ liệu|xoá dữ liệu|mất dữ liệu|schema (?:change|migration)|mô hình dữ liệu/i,
  },
  {
    id: 'audit-security',
    label: 'audit/security',
    hardGate: true,
    pattern: /\baudit\b|\bsecurity\b|bảo mật|an ninh|lỗ hổng|vulnerab/i,
  },
  {
    id: 'external-provider',
    label: 'external systems / external provider',
    hardGate: true,
    pattern: /external (?:provider|system|service|api)|third[- ]party|bên ngoài|nhà cung cấp|dịch vụ ngoài/i,
  },
  {
    id: 'public-contracts',
    label: 'public contracts',
    hardGate: false,
    pattern: /public contract|breaking change|api contract|hợp đồng công khai/i,
  },
  {
    id: 'cross-platform',
    label: 'cross-platform',
    hardGate: false,
    pattern: /cross-platform|đa nền tảng|windows[^\n]{0,40}(?:macos|linux)|macos[^\n]{0,40}(?:windows|linux)/i,
  },
  {
    id: 'test-behavior',
    label: 'changes behavior an existing test asserts',
    hardGate: false,
    pattern: /existing test|covered contract|kiểm thử hiện có|test hiện có/i,
  },
  {
    id: 'validation-removal',
    label: 'weakening/deleting/replacing existing proof (validation removal)',
    hardGate: true,
    pattern: /\bweaken(?:ing)?\b|remove validation|skip validation|bỏ qua kiểm tra|gỡ bỏ (?:kiểm tra|validation)|xoá test|xóa test|xoá proof|xóa proof/i,
  },
  {
    id: 'multi-domain',
    label: 'multi-domain',
    hardGate: false,
    pattern: /multi-domain|multiple domains|nhiều domain|đa lĩnh vực/i,
  },
];

function emit(result) {
  const { pbi, lane, hard_gate_flags, lane_safe, reason } = result;
  process.stdout.write(`${JSON.stringify({ pbi, lane, hard_gate_flags, lane_safe, reason })}\n`);
}

function unclassifiable(pbi, reason) {
  emit({ pbi, lane: 'high-risk', hard_gate_flags: [], lane_safe: false, reason });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let pbi = null;
  let backlog = 'docs/backlog.md';
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--backlog') {
      backlog = args[i + 1];
      i += 1;
    } else {
      positional.push(args[i]);
    }
  }
  if (positional.length > 0) {
    [pbi] = positional;
  }
  return { pbi, backlog };
}

// Split one markdown table row into its logical columns (ID, description,
// status, notes). A cell's own text can contain a literal "|" (verified in
// docs/backlog.md, e.g. "POST /api/panes|agents" or "start\|stop\|..."), so
// naive positional splitting is unsafe. The status column is a closed
// three-value vocabulary (proposed/in-flight/done, docs/backlog.md:3), so it
// is located by value and used as the anchor: everything between the ID
// field and the status field is the description, everything after the
// status field (minus a trailing empty cell from a closing "|") is notes.
function parseRow(fields) {
  let statusIdx = -1;
  for (let i = 2; i < fields.length; i += 1) {
    if (STATUS_VALUES.has(fields[i].trim())) {
      statusIdx = i;
      break;
    }
  }
  if (statusIdx === -1) {
    return { description: fields.slice(2).join('|').trim(), notes: '', status: null };
  }
  const description = fields.slice(2, statusIdx).join('|').trim();
  let lastIdx = fields.length;
  if (fields.length > 0 && fields[fields.length - 1].trim() === '') {
    lastIdx = fields.length - 1;
  }
  const notes = fields.slice(statusIdx + 1, lastIdx).join('|').trim();
  return { description, notes, status: fields[statusIdx].trim() };
}

function findRow(content, pbi) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('|')) continue;
    const fields = line.split('|');
    if (fields.length < 4) continue;
    const trimmedFields = fields.map((f) => f.trim());
    const inner = trimmedFields.slice(1, -1);
    const isSeparator = inner.length > 0 && inner.every((f) => f === '' || /^:?-+:?$/.test(f));
    if (isSeparator) continue;
    const idRaw = trimmedFields[1];
    if (!idRaw || idRaw === 'ID') continue; // blank leading cell or header row
    if (idRaw !== pbi) continue;
    return parseRow(fields);
  }
  return null;
}

function classify(pbi, row) {
  const text = [row.description, row.notes].filter((part) => part.length > 0).join(' ').trim();
  if (!text) {
    unclassifiable(pbi, `row for ${pbi} has empty or unparseable text (no description or notes found)`);
    return;
  }

  const matched = FLAG_RULES.filter((rule) => rule.pattern.test(text));
  const hardGateMatches = matched.filter((rule) => rule.hardGate);

  if (hardGateMatches.length > 0) {
    const labels = hardGateMatches.map((rule) => rule.label);
    emit({
      pbi,
      lane: 'high-risk',
      hard_gate_flags: labels,
      lane_safe: false,
      reason: `hard-gate flag matched: ${labels.join(', ')}`,
    });
    return;
  }

  if (matched.length >= 4) {
    const labels = matched.map((rule) => rule.label);
    emit({
      pbi,
      lane: 'high-risk',
      hard_gate_flags: [],
      lane_safe: false,
      reason: `${matched.length} mode-gate risk flags matched (4+ classifies high-risk): ${labels.join(', ')}`,
    });
    return;
  }

  // 0-1 flags -> tiny/small; 2-3 -> standard (bee-planning Mode Gate). The
  // tiny/small split further depends on a product-file count this script
  // has no visibility into from backlog text alone, so 0-1 flags reports
  // the safer (larger) of the two, "small".
  const lane = matched.length >= 2 ? 'standard' : 'small';
  const reason = matched.length === 0
    ? 'no mode-gate risk flags matched in row text'
    : `${matched.length} mode-gate risk flag(s) matched, below the high-risk threshold: ${matched.map((rule) => rule.label).join(', ')}`;
  emit({ pbi, lane, hard_gate_flags: [], lane_safe: true, reason });
}

function main() {
  const { pbi, backlog } = parseArgs(process.argv);
  if (!pbi) {
    unclassifiable('', 'no PBI id provided on the command line');
    return;
  }

  let content;
  try {
    content = readFileSync(backlog, 'utf8');
  } catch (err) {
    unclassifiable(pbi, `cannot read backlog file "${backlog}": ${err.code || err.message}`);
    return;
  }

  const row = findRow(content, pbi);
  if (!row) {
    unclassifiable(pbi, `no matching row found for ${pbi} in ${backlog}`);
    return;
  }

  classify(pbi, row);
}

main();
