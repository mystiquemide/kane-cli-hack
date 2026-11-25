#!/usr/bin/env node
import { loadConfig, check, loop } from "../src/run.js";

const HELP = `spillover: catch localization bugs that only show up on screen

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
const agent = flag("--agent");
const rounds = flag("--rounds");
const [command, ...locales] = args;

try {
  const config = await loadConfig(configFile);
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
