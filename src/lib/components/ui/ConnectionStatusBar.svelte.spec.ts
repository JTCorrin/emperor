import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConnectionStatusBar from './ConnectionStatusBar.svelte';
import { ConnectionController } from '$lib/state/connection.svelte';
import { libraryStatusFixture } from '$lib/test/fixtures';

describe('ConnectionStatusBar', () => {
	it('shows connected library summary and actions', async () => {
		const connection = new ConnectionController({ storage: null });
		connection.baseUrl = 'http://192.168.5.111:8080';
		connection.status = 'connected';
		connection.libraryStatus = libraryStatusFixture({ track_count: 12 });

		render(ConnectionStatusBar, { connection });

		await expect.element(page.getByText('Connected', { exact: true })).toBeVisible();
		await expect.element(page.getByText(/12 tracks/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Recheck' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
	});
});
