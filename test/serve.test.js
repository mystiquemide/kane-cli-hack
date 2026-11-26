import { test, after } from "node:test";
import assert from "node:assert/strict";
import { serveFolder } from "../src/serve.js";

const port = 41731;
const server = await serveFolder(new URL("../demo-app", import.meta.url).pathname, port);
after(() => server.close());

test("serves the demo store's index page", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
});

test("serves catalogs as JSON", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/locales/de.json`);
  assert.equal((await res.json()).cart.title, "Ihr Warenkorb");
});

test("returns 404 for missing files", async () => {
  assert.equal((await fetch(`http://127.0.0.1:${port}/nope.js`)).status, 404);
});

test("refuses to serve files outside the folder", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/%2e%2e/package.json`);
  assert.notEqual(res.status, 200);
});
