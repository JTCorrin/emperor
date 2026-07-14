import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { contactFromRequest, proxyReleaseLookup } from '$lib/server/musicbrainzProxy';

export const GET: RequestHandler = async ({ params, request }) => {
	const contact = contactFromRequest(request);
	if (!contact) {
		return json({ error: 'contact_required' }, { status: 400 });
	}

	const mbid = params.mbid?.trim() ?? '';
	if (!mbid) {
		return json({ error: 'mbid_required' }, { status: 400 });
	}

	const upstream = await proxyReleaseLookup(contact, mbid, request.signal);
	const body = await upstream.text();
	return new Response(body, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json'
		}
	});
};
