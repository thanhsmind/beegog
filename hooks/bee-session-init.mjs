#!/usr/bin/env node
// bee-session-init: SessionStart (startup|resume|clear|compact).
// Prints the bee session preamble (status, gates, HANDOFF surfacing, patterns,
// decisions) built by the target repo's own .bee/bin/lib/inject.mjs.
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs,
// cell codex-parity-3, decision D2): stdin is normalized before any property
// access and root discovery lives inside the fail-open boundary.
// SessionStart stdout stays plain developer context on both hosts.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "session-init";

async function main() {
  const ctx = await readHookContext(HOOK_NAME);
  const root = ctx.root;
  if (!root) {
    return 0;
  }
  if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
    return 0;
  }

  try {
    const state = await import(libModuleUrl(root, "state.mjs"));
    if (!state.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }
    const inject = await import(libModuleUrl(root, "inject.mjs"));
    const preamble = inject.buildSessionPreamble(root);
    if (preamble && String(preamble).trim()) {
      process.stdout.write(String(preamble));
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
