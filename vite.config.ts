/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // elkjs is imported lazily (Layout button); pre-bundle it so the dev server does not reload
  // the page the first time it is used.
  optimizeDeps: { include: ['elkjs/lib/elk.bundled.js'] },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
