import path from "node:path";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (color ? `\x1b[${code}m${text}\x1b[0m` : String(text));
export const red = paint("31");
export const green = paint("32");
export const yellow = paint("33");
export const dim = paint("2");
export const bold = paint("1");

export function printLocale(result) {
  const failed = result.checks.filter((c) => !c.pass);
  const head = result.error
    ? `${yellow("ERR ")} ${bold(result.locale)}  ${result.error}`
    : failed.length
      ? `${red("FAIL")} ${bold(result.locale)}  ${failed.length} of ${result.checks.length} checks failed`
      : `${green("PASS")} ${bold(result.locale)}  ${result.checks.length} checks`;
  console.log(head + dim(result.credits ? `  (${result.credits.toFixed(1)} credits, ${result.duration.toFixed(0)}s)` : ""));
  for (const check of failed) console.log(`     ${red("x")} ${check.reason}`);
}

export function summary(results) {
  const failing = results.filter((r) => r.error || r.checks.some((c) => !c.pass));
  const credits = results.reduce((sum, r) => sum + (r.credits || 0), 0);
  return { failing, credits, passed: results.length - failing.length, total: results.length };
}

// The brief is what the coding agent reads. It names the locale, what the
// screen showed, what it should show, and where the evidence lives.
export function writeBrief(results, config, outDir) {
  const lines = [
    "# Spillover: localization bugs found by Kane CLI",
    "",
    "Kane CLI opened each locale in real Chrome and judged what was on screen.",
    "Fix the app so every check below passes. Fix root causes (formatting code, CSS, document direction, missing catalog keys) rather than patching one locale at a time.",
    "",
    `App catalogs: \`${config.catalog}\``,
    config.fixScope ? `Only edit files under: ${config.fixScope.map((p) => `\`${p}\``).join(", ")}` : "",
    "Do not edit spillover.config.json.",
    "",
  ];
  for (const result of results) {
    const failed = result.checks.filter((c) => !c.pass);
    if (!failed.length && !result.error) continue;
    lines.push(`## ${result.locale} (${result.url})`, "");
    if (result.error) lines.push(`- Check could not run: ${result.error}`);
    for (const check of failed) {
      lines.push(`- **${check.description}**: ${check.reason}`);
      if (check.kaneReason) {
        const label = check.kind === "untranslated" ? "Kane read the untranslated text on screen" : "Kane";
        lines.push(`  - ${label}: ${check.kaneReason}`);
      }
    }
    if (result.screenshot) lines.push("", `Screenshot: \`${result.screenshot}\``);
    lines.push("");
  }
  return lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n");
}
