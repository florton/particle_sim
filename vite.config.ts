import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, so asset URLs need that
  // prefix. Netlify, Cloudflare Pages, S3 and any root-served host want '/'.
  //   BASE_PATH=/my-repo/ npm run build
  base: process.env.BASE_PATH ?? '/',
  server: { port: 5173 },
  build: { target: 'esnext' },
});
