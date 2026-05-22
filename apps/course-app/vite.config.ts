import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],

	server: {
		host: true,
		port: 5176
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
