// SPIKE (codex-parity-6c round-3): prove the guard-side causal close.
// Claim: if the guard DENIES creating a marker file (.bee/onboarding.json or
// hooks/bee-write-guard.mjs) that resolves OUTSIDE the resolved real root, then
// the above-root spoof can never be PLANTED (the plant write happens while the
// real root still resolves correctly). Must also NOT break legit out-of-repo
// writes to non-marker paths. Disposable; models the DECISION, not the wiring.
import path from "node:path";

const MARKER_BASENAMES = new Set(["onboarding.json", "bee-write-guard.mjs"]);
// A write is "marker-forging" when its target basename is a marker AND its parent
// component is the marker's home dir (.bee/ or hooks/) — i.e. it would create a
// file the root-walk keys on.
function isMarkerForge(absTarget) {
  const base = path.basename(absTarget);
  if (!MARKER_BASENAMES.has(base)) return false;
  const parent = path.basename(path.dirname(absTarget));
  if (base === "onboarding.json") return parent === ".bee";
  if (base === "bee-write-guard.mjs") return parent === "hooks";
  return false;
}
// escapes = resolves outside the real root (rel starts with .. or is absolute-elsewhere)
function escapesRoot(realRoot, absTarget) {
  const rel = path.relative(realRoot, absTarget);
  return rel === "" || rel.startsWith("..") || path.isAbsolute(rel);
}
// PROPOSED guard rule (added BEFORE the existing in-repo checks):
function proposedDecision(realRoot, absTarget) {
  if (isMarkerForge(absTarget) && escapesRoot(realRoot, absTarget)) return "DENY";
  return "PASS-THROUGH"; // existing logic decides in-repo gated writes
}

const REAL = "/work/repo";
const cases = [
  // [label, target, want]
  ["plant above: parent/.bee/onboarding.json",      "/work/.bee/onboarding.json",             "DENY"],
  ["plant above: parent/hooks/bee-write-guard.mjs", "/work/hooks/bee-write-guard.mjs",         "DENY"],
  ["plant far above: /tmp/x/.bee/onboarding.json",  "/tmp/x/.bee/onboarding.json",            "DENY"],
  ["plant sibling: /work/evil/hooks/bee-write-guard.mjs", "/work/evil/hooks/bee-write-guard.mjs", "DENY"],
  ["legit out-of-repo scratch: /tmp/notes.txt",     "/tmp/notes.txt",                          "PASS-THROUGH"],
  ["legit out-of-repo log: /var/log/app.log",       "/var/log/app.log",                        "PASS-THROUGH"],
  ["in-repo marker (self, not a forge outside): repo/.bee/onboarding.json", "/work/repo/.bee/onboarding.json", "PASS-THROUGH"],
  ["in-repo normal file: repo/src/x.js",            "/work/repo/src/x.js",                     "PASS-THROUGH"],
  ["below-root spoof marker (.spikes): repo/.spikes/s/.bee/onboarding.json", "/work/repo/.spikes/s/.bee/onboarding.json", "PASS-THROUGH"],
];

let ok = true;
console.log("case                                                              | got          | want");
console.log("------------------------------------------------------------------+--------------+-------------");
for (const [label, target, want] of cases) {
  const got = proposedDecision(REAL, target);
  const mark = got === want ? "  " : "XX";
  if (got !== want) ok = false;
  console.log(`${mark} ${label.padEnd(62)}| ${got.padEnd(12)} | ${want}`);
}
console.log("\nNOTE: below-root spoof marker is PASS-THROUGH here because the OUTERMOST walk");
console.log("already ignores it (picks the shallower real root); the guard rule only needs to");
console.log("stop the ABOVE-root plant. In-repo marker writes stay governed by existing logic.");
console.log(ok ? "\nSPIKE PASS: causal close holds, no legit out-of-repo write over-denied." : "\nSPIKE FAIL");
process.exit(ok ? 0 : 1);
