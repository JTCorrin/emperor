import { PUBLIC_MEDIA_SERVER_URL } from '$env/static/public';
import { normalizeBaseUrl } from '$lib/api/url';

/** Default LAN media-server used when PUBLIC_MEDIA_SERVER_URL is unset. */
export const DEFAULT_DEV_BASE_URL = 'http://192.168.5.111:8080';

/**
 * Media-server base URL baked in at build time.
 * Prefer PUBLIC_MEDIA_SERVER_URL; fall back to the documented LAN default.
 */
export function getMediaServerBaseUrl(): string {
	const raw =
		typeof PUBLIC_MEDIA_SERVER_URL === 'string' && PUBLIC_MEDIA_SERVER_URL.trim()
			? PUBLIC_MEDIA_SERVER_URL.trim()
			: DEFAULT_DEV_BASE_URL;
	return normalizeBaseUrl(raw);
}
