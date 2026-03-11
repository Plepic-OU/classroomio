import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],

	server: {
		hmr: {
			host: 'localhost',
			protocol: 'ws'
		},
		watch: {
			usePolling: true,
			interval: 1000
		}
	},

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},

	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	}
});
