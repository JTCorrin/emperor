import { describe, expect, it } from 'vitest';
import {
	hasMusicBrainzContact,
	loadMusicBrainzSettings,
	MB_APPLY_COVER_STORAGE_KEY,
	MB_CONTACT_STORAGE_KEY,
	saveMusicBrainzSettings
} from './settings';
import { buildMusicBrainzUserAgent, EMPEROR_MB_APP } from './userAgent';
import {
	buildRecordingQuery,
	buildReleaseQuery,
	mapRecordingToTrackForm,
	mapReleaseToAlbumForm,
	normalizeMbDate
} from './mapToForm';
import { createMusicBrainzClient, MusicBrainzError } from './client';
import { COVER_ART_ARCHIVE_BASE, MB_CONTACT_HEADER, MUSICBRAINZ_API_BASE } from './constants';
import { lookupAlbumMetadata, lookupTrackMetadata } from './lookup';
import { applyAlbumCoverFromMusicBrainz } from './applyCover';
import { MediaServerRequestError } from '$lib/api';
import { albumFixture, createFetchStub, jsonResponse } from '$lib/test/fixtures';

function memoryStorage(initial: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		clear() {
			map.clear();
		},
		getItem(key) {
			return map.has(key) ? map.get(key)! : null;
		},
		key(index) {
			return [...map.keys()][index] ?? null;
		},
		removeItem(key) {
			map.delete(key);
		},
		setItem(key, value) {
			map.set(key, value);
		}
	};
}

describe('musicbrainz settings + user agent', () => {
	it('persists contact and apply-cover toggle', () => {
		const storage = memoryStorage();
		expect(hasMusicBrainzContact(storage)).toBe(false);

		saveMusicBrainzSettings({ contact: 'dev@example.com', applyCoverOnLookup: true }, storage);
		expect(storage.getItem(MB_CONTACT_STORAGE_KEY)).toBe('dev@example.com');
		expect(storage.getItem(MB_APPLY_COVER_STORAGE_KEY)).toBe('1');
		expect(loadMusicBrainzSettings(storage)).toEqual({
			contact: 'dev@example.com',
			applyCoverOnLookup: true
		});
		expect(hasMusicBrainzContact(storage)).toBe(true);
	});

	it('builds Emperor User-Agent with contact', () => {
		expect(buildMusicBrainzUserAgent('https://example.com')).toBe(
			`${EMPEROR_MB_APP} (https://example.com)`
		);
		expect(() => buildMusicBrainzUserAgent('  ')).toThrow(/contact/i);
	});
});

describe('musicbrainz mapToForm', () => {
	it('maps recording and release payloads into form fields', () => {
		const track = mapRecordingToTrackForm({
			id: 'rec-1',
			title: 'Jade',
			'artist-credit': [{ name: 'XTC' }],
			releases: [
				{
					id: 'rel-1',
					title: 'English Settlement',
					date: '1982-02-12',
					media: [{ position: 1, track: [{ position: 3, number: '3' }] }]
				}
			],
			tags: [
				{ name: 'new wave', count: 2 },
				{ name: 'rock', count: 5 }
			]
		});
		expect(track).toEqual({
			recordingMbid: 'rec-1',
			releaseMbid: 'rel-1',
			form: {
				title: 'Jade',
				artist: 'XTC',
				album: 'English Settlement',
				release_date: '1982-02-12',
				genre: 'rock',
				track_number: '3',
				disc_number: '1'
			}
		});

		const album = mapReleaseToAlbumForm({
			id: 'rel-2',
			title: 'Skylarking',
			date: '1986',
			'artist-credit': [{ artist: { name: 'XTC' } }],
			tags: [{ name: 'pop', count: 1 }]
		});
		expect(album.form).toMatchObject({
			name: 'Skylarking',
			artist: 'XTC',
			release_date: '1986',
			genre: 'pop'
		});
	});

	it('prefers genres over tags on release and release-group', () => {
		const album = mapReleaseToAlbumForm({
			id: 'rel-3',
			title: 'Drums and Wires',
			'artist-credit': [{ name: 'XTC' }],
			tags: [{ name: 'folksonomy', count: 99 }],
			genres: [{ name: 'new wave', count: 3 }],
			'release-group': {
				tags: [{ name: 'rg-tag', count: 50 }],
				genres: [{ name: 'art rock', count: 10 }]
			}
		});
		expect(album.form.genre).toBe('new wave');

		const fromGroup = mapReleaseToAlbumForm({
			id: 'rel-4',
			title: 'Black Sea',
			tags: [{ name: 'folksonomy', count: 99 }],
			'release-group': {
				genres: [{ name: 'pop rock', count: 2 }],
				tags: [{ name: 'rg-tag', count: 50 }]
			}
		});
		expect(fromGroup.form.genre).toBe('pop rock');
	});

	it('normalizes dates and builds search queries', () => {
		expect(normalizeMbDate('1999-05')).toBe('1999-05');
		expect(normalizeMbDate('1999-05-01T00:00:00Z')).toBe('1999');
		expect(buildRecordingQuery({ title: 'A', artist: 'B', album: 'C' })).toContain('recording:"A"');
		expect(buildReleaseQuery({ name: 'Album', artist: 'Artist' })).toContain('release:"Album"');
	});
});

describe('musicbrainz client (stubbed fetch)', () => {
	const contact = 'ci@example.com';

	it('searches recordings and releases with User-Agent', async () => {
		let seenUa: string | null = null;
		const fetchImpl = createFetchStub([
			{
				url: new RegExp(`^${MUSICBRAINZ_API_BASE}/recording`),
				response: () => {
					return jsonResponse({
						recordings: [{ id: 'r1', title: 'Song', 'artist-credit': [{ name: 'A' }] }]
					});
				}
			},
			{
				url: new RegExp(`^${MUSICBRAINZ_API_BASE}/release`),
				response: () =>
					jsonResponse({
						releases: [{ id: 'rel1', title: 'Album', 'artist-credit': [{ name: 'A' }] }]
					})
			}
		]);

		const wrapped: typeof fetch = async (input, init) => {
			seenUa = new Headers(init?.headers).get('User-Agent');
			return fetchImpl(input, init);
		};

		const mb = createMusicBrainzClient({ contact, fetch: wrapped });
		const recordings = await mb.searchRecordings('recording:"Song"');
		expect(recordings[0]?.id).toBe('r1');
		expect(seenUa).toBe(buildMusicBrainzUserAgent(contact));

		const releases = await mb.searchReleases('release:"Album"');
		expect(releases[0]?.id).toBe('rel1');
	});

	it('fetches CAA front cover bytes', async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const mb = createMusicBrainzClient({
			contact,
			fetch: createFetchStub([
				{
					url: `${COVER_ART_ARCHIVE_BASE}/release/rel-1/front`,
					response: new Response(bytes, {
						status: 200,
						headers: { 'Content-Type': 'image/jpeg' }
					})
				}
			])
		});

		const cover = await mb.fetchFrontCover('rel-1');
		expect(cover.contentType).toBe('image/jpeg');
		expect(await cover.blob.arrayBuffer()).toEqual(bytes.buffer);
	});

	it('looks up a release by MBID with tags and genres', async () => {
		let seenUrl: string | null = null;
		const mb = createMusicBrainzClient({
			contact,
			fetch: async (input) => {
				seenUrl = String(input);
				return jsonResponse({
					id: 'rel-detail',
					title: 'Album',
					genres: [{ name: 'jazz', count: 2 }],
					tags: [{ name: 'cool', count: 1 }]
				});
			}
		});

		const release = await mb.getRelease('rel-detail');
		expect(release.id).toBe('rel-detail');
		expect(release.genres?.[0]?.name).toBe('jazz');
		expect(seenUrl).toContain(`${MUSICBRAINZ_API_BASE}/release/rel-detail?`);
		expect(seenUrl).toContain('inc=tags%2Bgenres%2Brelease-groups');
	});

	it('rejects missing contact', () => {
		expect(() => createMusicBrainzClient({ contact: '' })).toThrow(MusicBrainzError);
	});

	it('uses the Emperor proxy when useProxy is true', async () => {
		let seenUrl: string | null = null;
		let seenContact: string | null = null;
		const fetchImpl: typeof fetch = async (input, init) => {
			seenUrl = String(input);
			seenContact = new Headers(init?.headers).get(MB_CONTACT_HEADER);
			return jsonResponse({
				releases: [{ id: 'rel1', title: 'Album', 'artist-credit': [{ name: 'A' }] }]
			});
		};

		const mb = createMusicBrainzClient({ contact, fetch: fetchImpl, useProxy: true });
		await mb.searchReleases('release:"Album"');
		expect(seenUrl).toContain('/api/musicbrainz/release?');
		expect(seenContact).toBe(contact);
	});
});

describe('musicbrainz lookup helpers', () => {
	it('returns empty when no recordings match', async () => {
		const outcome = await lookupTrackMetadata(
			{ searchRecordings: async () => [] },
			{ title: 'Nope', artist: 'Nobody', album: '' }
		);
		expect(outcome).toEqual({ kind: 'empty' });
	});

	it('maps first album release via detailed lookup', async () => {
		const outcome = await lookupAlbumMetadata(
			{
				searchReleases: async () => [
					{ id: 'rel', title: 'LP', 'artist-credit': [{ name: 'Band' }], date: '2020' }
				],
				getRelease: async (mbid) => ({
					id: mbid,
					title: 'LP',
					'artist-credit': [{ name: 'Band' }],
					date: '2020',
					genres: [{ name: 'indie rock', count: 4 }],
					tags: [{ name: 'ignored', count: 99 }]
				})
			},
			{ name: 'LP', artist: 'Band' }
		);
		expect(outcome.kind).toBe('ok');
		if (outcome.kind === 'ok') {
			expect(outcome.result.releaseMbid).toBe('rel');
			expect(outcome.result.form.name).toBe('LP');
			expect(outcome.result.form.genre).toBe('indie rock');
		}
	});

	it('looks up the searched release by MBID', async () => {
		const seenIds: string[] = [];
		const outcome = await lookupAlbumMetadata(
			{
				searchReleases: async () => [{ id: 'rel-from-search', title: 'Search Hit' }],
				getRelease: async (mbid) => {
					seenIds.push(mbid);
					return {
						id: mbid,
						title: 'Detailed',
						genres: [{ name: 'electronic', count: 1 }]
					};
				}
			},
			{ name: 'Search Hit', artist: 'Artist' }
		);
		expect(seenIds).toEqual(['rel-from-search']);
		expect(outcome.kind).toBe('ok');
		if (outcome.kind === 'ok') {
			expect(outcome.result.form.genre).toBe('electronic');
			expect(outcome.result.form.name).toBe('Detailed');
		}
	});
});

describe('applyAlbumCoverFromMusicBrainz', () => {
	it('uses the upload cover id without polling or refetching', async () => {
		const album = albumFixture({ id: 7, cover_id: null });
		let uploads = 0;
		const result = await applyAlbumCoverFromMusicBrainz({
			mb: {
				fetchFrontCover: async () => ({
					blob: new Blob([new Uint8Array([9])], { type: 'image/png' }),
					contentType: 'image/png'
				})
			},
			media: {
				uploadAlbumCover: async () => {
					uploads += 1;
					return { ok: true as const, path: 'cover.png', cover_id: 99 };
				}
			},
			album,
			releaseMbid: 'rel-1'
		});

		expect(result).toEqual({ kind: 'ok', album: { ...album, cover_id: 99 } });
		expect(uploads).toBe(1);
	});

	it('explains an ambiguous album directory', async () => {
		const result = await applyAlbumCoverFromMusicBrainz({
			mb: {
				fetchFrontCover: async () => ({
					blob: new Blob(),
					contentType: 'image/jpeg'
				})
			},
			media: {
				uploadAlbumCover: async () => {
					throw new MediaServerRequestError({
						kind: 'http',
						message: 'Request failed: ambiguous_album_dir',
						status: 400,
						code: 'ambiguous_album_dir'
					});
				}
			},
			album: albumFixture({ id: 7 }),
			releaseMbid: 'rel-1'
		});

		expect(result).toMatchObject({
			kind: 'error',
			message: expect.stringMatching(/multiple folders/i)
		});
	});
});
