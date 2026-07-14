import type { FetchLike } from '$lib/api/client';
import {
	mbRecordingSearchSchema,
	mbReleaseSearchSchema,
	type MbRecording,
	type MbRelease
} from './schemas';
import { buildMusicBrainzUserAgent } from './userAgent';

export const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';
export const COVER_ART_ARCHIVE_BASE = 'https://coverartarchive.org';

export type MusicBrainzClientOptions = {
	contact: string;
	fetch?: FetchLike;
};

export type CoverArtResult = {
	blob: Blob;
	contentType: string;
};

export class MusicBrainzError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MusicBrainzError';
	}
}

function mbHeaders(contact: string): HeadersInit {
	return {
		Accept: 'application/json',
		// Forbidden in browsers; honored in Node / test stubs.
		'User-Agent': buildMusicBrainzUserAgent(contact)
	};
}

async function mbGetJson(
	path: string,
	contact: string,
	fetchImpl: FetchLike,
	signal?: AbortSignal
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchImpl(`${MUSICBRAINZ_API_BASE}${path}`, {
			headers: mbHeaders(contact),
			signal
		});
	} catch (cause) {
		if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
			throw new MusicBrainzError('MusicBrainz request aborted');
		}
		throw new MusicBrainzError(
			cause instanceof Error ? cause.message : 'Could not reach MusicBrainz'
		);
	}

	if (!response.ok) {
		throw new MusicBrainzError(`MusicBrainz HTTP ${response.status}`);
	}

	try {
		return (await response.json()) as unknown;
	} catch (cause) {
		throw new MusicBrainzError(cause instanceof Error ? cause.message : 'Invalid MusicBrainz JSON');
	}
}

export function createMusicBrainzClient(options: MusicBrainzClientOptions) {
	const contact = options.contact.trim();
	if (!contact) {
		throw new MusicBrainzError('MusicBrainz contact is required');
	}
	const fetchImpl = options.fetch ?? fetch;

	return {
		async searchRecordings(query: string, signal?: AbortSignal): Promise<MbRecording[]> {
			const q = query.trim();
			if (!q) return [];
			const params = new URLSearchParams({
				query: q,
				fmt: 'json',
				limit: '5'
			});
			const body = await mbGetJson(`/recording?${params}`, contact, fetchImpl, signal);
			return mbRecordingSearchSchema.parse(body).recordings;
		},

		async searchReleases(query: string, signal?: AbortSignal): Promise<MbRelease[]> {
			const q = query.trim();
			if (!q) return [];
			const params = new URLSearchParams({
				query: q,
				fmt: 'json',
				limit: '5'
			});
			const body = await mbGetJson(`/release?${params}`, contact, fetchImpl, signal);
			return mbReleaseSearchSchema.parse(body).releases;
		},

		async fetchFrontCover(releaseMbid: string, signal?: AbortSignal): Promise<CoverArtResult> {
			const mbid = releaseMbid.trim();
			if (!mbid) {
				throw new MusicBrainzError('Release MBID is required');
			}

			let response: Response;
			try {
				response = await fetchImpl(`${COVER_ART_ARCHIVE_BASE}/release/${mbid}/front`, {
					headers: mbHeaders(contact),
					signal,
					redirect: 'follow'
				});
			} catch (cause) {
				if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
					throw new MusicBrainzError('Cover Art Archive request aborted');
				}
				throw new MusicBrainzError(
					cause instanceof Error ? cause.message : 'Could not reach Cover Art Archive'
				);
			}

			if (!response.ok) {
				throw new MusicBrainzError(
					response.status === 404
						? 'No front cover found on Cover Art Archive'
						: `Cover Art Archive HTTP ${response.status}`
				);
			}

			const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim() ?? '';
			if (
				contentType !== 'image/jpeg' &&
				contentType !== 'image/png' &&
				contentType !== 'image/webp'
			) {
				throw new MusicBrainzError(`Unsupported cover Content-Type: ${contentType || 'unknown'}`);
			}

			const blob = await response.blob();
			return { blob, contentType };
		}
	};
}

export type MusicBrainzClient = ReturnType<typeof createMusicBrainzClient>;
