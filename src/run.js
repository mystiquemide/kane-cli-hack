import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { buildChecks, judge } from "./expect.js";
import { judgePage } from "./kane.js";
import { openLocalePage } from "./browser.js";
import { serveFolder } from "./serve.js";
import { printLocale, summary, writeBrief, bold, dim, green, red, yellow } from "./report.js";

export async function loadConfig(file = "spillover.config.json") {
  const config = JSON.parse(await readFile(file, "utf8"));
  config.source ??= "en";
  config.viewport ??= { width: 1280, height: 720 };
  config.outDir ??= ".spillover";
  config.parallel ??= 4;
  return config;
}

async function readCatalog(config, locale) {
  const file = config.catalog.replace("{locale}", locale);
  return JSON.parse(await readFile(file, "utf8"));
}

async function withServer(config, fn) {
  if (!config.serve) return fn();
  const port = Number(new URL(config.url.replace("{locale}", "x")).port || 80);
  const server = await serveFolder(config.serve, port);
  try { return await fn(); } finally { server.close(); }
}

async function checkLocale(config, locale) {
  const settings = config.locales[locale] || {};
  const url = config.url.replace("{locale}", locale);
  const [catalog, source] = await Promise.all([readCatalog(config, locale), readCatalog(config, config.source)]);
  const checks = buildChecks({ locale, settings, catalog, source, config });
  const result = { locale, url, checks: [], credits: 0, duration: 0 };

  let browser;
  try {
    browser = await openLocalePage({ url, viewport: config.viewport });
    result.screenshot = path.resolve(config.outDir, `${locale}.png`);
    await browser.screenshot(result.screenshot);

    const verdict = await judgePage({
      cdpEndpoint: browser.cdpEndpoint,
      url,
      conditions: checks.map((c) => c.condition),
    });
    if (!verdict.ok) {
      result.error = verdict.error;
      result.checks = checks.map((c) => ({ ...c, pass: false, reason: "not checked" }));
      return result;
    }
    result.credits = verdict.credits;
    result.duration = verdict.duration;
    result.checks = checks.map((check, i) => ({
      ...check,
      ...judge(check, verdict.results[i], verdict.subChecks[i]),
      kane: verdict.results[i],
      kaneReason: verdict.reasons[i],
      seen: verdict.subChecks[i]?.extracted_value,
    }));
  } catch (err) {
    result.error = err.message.split("\n")[0];
  } finally {
    await browser?.close();
  }
  return result;
}

async function pool(items, size, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i]);
    }
  }));
  return out;
}

export async function check(config, locales = Object.keys(config.locales)) {
  await mkdir(config.outDir, { recursive: true });
  console.log(dim(`Kane CLI is checking ${locales.join(", ")} in real Chrome...`));
  const results = await withServer(config, () =>
    pool(locales, config.parallel, async (locale) => {
      const r = await checkLocale(config, locale);
      printLocale(r);
      return r;
    }),
  );
  const s = summary(results);
  const report = { at: new Date().toISOString(), locales: results, credits: s.credits };
  await writeFile(path.join(config.outDir, "report.json"), JSON.stringify(report, null, 2));
  if (s.failing.length) {
    await writeFile(path.join(config.outDir, "brief.md"), writeBrief(s.failing, config, config.outDir));
  }
  console.log(
    `\n${s.failing.length ? red(`${s.failing.length} of ${s.total} locales broken`) : green(`All ${s.total} locales pass`)}` +
      dim(`  ·  ${s.credits.toFixed(1)} Kane credits  ·  report: ${path.join(config.outDir, "report.json")}`),
  );
  if (s.failing.length) console.log(dim(`Brief for your coding agent: ${path.join(config.outDir, "brief.md")}`));
  return { results, ...s };
}

function runAgent(command, prompt) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: ["pipe", "inherit", "inherit"] });
    child.stdin.end(prompt);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const DEFAULT_AGENT = "claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep";

export async function loop(config, { agent = config.agent || DEFAULT_AGENT, rounds = 3 } = {}) {
  let locales = Object.keys(config.locales);
  let credits = 0;
  for (let round = 1; round <= rounds + 1; round++) {
    console.log(bold(`\nRound ${round}: verify`));
    const result = await check(config, locales);
    credits += result.credits;
    if (!result.failing.length) {
      console.log(green(bold(`\nFixed. Kane verified every locale in ${round} round${round > 1 ? "s" : ""}.`)) + dim(`  ${credits.toFixed(1)} credits total`));
      return 0;
    }
    if (round > rounds) break;
    locales = result.failing.map((r) => r.locale);
    const brief = await readFile(path.join(config.outDir, "brief.md"), "utf8");
    console.log(bold(`\nRound ${round}: fix`) + dim(`  handing ${locales.length} broken locale${locales.length > 1 ? "s" : ""} to: ${agent.split(" ")[0]}`));
    const code = await runAgent(agent, `${brief}\n\nWhen you are done, reply with one line per fix.`);
    if (code !== 0) {
      console.log(yellow(`Agent exited with code ${code}. Stopping.`));
      return 2;
    }
    console.log(dim(`Re-checking only: ${locales.join(", ")}`));
  }
  console.log(red(bold(`\nStill broken after ${rounds} fix rounds.`)) + dim(`  ${credits.toFixed(1)} credits total`));
  return 1;
}
