import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright-core";
import { bold, dim, green, red, yellow } from "./report.js";

const CANDIDATE_DIRS = [
  "locales", "public/locales", "src/locales", "src/i18n", "src/lang", "i18n", "lang",
  "messages", "translations", "app/locales", "assets/locales", "static/locales", "demo-app/locales",
];
const LOCALE = /^[a-z]{2,3}([-_][A-Za-z]{2,4})?$/;
const RTL = new Set(["ar", "he", "fa", "ur", "ps", "yi", "dv", "ckb", "sd", "ug"]);

const exists = (p) => access(p).then(() => true, () => false);

// Look for translation catalogs in the usual places.
// Supports flat files (locales/de.json) and folders (locales/de/common.json).
export async function findCatalogs(root = ".") {
  for (const dir of CANDIDATE_DIRS) {
    const full = path.join(root, dir);
    if (!(await exists(full))) continue;
    const entries = await readdir(full, { withFileTypes: true });

    const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json") && LOCALE.test(e.name.slice(0, -5)));
    if (files.length >= 2) {
      return { pattern: `${dir}/{locale}.json`, locales: files.map((f) => f.name.slice(0, -5)) };
    }

    const folders = entries.filter((e) => e.isDirectory() && LOCALE.test(e.name));
    if (folders.length >= 2) {
      const inFirst = (await readdir(path.join(full, folders[0].name))).filter((n) => n.endsWith(".json"));
      const name = inFirst.includes("common.json") ? "common.json" : inFirst.includes("translation.json") ? "translation.json" : inFirst[0];
      if (name) return { pattern: `${dir}/{locale}/${name}`, locales: folders.map((f) => f.name) };
    }
  }
  return null;
}

export function intlFor(code) {
  try {
    const loc = new Intl.Locale(code.replace("_", "-")).maximize();
    return loc.region ? `${loc.language}-${loc.region}` : loc.language;
  } catch {
    return code;
  }
}

function findPrice(node, prefix = "") {
  for (const [k, v] of Object.entries(node || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      if (typeof v.amount === "number" && typeof v.currency === "string") return key;
      const inner = findPrice(v, key);
      if (inner) return inner;
    }
  }
  return null;
}

export async function init({ url, serve, force, file } = {}) {
  file ||= "spillover.config.json";
  if ((await exists(file)) && !force) {
    console.log(`${yellow("!")} ${file} already exists. Use --force to replace it.`);
    return 1;
  }
  const found = await findCatalogs();
  if (!found) {
    console.log(`${red("x")} No translation files found. Looked in: ${CANDIDATE_DIRS.slice(0, 8).join(", ")} and more.`);
    console.log(dim("  Spillover expects one JSON file per language, like locales/de.json or locales/de/common.json."));
    return 2;
  }
  const source = found.locales.includes("en") ? "en" : found.locales[0];
  const targets = found.locales.filter((l) => l !== source);
  const locales = Object.fromEntries(targets.map((l) => {
    const base = l.split(/[-_]/)[0];
    return [l, RTL.has(base) ? { intl: intlFor(l), dir: "rtl" } : { intl: intlFor(l) }];
  }));

  const sourceCatalog = JSON.parse(await readFile(found.pattern.replace("{locale}", source), "utf8"));
  const priceKey = findPrice(sourceCatalog);

  const config = {
    url: url || "http://localhost:3000/?lang={locale}",
    ...(serve ? { serve } : {}),
    catalog: found.pattern,
    source,
    locales,
    ...(priceKey ? { price: { key: priceKey, element: "product price" } } : {}),
  };
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);

  console.log(`${green("ok")} Found ${bold(found.locales.length)} languages in ${found.pattern}`);
  console.log(`   Source: ${source}   Checking: ${targets.map((l) => (locales[l].dir ? `${l} (right-to-left)` : l)).join(", ")}`);
  if (priceKey) console.log(`   Price format check on "${priceKey}"`);
  console.log(`${green("ok")} Wrote ${file}`);
  if (!url) {
    console.log(`\n${yellow("!")} Set the address of your app. Put {locale} where the language goes:`);
    console.log(dim(`  spillover init --force --url "http://localhost:3000/{locale}/"`));
    console.log(dim(`  spillover init --force --url "http://localhost:3000/?lang={locale}"`));
  }
  console.log(`\nNext: ${bold("spillover doctor")}, then ${bold("spillover check")}`);
  return 0;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`, missing: r.error?.code === "ENOENT" };
}

export async function doctor({ file } = {}) {
  file ||= "spillover.config.json";
  let problems = 0;
  const line = (ok, label, fix) => {
    console.log(`${ok ? green(" ok ") : red(" x  ")} ${label}`);
    if (!ok) { problems++; if (fix) console.log(dim(`      ${fix}`)); }
  };

  const major = Number(process.versions.node.split(".")[0]);
  line(major >= 20, `Node ${process.versions.node}`, "Install Node 20 or newer from nodejs.org");

  try {
    const opts = process.env.SPILLOVER_CHROME ? { executablePath: process.env.SPILLOVER_CHROME } : { channel: "chrome" };
    const browser = await chromium.launch({ ...opts, headless: true });
    await browser.close();
    line(true, "Google Chrome");
  } catch {
    line(false, "Google Chrome", "Install Chrome from google.com/chrome, or set SPILLOVER_CHROME to a Chrome binary");
  }

  const version = run("kane-cli", ["--version"]);
  line(version.ok, version.ok ? `Kane CLI ${version.out.trim().split("\n").pop()}` : "Kane CLI", "npm install -g @testmuai/kane-cli");

  if (version.ok) {
    const who = run("kane-cli", ["whoami"]);
    const authed = who.ok && /Authenticated/i.test(who.out);
    line(authed, "Signed in to TestMu AI", "kane-cli login   (free account at testmuai.com)");
    if (authed) {
      const credits = Number((run("kane-cli", ["balance"]).out.match(/credits:\s*([\d.]+)/i) || [])[1]);
      const enough = credits >= 10;
      line(enough, Number.isFinite(credits) ? `${credits.toFixed(0)} Kane credits${enough ? "" : " (low)"}` : "Kane credits", "Each language costs a few credits per check. Top up at testmuai.com/pricing");
    }
  }

  const hasConfig = await exists(file);
  line(hasConfig, hasConfig ? file : `${file} missing`, "spillover init");

  const agent = run("claude", ["--version"]);
  console.log(`${agent.ok ? green(" ok ") : yellow(" -  ")} ${agent.ok ? "Claude Code (for spillover loop)" : "Claude Code not found. Optional: only spillover loop needs a coding agent."}`);

  console.log(problems ? `\n${red(`${problems} thing${problems > 1 ? "s" : ""} to fix`)} before spillover check.` : `\n${green("Ready.")} Run ${bold("spillover check")}`);
  return problems ? 2 : 0;
}

// Copy the bundled demo store into ./spillover-demo so anyone can try
// Spillover right after installing, before pointing it at their own app.
export async function demo({ dest = "spillover-demo" } = {}) {
  const { cp, mkdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  if (await exists(dest)) {
    console.log(`${yellow("!")} ${dest}/ already exists. Using it.`);
  } else {
    await mkdir(dest, { recursive: true });
    await cp(path.join(pkgRoot, "demo-app"), path.join(dest, "demo-app"), { recursive: true });
    await cp(path.join(pkgRoot, "spillover.config.json"), path.join(dest, "spillover.config.json"));
    console.log(`${green("ok")} Copied the Tidepool demo store, with its localization bugs, to ${dest}/`);
  }
  return path.resolve(dest);
}
