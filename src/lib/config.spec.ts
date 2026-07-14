import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_BASE_URL, getMediaServerBaseUrl } from '$lib/config';

describe('getMediaServerBaseUrl', () => {
	it('returns a normalized absolute URL', () => {
		const url = getMediaServerBaseUrl();
		expect(url).toMatch(/^https?:\/\//);
		expect(url.endsWith('/')).toBe(false);
	});

	it('falls back to the documented LAN default when env is unset', () => {
		// Vitest/Vite may inject PUBLIC_MEDIA_SERVER_URL in some environments;
		// the fallback constant must remain a valid absolute LAN URL.
		expect(DEFAULT_DEV_BASE_URL).toBe('http://192.168.5.111:8080');
	});
});
