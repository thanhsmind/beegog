import path from "node:path";
import { Worker } from "node:worker_threads";

const WORKER_ENTRY = `
const fs = require("node:fs");
const os = require("node:os");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");
const { workerData } = require("node:worker_threads");
if (workerData.fakeHome) os.homedir = () => workerData.fakeHome;
process.argv = [process.execPath, workerData.modulePath, ...workerData.args];
process.cwd = () => workerData.cwd;
Object.defineProperty(process, "stdin", { value: Readable.from(workerData.input ? [Buffer.from(workerData.input)] : []), configurable: true });
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = (file, options) => {
  if (file !== 0) return originalReadFileSync(file, options);
  const buffer = Buffer.from(workerData.input || "");
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding ? buffer.toString(encoding) : buffer;
};
void import(pathToFileURL(workerData.modulePath).href).catch((error) => { console.error(error); process.exitCode = 1; });
`;

let runnerQueue = Promise.resolve();

export function runModuleWorker(modulePath, { args = [], cwd = process.cwd(), env = process.env, fakeHome = null, input = "", timeout = 30_000 } = {}) {
  const run = runnerQueue.then(() => runModuleWorkerNow(modulePath, { args, cwd, env, fakeHome, input, timeout }));
  runnerQueue = run.catch(() => {});
  return run;
}

async function runModuleWorkerNow(modulePath, { args, cwd, env, fakeHome, input, timeout }) {
  const resolvedCwd = path.resolve(cwd);
  const resolvedModulePath = path.isAbsolute(modulePath) ? modulePath : path.resolve(resolvedCwd, modulePath);
  const callerCwd = process.cwd();
  try { process.chdir(resolvedCwd); } catch (error) { return { status: null, signal: null, stdout: "", stderr: "", error }; }
  try {
    let worker;
    try {
      worker = new Worker(WORKER_ENTRY, { eval: true, workerData: { modulePath: resolvedModulePath, args: [...args], cwd: resolvedCwd, fakeHome: fakeHome || null, input: input == null ? "" : String(input) }, env: { ...env, ...(fakeHome ? { HOME: fakeHome, USERPROFILE: fakeHome } : {}) }, stdout: true, stderr: true, execArgv: [] });
    } catch (error) { return { status: null, signal: null, stdout: "", stderr: "", error }; }
    let timedOut = false;
    let workerError = null;
    const read = async (stream) => { stream.setEncoding("utf8"); let out = ""; for await (const chunk of stream) out += chunk; return out; };
    const exit = new Promise((resolve) => { worker.once("error", (error) => { workerError = error; }); worker.once("exit", resolve); });
    const timer = Number.isFinite(timeout) && timeout > 0 ? setTimeout(() => { timedOut = true; void worker.terminate(); }, timeout) : null;
    const [status, stdout, stderr] = await Promise.all([exit, read(worker.stdout), read(worker.stderr)]);
    if (timer) clearTimeout(timer);
    if (timedOut) return { status: null, signal: "SIGTERM", stdout, stderr, error: Object.assign(new Error(`Worker timed out after ${timeout}ms`), { code: "ETIMEDOUT" }) };
    return { status, signal: null, stdout, stderr, error: workerError };
  } finally { process.chdir(callerCwd); }
}
