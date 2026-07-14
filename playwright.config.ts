import { defineConfig } from '@playwright/test';

const mediaServerUrl = 'http://192.168.5.111:8080';

export default defineConfig({
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173,
		env: {
			...process.env,
			PUBLIC_MEDIA_SERVER_URL: mediaServerUrl
		}
	},
	testMatch: '**/*.e2e.{ts,js}',
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	}
});
