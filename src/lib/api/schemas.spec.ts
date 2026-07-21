import { describe, expect, it } from 'vitest';
import {
	albumMetadataFormSchema,
	albumMetadataPatchSchema,
	albumCoverUploadResponseSchema,
	albumPatchResponseSchema,
	albumPageSchema,
	albumSchema,
	artistPageSchema,
	artistSchema,
	historyItemSchema,
	libraryStatusSchema,
	pingResponseSchema,
	playlistSchema,
	searchResponseSchema,
	trackMetadataFormSchema,
	trackMetadataPatchSchema,
	trackPageSchema,
	trackSchema
} from '$lib/api/schemas';
import {
	albumFixture,
	albumPageFixture,
	artistFixture,
	artistPageFixture,
	historyItemFixture,
	libraryStatusFixture,
	pingFixture,
	playlistFixture,
	searchResponseFixture,
	trackFixture,
	trackPageFixture
} from '$lib/test/fixtures';

describe('API schemas', () => {
	it('accepts a ping response', () => {
		expect(pingResponseSchema.parse(pingFixture())).toEqual({ ok: true });
	});

	it('accepts library status', () => {
		expect(libraryStatusSchema.parse(libraryStatusFixture())).toMatchObject({
			has_library: true,
			track_count: 10
		});
	});

	it('accepts track and track page envelopes', () => {
		const track = trackFixture({ id: 7, title: 'Hello', album_id: 4, cover_id: 9 });
		expect(trackSchema.parse(track)).toEqual(track);
		expect(trackPageSchema.parse(trackPageFixture([track]))).toMatchObject({
			total: 1,
			items: [track]
		});
		expect(trackSchema.safeParse({ ...track, album_id: undefined }).success).toBe(false);
		expect(trackSchema.safeParse({ ...track, cover_id: undefined }).success).toBe(false);
	});

	it('accepts playlist and history items', () => {
		expect(playlistSchema.parse(playlistFixture())).toMatchObject({ name: 'Mix' });
		expect(historyItemSchema.parse(historyItemFixture())).toMatchObject({
			played_unix: 1_710_000_000,
			track: { id: 1 }
		});
	});

	it('accepts artist, album, and search envelopes', () => {
		const artist = artistFixture({ id: 3, name: 'ASM' });
		const album = albumFixture({ id: 5, name: 'Jade', cover_id: null });
		expect(artistSchema.parse(artist)).toEqual(artist);
		expect(albumSchema.parse(album)).toEqual(album);
		expect(artistPageSchema.parse(artistPageFixture([artist]))).toMatchObject({ total: 1 });
		expect(albumPageSchema.parse(albumPageFixture([album]))).toMatchObject({ total: 1 });
		expect(
			searchResponseSchema.parse(
				searchResponseFixture({
					q: 'a',
					tracks: trackPageFixture([trackFixture({ id: 9 })]),
					artists: artistPageFixture([artist]),
					albums: albumPageFixture([album])
				})
			)
		).toMatchObject({ q: 'a', fuzzy: false });
	});

	it('rejects malformed artist and album payloads', () => {
		expect(artistSchema.safeParse({ id: 1, name: 'X' }).success).toBe(false);
		expect(albumSchema.safeParse({ id: 1, name: 'X', artist: 'Y' }).success).toBe(false);
	});

	it('accepts partial track and album metadata patches including null clears', () => {
		expect(trackMetadataPatchSchema.parse({ title: 'Fixed', genre: null })).toEqual({
			title: 'Fixed',
			genre: null
		});
		expect(trackMetadataPatchSchema.parse({ track_number: 0, disc_number: null })).toEqual({
			track_number: 0,
			disc_number: null
		});
		expect(albumMetadataPatchSchema.parse({ name: 'New', release_date: null })).toEqual({
			name: 'New',
			release_date: null
		});
		expect(albumPatchResponseSchema.parse({ updated_track_count: 4 })).toEqual({
			updated_track_count: 4
		});
		expect(
			albumCoverUploadResponseSchema.parse({
				ok: true,
				path: 'Artist/Album/cover.jpg',
				cover_id: 12
			})
		).toEqual({ ok: true, path: 'Artist/Album/cover.jpg', cover_id: 12 });
		expect(trackMetadataPatchSchema.safeParse({ release_date: '13-2024' }).success).toBe(false);
		for (const release_date of ['2024', '2024-03', '2024-03-02']) {
			expect(trackMetadataPatchSchema.safeParse({ release_date }).success).toBe(true);
		}
		expect(
			trackMetadataFormSchema.safeParse({
				title: 't',
				artist: 'a',
				album: 'b',
				release_date: 'bad',
				genre: '',
				track_number: '',
				disc_number: ''
			}).success
		).toBe(false);
		expect(
			albumMetadataFormSchema.safeParse({
				name: '',
				artist: 'a',
				release_date: '',
				genre: ''
			}).success
		).toBe(false);
	});

	it('rejects oversized server strings and page arrays', () => {
		expect(trackSchema.safeParse(trackFixture({ title: 'x'.repeat(2049) })).success).toBe(false);
		expect(
			trackPageSchema.safeParse(
				trackPageFixture(
					Array.from({ length: 201 }, (_, index) => trackFixture({ id: index + 1 })),
					{ total: 201, limit: 200 }
				)
			).success
		).toBe(false);
	});
});
