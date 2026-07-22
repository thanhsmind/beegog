#!/usr/bin/env node
// okf_migrate.mjs — migration tooling for the OKF knowledge bundle
// (okf-foundation cell okf-5, D20/D24/D29/D33/D35/D37).
//
// Bee-repo tooling ONLY — lives in scripts/, never shipped to hosts (D24).
// The authoring itself is agent work, not script magic: this script
// INVENTORIES a source BA spec's numbered anchors and VERIFIES a finished
// migration's coverage; it never writes a concept, a stub, or anything else.
//
// Subcommands:
//   --inventory <path>   Parse a legacy nine-section BA spec and emit its
//                        machine-readable anchor inventory: every numbered
//                        B*/R* anchor plus every top-level Edge Cases bullet
//                        (E1..En, document order) and Pointers bullet
//                        (P1..Pn, document order). JSON to stdout.
//   --check <area>       Coverage check (D35), chain-failing. Asserts
//                        set-equality across three sets for the area:
//                          (1) the frozen anchor registry below (captured
//                              from the pre-migration source via --inventory
//                              — the "no loss" baseline that survives the
//                              source becoming a stub),
//                          (2) the anchors recorded in the pointer stub's
//                              anchor map (docs/specs/<area>.md, D37),
//                          (3) the anchors claimed by concepts under
//                              docs/knowledge/areas/<area>/ via bee.sources
//                              entries of the form
//                              "docs/specs/<area>.md#<ANCHOR>".
//                        Every anchor must be owned by EXACTLY ONE concept
//                        (no loss, no duplication), the stub map's target
//                        path must be the claiming concept's own path, and
//                        that file must exist. Exit 0 with counts on green,
//                        exit 1 naming every violation on red.
//
// No --strict flag exists here on purpose: the check is already binary.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

// ─── frozen anchor registries (the "no loss" baseline, D35) ────────────────
// Captured by running `--inventory docs/specs/<area>.md` against the FULL
// pre-migration source (for advisor-protocol: the 202-line BA spec as of its
// last content commit, updated 2026-07-19, before it became a D37 pointer
// stub — recoverable any time via git history). The registry is what lets
// --check detect loss even after the source file itself is a stub: a stub
// map and the concept claims agreeing with each other proves consistency,
// only this frozen set proves nothing fell out of the world.
const ANCHOR_REGISTRY = {
  "advisor-protocol": [
    // Behaviors & Operations
    "B1", "B2", "B3", "B4",
    // Business Rules
    "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9",
    // Edge Cases Settled (top-level bullets, document order)
    "E1", "E2", "E3", "E4", "E5", "E6",
    // Pointers (implementation) (top-level bullets, document order)
    "P1", "P2", "P3", "P4", "P5", "P6", "P7",
  ],
};

// ─── inventory mode ─────────────────────────────────────────────────────────

// Parse a nine-section BA spec's numbered anchors. Returns
// { behaviors, rules, edges, pointers, all } where behaviors/rules carry the
// source's own B-/R-numbered ids and edges/pointers are assigned E-/P-ids by
// top-level-bullet position inside their sections (document order).
export function inventorySpec(text) {
  const lines = text.split("\n");
  const behaviors = [];
  const rules = [];
  let edgeBullets = 0;
  let pointerBullets = 0;
  let section = null;
  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      const h = heading[1].toLowerCase();
      if (h.startsWith("edge cases")) section = "edges";
      else if (h.startsWith("pointers")) section = "pointers";
      else section = null;
      continue;
    }
    const bold = /^\*\*(B\d+)\s+—/.exec(line);
    if (bold) {
      behaviors.push(bold[1]);
      continue;
    }
    const rule = /^-\s+(R\d+)\s+—/.exec(line);
    if (rule) {
      rules.push(rule[1]);
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (section === "edges") edgeBullets += 1;
      else if (section === "pointers") pointerBullets += 1;
    }
  }
  const edges = Array.from({ length: edgeBullets }, (_, i) => `E${i + 1}`);
  const pointers = Array.from({ length: pointerBullets }, (_, i) => `P${i + 1}`);
  return {
    behaviors,
    rules,
    edges,
    pointers,
    all: [...behaviors, ...rules, ...edges, ...pointers],
  };
}

// ─── check mode helpers ─────────────────────────────────────────────────────

/** Anchor → target concept path rows from a D37 pointer-stub anchor map.
 *  Rows look like: | B1 | [docs/knowledge/areas/<area>/x.md](../…) | */
export function parseStubAnchorMap(text) {
  const map = new Map();
  const issues = [];
  for (const line of text.split("\n")) {
    const row = /^\|\s*`?([A-Z]\d+)`?\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const anchor = row[1];
    const cell = row[2];
    const link = /\[([^\]]+)\]\([^)]+\)/.exec(cell);
    const target = (link ? link[1] : cell).replace(/`/g, "").trim();
    if (map.has(anchor)) {
      issues.push(`stub anchor map lists ${anchor} more than once`);
      continue;
    }
    map.set(anchor, target);
  }
  return { map, issues };
}

/** bee.sources claims of the form docs/specs/<area>.md#<ANCHOR> from every
 *  concept under docs/knowledge/areas/<area>/ (index.md excluded). */
async function collectClaims(area) {
  const knowledge = await import(
    pathToFileURL(path.join(REPO_ROOT, ".bee", "bin", "lib", "knowledge.mjs")).href
  );
  const areaDir = path.join(REPO_ROOT, "docs", "knowledge", "areas", area);
  const claims = new Map(); // anchor -> [concept repo-relative path, ...]
  const issues = [];
  if (!fs.existsSync(areaDir)) {
    issues.push(`concept directory missing: docs/knowledge/areas/${area}/`);
    return { claims, issues };
  }
  const claimRe = new RegExp(`^docs/specs/${area}\\.md#([A-Z]\\d+)$`);
  for (const name of fs.readdirSync(areaDir).sort()) {
    if (!name.endsWith(".md") || name === "index.md" || name === "log.md") continue;
    const rel = `docs/knowledge/areas/${area}/${name}`;
    const parsed = knowledge.parseFrontmatter(fs.readFileSync(path.join(areaDir, name), "utf8"));
    if (!parsed.ok || !parsed.present) {
      issues.push(`${rel}: frontmatter missing or unparseable — cannot read bee.sources claims`);
      continue;
    }
    const bee = parsed.data.bee && typeof parsed.data.bee === "object" ? parsed.data.bee : {};
    const sources = Array.isArray(bee.sources) ? bee.sources : [];
    for (const entry of sources) {
      const m = typeof entry === "string" ? claimRe.exec(entry) : null;
      if (!m) continue;
      if (!claims.has(m[1])) claims.set(m[1], []);
      claims.get(m[1]).push(rel);
    }
  }
  return { claims, issues };
}

export async function runCheck(area) {
  const expected = ANCHOR_REGISTRY[area];
  if (!expected) {
    console.error(`okf_migrate --check: unknown area "${area}" — no frozen anchor registry (known: ${Object.keys(ANCHOR_REGISTRY).join(", ")})`);
    return 1;
  }
  const issues = [];
  const stubPath = path.join(REPO_ROOT, "docs", "specs", `${area}.md`);
  let stubMap = new Map();
  if (!fs.existsSync(stubPath)) {
    issues.push(`pointer stub missing: docs/specs/${area}.md (the path is never deleted — D20)`);
  } else {
    const parsedStub = parseStubAnchorMap(fs.readFileSync(stubPath, "utf8"));
    stubMap = parsedStub.map;
    issues.push(...parsedStub.issues);
  }
  const { claims, issues: claimIssues } = await collectClaims(area);
  issues.push(...claimIssues);

  const expectedSet = new Set(expected);
  let duplicated = 0;
  let lost = 0;

  for (const anchor of expected) {
    const owners = claims.get(anchor) || [];
    const mapped = stubMap.get(anchor);
    if (!mapped) {
      issues.push(`LOST in stub map: ${anchor} has no row in docs/specs/${area}.md's anchor map (D37)`);
    }
    if (owners.length === 0) {
      lost += 1;
      issues.push(`LOST in concepts: ${anchor} is claimed by no concept's bee.sources (expected one owner)`);
      continue;
    }
    if (owners.length > 1) {
      duplicated += 1;
      issues.push(`DUPLICATED: ${anchor} is claimed by ${owners.length} concepts: ${owners.join(", ")}`);
      continue;
    }
    const owner = owners[0];
    if (mapped && mapped !== owner) {
      issues.push(`MAP MISMATCH: stub map sends ${anchor} to "${mapped}" but the claiming concept is "${owner}"`);
    }
    if (!fs.existsSync(path.join(REPO_ROOT, owner))) {
      issues.push(`MISSING FILE: ${anchor}'s owner "${owner}" does not exist on disk`);
    }
  }
  for (const anchor of stubMap.keys()) {
    if (!expectedSet.has(anchor)) {
      issues.push(`EXTRA in stub map: ${anchor} is not in the frozen source inventory for ${area}`);
    }
  }
  for (const anchor of claims.keys()) {
    if (!expectedSet.has(anchor)) {
      issues.push(`EXTRA claim: ${anchor} (claimed by ${claims.get(anchor).join(", ")}) is not in the frozen source inventory for ${area}`);
    }
  }

  const owned = expected.filter((a) => (claims.get(a) || []).length === 1).length;
  if (issues.length > 0) {
    console.error(`FAIL okf_migrate --check ${area}: ${expected.length} anchors, ${owned} owned, ${duplicated} duplicated, ${lost} lost`);
    for (const issue of issues) console.error(`  - ${issue}`);
    return 1;
  }
  console.log(`PASS okf_migrate --check ${area}: ${expected.length} anchors, ${owned} owned, 0 duplicated, 0 lost — every source anchor lands in exactly one concept and the stub map agrees (D35/D37)`);
  return 0;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--inventory" && args[1]) {
    const abs = path.resolve(REPO_ROOT, args[1]);
    if (!fs.existsSync(abs)) {
      console.error(`okf_migrate --inventory: no such file: ${args[1]}`);
      return 1;
    }
    const inv = inventorySpec(fs.readFileSync(abs, "utf8"));
    console.log(JSON.stringify({ file: args[1], counts: {
      behaviors: inv.behaviors.length,
      rules: inv.rules.length,
      edges: inv.edges.length,
      pointers: inv.pointers.length,
      total: inv.all.length,
    }, anchors: inv }, null, 2));
    return 0;
  }
  if (args[0] === "--check" && args[1]) {
    return runCheck(args[1]);
  }
  console.error("usage: okf_migrate.mjs (--inventory <spec-path> | --check <area>)");
  return 1;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  process.exitCode = await main();
}
