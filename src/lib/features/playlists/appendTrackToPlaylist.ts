import type { MediaServerClient, Track } from '$lib/api';
import { loadAllPages } from '$lib/features/browse/loadAllPages';

export type AppendTrackResult =
	{ kind: 'added'; trackCount: number } | { kind: 'already_present'; trackCount: number };

/**
 * Append a track to a playlist via full-list PUT replace.
 * Loads existing tracks, skips PUT when the id is already present.
 */
export async function appendTrackToPlaylist(
	client: Pick<MediaServerClient, 'getPlaylistTracks' | 'setPlaylistTracks'>,
	playlistId: number,
	trackId: number,
	signal?: AbortSignal
): Promise<AppendTrackResult> {
	const existing = await loadAllPages((offset) =>
		client.getPlaylistTracks(playlistId, { limit: 200, offset, signal })
	);
	const ids = existing.map((track: Track) => track.id);

	if (ids.includes(trackId)) {
		return { kind: 'already_present', trackCount: ids.length };
	}

	const nextIds = [...ids, trackId];
	await client.setPlaylistTracks(playlistId, nextIds, signal);
	return { kind: 'added', trackCount: nextIds.length };
}
