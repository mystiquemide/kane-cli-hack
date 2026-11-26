import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

process.env.SPILLOVER_KANE_BIN = fileURLToPath(new URL("./fixtures/fake-kane.js", import.meta.url));
const { judgePage } = await import("../src/kane.js");

test("parses a real recorded Kane run (German check, 2 bugs)", async () => {
  process.env.FAKE_KANE_MODE = "replay";
  const r = await judgePage({ cdpEndpoint: "http://127.0.0.1:1", url: "http://x", conditions: ["a"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.results, [true, true, true, false, false]);
  assert.equal(r.subChecks[3].extracted_value, "€1,399.00");
  assert.ok(r.credits > 0);
});

test("ignores non-JSON lines in Kane's output", async () => {
  process.env.FAKE_KANE_MODE = "replay";
  const r = await judgePage({ cdpEndpoint: "http://127.0.0.1:1", url: "http://x", conditions: ["a"] });
  assert.ok(r.events.every((e) => typeof e === "object"));
});

test("surfaces Kane's error message when a run can't start", async () => {
  process.env.FAKE_KANE_MODE = "auth-error";
  const r = await judgePage({ cdpEndpoint: "http://127.0.0.1:1", url: "http://x", conditions: ["a"] });
  assert.equal(r.ok, false);
  assert.match(r.error, /Not signed in/);
});

test("sends analyzer mode, visual assertions and every condition to Kane", async () => {
  process.env.FAKE_KANE_MODE = "args";
  const r = await judgePage({ cdpEndpoint: "http://127.0.0.1:9222", url: "http://app", conditions: ["one", "two"] });
  const args = JSON.parse(r.reasons[0]);
  for (const flag of ["--analyzer-only", "--agent", "--allow-missing-url"]) assert.ok(args.includes(flag), flag);
  assert.equal(args[args.indexOf("--assertion-mode") + 1], "visual");
  assert.equal(args[args.indexOf("--cdp-endpoint") + 1], "http://127.0.0.1:9222");
  assert.deepEqual(args.filter((_, i) => args[i - 1] === "--condition"), ["one", "two"]);
});

test("explains how to install Kane when it is missing", async () => {
  const saved = process.env.SPILLOVER_KANE_BIN;
  process.env.SPILLOVER_KANE_BIN = "/nonexistent/kane-cli";
  try {
    const r = await judgePage({ cdpEndpoint: "http://127.0.0.1:1", url: "http://x", conditions: ["a"] });
    assert.equal(r.ok, false);
    assert.match(r.error, /npm install -g @testmuai\/kane-cli/);
  } finally {
    process.env.SPILLOVER_KANE_BIN = saved;
  }
});
