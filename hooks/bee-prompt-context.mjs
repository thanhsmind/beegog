#!/usr/bin/env node
// bee-prompt-context: UserPromptSubmit.
// Injects a 1-3 line phase/mode/next-action/gate reminder, deduped via the
// injection cache (only when state changed or >30 min since last injection).
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs,
// cell codex-parity-3, decision D2): stdin is normalized before any property
// access and root discovery lives inside the fail-open boundary.
// UserPromptSubmit stdout stays plain developer context on both hosts.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "prompt-context";

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
    const reminder = inject.buildPromptReminder(root);
    if (!reminder || !reminder.text || !String(reminder.text).trim()) {
      return 0;
    }
    if (inject.shouldInject(root, "prompt", reminder.hash)) {
      process.stdout.write(String(reminder.text));
      inject.markInjected(root, "prompt", reminder.hash);
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
