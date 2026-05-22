import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
    port: 5174
  },
  build: {
    sourcemap: true
  },
  optimizeDeps: {
    entries: ['src/routes/**/+*.{js,ts,svelte}']
  }
});
