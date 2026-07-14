import {
	COVER_ART_ARCHIVE_BASE,
	MB_CONTACT_HEADER,
	MUSICBRAINZ_API_BASE
} from '$lib/features/musicbrainz/constants';
import { buildMusicBrainzUserAgent } from '$lib/features/musicbrainz/userAgent';

export { MB_CONTACT_HEADER };

export function contactFromRequest(request: Request): string | null {
	const contact = request.headers.get(MB_CONTACT_HEADER)?.trim();
	return contact || null;
}

function mbHeaders(contact: string): HeadersInit {
	return {
		Accept: 'application/json',
		'User-Agent': buildMusicBrainzUserAgent(contact)
	};
}

export async function proxyRecordingSearch(
	contact: string,
	query: string,
	signal?: AbortSignal
): Promise<Response> {
	const params = new URLSearchParams({
		query,
		fmt: 'json',
		limit: '5'
	});
	return fetch(`${MUSICBRAINZ_API_BASE}/recording?${params}`, {
		headers: mbHeaders(contact),
		signal
	});
}

export async function proxyReleaseSearch(
	contact: string,
	query: string,
	signal?: AbortSignal
): Promise<Response> {
	const params = new URLSearchParams({
		query,
		fmt: 'json',
		limit: '5'
	});
	return fetch(`${MUSICBRAINZ_API_BASE}/release?${params}`, {
		headers: mbHeaders(contact),
		signal
	});
}

export async function proxyFrontCover(
	contact: string,
	releaseMbid: string,
	signal?: AbortSignal
): Promise<Response> {
	return fetch(`${COVER_ART_ARCHIVE_BASE}/release/${releaseMbid}/front`, {
		headers: mbHeaders(contact),
		signal,
		redirect: 'follow'
	});
}
