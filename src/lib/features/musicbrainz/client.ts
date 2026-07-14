import { browser } from '$app/environment';
import type { FetchLike } from '$lib/api/client';
import {
	COVER_ART_ARCHIVE_BASE,
	MB_CONTACT_HEADER,
	MUSICBRAINZ_API_BASE,
	MUSICBRAINZ_PROXY_BASE
} from './constants';
import {
	mbRecordingSearchSchema,
	mbReleaseSearchSchema,
	type MbRecording,
	type MbRelease
} from './schemas';
import { buildMusicBrainzUserAgent } from './userAgent';

export { COVER_ART_ARCHIVE_BASE, MUSICBRAINZ_API_BASE } from './constants';

export type MusicBrainzClientOptions = {
	contact: string;
	fetch?: FetchLike;
	/** Route MusicBrainz / CAA via Emperor's server proxy. Defaults to true in the browser. */
	useProxy?: boolean;
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

function proxyHeaders(contact: string): HeadersInit {
	return {
		[MB_CONTACT_HEADER]: contact
	};
}

async function readJsonResponse(
	response: Response,
	service: 'MusicBrainz' | 'Cover Art Archive'
): Promise<unknown> {
	if (!response.ok) {
		throw new MusicBrainzError(`${service} HTTP ${response.status}`);
	}

	try {
		return (await response.json()) as unknown;
	} catch (cause) {
		throw new MusicBrainzError(cause instanceof Error ? cause.message : `Invalid ${service} JSON`);
	}
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

	return readJsonResponse(response, 'MusicBrainz');
}

async function proxyGetJson(
	path: string,
	contact: string,
	fetchImpl: FetchLike,
	signal?: AbortSignal
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchImpl(`${MUSICBRAINZ_PROXY_BASE}${path}`, {
			headers: proxyHeaders(contact),
			signal
		});
	} catch (cause) {
		if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
			throw new MusicBrainzError('MusicBrainz request aborted');
		}
		throw new MusicBrainzError(
			cause instanceof Error ? cause.message : 'Could not reach MusicBrainz proxy'
		);
	}

	return readJsonResponse(response, 'MusicBrainz');
}

async function fetchFrontCoverBytes(
	releaseMbid: string,
	contact: string,
	fetchImpl: FetchLike,
	useProxy: boolean,
	signal?: AbortSignal
): Promise<CoverArtResult> {
	const mbid = releaseMbid.trim();
	if (!mbid) {
		throw new MusicBrainzError('Release MBID is required');
	}

	let response: Response;
	try {
		response = useProxy
			? await fetchImpl(`${MUSICBRAINZ_PROXY_BASE}/release/${mbid}/front`, {
					headers: proxyHeaders(contact),
					signal
				})
			: await fetchImpl(`${COVER_ART_ARCHIVE_BASE}/release/${mbid}/front`, {
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
	if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
		throw new MusicBrainzError(`Unsupported cover Content-Type: ${contentType || 'unknown'}`);
	}

	const blob = await response.blob();
	return { blob, contentType };
}

export function createMusicBrainzClient(options: MusicBrainzClientOptions) {
	const contact = options.contact.trim();
	if (!contact) {
		throw new MusicBrainzError('MusicBrainz contact is required');
	}
	const fetchImpl = options.fetch ?? fetch;
	const useProxy = options.useProxy ?? browser;

	const getJson = useProxy ? proxyGetJson : mbGetJson;

	return {
		async searchRecordings(query: string, signal?: AbortSignal): Promise<MbRecording[]> {
			const q = query.trim();
			if (!q) return [];
			const params = new URLSearchParams({
				query: q,
				fmt: 'json',
				limit: '5'
			});
			const body = await getJson(`/recording?${params}`, contact, fetchImpl, signal);
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
			const body = await getJson(`/release?${params}`, contact, fetchImpl, signal);
			return mbReleaseSearchSchema.parse(body).releases;
		},

		async fetchFrontCover(releaseMbid: string, signal?: AbortSignal): Promise<CoverArtResult> {
			return fetchFrontCoverBytes(releaseMbid, contact, fetchImpl, useProxy, signal);
		}
	};
}

export type MusicBrainzClient = ReturnType<typeof createMusicBrainzClient>;
