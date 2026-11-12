import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /moonhaven/
export default defineConfig({
  base: '/moonhaven/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
