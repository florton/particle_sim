import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites from /<repo>/, so built asset URLs need
  // that prefix. The dev server is served from the root, so it stays '/'.
  // Override for a root-served host (Netlify, Cloudflare Pages, S3):
  //   BASE_PATH=/ npm run build
  base: process.env.BASE_PATH ?? (command === 'build' ? '/particles/' : '/'),
  server: { port: 5173 },
  build: { target: 'esnext' },
}));
