import { MediaServerRequestError, type Album, type MediaServerClient } from '$lib/api';
import type { CoverArtResult, MusicBrainzClient } from './client';

export type ApplyCoverResult = { kind: 'ok'; album: Album } | { kind: 'error'; message: string };

export type ApplyCoverOptions = {
	mb: Pick<MusicBrainzClient, 'fetchFrontCover'>;
	media: Pick<MediaServerClient, 'uploadAlbumCover'>;
	album: Album;
	releaseMbid: string;
	signal?: AbortSignal;
};

function coverApplyError(cause: unknown): string {
	if (cause instanceof MediaServerRequestError) {
		switch (cause.error.code) {
			case 'ambiguous_album_dir':
				return 'This album spans multiple folders, so the server cannot choose where to save its cover.';
			case 'invalid_content_type':
			case 'unsupported_image_type':
				return 'The downloaded cover is not a supported JPEG, PNG, or WebP image.';
			case 'body_too_large':
			case 'image_too_large':
				return 'The downloaded cover is larger than the server’s 10 MiB limit.';
		}
		return cause.error.message;
	}
	return cause instanceof Error ? cause.message : 'Could not apply album cover';
}

/**
 * Fetch a CAA front cover and use the upload response to update the album immediately.
 */
export async function applyAlbumCoverFromMusicBrainz(
	options: ApplyCoverOptions
): Promise<ApplyCoverResult> {
	try {
		const cover: CoverArtResult = await options.mb.fetchFrontCover(
			options.releaseMbid,
			options.signal
		);
		const upload = await options.media.uploadAlbumCover(
			options.album.id,
			cover.blob,
			cover.contentType,
			options.signal
		);
		return { kind: 'ok', album: { ...options.album, cover_id: upload.cover_id } };
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			return { kind: 'error', message: 'Cover apply aborted' };
		}
		return { kind: 'error', message: coverApplyError(cause) };
	}
}
