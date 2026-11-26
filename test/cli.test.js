import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const BIN = new URL("../bin/spillover.js", import.meta.url).pathname;
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });

test("--help lists every command", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  for (const cmd of ["init", "doctor", "demo", "check", "loop"]) assert.match(r.stdout, new RegExp(`spillover ${cmd}`));
});

test("unknown command exits 2", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "spill-"));
  await writeFile(path.join(dir, "spillover.config.json"), JSON.stringify({ url: "http://127.0.0.1:1/{locale}", catalog: "x/{locale}.json", locales: {} }));
  assert.equal(run(["fly"], dir).status, 2);
});

test("check without a config points to init", async () => {
  const r = run(["check"], await mkdtemp(path.join(tmpdir(), "spill-")));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /spillover init/);
});

test("check stops before spending credits when the app is down", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "spill-"));
  await writeFile(path.join(dir, "spillover.config.json"), JSON.stringify({ url: "http://127.0.0.1:9/?lang={locale}", catalog: "l/{locale}.json", locales: { de: {} } }));
  const r = run(["check"], dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No Kane credits were used/);
});

test("init writes a config from the project's translation files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "spill-"));
  await mkdir(path.join(dir, "locales"));
  await writeFile(path.join(dir, "locales/en.json"), JSON.stringify({ price: { amount: 10, currency: "USD" } }));
  await writeFile(path.join(dir, "locales/ar.json"), "{}");
  const r = run(["init", "--url", "http://localhost:5173/{locale}/"], dir);
  assert.equal(r.status, 0);
  const config = JSON.parse(await readFile(path.join(dir, "spillover.config.json"), "utf8"));
  assert.equal(config.url, "http://localhost:5173/{locale}/");
  assert.equal(config.locales.ar.dir, "rtl");
  assert.equal(config.price.key, "price");
});

test("init will not overwrite an existing config without --force", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "spill-"));
  await writeFile(path.join(dir, "spillover.config.json"), "{}");
  assert.equal(run(["init"], dir).status, 1);
});
