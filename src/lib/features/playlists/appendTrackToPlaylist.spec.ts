import { describe, expect, it, vi } from 'vitest';
import { trackFixture, trackPageFixture } from '$lib/test/fixtures';
import { appendTrackToPlaylist } from './appendTrackToPlaylist';

describe('appendTrackToPlaylist', () => {
	it('appends a new track id via setPlaylistTracks', async () => {
		const setPlaylistTracks = vi.fn().mockResolvedValue(undefined);
		const client = {
			getPlaylistTracks: vi.fn().mockResolvedValue(trackPageFixture([trackFixture({ id: 1 })])),
			setPlaylistTracks
		};

		await expect(appendTrackToPlaylist(client, 9, 42)).resolves.toEqual({
			kind: 'added',
			trackCount: 2
		});
		expect(setPlaylistTracks).toHaveBeenCalledWith(9, [1, 42], undefined);
	});

	it('skips PUT when the track is already present', async () => {
		const setPlaylistTracks = vi.fn();
		const client = {
			getPlaylistTracks: vi
				.fn()
				.mockResolvedValue(trackPageFixture([trackFixture({ id: 42 }), trackFixture({ id: 7 })])),
			setPlaylistTracks
		};

		await expect(appendTrackToPlaylist(client, 9, 42)).resolves.toEqual({
			kind: 'already_present',
			trackCount: 2
		});
		expect(setPlaylistTracks).not.toHaveBeenCalled();
	});

	it('adds the first track to an empty playlist', async () => {
		const setPlaylistTracks = vi.fn().mockResolvedValue(undefined);
		const client = {
			getPlaylistTracks: vi.fn().mockResolvedValue(trackPageFixture([])),
			setPlaylistTracks
		};

		await expect(appendTrackToPlaylist(client, 3, 11)).resolves.toEqual({
			kind: 'added',
			trackCount: 1
		});
		expect(setPlaylistTracks).toHaveBeenCalledWith(3, [11], undefined);
	});
});
