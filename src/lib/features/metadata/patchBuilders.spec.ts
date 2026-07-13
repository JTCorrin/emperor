import { describe, expect, it } from 'vitest';
import { albumFixture, trackFixture } from '$lib/test/fixtures';
import {
	albumToFormValues,
	buildAlbumPatch,
	buildTrackPatch,
	trackToFormValues
} from './patchBuilders';

describe('metadata patch builders', () => {
	it('omits unchanged track fields and sends null for cleared overrides', () => {
		const track = trackFixture({
			title: 'Original',
			genre: 'Rock',
			release_date: '2024',
			track_number: 3
		});
		const form = {
			...trackToFormValues(track),
			title: 'Corrected',
			genre: '',
			track_number: '3'
		};

		expect(buildTrackPatch(track, form)).toEqual({
			title: 'Corrected',
			genre: null
		});
		expect(buildTrackPatch(track, form, { release_date: true })).toEqual({
			title: 'Corrected',
			genre: null,
			release_date: null
		});
	});

	it('does not send empty required string fields as null for tracks', () => {
		const track = trackFixture({ title: 'Keep' });
		const form = { ...trackToFormValues(track), title: '' };
		expect(buildTrackPatch(track, form)).toEqual({});
	});

	it('builds album patches with omit vs null semantics', () => {
		const album = albumFixture({
			name: 'Album',
			artist: 'Artist',
			release_date: '2020',
			genre: 'Jazz'
		});
		const form = {
			...albumToFormValues(album),
			name: 'Renamed',
			genre: ''
		};
		expect(buildAlbumPatch(album, form)).toEqual({
			name: 'Renamed',
			genre: null
		});
		expect(buildAlbumPatch(album, form, { release_date: true })).toEqual({
			name: 'Renamed',
			genre: null,
			release_date: null
		});
	});
});
