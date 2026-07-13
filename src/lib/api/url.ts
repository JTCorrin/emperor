export class BaseUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BaseUrlError';
	}
}

export function normalizeBaseUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new BaseUrlError('Base URL is required');
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new BaseUrlError('Base URL must be a valid absolute URL');
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new BaseUrlError('Base URL must use http or https');
	}

	if (parsed.username || parsed.password) {
		throw new BaseUrlError('Base URL must not include credentials');
	}

	parsed.hash = '';
	parsed.search = '';

	let pathname = parsed.pathname;
	if (pathname.endsWith('/') && pathname !== '/') {
		pathname = pathname.slice(0, -1);
	}
	if (pathname === '/') {
		pathname = '';
	}

	return `${parsed.protocol}//${parsed.host}${pathname}`;
}

export function streamUrl(baseUrl: string, trackId: number): string {
	return `${normalizeBaseUrl(baseUrl)}/stream/${trackId}`;
}

export function coverUrl(baseUrl: string, coverId: number): string {
	return `${normalizeBaseUrl(baseUrl)}/cover/${coverId}`;
}

export function apiUrl(baseUrl: string, path: string): string {
	const normalized = normalizeBaseUrl(baseUrl);
	const suffix = path.startsWith('/') ? path : `/${path}`;
	return `${normalized}${suffix}`;
}
