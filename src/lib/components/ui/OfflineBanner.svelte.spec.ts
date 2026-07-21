import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfflineBanner from './OfflineBanner.svelte';
import { ConnectionController } from '$lib/state/connection.svelte';

describe('OfflineBanner', () => {
	it('is hidden while connected', async () => {
		const connection = new ConnectionController();
		connection.status = 'connected';
		connection.baseUrl = 'http://192.168.5.111:8080';

		render(OfflineBanner, { connection });

		await expect.element(page.getByTestId('offline-banner')).not.toBeInTheDocument();
	});

	it('shows offline copy and retries with the configured URL', async () => {
		const connection = new ConnectionController();
		connection.status = 'error';
		connection.error = {
			kind: 'network',
			message: 'Could not reach the media server'
		};
		const connect = vi.spyOn(connection, 'connect').mockResolvedValue(false);

		render(OfflineBanner, { connection });

		await expect.element(page.getByText('Offline', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Retry' }).click();
		expect(connect).toHaveBeenCalled();
	});
});
