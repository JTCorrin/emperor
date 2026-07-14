import type { Album, LibraryStatus, MediaServerClient } from '$lib/api';
import type { CoverArtResult, MusicBrainzClient } from './client';

export type ApplyCoverResult = { kind: 'ok'; album: Album } | { kind: 'error'; message: string };

export type ApplyCoverOptions = {
	mb: Pick<MusicBrainzClient, 'fetchFrontCover'>;
	media: Pick<MediaServerClient, 'uploadAlbumCover' | 'getLibraryStatus' | 'getAlbum'>;
	albumId: number;
	releaseMbid: string;
	/** Max wait for scan to finish after upload. Default 30s. */
	timeoutMs?: number;
	/** Poll interval. Default 500ms. */
	pollIntervalMs?: number;
	signal?: AbortSignal;
	/** Injected sleep for tests. */
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(new DOMException('Aborted', 'AbortError'));
			},
			{ once: true }
		);
	});
}

async function waitForScanIdle(
	getStatus: (signal?: AbortSignal) => Promise<LibraryStatus>,
	options: {
		timeoutMs: number;
		pollIntervalMs: number;
		signal?: AbortSignal;
		sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
	}
): Promise<void> {
	const deadline = Date.now() + options.timeoutMs;
	while (Date.now() < deadline) {
		if (options.signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}
		const status = await getStatus(options.signal);
		if (!status.scanning) return;
		await options.sleep(options.pollIntervalMs, options.signal);
	}
	throw new Error('Timed out waiting for library scan after cover upload');
}

/**
 * Fetch CAA front cover for a release, PUT to media-server, poll until scan idle, refetch album.
 */
export async function applyAlbumCoverFromMusicBrainz(
	options: ApplyCoverOptions
): Promise<ApplyCoverResult> {
	const timeoutMs = options.timeoutMs ?? 30_000;
	const pollIntervalMs = options.pollIntervalMs ?? 500;
	const sleep = options.sleep ?? defaultSleep;

	try {
		const cover: CoverArtResult = await options.mb.fetchFrontCover(
			options.releaseMbid,
			options.signal
		);
		await options.media.uploadAlbumCover(
			options.albumId,
			cover.blob,
			cover.contentType,
			options.signal
		);
		await waitForScanIdle((signal) => options.media.getLibraryStatus(signal), {
			timeoutMs,
			pollIntervalMs,
			signal: options.signal,
			sleep
		});
		const album = await options.media.getAlbum(options.albumId, options.signal);
		return { kind: 'ok', album };
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			return { kind: 'error', message: 'Cover apply aborted' };
		}
		return {
			kind: 'error',
			message: cause instanceof Error ? cause.message : 'Could not apply album cover'
		};
	}
}
