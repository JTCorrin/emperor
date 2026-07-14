import type { AlbumMetadataForm, TrackMetadataForm } from '$lib/api/schemas';
import type { MusicBrainzClient } from './client';
import {
	buildRecordingQuery,
	buildReleaseQuery,
	mapRecordingToTrackForm,
	mapReleaseToAlbumForm,
	type AlbumLookupResult,
	type TrackLookupResult
} from './mapToForm';

export type TrackLookupOutcome =
	| { kind: 'ok'; result: TrackLookupResult }
	| { kind: 'empty' }
	| { kind: 'error'; message: string };

export type AlbumLookupOutcome =
	| { kind: 'ok'; result: AlbumLookupResult }
	| { kind: 'empty' }
	| { kind: 'error'; message: string };

export async function lookupTrackMetadata(
	mb: Pick<MusicBrainzClient, 'searchRecordings'>,
	form: Pick<TrackMetadataForm, 'title' | 'artist' | 'album'>,
	signal?: AbortSignal
): Promise<TrackLookupOutcome> {
	try {
		const query = buildRecordingQuery(form);
		const recordings = await mb.searchRecordings(query, signal);
		const first = recordings[0];
		if (!first) return { kind: 'empty' };
		return { kind: 'ok', result: mapRecordingToTrackForm(first) };
	} catch (cause) {
		return {
			kind: 'error',
			message: cause instanceof Error ? cause.message : 'MusicBrainz lookup failed'
		};
	}
}

export async function lookupAlbumMetadata(
	mb: Pick<MusicBrainzClient, 'searchReleases'>,
	form: Pick<AlbumMetadataForm, 'name' | 'artist'>,
	signal?: AbortSignal
): Promise<AlbumLookupOutcome> {
	try {
		const query = buildReleaseQuery(form);
		const releases = await mb.searchReleases(query, signal);
		const first = releases[0];
		if (!first) return { kind: 'empty' };
		return { kind: 'ok', result: mapReleaseToAlbumForm(first) };
	} catch (cause) {
		return {
			kind: 'error',
			message: cause instanceof Error ? cause.message : 'MusicBrainz lookup failed'
		};
	}
}
