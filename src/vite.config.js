import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './', // Relative paths so the build works when hosted in a subdirectory
  publicDir: path.resolve(__dirname, '../public'),
});
