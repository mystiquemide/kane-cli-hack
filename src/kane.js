import { spawn } from "node:child_process";

const KANE = process.env.SPILLOVER_KANE_BIN || "kane-cli";

// Ask Kane CLI to judge a list of conditions against the page open in the
// Chrome instance at cdpEndpoint. Uses analyzer mode: no clicks, no authoring,
// just verdicts on what is on screen.
export function judgePage({ cdpEndpoint, url, conditions, assertionMode = "visual", timeout = 240 }) {
  const args = [
    "run",
    "--analyzer-only",
    "--agent",
    "--cdp-endpoint", cdpEndpoint,
    "--url", url,
    "--allow-missing-url",
    "--assertion-mode", assertionMode,
    "--timeout", String(timeout),
  ];
  for (const condition of conditions) args.push("--condition", condition);

  return new Promise((resolve) => {
    const child = spawn(KANE, args, { stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    let stderr = "";
    const events = [];

    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch { /* not JSON, ignore */ }
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    child.on("error", (err) => {
      resolve({ ok: false, exitCode: 2, error: err.code === "ENOENT" ? "kane-cli not found. Install it with: npm install -g @testmuai/kane-cli" : err.message, events });
    });

    child.on("close", (exitCode) => {
      if (buffer.trim()) { try { events.push(JSON.parse(buffer.trim())); } catch { /* ignore */ } }
      const runEnd = events.find((e) => e.type === "run_end");
      const errorEvent = events.find((e) => e.type === "error");
      if (!runEnd || !Array.isArray(runEnd.condition_results)) {
        resolve({
          ok: false,
          exitCode: exitCode ?? 2,
          error: errorEvent?.message || runEnd?.reason || lastLine(stderr) || `kane-cli exited with code ${exitCode}`,
          events,
        });
        return;
      }
      resolve({
        ok: true,
        exitCode,
        results: runEnd.condition_results,
        reasons: runEnd.condition_reasons || [],
        subChecks: runEnd.condition_sub_checks || [],
        credits: Number(runEnd.credits_consumed ?? runEnd.credits ?? 0),
        duration: Number(runEnd.duration ?? 0),
        events,
      });
    });
  });
}

function lastLine(text) {
  return text.trim().split("\n").filter((l) => !/Skill update/.test(l)).pop();
}
