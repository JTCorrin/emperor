import { describe, expect, it } from 'vitest';
import { BaseUrlError, coverUrl, normalizeBaseUrl, streamUrl } from '$lib/api/url';

describe('normalizeBaseUrl', () => {
	it('trims whitespace and trailing slashes', () => {
		expect(normalizeBaseUrl('  http://127.0.0.1:8080/  ')).toBe('http://127.0.0.1:8080');
	});

	it('keeps nested path prefixes without a trailing slash', () => {
		expect(normalizeBaseUrl('http://example.com/media/')).toBe('http://example.com/media');
	});

	it('rejects empty values', () => {
		expect(() => normalizeBaseUrl('   ')).toThrow(BaseUrlError);
	});

	it('rejects non-http protocols', () => {
		expect(() => normalizeBaseUrl('ftp://example.com')).toThrow(/http or https/);
	});

	it('rejects relative URLs', () => {
		expect(() => normalizeBaseUrl('/api')).toThrow(/absolute URL/);
	});

	it('rejects credentials in the URL', () => {
		expect(() => normalizeBaseUrl('http://user:pass@example.com')).toThrow(/credentials/);
	});
});

describe('media URL helpers', () => {
	it('builds stream and cover URLs from a normalized base', () => {
		const base = 'http://127.0.0.1:8080/';
		expect(streamUrl(base, 12)).toBe('http://127.0.0.1:8080/stream/12');
		expect(coverUrl(base, 3)).toBe('http://127.0.0.1:8080/cover/3');
	});
});
