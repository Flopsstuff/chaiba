/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// `base` matches the GitHub Pages repo path so assets resolve under /chaiba/.
export default defineConfig({
  base: '/chaiba/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
