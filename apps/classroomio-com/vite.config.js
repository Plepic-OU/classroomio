import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    hmr: true,
    watch: {
      usePolling: true,
      interval: 1000
    }
  },
  build: {
    sourcemap: true
  },
  optimizeDeps: {
    entries: ['src/routes/**/+*.{js,ts,svelte}']
  }
});
