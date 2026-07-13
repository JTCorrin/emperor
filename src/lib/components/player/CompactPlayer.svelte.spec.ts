import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CompactPlayer from './CompactPlayer.svelte';
import { PlayerController } from '$lib/state/player.svelte';
import { trackFixture } from '$lib/test/fixtures';

describe('CompactPlayer', () => {
	it('shows track info and fires player commands', async () => {
		const player = new PlayerController({
			getBaseUrl: () => 'http://192.168.5.111:8080'
		});
		player.playTracks(
			[trackFixture({ id: 1, title: 'Alpha', artist: 'Beta' }), trackFixture({ id: 2 })],
			0
		);
		player.playbackStatus = 'paused';

		const expand = vi.spyOn(player, 'expand');
		const toggle = vi.spyOn(player, 'toggle');
		const next = vi.spyOn(player, 'next').mockImplementation(() => {});

		render(CompactPlayer, { player, baseUrl: 'http://192.168.5.111:8080' });

		await expect.element(page.getByText('Alpha')).toBeVisible();
		await expect.element(page.getByText('Beta')).toBeVisible();

		await page.getByRole('button', { name: 'Play' }).click();
		expect(toggle).toHaveBeenCalled();

		await page.getByRole('button', { name: 'Next track' }).click();
		expect(next).toHaveBeenCalled();

		await page.getByRole('button', { name: /Alpha/ }).click();
		expect(expand).toHaveBeenCalled();
	});
});
