import net from "node:net";
import { chromium } from "playwright-core";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Open one real Chrome per locale with a DevTools port Kane CLI can attach to.
export async function openLocalePage({ url, viewport, headless = true }) {
  const port = await freePort();
  const launchOptions = {
    headless,
    args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
  };
  if (process.env.SPILLOVER_CHROME) launchOptions.executablePath = process.env.SPILLOVER_CHROME;
  else launchOptions.channel = "chrome";

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  return {
    page,
    cdpEndpoint: `http://127.0.0.1:${port}`,
    async screenshot(path) {
      await page.screenshot({ path, fullPage: true });
    },
    async close() {
      await browser.close().catch(() => {});
    },
  };
}
