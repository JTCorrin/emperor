import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { contactFromRequest, proxyFrontCover } from '$lib/server/musicbrainzProxy';

export const GET: RequestHandler = async ({ params, request }) => {
	const contact = contactFromRequest(request);
	if (!contact) {
		return json({ error: 'contact_required' }, { status: 400 });
	}

	const mbid = params.mbid?.trim() ?? '';
	if (!mbid) {
		return json({ error: 'mbid_required' }, { status: 400 });
	}

	const upstream = await proxyFrontCover(contact, mbid, request.signal);
	if (!upstream.ok) {
		return new Response(null, { status: upstream.status });
	}

	const contentType = upstream.headers.get('Content-Type')?.split(';')[0]?.trim() ?? '';
	if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
		return json({ error: 'unsupported_content_type' }, { status: 502 });
	}

	const body = await upstream.arrayBuffer();
	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
