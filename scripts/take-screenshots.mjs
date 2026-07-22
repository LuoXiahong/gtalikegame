/**
 * Capture night+rain screenshots via CDP.
 * Avoid page.screenshot({ animations:'disabled' }) — hangs on WebGL/rAF pages.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { SCENARIOS } from '../src/dev/screenshotScenarios.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../docs/screenshots');
const PORT = 5174;

async function captureViaCdp(page, outputPath) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
    });
    fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Starting Vite server...');
  const server = await createServer({
    root: path.resolve(__dirname, '../src'),
    server: { port: PORT, host: 'localhost', strictPort: true },
    configFile: path.resolve(__dirname, '../src/vite.config.js'),
  });
  await server.listen();
  console.log(`Vite server running on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    // Prefer real GL when available; avoid forcing swiftshader (ReadPixels stalls on WSL)
    args: ['--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (err) => console.error('pageerror:', err.message));

  const scenarios = Object.keys(SCENARIOS);
  console.log(`Capturing ${scenarios.length} night+rain screenshots: ${scenarios.join(', ')}`);

  for (const scenario of scenarios) {
    const t0 = Date.now();
    console.log(`Generating screenshot for scenario: ${scenario}`);
    const url = `http://localhost:${PORT}/?screenshot=${encodeURIComponent(scenario)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForFunction(
      () => window.__SCREENSHOT_READY__ === true,
      null,
      { timeout: 120000 }
    );

    const outputPath = path.join(OUT_DIR, `${scenario}.png`);
    await captureViaCdp(page, outputPath);
    console.log(`Saved ${outputPath} (${Date.now() - t0}ms)`);
  }

  await browser.close();
  await server.close();
  console.log('Done!');
}

run().catch((err) => {
  console.error('Failed to generate screenshots:', err);
  process.exit(1);
});
