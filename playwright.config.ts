import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm run build && pnpm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	}
});
