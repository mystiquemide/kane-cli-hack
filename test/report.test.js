import { test } from "node:test";
import assert from "node:assert/strict";
import { writeBrief, summary } from "../src/report.js";

const results = [
  { locale: "de", url: "http://x/?lang=de", screenshot: ".spillover/de.png", credits: 2, checks: [
    { pass: false, kind: "price", description: "price", reason: "Expected \"1.399,00 €\"", kaneReason: "equals -> FAIL" },
    { pass: true, kind: "string", description: "heading" },
  ] },
  { locale: "ja", url: "http://x/?lang=ja", credits: 3, checks: [
    { pass: false, kind: "untranslated", description: "button", reason: "Missing translation", kaneReason: "value 'Checkout'" },
  ] },
  { locale: "hi", url: "http://x/?lang=hi", credits: 1, checks: [{ pass: true, kind: "string" }] },
];
const config = { catalog: "locales/{locale}.json", fixScope: ["src/"] };

test("summary counts broken locales and credits", () => {
  const s = summary(results);
  assert.equal(s.failing.length, 2);
  assert.equal(s.passed, 1);
  assert.equal(s.credits, 6);
});

test("brief lists only failed checks, per locale, with screenshots", () => {
  const brief = writeBrief(results, config);
  assert.match(brief, /## de \(http:\/\/x\/\?lang=de\)/);
  assert.match(brief, /Screenshot: `.spillover\/de.png`/);
  assert.doesNotMatch(brief, /heading/);
  assert.doesNotMatch(brief, /## hi/);
});

test("brief tells the agent where it may edit", () => {
  assert.match(writeBrief(results, config), /Only edit files under: `src\/`/);
});

test("brief labels Kane's reading of untranslated text clearly", () => {
  assert.match(writeBrief(results, config), /Kane read the untranslated text on screen: value 'Checkout'/);
});

test("a locale that could not be checked says why", () => {
  const brief = writeBrief([{ locale: "ar", url: "u", error: "Chrome missing", checks: [] }], config);
  assert.match(brief, /Check could not run: Chrome missing/);
});
