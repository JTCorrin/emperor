import { describe, expect, it } from 'vitest';
import { sortAlbumTracks } from './albumTracks';
import { trackFixture } from '$lib/test/fixtures';

describe('sortAlbumTracks', () => {
	it('sorts by disc, track number, title, and leaves the input unchanged', () => {
		const tracks = [
			trackFixture({ id: 4, disc_number: null, track_number: null, title: 'Bonus' }),
			trackFixture({ id: 3, disc_number: 2, track_number: 1, title: 'Disc two' }),
			trackFixture({ id: 2, disc_number: 1, track_number: 2, title: 'Second' }),
			trackFixture({ id: 1, disc_number: 1, track_number: 1, title: 'First' })
		];

		expect(sortAlbumTracks(tracks).map((track) => track.id)).toEqual([1, 2, 3, 4]);
		expect(tracks.map((track) => track.id)).toEqual([4, 3, 2, 1]);
	});
});
