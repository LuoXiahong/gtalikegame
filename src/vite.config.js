import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Użycie ścieżek relatywnych rozwiązuje problem hostowania w podkatalogu
});
