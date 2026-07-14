import { describe, expect, it, vi } from 'vitest';
import { albumFixture, artistFixture, searchResponseFixture } from '$lib/test/fixtures';
import {
	albumCoverCacheKey,
	catalogLinkHref,
	clearAlbumCoverCache,
	resolveAlbumCoverId,
	resolveAlbumFromSearch,
	resolveAlbumLink,
	resolveArtistFromSearch,
	resolveArtistLink
} from './resolveCatalogLinks';

describe('resolveCatalogLinks', () => {
	it('resolves exact artist name matches', () => {
		const artists = [
			artistFixture({ id: 2, name: 'Other' }),
			artistFixture({ id: 3, name: 'Shelf Artist' })
		];
		expect(resolveArtistLink(artists, 'Shelf Artist')).toEqual({ kind: 'artist', id: 3 });
		expect(resolveArtistLink(artists, 'Missing')).toEqual({ kind: 'search', q: 'Missing' });
	});

	it('resolves albums by name and artist, falling back to name-only', () => {
		const albums = [
			albumFixture({ id: 1, name: 'Shelf Album', artist: 'Wrong' }),
			albumFixture({ id: 7, name: 'Shelf Album', artist: 'Shelf Artist' })
		];
		expect(resolveAlbumLink(albums, 'Shelf Album', 'Shelf Artist')).toEqual({
			kind: 'album',
			id: 7
		});
		expect(resolveAlbumLink(albums, 'Shelf Album', 'Nobody')).toEqual({
			kind: 'album',
			id: 1
		});
		expect(resolveAlbumLink(albums, 'Ghost', 'Shelf Artist')).toEqual({
			kind: 'search',
			q: 'Ghost'
		});
	});

	it('builds hrefs for catalog targets', () => {
		expect(catalogLinkHref({ kind: 'artist', id: 3 })).toBe('/artists/3');
		expect(catalogLinkHref({ kind: 'album', id: 7 })).toBe('/albums/7');
		expect(catalogLinkHref({ kind: 'search', q: 'a b' })).toBe('/search?q=a%20b');
	});

	it('uses search client responses for async resolve helpers', async () => {
		const response = searchResponseFixture({
			artists: {
				items: [artistFixture({ id: 9, name: 'Exact' })],
				total: 1,
				limit: 50,
				offset: 0
			},
			albums: {
				items: [albumFixture({ id: 4, name: 'Exact LP', artist: 'Exact' })],
				total: 1,
				limit: 50,
				offset: 0
			}
		});
		const client = {
			search: async () => response
		};

		await expect(resolveArtistFromSearch(client, 'Exact')).resolves.toEqual({
			kind: 'artist',
			id: 9
		});
		await expect(resolveAlbumFromSearch(client, 'Exact LP', 'Exact')).resolves.toEqual({
			kind: 'album',
			id: 4
		});
	});

	it('resolves and caches album cover ids from search', async () => {
		clearAlbumCoverCache();
		const response = searchResponseFixture({
			albums: {
				items: [
					albumFixture({
						id: 4,
						name: 'Exact LP',
						artist: 'Exact',
						cover_id: 99
					})
				],
				total: 1,
				limit: 50,
				offset: 0
			}
		});
		const search = vi.fn().mockResolvedValue(response);
		const client = { search };

		await expect(resolveAlbumCoverId(client, 'Exact LP', 'Exact')).resolves.toBe(99);
		await expect(resolveAlbumCoverId(client, 'Exact LP', 'Exact')).resolves.toBe(99);
		expect(search).toHaveBeenCalledTimes(1);
		expect(albumCoverCacheKey('Exact LP', 'Exact')).toBe('exact|exact lp');
	});
});
