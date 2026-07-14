import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { contactFromRequest, proxyRecordingSearch } from '$lib/server/musicbrainzProxy';

export const GET: RequestHandler = async ({ request, url }) => {
	const contact = contactFromRequest(request);
	if (!contact) {
		return json({ error: 'contact_required' }, { status: 400 });
	}

	const query = url.searchParams.get('query')?.trim() ?? '';
	if (!query) {
		return json({ recordings: [] });
	}

	const upstream = await proxyRecordingSearch(contact, query, request.signal);
	const body = await upstream.text();
	return new Response(body, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json'
		}
	});
};
