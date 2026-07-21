import { chromium } from 'playwright';
import { createServer } from 'vite';
import { SCENARIOS } from '../src/dev/screenshotScenarios.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  console.log('Starting Vite server...');
  const server = await createServer({
    root: path.resolve(__dirname, '../src'),
    server: {
      port: 5174,
      host: 'localhost',
    },
    configFile: path.resolve(__dirname, '../src/vite.config.js'),
  });
  
  await server.listen();
  console.log('Vite server running on http://localhost:5174');

  console.log('Launching browser...');
  const browser = await chromium.launch({
    // Removed swiftshader args to allow hardware acceleration / real WebGL
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2
  });

  const scenarios = Object.keys(SCENARIOS);

  for (const scenario of scenarios) {
    console.log(`Generating screenshot for scenario: ${scenario}`);
    
    // Using networkidle to ensure Vite has loaded everything
    await page.goto(`http://localhost:5174/?screenshot=${scenario}`);
    
    // Wait for textures and 3D models to load
    await page.waitForTimeout(3000);

    // Give it an extra frame or two for the composer to settle
    await page.waitForTimeout(100);

    const outputPath = path.resolve(__dirname, `../docs/screenshots/${scenario}.png`);
    await page.screenshot({ 
      path: outputPath,
      animations: 'disabled',
      timeout: 60000
    });
    console.log(`Saved screenshot: ${outputPath}`);
  }

  console.log('Closing browser and server...');
  await browser.close();
  await server.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Failed to generate screenshots:', err);
  process.exit(1);
});
