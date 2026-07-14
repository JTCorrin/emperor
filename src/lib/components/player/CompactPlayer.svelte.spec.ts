import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CompactPlayer from './CompactPlayer.svelte';
import { PlayerController } from '$lib/state/player.svelte';
import { trackFixture } from '$lib/test/fixtures';

describe('CompactPlayer', () => {
	it('shows track info and fires player commands', async () => {
		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.playTracks(
			[trackFixture({ id: 1, title: 'Alpha', artist: 'Beta' }), trackFixture({ id: 2 })],
			0
		);
		player.playbackStatus = 'paused';

		const expand = vi.spyOn(player, 'expand');
		const toggle = vi.spyOn(player, 'toggle');
		const next = vi.spyOn(player, 'next').mockImplementation(() => {});

		render(CompactPlayer, { player, baseUrl: 'http://127.0.0.1:8080' });

		await expect.element(page.getByText('Alpha')).toBeVisible();
		await expect.element(page.getByText('Beta')).toBeVisible();

		await page.getByRole('button', { name: 'Play', exact: true }).click();
		expect(toggle).toHaveBeenCalled();

		await page.getByRole('button', { name: 'Next track' }).click();
		expect(next).toHaveBeenCalled();

		await expect.element(page.getByRole('button', { name: 'Shuffle off' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Repeat off' })).toBeVisible();

		const toggleShuffle = vi.spyOn(player, 'toggleShuffle');
		const cycleRepeat = vi.spyOn(player, 'cycleRepeat');
		await page.getByRole('button', { name: 'Shuffle off' }).click();
		expect(toggleShuffle).toHaveBeenCalled();
		await page.getByRole('button', { name: 'Repeat off' }).click();
		expect(cycleRepeat).toHaveBeenCalled();

		await page.getByRole('button', { name: 'Expand player: Alpha' }).click();
		expect(expand).toHaveBeenCalled();
	});
});
