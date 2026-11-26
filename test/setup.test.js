import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findCatalogs, intlFor } from "../src/setup.js";
import { pickStrings } from "../src/expect.js";

test("finds flat catalogs like locales/de.json", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "spill-"));
  await mkdir(path.join(root, "locales"));
  for (const l of ["en", "de", "ar"]) await writeFile(path.join(root, "locales", `${l}.json`), "{}");
  const found = await findCatalogs(root);
  assert.equal(found.pattern, "locales/{locale}.json");
  assert.deepEqual(found.locales.sort(), ["ar", "de", "en"]);
});

test("finds i18next folders like public/locales/de/common.json", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "spill-"));
  for (const l of ["en", "pt-BR"]) {
    await mkdir(path.join(root, "public/locales", l), { recursive: true });
    await writeFile(path.join(root, "public/locales", l, "common.json"), "{}");
  }
  const found = await findCatalogs(root);
  assert.equal(found.pattern, "public/locales/{locale}/common.json");
});

test("maps languages to a regional format", () => {
  assert.equal(intlFor("hi"), "hi-IN");
  assert.equal(intlFor("de"), "de-DE");
  assert.equal(intlFor("pt-BR"), "pt-BR");
});

test("picks visible strings, skipping prices and codes", () => {
  const keys = pickStrings({ cart: { title: "Your cart" }, price: { amount: 5, currency: "USD" } }, 5, ["price"]);
  assert.deepEqual(keys, ["cart.title"]);
});

test("returns null when a project has no translation files", async () => {
  assert.equal(await findCatalogs(await mkdtemp(path.join(tmpdir(), "spill-"))), null);
});

test("keeps an unknown locale code as is", () => {
  assert.equal(intlFor("not a locale"), "not a locale");
});
