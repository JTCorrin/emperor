import { describe, expect, it } from 'vitest';
import { MB_CONTACT_HEADER } from '$lib/features/musicbrainz/constants';
import { contactFromRequest } from './musicbrainzProxy';

describe('musicbrainzProxy', () => {
	it('reads contact from the proxy header', () => {
		const request = new Request('http://localhost/api/musicbrainz/recording', {
			headers: { [MB_CONTACT_HEADER]: ' dev@example.com ' }
		});
		expect(contactFromRequest(request)).toBe('dev@example.com');
		expect(contactFromRequest(new Request('http://localhost'))).toBeNull();
	});
});
