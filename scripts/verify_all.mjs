#!/usr/bin/env node
// Single source of truth for the verify chain: reads `.bee/config.json`
// `commands.verify` and runs it exactly as recorded there. CI (.github/
// workflows/ci.yml) invokes this same script, so CI can never drift from
// the local chain — there is nowhere else the command list is duplicated.
//
// Usage:
//   node scripts/verify_all.mjs            run the full chain, streamed
//   node scripts/verify_all.mjs --list     print each `&&`-joined command,
//                                          one per line, and exit 0
//   node scripts/verify_all.mjs --only N   run only the Nth command (1-based)
//                                          from the chain (useful for CI
//                                          debugging / a fast local check)

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, '.bee', 'config.json');

function loadVerifyChain() {
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    console.error(`verify_all: cannot read ${configPath}: ${err.message}`);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    console.error(`verify_all: ${configPath} is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  const verify = config?.commands?.verify;
  if (typeof verify !== 'string' || !verify.trim()) {
    console.error(`verify_all: .bee/config.json commands.verify is missing or empty`);
    process.exit(1);
  }
  return verify.trim();
}

// The chain is a shell `&&`-joined string of independent commands, matching
// how it is authored in .bee/config.json today (no command in the chain
// embeds a literal ' && ' inside quotes).
function splitCommands(chain) {
  return chain.split(' && ').map((c) => c.trim()).filter(Boolean);
}

function runShell(command) {
  return new Promise((resolve) => {
    console.log(`> ${command}`);
    const child = spawn(command, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => {
      console.error(`verify_all: failed to spawn: ${err.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`verify_all: terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const verifyChain = loadVerifyChain();

  if (args.includes('--list')) {
    for (const cmd of splitCommands(verifyChain)) {
      console.log(cmd);
    }
    process.exit(0);
  }

  const onlyIndex = args.indexOf('--only');
  if (onlyIndex !== -1) {
    const commands = splitCommands(verifyChain);
    const n = Number.parseInt(args[onlyIndex + 1], 10);
    if (!Number.isInteger(n) || n < 1 || n > commands.length) {
      console.error(`verify_all: --only expects an index between 1 and ${commands.length}`);
      process.exit(1);
    }
    const code = await runShell(commands[n - 1]);
    process.exit(code);
  }

  const code = await runShell(verifyChain);
  process.exit(code);
}

main();
