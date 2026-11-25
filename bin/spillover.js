#!/usr/bin/env node
import { loadConfig, check, loop } from "../src/run.js";
import { init, doctor, demo } from "../src/setup.js";

const HELP = `spillover: catch localization bugs that only show up on screen

Get started
  spillover init [--url "http://localhost:3000/?lang={locale}"]
                                   Find your translation files and write a config
  spillover doctor                 Check Chrome, Kane CLI, sign-in and credits
  spillover demo                   Try it on a sample store with real bugs

Usage
  spillover check [locales...]     Kane CLI checks each locale in real Chrome
  spillover loop  [--rounds N]     Check, hand failures to your coding agent, re-check
                  [--agent "cmd"]  Agent command that reads the brief on stdin
                                   (default: Claude Code headless)

Options
  --config <file>   Config file (default: spillover.config.json)
  -h, --help        Show this help

Exit codes: 0 all locales pass, 1 a locale is broken, 2 setup error`;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};

if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(HELP);
  process.exit(0);
}

const configFile = flag("--config");
const url = flag("--url");
const serve = flag("--serve");
const force = args.includes("--force");
if (force) args.splice(args.indexOf("--force"), 1);
const agent = flag("--agent");
const rounds = flag("--rounds");
const [command, ...locales] = args;

try {
  if (command === "init") process.exit(await init({ url, serve, force, file: configFile }));
  if (command === "doctor") process.exit(await doctor({ file: configFile }));
  if (command === "demo") {
    process.chdir(await demo());
    const result = await check(await loadConfig());
    console.log(`\nThe demo store is in ./spillover-demo. Try ${"`"}cd spillover-demo && spillover loop${"`"} to watch your agent fix it.`);
    process.exit(result.failing.length ? 1 : 0);
  }
  const config = await loadConfig(configFile).catch((err) => {
    if (err.code === "ENOENT") throw new Error("No spillover.config.json here. Run: spillover init");
    throw err;
  });
  if (command === "check") {
    const result = await check(config, locales.length ? locales : undefined);
    process.exit(result.results.some((r) => r.error) ? 2 : result.failing.length ? 1 : 0);
  } else if (command === "loop") {
    process.exit(await loop(config, { agent, rounds: rounds ? Number(rounds) : undefined }));
  } else {
    console.error(`Unknown command: ${command}\n\n${HELP}`);
    process.exit(2);
  }
} catch (err) {
  console.error(`spillover: ${err.message}`);
  process.exit(2);
}
