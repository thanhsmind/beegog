#!/usr/bin/env node
// P40 byte-for-byte regression freeze — bee's two `resolveRoots` twins.
//
// PURPOSE: this is a SAFETY NET for an upcoming edit to resolveRoots, written
// and run against the CURRENT, UNMODIFIED production code. It pins today's
// observed behavior of BOTH implementations so a later change that silently
// alters resolution semantics gets caught immediately. It does NOT assert the
// absence of any field — a later additive change may add new fields to the
// returned object, and this test must keep passing when it does. It only
// pins the fields that exist today.
//
//   - .bee/bin/lib/state.mjs        resolveRoots — CLI-side, THROWS
//     WorktreeLinkInvalidError (.code === 'WORKTREE_LINK_INVALID') on an
//     invalid linked worktree.
//   - .bee/bin/hooks/adapter.mjs    resolveRoots — hook-side twin, NEVER
//     throws; an invalid linked worktree instead returns
//     { storeRoot: null, worktreeResolution: 'linked-invalid', ... }.
//
// Both are exercised against a REAL git repo + REAL `git worktree add` built
// fresh under os.tmpdir() (via node:child_process spawnSync — no git
// simulation, no fixtures). Cleaned up in a `finally` even on failure.
//
// Exit code: 0 iff every case passes; 7 (a distinct code, not 1) otherwise.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveRoots as resolveRootsState, WorktreeLinkInvalidError } from "../.bee/bin/lib/state.mjs";
import { resolveRoots as resolveRootsAdapter } from "../.bee/bin/hooks/adapter.mjs";

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const results = [];
function record(desc, passed, detail) {
  results.push({ desc, passed });
  if (passed) {
    console.log(`PASS ${desc}`);
  } else {
    console.log(`FAIL ${desc}${detail ? ` -- ${detail}` : ""}`);
  }
}

function git(cwd, args) {
  const res = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} (cwd=${cwd}) failed with status ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`,
    );
  }
  return res.stdout;
}

// Same derivation the resolvers themselves use: a linked worktree's own
// `.git` file contains "gitdir: <path-to-main>/.git/worktrees/<id>"; the
// basename of that path is the worktree id. Read-only inspection, used here
// only to locate the reverse back-link file to corrupt for case 3.
function readWorktreeId(worktreeRoot) {
  const raw = fs.readFileSync(path.join(worktreeRoot, ".git"), "utf8").trim();
  const pointer = raw.startsWith("gitdir:") ? raw.slice("gitdir:".length).trim() : raw;
  const gitdirAbs = path.resolve(worktreeRoot, pointer);
  return path.basename(gitdirAbs);
}

// ---------------------------------------------------------------------------
// fixture setup
// ---------------------------------------------------------------------------

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bee-resolveroots-p40-"));
const mainRepo = path.join(tmpRoot, "main");
const worktreePath = path.join(tmpRoot, "wt");
const ordinarySubdir = path.join(mainRepo, "sub", "nested");
const worktreeSubdir = path.join(worktreePath, "sub");

try {
  fs.mkdirSync(mainRepo, { recursive: true });
  git(mainRepo, ["init", "-q", "-b", "main"]);
  git(mainRepo, ["config", "user.email", "resolveroots-p40@example.com"]);
  git(mainRepo, ["config", "user.name", "resolveroots-p40"]);
  fs.writeFileSync(path.join(mainRepo, "README.md"), "p40 fixture\n");
  git(mainRepo, ["add", "README.md"]);
  git(mainRepo, ["commit", "-q", "-m", "init"]);

  fs.mkdirSync(ordinarySubdir, { recursive: true });

  // Real `git worktree add` — a genuinely linked-valid worktree.
  git(mainRepo, ["worktree", "add", "-q", "-b", "feature", worktreePath]);
  fs.mkdirSync(worktreeSubdir, { recursive: true });

  const mainRepoReal = fs.realpathSync(mainRepo);
  const worktreeReal = fs.realpathSync(worktreePath);

  // ==========================================================================
  // CASE 1 — ordinary checkout (.git is a directory)
  // ==========================================================================
  {
    const r = resolveRootsState(ordinarySubdir);
    const ok =
      r.worktreeResolution === "ordinary" &&
      fs.realpathSync(r.storeRoot) === mainRepoReal &&
      fs.realpathSync(r.workRoot) === mainRepoReal;
    record(
      "state.mjs ordinary checkout: worktreeResolution=ordinary, storeRoot=workRoot=repo root",
      ok,
      JSON.stringify(r),
    );
  }
  {
    const r = resolveRootsAdapter(ordinarySubdir);
    const ok =
      r.worktreeResolution === "ordinary" &&
      r.storeRoot != null &&
      fs.realpathSync(r.storeRoot) === mainRepoReal &&
      r.workRoot != null &&
      fs.realpathSync(r.workRoot) === mainRepoReal;
    record(
      "adapter.mjs ordinary checkout: worktreeResolution=ordinary, storeRoot=workRoot=repo root",
      ok,
      JSON.stringify(r),
    );
  }

  // ==========================================================================
  // CASE 2 — linked-valid worktree (THE P40 CORE): storeRoot is the MAIN
  // checkout, never the worktree.
  // ==========================================================================
  {
    const r = resolveRootsState(worktreeSubdir);
    const ok =
      r.worktreeResolution === "linked-valid" &&
      fs.realpathSync(r.storeRoot) === mainRepoReal &&
      fs.realpathSync(r.workRoot) === worktreeReal;
    record(
      "state.mjs linked-valid worktree: worktreeResolution=linked-valid, storeRoot=MAIN root (not worktree), workRoot=worktree root",
      ok,
      JSON.stringify(r),
    );
  }
  {
    const r = resolveRootsAdapter(worktreeSubdir);
    const ok =
      r.worktreeResolution === "linked-valid" &&
      r.storeRoot != null &&
      fs.realpathSync(r.storeRoot) === mainRepoReal &&
      r.workRoot != null &&
      fs.realpathSync(r.workRoot) === worktreeReal;
    record(
      "adapter.mjs linked-valid worktree: worktreeResolution=linked-valid, storeRoot=MAIN root (not worktree), workRoot=worktree root",
      ok,
      JSON.stringify(r),
    );
  }

  // ==========================================================================
  // CASE 3 — linked-invalid: corrupt the worktree's reverse back-link so
  // bidirectional validation fails.
  // ==========================================================================
  {
    const worktreeId = readWorktreeId(worktreePath);
    const backlinkFile = path.join(mainRepo, ".git", "worktrees", worktreeId, "gitdir");
    const original = fs.readFileSync(backlinkFile, "utf8");

    try {
      fs.writeFileSync(backlinkFile, "/nonexistent/forged/path/.git\n");

      // state.mjs — must THROW WorktreeLinkInvalidError with .code.
      {
        let threw = false;
        let code = null;
        let isInstance = false;
        try {
          resolveRootsState(worktreeSubdir);
        } catch (err) {
          threw = true;
          code = err && err.code;
          isInstance = err instanceof WorktreeLinkInvalidError;
        }
        const ok = threw && code === "WORKTREE_LINK_INVALID" && isInstance;
        record(
          "state.mjs linked-invalid (corrupted back-link): throws WorktreeLinkInvalidError with code WORKTREE_LINK_INVALID",
          ok,
          threw ? `code=${code} instanceof=${isInstance}` : "did NOT throw",
        );
      }

      // adapter.mjs — must NOT throw; returns linked-invalid / storeRoot null.
      {
        let threw = false;
        let r = null;
        try {
          r = resolveRootsAdapter(worktreeSubdir);
        } catch {
          threw = true;
        }
        const ok = !threw && r && r.worktreeResolution === "linked-invalid" && r.storeRoot === null;
        record(
          "adapter.mjs linked-invalid (corrupted back-link): does NOT throw, returns worktreeResolution=linked-invalid, storeRoot=null",
          ok,
          threw ? "THREW (should not have)" : JSON.stringify(r),
        );
      }
    } finally {
      // Restore the backlink so the fixture is internally consistent again
      // (defensive — the whole tmpRoot is removed below regardless).
      fs.writeFileSync(backlinkFile, original);
    }
  }
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.passed);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 7);
