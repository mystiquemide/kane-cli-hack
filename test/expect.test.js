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
