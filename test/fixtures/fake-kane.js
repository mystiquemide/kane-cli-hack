#!/usr/bin/env node
// Stands in for kane-cli in tests. Replays a recorded Kane run, or misbehaves on purpose.
import { readFileSync } from "node:fs";
const mode = process.env.FAKE_KANE_MODE || "replay";
if (mode === "replay") {
  process.stdout.write("not json, Kane sometimes prints notices\n");
  process.stdout.write(readFileSync(new URL("./kane-de-run.ndjson", import.meta.url), "utf8"));
  process.exit(0);
}
if (mode === "auth-error") {
  process.stdout.write(JSON.stringify({ type: "error", message: "Not signed in. Run kane-cli login." }) + "\n");
  process.exit(2);
}
if (mode === "args") {
  process.stdout.write(JSON.stringify({ type: "run_end", status: "passed", condition_results: [true], condition_reasons: [JSON.stringify(process.argv.slice(2))], credits_consumed: 1 }) + "\n");
  process.exit(0);
}
