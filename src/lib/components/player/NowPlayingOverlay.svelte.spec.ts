import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowPlayingOverlay from './NowPlayingOverlay.svelte';
import { PlayerController } from '$lib/state/player.svelte';
import { trackFixture } from '$lib/test/fixtures';

describe('NowPlayingOverlay', () => {
	let priorFocus: HTMLButtonElement | null = null;

	afterEach(() => {
		priorFocus?.remove();
		priorFocus = null;
	});

	it('focuses close, closes on Escape, and restores focus', async () => {
		priorFocus = document.createElement('button');
		priorFocus.textContent = 'Open player';
		document.body.append(priorFocus);
		priorFocus.focus();

		const player = new PlayerController({
			getBaseUrl: () => 'http://127.0.0.1:8080'
		});
		player.playTracks([trackFixture({ title: 'Alpha' })]);
		player.playbackStatus = 'paused';
		player.expand();

		render(NowPlayingOverlay, { player, baseUrl: 'http://127.0.0.1:8080' });

		const close = page.getByRole('button', { name: 'Close' });
		await expect.element(close).toHaveFocus();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(document.activeElement).toBe(priorFocus);
	});
});
