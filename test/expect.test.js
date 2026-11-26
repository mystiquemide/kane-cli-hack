import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecks, judge, normalize, expectedPrice } from "../src/expect.js";

const config = {
  strings: { "cart.title": "heading", "cart.checkout": "checkout button" },
  price: { key: "price", element: "price" },
};
const source = { cart: { title: "Your cart", checkout: "Checkout" }, price: { amount: 124999, currency: "INR" } };

test("prices follow the locale, including lakh grouping", () => {
  assert.equal(expectedPrice({ amount: 124999, currency: "INR" }, "hi-IN"), "₹1,24,999.00");
  assert.equal(normalize(expectedPrice({ amount: 1399, currency: "EUR" }, "de-DE")), "1.399,00 €");
});

test("missing catalog keys become untranslated checks", () => {
  const checks = buildChecks({ locale: "ja", settings: {}, catalog: { cart: { title: "カート" } }, source, config });
  const missing = checks.find((c) => c.key === "cart.checkout");
  assert.equal(missing.kind, "untranslated");
  assert.match(missing.condition, /'Checkout'/);
});

test("RTL locales get a direction check", () => {
  const checks = buildChecks({ locale: "ar", settings: { dir: "rtl" }, catalog: source, source, config });
  assert.ok(checks.some((c) => c.id === "rtl"));
});

test("text is judged on what Kane read, ignoring spacing and bidi marks", () => {
  const check = { kind: "price", expected: "1.399,00 €" };
  assert.equal(judge(check, false, { extracted_value: "1.399,00 €" }).pass, true);
  assert.equal(judge(check, true, { extracted_value: "€1,399.00" }).pass, false);
});

test("visual checks use Kane's verdict", () => {
  const check = { kind: "visual", expected: "fits", failMessage: "cut off" };
  assert.equal(judge(check, true, { extracted_value: "true" }).pass, true);
  assert.equal(judge(check, false, { extracted_value: "false" }).reason, "cut off");
});

test("normalize strips Arabic direction marks", () => {
  assert.equal(normalize("‏5,499.00 د.إ.‏"), "5,499.00 د.إ.");
});

test("normalize treats full-width and half-width yen the same", () => {
  assert.equal(normalize("￥219,800"), normalize("¥219,800"));
});

test("normalize drops quotes Kane sometimes wraps around values", () => {
  assert.equal(normalize("'Zur Kasse gehen'"), "Zur Kasse gehen");
});

test("described strings tell Kane where to look", () => {
  const checks = buildChecks({ locale: "de", settings: {}, catalog: { cart: { title: "Ihr Warenkorb", checkout: "Zur Kasse" } }, source, config });
  assert.equal(checks[0].condition, "The heading reads 'Ihr Warenkorb'");
});

test("without descriptions, Kane looks for the text anywhere on the page", () => {
  const checks = buildChecks({ locale: "de", settings: {}, catalog: { cart: { title: "Ihr Warenkorb" } }, source: { cart: { title: "Your cart" } }, config: {} });
  assert.equal(checks[0].condition, "The page shows the text 'Ihr Warenkorb'");
});

test("left-to-right locales get no direction check", () => {
  const checks = buildChecks({ locale: "de", settings: {}, catalog: source, source, config });
  assert.ok(!checks.some((c) => c.id === "rtl"));
});

test("every locale gets the clipped-label check", () => {
  const checks = buildChecks({ locale: "hi", settings: {}, catalog: source, source, config });
  assert.ok(checks.some((c) => c.id === "fit" && c.kind === "visual"));
});

test("no price check when the catalog has no price", () => {
  const checks = buildChecks({ locale: "de", settings: {}, catalog: {}, source: {}, config: { price: { key: "price", element: "price" } } });
  assert.ok(!checks.some((c) => c.id === "price"));
});

test("an untranslated string always fails and names the English text", () => {
  const check = { kind: "untranslated", key: "cart.checkout", sourceText: "Checkout" };
  const r = judge(check, true, { extracted_value: "Checkout" });
  assert.equal(r.pass, false);
  assert.match(r.reason, /source text "Checkout"/);
});

test("a wrong string reports what the screen showed", () => {
  const r = judge({ kind: "string", expected: "Ihr Warenkorb" }, false, { extracted_value: "Your cart" });
  assert.equal(r.pass, false);
  assert.match(r.reason, /screen shows "Your cart"/);
});

test("falls back to Kane's boolean when Kane returns no text", () => {
  assert.equal(judge({ kind: "string", expected: "Konto" }, true, { extracted_value: "true" }).pass, true);
  assert.equal(judge({ kind: "string", expected: "Konto" }, false, { extracted_value: "false" }).pass, false);
});

test("Japanese prices have no decimals", () => {
  assert.equal(normalize(expectedPrice({ amount: 219800, currency: "JPY" }, "ja-JP")), "¥219,800");
});
