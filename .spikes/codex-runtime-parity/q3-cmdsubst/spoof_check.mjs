import { checkWrite } from "../../../.bee/bin/lib/guards.mjs";
for (const p of [".spikes/s/.bee/onboarding.json",".spikes/s/hooks/bee-write-guard.mjs",".spikes/s/.bee/state.json"]) {
  const idle = checkWrite("/x", { phase: "idle" }, p);
  const gated = checkWrite("/x", { phase: "validating", approved_gates:{execution:false} }, p);
  console.log(p, "| idle.allow=", idle.allow, "| validating.allow=", gated.allow);
}
