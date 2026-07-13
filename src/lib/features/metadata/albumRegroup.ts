import type { Album } from '$lib/api/schemas';
import { MediaServerRequestError } from '$lib/api/client';

export type AlbumRefetchResult =
	{ kind: 'ok'; album: Album } | { kind: 'regrouped' } | { kind: 'error'; message: string };

export async function refetchAlbumAfterPatch(
	getAlbum: (id: number) => Promise<Album>,
	albumId: number
): Promise<AlbumRefetchResult> {
	try {
		const album = await getAlbum(albumId);
		return { kind: 'ok', album };
	} catch (cause) {
		if (cause instanceof MediaServerRequestError && cause.error.status === 404) {
			return { kind: 'regrouped' };
		}
		return {
			kind: 'error',
			message: cause instanceof Error ? cause.message : 'Could not reload album.'
		};
	}
}
